# Launch checklist

Walk through this before you tell anyone about natthesisa.

---

## Product

- [ ] Onboarding takes under 2 minutes and explains what happens next
- [ ] Empty states are friendly ("no matches yet" → button to start swiping)
- [ ] Every error the API can return has a human sentence in the UI
  (out of likes, payment failed, cannot call a non-match…)
- [ ] A brand-new user can: register → onboard → swipe → match → chat → status → call → pay
- [ ] Tested on a real Android phone, a real iPhone, and a laptop browser
- [ ] Tested on a slow 3G connection (Chrome DevTools → Network → Slow 3G)

## Safety & moderation (required by Google Play and Apple)

- [ ] **Block** works and removes the match
- [ ] **Report** works and lands in the admin queue
- [ ] An admin can ban an account and the ban takes effect immediately (JWT check)
- [ ] A **support email** is visible in the app and replies within 48 h
- [ ] Under-18 reporting path (registration already blocks under 18)
- [ ] Photo moderation plan: manual review queue now, AI (Hive / Sightengine) when volume grows
- [ ] Rate limits enabled (already: 600 req/15 min, 30 logins/15 min, 20 payments/10 min)

## Legal & privacy (a dating app handles sensitive data)

- [ ] **Privacy policy** page published (what you collect, why, how to delete)
- [ ] **Terms of service** page published (18+, no prostitution/solicitation, no harassment)
- [ ] **Community guidelines** or safety tips page
- [ ] **Refund policy** for the paid plans (payment providers require it)
- [ ] Account deletion available **inside** the app (Apple requires it; API has
      `DELETE /api/auth/me`)
- [ ] Data export/erasure process if you have users in the UK/EU (GDPR)
- [ ] Ghana Data Protection Commission registration if you process Ghanaian users at scale

## Payments

- [ ] Merchant account approved (Hubtel or Paystack)
- [ ] `MOMO_PROVIDER` switched from `mock` in production
- [ ] Webhook URL is https, publicly reachable, returns 200
- [ ] Live purchase tested for **each** plan (20p, 50p, 100p)
- [ ] Declined payment path tested (insufficient balance) → friendly message, no crash
- [ ] `premiumUntil` extends correctly when someone buys twice
- [ ] Daily like limit jumps from 20 → 100 after a purchase

## Infrastructure

- [ ] `DATABASE_URL`, `JWT_SECRET`, provider keys set on Render
- [ ] Automatic daily database backups (Neon keeps 7 days on free, more on paid)
- [ ] Uploads on Cloudinary/S3, not the ephemeral local disk
- [ ] TURN server configured for calls
- [ ] Error monitoring (Sentry) installed — `npm i @sentry/node` in the API
- [ ] Uptime check (UptimeRobot pinging `/health` every 5 minutes)
- [ ] `NODE_ENV=production`, helmet enabled, rate limits on (all already done)

## Mobile stores

- [ ] App icon, splash, screenshots, store description
- [ ] Content rating + data-safety form completed
- [ ] Privacy policy URL added to both stores
- [ ] Google Play: safety policy declaration for dating apps
- [ ] Apple: age rating 17+, account deletion

## Growth

- [ ] Landing page says what the product is in one sentence
- [ ] Invite/share link so matches can bring friends
- [ ] Instagram / TikTok / X account with the natthesisa name
- [ ] Analytics installed so you know where people drop off
- [ ] A plan for the first 100 users (WhatsApp groups, campus ambassadors, church/youth groups)

---

## Suggested order for the first week

1. Deploy to Render + Vercel with `MOMO_PROVIDER=mock`.
2. Invite 10 friends, watch them use it, fix what confuses them.
3. Turn on real mobile money.
4. Publish the APK (`npm run build:apk`) and share the download link.
5. Submit to Google Play.
6. Build iOS when Android retention looks good.
