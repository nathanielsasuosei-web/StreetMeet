from decimal import Decimal
import requests
from django.conf import settings


class PaymentGatewayError(Exception):
    """A safe, user-facing Paystack integration error."""


def paystack_request(path, *, method='GET', payload=None):
    if not settings.PAYSTACK_SECRET_KEY:
        raise PaymentGatewayError('Paystack is not configured. Add PAYSTACK_SECRET_KEY on the server.')

    try:
        response = requests.request(
            method,
            f'{settings.PAYSTACK_BASE_URL}{path}',
            json=payload,
            headers={'Authorization': f'Bearer {settings.PAYSTACK_SECRET_KEY}', 'Content-Type': 'application/json'},
            timeout=20,
        )
        data = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise PaymentGatewayError('Could not reach the payment provider. Please try again.') from exc

    if not response.ok or not data.get('status'):
        message = data.get('message') if isinstance(data, dict) else None
        raise PaymentGatewayError(message or 'The payment provider rejected the request.')
    return data.get('data') or {}


def initialize_paystack_order(order, *, phone=''):
    channels = (
        settings.PAYSTACK_MOMO_CHANNELS
        if order.payment_method == order.Method.MOBILE_MONEY
        else settings.PAYSTACK_BANK_CHANNELS
    )
    amount_minor = int((Decimal(order.amount) * Decimal('100')).quantize(Decimal('1')))
    payload = {
        'email': order.user.email,
        'amount': amount_minor,
        'currency': order.currency,
        'reference': order.payment_reference,
        'callback_url': f'{settings.FRONTEND_URL}/?payment_return=1',
        'channels': channels,
        'metadata': {
            'order_id': str(order.pk),
            'beat_id': str(order.beat_id),
            'beat_title': order.beat.title,
            'payment_method': order.payment_method,
            'phone': phone[:24] if phone else '',
        },
    }
    return paystack_request('/transaction/initialize', method='POST', payload=payload)


def verify_paystack_transaction(reference):
    return paystack_request(f'/transaction/verify/{reference}')
