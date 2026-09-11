# Mobile money — 20p, 50p and 100p plans

natthesisa collects money with **Hubtel Ghana** or **Paystack Ghana**. Both talk to
MTN MoMo, Vodafone Cash and AirtelTigo Money. You switch between them with one
environment variable — no code change.

---

## 1. The plans

Plans live in the database (`plans` table), so you can change prices without deploying:

| Code | Name | Pesewas | GHS | Duration |
| --- | --- | --- | --- | --- |
| `spark` | Spark | 20 | GH¢0.20 | 1 day |
| `boost` | Boost | 50 | GH¢0.50 | 7 days |
| `gold` | Gold | 100 | GH¢1.00 | 30 days |

Created by `backend/src/db/seed.js`. Edit there, re-run `npm run seed`, or use the
admin endpoints (`POST /api/admin/plans`, `PATCH /api/admin/plans/:id`).

> **Always store money as an integer in the smallest unit** (`pricePesewas`), never as a
> float. `20` means 20 pesewas everywhere in the code; only the display layer divides by 100.

---

## 2. How a payment flows

```
App                    Your API                     Hubtel / Paystack        Phone
 │  POST /payments/initiate   │                            │                  │
 │───────────────────────────►│  charge()                  │                  │
 │                            │───────────────────────────►│  USSD prompt     │
 │                            │                            │─────────────────►│
 │  { reference, status:PENDING, instructions }            │                  │
 │◄───────────────────────────│                            │   user approves  │
 │  GET /payments/:ref (poll every 3s)                     │◄─────────────────│
 │───────────────────────────►│                            │                  │
 │                            │◄─── webhook: SUCCESS ──────│                  │
 │  { status: SUCCESS, user.isPremium: true }              │                  │
 │◄───────────────────────────│                            │                  │
```

1. **initiate** creates a `transactions` row in `PENDING` with a reference like
   `NTMTXKG66EEB4250` and calls the provider.
2. The provider sends a **prompt to the handset**; the customer enters their MoMo PIN
   (or dials a USSD code — the API returns `instructions` to show them).
3. The provider calls your **webhook**; on success the API extends `premiumUntil`.
4. The app **polls** `GET /api/payments/:reference` as a fallback (slow networks, closed app).

Idempotency: `settle()` refuses to credit the same reference twice, and
`premiumUntil` is *extended* from its current value, never overwritten.

---

## 3. Sandbox mode (no keys, no money)

```env
MOMO_PROVIDER=mock
```

`backend/src/services/payments/mock.js` behaves like a real provider:

- `charge()` returns `PENDING` with instructions
- `verify()` turns `SUCCESS` after 12 seconds
- `POST /api/payments/simulate {reference, outcome}` settles it immediately

The Premium screen shows an **"Approve in sandbox"** button when `provider === "mock"`.

---

## 4. Hubtel (Ghana)

### Get keys

1. Register a merchant account: <https://unity.hubtel.com> (or email support@hubtel.com).
2. Dashboard → **API accounts** → **Request for new API keys** → type **HTTP Rest API**.
3. Copy the **Client ID**, **Client Secret** and your **Account Number** (merchant number).

### Configure

```env
MOMO_PROVIDER=hubtel
HUBTEL_CLIENT_ID=xxxxxxxx
HUBTEL_CLIENT_SECRET=xxxxxxxx
HUBTEL_MERCHANT_ACCOUNT_NUMBER=2012345
HUBTEL_WEBHOOK_TOKEN=optional-secret
```

### What the code sends

`POST https://payproxyapi.hubtel.com/receive/initiate`
with `Authorization: Basic base64(ClientID:ClientSecret)`:

```json
{
  "CustomerName": "Kwame Mensah",
  "CustomerMsisdn": "233241112222",
  "CustomerEmail": "kwame@example.com",
  "Amount": 0.5,
  "Currency": "GHS",
  "Description": "Boost - natthesisa",
  "Channel": "mtn-gh",
  "ClientReference": "NTMTXKG66EEB4250",
  "PrimaryCallbackUrl": "https://api.natthesisa.app/api/payments/webhook/hubtel"
}
```

