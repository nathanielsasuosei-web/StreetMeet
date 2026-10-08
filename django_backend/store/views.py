import hashlib
import hmac
import json
import logging
import mimetypes
from decimal import Decimal, InvalidOperation
from pathlib import Path, PurePosixPath

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core import signing
from django.core.exceptions import ValidationError
from django.core.files.storage import default_storage
from django.core.validators import URLValidator
from django.http import FileResponse, Http404, JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt, csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from django.db import transaction

from .emails import DOWNLOAD_MAX_AGE, DOWNLOAD_SALT, send_order_emails, send_studio_update
from .models import Beat, Order, Video
from .payments import PaymentGatewayError, initialize_paystack_order, verify_paystack_transaction

logger = logging.getLogger(__name__)
User = get_user_model()


def _json_body(request):
    try:
        value = json.loads(request.body or '{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None
    return value if isinstance(value, dict) else None


def _error(message, status=400, **extra):
    return JsonResponse({'error': message, **extra}, status=status)


def _user_payload(user):
    return {
        'id': user.pk,
        'name': user.get_full_name() or user.username,
        'email': user.email,
        'is_staff': user.is_staff,
    }


def _beat_payload(beat, request=None):
    # Only the producer-supplied preview is public. The licensed master is served
    # exclusively by the signed, paid-order download endpoint.
    audio_url = beat.preview_file.url if beat.preview_file else ''
    cover_url = beat.cover_image.url if beat.cover_image else ''
    return {
        'id': str(beat.pk),
        'title': beat.title,
        'description': beat.description,
        'genre': beat.genre,
        'price': str(beat.price),
        'bpm': beat.bpm or 100,
        'key': beat.musical_key or 'C minor',
        'tag': beat.tag,
        'artwork': 'art-upload-1',
        'coverLine': 'ORIGINAL PRODUCTION',
        'audioUrl': audio_url,
        'audioName': Path(beat.preview_file.name).name if beat.preview_file else '',
        'hasAudio': bool(beat.audio_file),
        'coverUrl': cover_url,
        'createdAt': beat.created_at.isoformat(),
    }


def _video_payload(video):
    return {
        'id': str(video.pk),
        'title': video.title,
        'detail': video.description,
        'duration': 'NEW',
        'poster': 'poster-upload',
        'mediaUrl': video.video_file.url if video.video_file else '',
        'videoUrl': video.video_url,
        'fileName': Path(video.video_file.name).name if video.video_file else '',
        'createdAt': video.created_at.isoformat(),
    }


def _order_payload(order):
    payload = {
        'id': order.payment_reference,
        'orderId': str(order.pk),
        'beatId': str(order.beat_id),
        'title': order.beat.title,
        'price': str(order.amount),
        'email': order.user.email,
        'customer': order.user.get_full_name() or order.user.username,
        'method': order.get_payment_method_display(),
        'paidAt': (order.paid_at or order.created_at).isoformat(),
        'status': order.get_status_display(),
    }
    if order.status == Order.Status.PAID:
        from .emails import signed_download_url
        payload['downloadUrl'] = signed_download_url(order)
    return payload


@require_GET
@ensure_csrf_cookie
def csrf_token(request):
    return JsonResponse({'csrfToken': get_token(request)})


@require_GET
def health(request):
    return JsonResponse({'app': 'KAIRO Beats API', 'status': 'ok', 'payments': 'configured' if settings.PAYSTACK_SECRET_KEY else 'demo'})


@require_GET
def beat_list(request):
    return JsonResponse([_beat_payload(beat) for beat in Beat.objects.filter(is_published=True)], safe=False)


@require_GET
def video_list(request):
    return JsonResponse([_video_payload(video) for video in Video.objects.filter(is_published=True)], safe=False)


@require_GET
def public_media(request, path):
    """Serve previews and public video only; private beat masters stay protected."""
    normalized = PurePosixPath(path)
    allowed_prefixes = ('beats/previews/', 'beats/covers/', 'videos/')
    if '..' in normalized.parts or not normalized.as_posix().startswith(allowed_prefixes):
        raise Http404('Media not found.')
    try:
        media_file = default_storage.open(normalized.as_posix(), 'rb')
    except (FileNotFoundError, OSError, ValueError) as error:
        raise Http404('Media not found.') from error
    content_type = mimetypes.guess_type(normalized.name)[0] or 'application/octet-stream'
    return FileResponse(media_file, content_type=content_type)


@require_GET
def current_artist(request):
    if not request.user.is_authenticated:
        return JsonResponse({'authenticated': False})
    return JsonResponse({'authenticated': True, 'user': _user_payload(request.user)})


@require_POST
@csrf_protect
def artist_signup(request):
    data = _json_body(request)
    if data is None:
        return _error('Send a valid JSON request.')
    name = str(data.get('name', '')).strip()
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))
    if len(name) < 2 or len(name) > 150:
        return _error('Enter your name (2–150 characters).')
    if '@' not in email or len(email) > 254:
        return _error('Enter a valid email address.')
    if User.objects.filter(email__iexact=email).exists():
        return _error('An account with this email already exists. Sign in instead.', 409)
    candidate = User(username=email, email=email, first_name=name)
    try:
        validate_password(password, user=candidate)
    except ValidationError as error:
        return _error(' '.join(error.messages))
    user = User.objects.create_user(username=email, email=email, first_name=name, password=password)
    login(request, user)
    return JsonResponse({'user': _user_payload(user)}, status=201)


