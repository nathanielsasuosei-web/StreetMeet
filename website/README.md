# KAIRO Beats storefront

A responsive React/Vite storefront for a beat producer, paired with the Django service in `../django_backend`. It includes the animated hero, beat catalogue and audio previews, artist accounts, producer uploads, payment checkout, purchase history and email updates.

## Run with the Django backend

Terminal 1:

```bash
cd ../django_backend
python3 -m venv .venv
source .venv/bin/activate             # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

Terminal 2:

```bash
cd website
npm install
npm run dev
```

Vite proxies `/api/`, `/admin/` and public preview/video media to Django. Sign in at `/admin/` with the superuser to upload masters, optional public preview clips and videos, and review orders. The React producer console links to Django admin. Public catalogue responses expose only preview files; purchased master files are downloaded through signed links after a verified paid order.

## Preview without Django

`npm run dev` still shows a browser-only preview if Django is not running. Local uploads and demo orders stay in that browser, and do not process payments or send emails. With Django running but without `PAYSTACK_SECRET_KEY`, checkout creates a clearly marked `DEMO` order in development.

## Turning on live services

Configure the environment variables in `django_backend/.env.example`: Paystack secret key, enabled payment channels, HTTPS site URLs, SMTP settings and the producer notification email. Register `/api/payments/paystack/webhook/` with Paystack. The backend verifies the transaction server-to-server and checks its status, reference, amount and currency before marking an order paid and emailing a signed seven-day download link. Paystack payment channels differ by merchant market; confirm the enabled MoMo/bank/card channels in the merchant dashboard.

For production, use PostgreSQL, set `DJANGO_DEBUG=false` and a strong secret, deploy behind HTTPS, and move media to private/object storage. Configure a public CDN/object bucket for previews and videos separately from protected beat masters. Never commit `.env`, database files, private beat files, or gateway/email secrets.
