import json
from decimal import Decimal
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.core import mail, signing
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse

from .emails import DOWNLOAD_SALT
from .models import Beat, Order, Video

User = get_user_model()


class StoreApiTests(TestCase):
    def setUp(self):
        self.artist = User.objects.create_user(
            username='artist@example.com',
            email='artist@example.com',
            password='SafePassphrase-8264',
            first_name='Artist One',
        )
        self.beat = Beat.objects.create(
            title='Late Train',
            genre='Afrobeats',
            price=Decimal('250.00'),
            audio_file='beats/private/late-train.wav',
            preview_file='beats/previews/late-train-preview.wav',
            bpm=98,
            musical_key='C minor',
        )

    def test_public_catalog_only_exposes_the_preview_path(self):
        response = self.client.get('/api/beats/')
        self.assertEqual(response.status_code, 200)
        payload = response.json()[0]
        self.assertEqual(payload['title'], 'Late Train')
        self.assertTrue(payload['audioUrl'].startswith('/media/beats/previews/'))
        self.assertNotIn('private/late-train', payload['audioUrl'])
        self.assertTrue(payload['hasAudio'])

    def test_private_master_cannot_be_served_from_public_media_route(self):
        response = self.client.get('/media/beats/private/late-train.wav')
        self.assertEqual(response.status_code, 404)

    def test_artist_signup_hashes_password_and_logs_in(self):
        response = self.client.post(
            '/api/auth/signup/',
            data=json.dumps({'name': 'New Artist', 'email': 'new@example.com', 'password': 'Long-Good-Passphrase-34'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201)
        created = User.objects.get(email='new@example.com')
        self.assertTrue(created.check_password('Long-Good-Passphrase-34'))
        self.assertNotEqual(created.password, 'Long-Good-Passphrase-34')
        self.assertEqual(response.json()['user']['email'], 'new@example.com')

    @override_settings(DEBUG=True, PAYMENTS_DEMO_MODE=True, PAYSTACK_SECRET_KEY='')
    def test_checkout_without_gateway_creates_demo_order_not_paid_order(self):
        self.client.force_login(self.artist)
        response = self.client.post(
            '/api/checkout/initialize/',
            data=json.dumps({'beat_id': self.beat.pk, 'payment_method': 'mobile_money', 'phone': '0240000000'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['mode'], 'demo')
        order = Order.objects.get(user=self.artist, beat=self.beat)
        self.assertEqual(order.status, Order.Status.DEMO)
        self.assertEqual(order.amount, Decimal('250.00'))

    @override_settings(
        PAYSTACK_SECRET_KEY='test_paystack_key',
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
        DEFAULT_FROM_EMAIL='KAIRO Test <studio@example.test>',
        SITE_URL='https://kairo.example.test',
    )
    @patch('store.views.verify_paystack_transaction')
    def test_verified_payment_marks_order_paid_and_emails_signed_download(self, verify):
        self.client.force_login(self.artist)
        order = Order.objects.create(
            user=self.artist,
            beat=self.beat,
            amount=Decimal('250.00'),
            currency='GHS',
            payment_method=Order.Method.MOBILE_MONEY,
        )
        verify.return_value = {
            'status': 'success',
            'reference': order.payment_reference,
            'currency': 'GHS',
            'amount': 25000,
            'id': 987654,
            'channel': 'mobile_money',
        }
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.get('/api/payments/verify/', {'reference': order.payment_reference})
        self.assertEqual(response.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PAID)
        self.assertIsNotNone(order.email_sent_at)
        self.assertIn('/api/download/', response.json()['download_url'])
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(response.json()['download_url'], mail.outbox[0].body)

    def test_artist_cannot_upload_server_beats(self):
        self.client.force_login(self.artist)
        response = self.client.post('/api/admin/beats/', data={
            'title': 'Unauthorized upload',
            'price': '300',
            'bpm': '100',
            'genre': 'Afrobeats',
            'musical_key': 'A minor',
            'audio_file': SimpleUploadedFile('master.wav', b'RIFF0000WAVE', content_type='audio/wav'),
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(Beat.objects.count(), 1)

    def test_staff_can_upload_master_and_preview(self):
        producer = User.objects.create_superuser(
            username='producer@example.com',
            email='producer@example.com',
            password='Admin-Only-Passphrase-346',
        )
        self.client.force_login(producer)
        response = self.client.post('/api/admin/beats/', data={
            'title': 'Orange Lines',
            'price': '320.00',
            'bpm': '112',
            'genre': 'R&B / Alté',
            'musical_key': 'F minor',
            'audio_file': SimpleUploadedFile('orange-lines-master.wav', b'RIFF0000WAVE', content_type='audio/wav'),
            'preview_file': SimpleUploadedFile('orange-lines-preview.wav', b'RIFF0000WAVE', content_type='audio/wav'),
        })
        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload['title'], 'Orange Lines')
        self.assertTrue(payload['audioUrl'].startswith('/media/beats/previews/'))
        self.assertNotIn('/private/', payload['audioUrl'])
        self.assertEqual(Beat.objects.count(), 2)

    def test_preview_file_is_optional_for_master_uploads(self):
        producer = User.objects.create_superuser(
            username='producer2@example.com',
            email='producer2@example.com',
            password='Another-Admin-Passphrase-782',
        )
        self.client.force_login(producer)
        response = self.client.post('/api/admin/beats/', data={
            'title': 'Master Only',
            'price': '280.00',
            'bpm': '100',
            'genre': 'Afrobeats',
            'musical_key': 'A minor',
            'audio_file': SimpleUploadedFile('master-only.wav', b'RIFF0000WAVE', content_type='audio/wav'),
        })
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['audioUrl'], '')
        self.assertTrue(response.json()['hasAudio'])

    def test_staff_can_add_https_hosted_video_without_upload(self):
        producer = User.objects.create_superuser(
            username='producer-video@example.com',
            email='producer-video@example.com',
            password='Video-Admin-Passphrase-482',
        )
        self.client.force_login(producer)
        response = self.client.post('/api/admin/videos/', data={
            'title': 'Studio story',
            'detail': 'A short session cut.',
            'video_url': 'https://media.example.test/studio.mp4',
        })
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['videoUrl'], 'https://media.example.test/studio.mp4')
        self.assertEqual(Video.objects.count(), 1)

    def test_download_requires_a_paid_order_and_valid_signature(self):
        order = Order.objects.create(
            user=self.artist,
            beat=self.beat,
            amount=self.beat.price,
            currency='GHS',
            payment_method=Order.Method.BANK,
            status=Order.Status.DEMO,
        )
        token = signing.dumps({'order_id': str(order.pk)}, salt=DOWNLOAD_SALT)
        response = self.client.get(reverse('store:download-beat', kwargs={'token': token}))
        self.assertEqual(response.status_code, 404)

    @override_settings(PAYSTACK_SECRET_KEY='test_webhook_key')
    def test_webhook_rejects_an_invalid_signature(self):
        response = self.client.post(
            '/api/payments/paystack/webhook/',
            data=json.dumps({'event': 'charge.success', 'data': {'reference': 'bad'}}),
            content_type='application/json',
            HTTP_X_PAYSTACK_SIGNATURE='invalid',
        )
        self.assertEqual(response.status_code, 401)