@require_POST
@csrf_protect
def artist_login(request):
    data = _json_body(request)
    if data is None:
        return _error('Send a valid JSON request.')
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))
    user = authenticate(request, username=email, password=password)
    if not user:
        return _error('Email or password is incorrect.', 401)
    login(request, user)
    return JsonResponse({'user': _user_payload(user)})


@require_POST
@csrf_protect
def artist_logout(request):
    logout(request)
    return JsonResponse({'ok': True})


@require_GET
def my_orders(request):
    if not request.user.is_authenticated:
        return _error('Sign in to view your orders.', 401)
    orders = Order.objects.all().select_related('beat', 'user')
    if not request.user.is_staff:
        orders = orders.filter(user=request.user)
    return JsonResponse([_order_payload(order) for order in orders], safe=False)


def _payment_amount_minor(order):
    return int((Decimal(order.amount) * Decimal('100')).quantize(Decimal('1')))


def _finish_paid_order(order, payment_data):
    with transaction.atomic():
        locked = Order.objects.select_for_update().select_related('user', 'beat').get(pk=order.pk)
        if locked.status != Order.Status.PAID:
            locked.status = Order.Status.PAID
            locked.paid_at = timezone.now()
            locked.gateway_transaction_id = str(payment_data.get('id', ''))[:64]
            locked.payment_metadata = {
                'channel': payment_data.get('channel', ''),
                'gateway_status': payment_data.get('status', ''),
            }
            locked.save(update_fields=['status', 'paid_at', 'gateway_transaction_id', 'payment_metadata'])
        order = locked
        order_id = order.pk

        def deliver_receipts():
            try:
                send_order_emails(Order.objects.select_related('user', 'beat').get(pk=order_id))
            except Exception:  # Payment is still valid if SMTP is temporarily unavailable.
                logger.exception('Receipt email failed for paid order %s', order_id)

        if not locked.email_sent_at:
            transaction.on_commit(deliver_receipts)
    return order


@require_POST
@csrf_protect
def initialize_checkout(request):
    if not request.user.is_authenticated:
        return _error('Create an artist account before checkout.', 401)
    data = _json_body(request)
    if data is None:
        return _error('Send a valid JSON request.')
    beat_id = str(data.get('beat_id', '')).strip()
    method = str(data.get('payment_method', '')).strip()
    if method not in (Order.Method.MOBILE_MONEY, Order.Method.BANK):
        return _error('Choose mobile money or bank/card payment.')
    beat = get_object_or_404(Beat, pk=beat_id, is_published=True)
    order = Order.objects.create(
        user=request.user,
        beat=beat,
        amount=beat.price,
        currency=settings.PAYSTACK_CURRENCY,
        payment_method=method,
        payment_metadata={'phone': str(data.get('phone', '')).strip()[:24]},
    )

    if not settings.PAYSTACK_SECRET_KEY:
        if settings.DEBUG and settings.PAYMENTS_DEMO_MODE:
            order.status = Order.Status.DEMO
            order.save(update_fields=['status'])
            return JsonResponse({'mode': 'demo', 'order': _order_payload(order), 'message': 'No real payment was taken.'})
        order.status = Order.Status.FAILED
        order.save(update_fields=['status'])
        return _error('Payment processing is not configured. Please contact the producer.', 503)

    try:
        result = initialize_paystack_order(order, phone=str(data.get('phone', '')).strip())
    except PaymentGatewayError as error:
        order.status = Order.Status.FAILED
        order.save(update_fields=['status'])
        return _error(str(error), 502)

    order.payment_metadata = {**order.payment_metadata, 'access_code': result.get('access_code', '')}
    order.save(update_fields=['payment_metadata'])
    return JsonResponse({
        'mode': 'gateway',
        'authorization_url': result.get('authorization_url', ''),
        'reference': order.payment_reference,
        'order_id': str(order.pk),
    })


