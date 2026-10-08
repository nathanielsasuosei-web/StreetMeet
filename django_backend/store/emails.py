from django.conf import settings
from django.core import signing
from django.core.mail import EmailMultiAlternatives
from django.urls import reverse
from django.utils import timezone
from django.contrib.auth import get_user_model

DOWNLOAD_SALT = 'kairo-beat-download-v1'
DOWNLOAD_MAX_AGE = 60 * 60 * 24 * 7


def signed_download_url(order):
    token = signing.dumps({'order_id': str(order.pk)}, salt=DOWNLOAD_SALT)
    relative_url = reverse('store:download-beat', kwargs={'token': token})
    return f'{settings.SITE_URL}{relative_url}'


def send_order_emails(order):
    """Send buyer receipt/download and producer notification once per paid order."""
    if order.status != order.Status.PAID or order.email_sent_at:
        return

    download_url = signed_download_url(order)
    buyer_subject = f'Your beat is ready: {order.beat.title}'
    buyer_body = (
        f'Hi {order.user.get_full_name() or order.user.email},\n\n'
        f'Thanks for licensing “{order.beat.title}”. Your order {order.payment_reference} is confirmed.\n\n'
        f'Download your beat (link expires in 7 days):\n{download_url}\n\n'
        'Please save the file somewhere safe. Your purchase includes the artist license shown at checkout.\n\n'
        'Keep making good things,\nKAIRO Beats'
    )
    EmailMultiAlternatives(
        subject=buyer_subject,
        body=buyer_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[order.user.email],
    ).send(fail_silently=False)
    order.email_sent_at = timezone.now()
    order.save(update_fields=['email_sent_at'])

    if settings.ADMIN_NOTIFICATION_EMAIL:
        admin_body = (
            f'New paid order {order.payment_reference}\n'
            f'Artist: {order.user.get_full_name() or order.user.email} ({order.user.email})\n'
            f'Beat: {order.beat.title}\n'
            f'Total: {order.currency} {order.amount}\n'
            f'Method: {order.get_payment_method_display()}\n'
        )
        EmailMultiAlternatives(
            subject=f'New KAIRO order: {order.beat.title}',
            body=admin_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[settings.ADMIN_NOTIFICATION_EMAIL],
        ).send(fail_silently=False)



def send_studio_update(subject, body):
    """Send a producer-authored email update to active artist accounts."""
    user_model = get_user_model()
    recipients = list(user_model.objects.filter(is_active=True).exclude(email='').values_list('email', flat=True).distinct())
    if not recipients:
        return 0
    messages = [
        EmailMultiAlternatives(
            subject=subject,
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[address],
        )
        for address in recipients
    ]
    # Send sequentially so the number of recipients and failures remain observable.
    sent = 0
    for message in messages:
        sent += message.send(fail_silently=False)
    return sent
