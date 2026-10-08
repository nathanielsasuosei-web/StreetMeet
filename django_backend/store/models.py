import secrets
from django.conf import settings
from django.db import models


def make_payment_reference():
    return f'KAIRO-{secrets.token_hex(6).upper()}'


class Beat(models.Model):
    title = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    genre = models.CharField(max_length=60, default='Afrobeats')
    price = models.DecimalField(max_digits=10, decimal_places=2)
    audio_file = models.FileField(upload_to='beats/private/%Y/%m/')
    preview_file = models.FileField(upload_to='beats/previews/%Y/%m/', blank=True)
    cover_image = models.FileField(upload_to='beats/covers/%Y/%m/', blank=True)
    bpm = models.PositiveSmallIntegerField(null=True, blank=True)
    musical_key = models.CharField(max_length=24, blank=True)
    tag = models.CharField(max_length=36, blank=True)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class Video(models.Model):
    title = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    video_file = models.FileField(upload_to='videos/%Y/%m/', blank=True)
    video_url = models.URLField(blank=True)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        PAID = 'PAID', 'Paid'
        FAILED = 'FAILED', 'Failed'
        DEMO = 'DEMO', 'Demo only'

    class Method(models.TextChoices):
        MOBILE_MONEY = 'mobile_money', 'Mobile money'
        BANK = 'bank', 'Bank / card'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='beat_orders')
    beat = models.ForeignKey(Beat, on_delete=models.PROTECT, related_name='orders')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='GHS')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    payment_method = models.CharField(max_length=24, choices=Method.choices)
    payment_reference = models.CharField(max_length=64, unique=True, default=make_payment_reference)
    gateway_transaction_id = models.CharField(max_length=64, blank=True)
    payment_metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    email_sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.payment_reference} · {self.user} · {self.beat}'