def _verified_order_for_reference(reference, user=None):
    query = Order.objects.select_related('user', 'beat')
    if user is not None:
        query = query.filter(user=user)
    return get_object_or_404(query, payment_reference=reference)


def _validate_gateway_result(order, payment_data):
    try:
        amount = int(payment_data.get('amount', -1))
    except (TypeError, ValueError):
        return False
    return (
        payment_data.get('status') == 'success'
        and payment_data.get('reference') == order.payment_reference
        and payment_data.get('currency') == order.currency
        and amount == _payment_amount_minor(order)
    )


@require_GET
def verify_checkout(request):
    if not request.user.is_authenticated:
        return _error('Sign in again to confirm this order.', 401)
    reference = str(request.GET.get('reference', '')).strip()
    if not reference:
        return _error('Missing payment reference.')
    order = _verified_order_for_reference(reference, user=request.user)
    if order.status == Order.Status.DEMO:
        return _error('This was a demo order; no payment was processed.', 409)
    try:
        payment_data = verify_paystack_transaction(reference)
    except PaymentGatewayError as error:
        return _error(str(error), 502)
    if not _validate_gateway_result(order, payment_data):
        return _error('The payment has not been verified. Your order remains pending.', 409, status='pending')
    order = _finish_paid_order(order, payment_data)
    order.refresh_from_db(fields=['email_sent_at'])
    from .emails import signed_download_url
    return JsonResponse({
        'order': _order_payload(order),
        'download_url': signed_download_url(order),
        'audio_name': Path(order.beat.audio_file.name).name,
        'email_sent': bool(order.email_sent_at),
    })


@csrf_exempt
@require_POST
def paystack_webhook(request):
    if not settings.PAYSTACK_SECRET_KEY:
        return _error('Webhook is not configured.', 503)
    signature = request.headers.get('x-paystack-signature', '')
    expected = hmac.new(settings.PAYSTACK_SECRET_KEY.encode(), request.body, hashlib.sha512).hexdigest()
    if not signature or not hmac.compare_digest(signature, expected):
        return _error('Invalid webhook signature.', 401)
    try:
        event = json.loads(request.body.decode('utf-8'))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return _error('Invalid webhook payload.')
    if event.get('event') != 'charge.success':
        return JsonResponse({'ok': True, 'ignored': True})
    reference = str((event.get('data') or {}).get('reference', '')).strip()
    if not reference:
        return _error('Missing payment reference.')
    try:
        order = _verified_order_for_reference(reference)
        payment_data = verify_paystack_transaction(reference)
    except (PaymentGatewayError, Http404) as error:
        logger.warning('Could not verify Paystack webhook for %s: %s', reference, error)
        return _error('Unable to verify this payment right now.', 503)
    if _validate_gateway_result(order, payment_data):
        _finish_paid_order(order, payment_data)
        return JsonResponse({'ok': True})
    return _error('Payment details did not match this order.', 400)


@require_GET
def download_beat(request, token):
    try:
        payload = signing.loads(token, salt=DOWNLOAD_SALT, max_age=DOWNLOAD_MAX_AGE)
    except signing.SignatureExpired as error:
        raise Http404('This download link has expired. Contact the producer for a new one.') from error
    except signing.BadSignature as error:
        raise Http404('This download link is invalid.') from error
    order = get_object_or_404(Order.objects.select_related('beat'), pk=payload.get('order_id'), status=Order.Status.PAID)
    if not order.beat.audio_file:
        raise Http404('No audio file is attached to this beat.')
    filename = Path(order.beat.audio_file.name).name
    return FileResponse(order.beat.audio_file.open('rb'), as_attachment=True, filename=filename)


def _require_staff(request):
    return request.user.is_authenticated and request.user.is_staff


def _uploaded_file_error(upload, *, allowed_extensions, max_size):
    if upload is None:
        return 'Choose a file to upload.'
    if upload.size > max_size:
        return f'File is too large (maximum {max_size // (1024 * 1024)} MB).'
    extension = Path(upload.name).suffix.lower()
    if extension not in allowed_extensions:
        return f'Unsupported file type: {extension or "unknown"}.'
    return ''


