# KAIRO Beats Django API

This backend provides real server-side artist accounts, producer-controlled media uploads, order records and Paystack checkout verification for the React storefront. It uses Django's built-in session authentication and admin, SQLite for local development and can be configured for PostgreSQL.

## Local setup

```bash
cd django_backend
python -m venv .venv
source .venv/bin/activate             # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

In another terminal, run the storefront from `website/` with `npm run dev`. Vite proxies `/api/`, `/admin/` and `/media/` to this Django service so the browser uses same-origin relative URLs.

Visit `/admin/` to upload beats and videos and review orders. Create the Django superuser with an email address: that address is used for the producer's order notification if `ADMIN_NOTIFICATION_EMAIL` is set.

## Payment and fulfillment

The default integration is Paystack with `GHS` amounts sent in pesewas. `PAYSTACK_SECRET_KEY` stays on the server. Checkout creates a pending order; the user is redirected to Paystack; the return endpoint verifies the transaction's reference, status, amount and currency; the webhook also validates Paystack's HMAC signature and verifies the transaction server-to-server. A successful order triggers a buyer receipt with a signed, seven-day download URL and an optional producer notification. Repeated webhook deliveries do not send a second receipt.

For the local preview, no key is required: with `DJANGO_DEBUG=true` and `PAYMENTS_DEMO_MODE=true`, the checkout API creates a clearly marked `DEMO` order without collecting money or sending a receipt. Never enable demo mode for production. Available Paystack channels vary by market/account; tune `PAYSTACK_MOMO_CHANNELS` and `PAYSTACK_BANK_CHANNELS` to the channels enabled for your merchant.

Email prints to the Django console unless `EMAIL_HOST`, `EMAIL_HOST_USER` and `EMAIL_HOST_PASSWORD` are configured. Studio updates can be sent from the producer console only by an authenticated staff user.

## Production checklist

- Set a long random `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=false`, explicit `DJANGO_ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, and production `SITE_URL` / `FRONTEND_URL`.
- Configure PostgreSQL (`DB_ENGINE=django.db.backends.postgresql` plus `DB_*`) and install `psycopg[binary]`.
- Configure Paystack live/test credentials in the hosting provider's secret manager and register `/api/payments/paystack/webhook/` as the webhook URL over HTTPS.
- Configure SMTP and `ADMIN_NOTIFICATION_EMAIL`.
- Move uploaded media and paid beat masters to private object storage; serve paid downloads through a signed/protected endpoint. Local `MEDIA_ROOT` is for development only.
- Configure HTTPS, backups, logging, upload limits, antivirus/media validation, and monitoring before accepting real purchases.

No payment credentials, email credentials or generated database/media files belong in Git.
