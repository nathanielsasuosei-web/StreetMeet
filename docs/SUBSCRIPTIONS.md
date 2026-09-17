# Module 3 — Subscriptions & payments (Paystack)

Third module of the StreetMeet rebuild: paid plans, Paystack checkout with
**Ghana Mobile Money and cards**, automatic activation on successful payment,
and expiry when the paid period ends. Runs on the same portable SQL layer as
modules 1–2 and is covered by `backend/scripts/smoke.js` (10 billing checks)
and `website/scripts/ui-smoke.mjs` (3 billing checks).

## 1. Requirement → implementation map

| Requirement | Where it lives |
| --- | --- |
| Free / Premium / VIP plans | `src/constants/billing.js` (catalogue + perk matrix) → `GET /api/billing/plans` → `website/src/pages/Premium.jsx` |
| Payments via Paystack | `src/services/paystack.js` (initialize / verify / webhook signature) → `src/services/billingService.js` |
| Ghana Mobile Money + cards | checkout accepts `channel: mobile_money \| card`; momo takes `provider` (mtn / telecel / at) + wallet `phone`; live mode forwards both channels to Paystack |
| Auto-activation after payment | `billingService.activateIfPaid` — verify → start the paid window immediately; also triggered by the signed `charge.success` webhook |
| Expiry at period end | read-time expiry (`planService.currentPlan`) **plus** an hourly sweeper (`expireStale`, started in `server.js`) that flips stale rows to `EXPIRED` |
| Premium perks (unlimited likes, advanced filters, messaging features) | enforced in `swipeService` (402 `LIKE_LIMIT_REACHED`), `discoverService` (402 `PLAN_REQUIRED`), `matchService` (read receipts hidden) |
| VIP extras (see who liked you, priority placement, badge) | `GET /api/discover/likes-you`, `is_vip DESC` deck ordering, `badge: "VIP"` on discover cards |

## 2. Plans & perks

| | **Free** | **Premium — GHS 49 / 30 days** | **VIP — GHS 99 / 30 days** |
| --- | --- | --- | --- |
| Matching & messaging | ✓ | ✓ | ✓ |
| Likes per day | 20 (`BILLING_FREE_LIKE_LIMIT`) | unlimited | unlimited |
| Advanced filters (interests, relationship goal) | — | ✓ | ✓ |
| Read receipts in conversations | — | ✓ | ✓ |
| See who liked you | — | — | ✓ |
| Priority placement in other people's decks | — | — | ✓ |
| VIP badge on your card | — | — | ✓ |

Entitlement checks funnel through `planService.requirePerk(userId, perk)`,
which answers `402 PLAN_REQUIRED` with a plan-aware message; the like budget
answers `402 LIKE_LIMIT_REACHED`. The free-tier budget counts likes since
UTC midnight (`swipeRepository.countLikesSince`), so it resets daily.

## 3. Data model (migration `0003_billing.sql`, both dialects)

* `subscriptions` — `id, user_id, plan (FREE|PREMIUM|VIP), status
  (PENDING|ACTIVE|EXPIRED|FAILED), reference (unique Paystack reference),
  channel, provider, phone, amount_pesewas, currency, started_at, expires_at,
  payload (JSON of the provider confirmation), created_at, updated_at`.
  Pending rows carry a far-future placeholder `expires_at` so the column stays
  `NOT NULL`; the API never exposes it (`expiresAt: null` until active).
* `users.subscription_active` (legacy boolean) is mirrored for backwards
  compatibility: `1` while an `ACTIVE` row exists.
* Amounts are stored in **pesewas** (GHS × 100) and surfaced as `amountGhs`.

Lifecycle: `PENDING` → (payment confirmed) → `ACTIVE` → (period ends) →
`EXPIRED`; failed charges become `FAILED`. Expiry is evaluated both lazily on
read and by the hourly sweeper.