@require_POST
@csrf_protect
def admin_create_beat(request):
    if not _require_staff(request):
        return _error('Producer admin sign-in is required.', 403)
    audio = request.FILES.get('audio_file')
    file_error = _uploaded_file_error(
        audio,
        allowed_extensions={'.mp3', '.wav', '.aiff', '.aif', '.m4a', '.ogg', '.flac'},
        max_size=120 * 1024 * 1024,
    )
    if file_error:
        return _error(file_error)
    preview = request.FILES.get('preview_file')
    if preview:
        preview_error = _uploaded_file_error(
            preview,
            allowed_extensions={'.mp3', '.wav', '.aiff', '.aif', '.m4a', '.ogg', '.flac'},
            max_size=30 * 1024 * 1024,
        )
        if preview_error:
            return _error(f'Preview: {preview_error}')
    title = str(request.POST.get('title', '')).strip()
    if len(title) < 2 or len(title) > 160:
        return _error('Enter a beat title (2–160 characters).')
    try:
        price = Decimal(request.POST.get('price', '0'))
        bpm = int(request.POST.get('bpm', '100'))
    except (InvalidOperation, ValueError):
        return _error('Enter a valid price and tempo.')
    if price <= 0 or price > Decimal('100000') or bpm < 40 or bpm > 240:
        return _error('Price must be positive and tempo must be between 40 and 240 BPM.')
    beat = Beat.objects.create(
        title=title,
        description=str(request.POST.get('description', '')).strip()[:5000],
        genre=str(request.POST.get('genre', 'Afrobeats')).strip()[:60] or 'Afrobeats',
        price=price,
        bpm=bpm,
        musical_key=str(request.POST.get('musical_key', 'C minor')).strip()[:24],
        tag='JUST ADDED',
        audio_file=audio,
        preview_file=preview or '',
        cover_image=request.FILES.get('cover_image') or '',
    )
    return JsonResponse(_beat_payload(beat), status=201)


@require_POST
@csrf_protect
def admin_unpublish_beat(request, beat_id):
    if not _require_staff(request):
        return _error('Producer admin sign-in is required.', 403)
    beat = get_object_or_404(Beat, pk=beat_id)
    beat.is_published = False
    beat.save(update_fields=['is_published'])
    return JsonResponse({'ok': True})


@require_POST
@csrf_protect
def admin_create_video(request):
    if not _require_staff(request):
        return _error('Producer admin sign-in is required.', 403)
    video = request.FILES.get('video_file')
    video_url = str(request.POST.get('video_url', '')).strip()
    if video:
        file_error = _uploaded_file_error(
            video,
            allowed_extensions={'.mp4', '.mov', '.webm', '.m4v', '.ogv'},
            max_size=200 * 1024 * 1024,
        )
        if file_error:
            return _error(file_error)
    elif not video_url:
        return _error('Choose a video file or provide a hosted video URL.')
    if video_url:
        try:
            URLValidator(schemes=['https'])(video_url)
        except ValidationError:
            return _error('Video links must use HTTPS.')
    title = str(request.POST.get('title', '')).strip()
    if len(title) < 2 or len(title) > 160:
        return _error('Enter a video title (2–160 characters).')
    video_obj = Video.objects.create(
        title=title,
        description=str(request.POST.get('detail', '')).strip()[:5000],
        video_file=video or '',
        video_url=video_url,
    )
    return JsonResponse(_video_payload(video_obj), status=201)


@require_POST
@csrf_protect
def admin_unpublish_video(request, video_id):
    if not _require_staff(request):
        return _error('Producer admin sign-in is required.', 403)
    video = get_object_or_404(Video, pk=video_id)
    video.is_published = False
    video.save(update_fields=['is_published'])
    return JsonResponse({'ok': True})


@require_POST
@csrf_protect
def admin_send_update(request):
    if not _require_staff(request):
        return _error('Producer admin sign-in is required.', 403)
    data = _json_body(request)
    if data is None:
        return _error('Send a valid JSON request.')
    subject = str(data.get('subject', '')).strip()
    body = str(data.get('body', '')).strip()
    if not subject or not body or len(subject) > 160 or len(body) > 5000:
        return _error('Add a subject and message (maximum 5,000 characters).')
    try:
        recipients = send_studio_update(subject, body)
    except Exception:
        logger.exception('Studio update email failed')
        return _error('Email delivery failed. Check the SMTP configuration and try again.', 502)
    return JsonResponse({'ok': True, 'recipients': recipients})