Channels: `mtn-gh`, `vodafone-gh`, `airtel-gh`. `Channel` is optional — Hubtel can detect
the network from the number, but passing it is faster.

`ResponseCode` `00` / `0000` means *the prompt was delivered* — the money is not in yet.
The webhook (`ClientReference`, `Status`) is what settles the transaction.

### Webhook

`POST /api/payments/webhook/hubtel`. The handler reads `ClientReference` + `Status`
(`Completed` / `Success` → SUCCESS). Add the token to the callback URL if you set
`HUBTEL_WEBHOOK_TOKEN`, e.g. `…/webhook/hubtel?token=xxxx`, and check it in the handler.

---

## 5. Paystack (Ghana)

### Get keys

1. Create a business on <https://paystack.com> (choose Ghana, currency GHS).
2. Complete verification (business documents, settlement account).
3. Settings → **API keys** → copy the **secret key** and **public key**.

### Configure

```env
MOMO_PROVIDER=paystack
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxx
```

### What the code sends

`POST https://api.paystack.co/charge` with `Authorization: Bearer sk_live_…`:

```json
{
  "amount": 50,
  "email": "kwame@example.com",
  "currency": "GHS",
  "reference": "NTMTXKG66EEB4250",
  "mobile_money": { "phone": "0241112222", "provider": "mtn" }
}
```

Providers: `mtn`, `vod`, `atl`. Amounts are in **pesewas** (Paystack, unlike Hubtel, wants
the minor unit). The response may contain `display_text` — a USSD code for the customer to
dial; the app shows it in `instructions`.

### Webhook

`POST /api/payments/webhook/paystack`. The handler recomputes
`HMAC-SHA512(rawBody, secretKey)` and compares it to the `x-paystack-signature` header;
anything else gets a 401. `charge.success` settles the plan.

---

## 6. Testing webhooks from your laptop

```bash
ngrok http 5000
# Forwarding https://a1b2-3c4d-56ef.ngrok-free.app -> http://localhost:5000
```

Paste `https://a1b2-3c4d-56ef.ngrok-free.app/api/payments/webhook/hubtel` (or
`…/paystack`) into the provider dashboard's callback/webhook field, then run a
sandbox payment. Watch the API log:

```
💚 Payment NTMTXKG66EEB4250 settled - kwame@example.com is premium until 2026-09-18T23:07:08.568Z
```

No ngrok? Cloudflare Tunnel: `cloudflared tunnel --url http://localhost:5000`.

---

## 7. Going live checklist

- [ ] Business registered, merchant account approved by Hubtel/Paystack
- [ ] `MOMO_PROVIDER` set to `hubtel` or `paystack` in production env vars
- [ ] Callback URL uses **https** and the **production** domain
- [ ] A live GHS 0.20 purchase end-to-end (use your own number)
- [ ] A failed/decline path tested (insufficient balance) → app shows a friendly error
- [ ] Webhook logs show `received: true` (200) — a non-200 makes providers retry
- [ ] Refund policy page published (providers and Google Play both require it)
- [ ] Prices shown in-app match the `plans` table

---

## 8. Adding another provider later

Create `backend/src/services/payments/yourprovider.js` exporting
`charge()`, `verify()`, `parseWebhook()` and `name`, then register it in
`backend/src/services/payments/index.js`:

```js
import * as yourprovider from "./yourprovider.js";
const providers = { mock, hubtel, paystack, yourprovider };
```

Nothing else in the codebase changes.

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| "Provider rejected the request" on initiate | Wrong keys, wrong channel, or the number is not MoMo-enabled | Check the dashboard logs; test with your own number |
| Payment stays `PENDING` forever | Webhook never arrived | ngrok for local; verify the callback URL in production; check the API logs |
| Paystack webhook returns 401 | Raw body was modified before the HMAC check | Do not add body parsers before the webhook route (`server.js` already handles this) |
| Hubtel says "invalid ClientReference" | Reference longer than 32 characters | The code already truncates to 32 — keep references short if you change the format |
| Amount rejected as too small | Some providers enforce a minimum (often GH¢0.10+) | Bundle plans (e.g. sell 5× Spark) or use the other provider |