## 4. API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/billing/plans` | catalogue + caller's `plan`, `perks`, `limits`, live `subscription` |
| `GET /api/billing/subscription` | current subscription + billing history |
| `POST /api/billing/checkout` | `{plan, channel, phone?, provider?}` → `201 {subscriptionId, reference, checkoutUrl, mode, amountGhs}` |
| `POST /api/billing/verify` | `{reference}` → confirm with Paystack, activate if paid |
| `POST /api/billing/mock-pay` | mock mode only: approve a pending charge like a wallet prompt would |
| `POST /api/billing/webhook` | Paystack events; `charge.success` activates the subscription |
| `GET /api/discover/likes-you` | VIP: profiles that already liked you |

All authenticated routes use the module-1 bearer token. Errors follow the
shared envelope `{success, message, code, fields?}`.

## 5. Paystack integration (live and mock)

`src/services/paystack.js` switches on `PAYSTACK_SECRET_KEY`:

* **Live mode** (key present): `POST https://api.paystack.co/transaction/initialize`
  with `amount` (pesewas), `email`, `reference`, `callback_url`, and
  `channels: ["mobile_money", "card"]` — mobile-money checkouts also send the
  wallet `phone`. Customers are redirected to `checkoutUrl`; activation then
  happens through `/verify` when they return, and/or the signed webhook.
  Webhook authenticity: HMAC-SHA512 of the **raw request body** with
  `PAYSTACK_WEBHOOK_SECRET` (falls back to the secret key), compared to the
  `x-paystack-signature` header in constant time.
* **Mock mode** (no key, dev/demo): the same flow with simulated responses —
  `checkout` returns a `/premium?reference=…` URL, `POST /api/billing/mock-pay`
  plays the role of the customer approving the wallet prompt, and the webhook
  secret defaults to `streetmeet-mock-paystack-secret`. Nothing leaves the
  process, so the whole activation path is testable offline (this is what both
  smoke suites exercise).

`PAYSTACK_CURRENCY` defaults to `GHS`.

## 6. Frontend

* `pages/Premium.jsx` — plan cards with feature lists, current-plan badge,
  active-subscription card, billing history, and the return-from-Paystack
  confirm loop (polls `/verify` with the `reference` query param).
* `components/CheckoutModal.jsx` — channel picker (📱 Mobile money / 💳 Card),
  provider + wallet number for momo, then either a redirect to Paystack
  (live) or the mock approval step, ending in "PREMIUM is live — thank you!".
* `hooks/usePlan.js` — tab-scoped cache of `GET /api/billing/plans` shared by
  the navbar chip, discover gating and the plans page; `refresh()` after
  payment.
* Discover reacts to entitlements: like-budget errors raise an upgrade banner,
  the filter panel shows a 🔒 note for premium filters, VIP members get a
  "💘 Likes you" strip while everyone else sees a teaser link, and VIP cards
  wear a gold badge. Conversations show "· Read" on own messages when read
  receipts are included in the plan.

## 7. Environment

```dotenv
PAYSTACK_SECRET_KEY=            # empty ⇒ mock mode; sk_live_…/sk_test_… ⇒ live
PAYSTACK_WEBHOOK_SECRET=        # optional; defaults to the secret key (mock: streetmeet-mock-paystack-secret)
PAYSTACK_CURRENCY=GHS
BILLING_FREE_LIKE_LIMIT=20      # free-plan likes per UTC day
PAYSTACK_CALLBACK_URL=          # optional override; defaults to CLIENT_URL/premium
```

## 8. Tests

* `backend/scripts/smoke.js` — the billing section (10 of the suite's checks) covers the
  catalogue, 402 gating (advanced filters, likes-you, like budget with
  `BILLING_FREE_LIKE_LIMIT=2`), checkout validation, the mock
  approve → verify → activate path, perk unlocking, read receipts, a signed
  `charge.success` webhook activating VIP, and read-time expiry + sweeper.
* `website/scripts/ui-smoke.mjs` — the billing section (3 of the suite's checks) walks
  the plans page, completes a mobile-money checkout in mock mode and asserts
  the navbar/badge/history updates, then verifies the previously locked
  advanced filters now return `200`.
