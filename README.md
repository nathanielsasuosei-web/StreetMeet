# 💜 natthesisa

A Ghanaian dating product: **swipe, match, chat, post statuses and make voice or video
calls**. Plans cost **20, 50 or 100 pesewas**, paid with **MTN MoMo, Vodafone Cash or
AirtelTigo Money** (Hubtel or Paystack).

```
backend/   Express + Socket.IO API · Drizzle ORM · PostgreSQL · mobile money
web/       React + Vite dating site (installable as a PWA)
mobile/    Expo / React Native app (Android + iOS)
docs/      Step-by-step guides, tools, deployment and launch checklist
```

---

## Quick start

You need **[Node.js 20+](https://nodejs.org)** and **[Git](https://git-scm.com)**.

```bash
# 1. clone and open the workspace
git clone <your-repo-url> natthesisa
cd natthesisa
code natthesisa.code-workspace

# 2. backend  (get a free Postgres at https://neon.tech)
cd backend
cp .env.example .env        # <- paste DATABASE_URL, set JWT_SECRET
npm install
npm run db:migrate          # create tables
npm run seed                # 20p / 50p / 100p plans
npm run seed:demo           # 8 demo profiles with photos and statuses
npm run dev                 # http://localhost:5000

# 3. website (new terminal)
cd web
npm install
npm run dev                 # http://localhost:5173
```

Log in with **demo@natthesisa.app / natthesisa**.
Payments run in a **sandbox provider** (`MOMO_PROVIDER=mock`) until you add real keys.

---

## Features

- 💳 **Plans from 20 pesewas** — 20p/1 day, 50p/7 days, 100p/30 days, MTN/Vodafone/AirtelTigo
- 🔥 **Discover deck** — swipe, like, super-like, pass; 20 free likes a day, 100 with a plan
- 💬 **Real-time chat** — typing indicators, read receipts, photo and video messages
- ⭕ **Status** — WhatsApp-style photos, videos and thoughts that vanish after 24 hours
- 📞 **Voice + video calls** — peer-to-peer WebRTC with ring, mute and camera controls
- 🛡️ **Safety** — block, report, bans, verification and an admin dashboard
- 👑 **Admin dashboard** — members, reports, revenue, plan management

---

## Documentation

| Guide | What's inside |
| --- | --- |
| **[docs/00-START-HERE.md](docs/00-START-HERE.md)** | 15-minute setup and a map of everything |
| **[docs/02-STEP-BY-STEP.md](docs/02-STEP-BY-STEP.md)** | Every step from install to publish, with the tool for each |
| [docs/01-TOOLS.md](docs/01-TOOLS.md) | Which tool to use for which job |
| [docs/03-VSCODE-SETUP.md](docs/03-VSCODE-SETUP.md) | Extensions, tasks, debugging |
| [docs/04-PAYMENTS-MOMO.md](docs/04-PAYMENTS-MOMO.md) | Hubtel / Paystack setup, webhooks, going live |
| [docs/05-CALLS-WEBRTC.md](docs/05-CALLS-WEBRTC.md) | How calls work + TURN servers |
| [docs/06-MOBILE-EXPO-BUILD.md](docs/06-MOBILE-EXPO-BUILD.md) | APK, App Store, Play Store |
| [docs/07-PUBLISH-DEPLOY.md](docs/07-PUBLISH-DEPLOY.md) | Neon + Render + Vercel, custom domain, costs |
| [docs/08-API-REFERENCE.md](docs/08-API-REFERENCE.md) | Every REST endpoint and socket event |
| [docs/09-LAUNCH-CHECKLIST.md](docs/09-LAUNCH-CHECKLIST.md) | Safety, legal and growth before launch |

---

## Tech choices

| Choice | Why |
| --- | --- |
| **Drizzle ORM** over Prisma | Pure JavaScript — `npm install` works everywhere with no engine downloads |
| **Postgres** (Neon/Supabase) | Free serverless tier, array columns, proper transactions |
| **Socket.IO** | Realtime chat, presence and call signalling in one connection |
| **WebRTC** (peer to peer) | Private, low-latency calls; the server never handles media |
| **Money in pesewas** (integers) | Never lose cedis to floating-point rounding |
| **One env var per provider** | `MOMO_PROVIDER=mock \| hubtel \| paystack` swaps the whole payment stack |

---

## Deploy in 20 minutes

Neon (database) → Render (API, reads `render.yaml`) → Vercel (website, reads
`web/vercel.json`). Full walkthrough: **[docs/07-PUBLISH-DEPLOY.md](docs/07-PUBLISH-DEPLOY.md)**.

---

## Security notes

- Never commit `.env` (it is git-ignored) — only `.env.example`.
- Rotate `JWT_SECRET` if it ever leaks; it invalidates every session.
- The Paystack webhook verifies an HMAC-SHA512 signature before trusting a payload.
- Payments are idempotent: the same reference can never credit an account twice.
- Uploads are limited to 15 MB and to image/video/audio MIME types.

---

Built with 💜 in Accra.
