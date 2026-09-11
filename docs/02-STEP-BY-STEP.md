# Step by step — from empty folder to published app

Every step has: **goal → tool → what to do → where the code lives → how to check it works.**
Follow them in order. Steps 1–6 are one-time setup; 7–16 are the features; 17–20 ship it.

> Convention: commands starting with `backend$` run inside the `backend/` folder,
> `web$` inside `web/`, `mobile$` inside `mobile/`.

---

## Step 1 — Install the tools

**Goal:** a computer that can run the project.
**Tool:** Node.js, VS Code, Git.

1. Install **Node.js 20 LTS** → <https://nodejs.org> (accept the defaults).
2. Install **VS Code** → <https://code.visualstudio.com>.
3. Install **Git** → <https://git-scm.com>.

Check:

```bash
node -v     # v20.x or newer
npm -v      # 10.x or newer
git --version
```

---

## Step 2 — Get the code and open it in VS Code

**Goal:** the repository on your machine, opened correctly.
**Tool:** Git + VS Code.

```bash
git clone <your-repo-url> natthesisa
cd natthesisa
code natthesisa.code-workspace     # opens all three projects at once
```

The workspace file already sets the recommended extensions, the terminal layout and the
debug configs. If VS Code asks "Do you trust the authors?" → **Yes**.

Add the extensions (or accept VS Code's "Install recommended" prompt):

```bash
code --install-extension esbenp.prettier-vscode dbaeumer.vscode-eslint expo.vscode-expo-tools humao.rest-client eamodio.gitlens
```

**Check:** the left panel shows three folders: `backend`, `web`, `mobile`.

---

## Step 3 — Create the database

**Goal:** a PostgreSQL database you can connect to.
**Tool:** [Neon](https://neon.tech) (free, no install).

1. Sign in → **Create project** → name it `natthesisa`.
2. Copy the **connection string** (starts with `postgresql://…?sslmode=require`).
3. Keep the tab open, you need it in Step 4.

*Prefer local?* `docker run -d --name natthesisa-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=natthesisa -p 5432:5432 postgres:16`
then use `postgresql://postgres:postgres@localhost:5432/natthesisa`.

**Check:** Neon shows the project as **Active**.

---

## Step 4 — Environment variables

**Goal:** secrets that never go into Git.
**Tool:** VS Code (edit `.env`).

```bash
backend$ cp .env.example .env
```

Edit `backend/.env`:

```env
DATABASE_URL="postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/natthesisa?sslmode=require"
JWT_SECRET="type-40-random-characters-here"
MOMO_PROVIDER=mock              # switch to hubtel or paystack in Step 14
CLIENT_URL=http://localhost:5173
```

Make a long random secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

> `.env` is in `.gitignore` — it is never committed. Only `.env.example` is.

**Check:** `backend/.env` exists and VS Code shows it greyed out in the Git panel.

---

## Step 5 — Start the API

**Goal:** a running backend with hot reload.
**Tool:** VS Code terminal + nodemon.

```bash
backend$ npm install     # ~30 seconds
backend$ npm run dev
```

You should see:

```
✅ Database schema is up to date
  natthesisa API running on http://localhost:5000
  Mobile money provider: MOCK
  Realtime: socket.io ready
```

**Check:** open <http://localhost:5000/health> → `{"app":"natthesisa","status":"running",…}`

**How it works** (`backend/src/server.js`):

```
helmet (security headers) → cors (allow the website) → rate limiter
→ express.json (keeps the raw body for Paystack signatures)
→ /uploads static files → /api routes → error handler
→ one HTTP server shared by Express and Socket.IO
```

---

## Step 6 — Create the tables

**Goal:** turn the schema into real tables.
**Tool:** Drizzle Kit (pure JavaScript — no engine downloads).

```bash
backend$ npm run db:generate    # writes SQL into backend/drizzle/
backend$ npm run db:migrate     # applies it
backend$ npm run seed           # 3 plans: 20p, 50p, 100p
backend$ npm run seed:demo      # 8 demo profiles with photos + statuses
backend$ npm run db:studio      # optional: browse the data in your browser
```

**Where the model lives:** `backend/src/db/schema.js` (users, likes, passes, matches,
messages, statuses, status_views, plans, transactions, call_sessions, reports, blocks).

Key decisions, already made for you:

- Money is stored in **pesewas** (`pricePesewas: 20` = GH¢0.20) – never floats for currency.
- Every `expiresAt` on a status is `createdAt + 24h` – that is the WhatsApp behaviour.
- Cascading deletes: delete a user and all of their likes, messages and statuses go too.

**Check:** `npm run db:studio` → the `users` and `plans` tables have rows.

---

## Step 7 — Authentication

**Goal:** people can create an account and stay logged in.
**Tool:** VS Code + the REST Client extension (or Postman).

Already built: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`.

```bash
curl -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" \
  -d '{"fullName":"Kwame Mensah","email":"kwame@example.com","phone":"0241112222",
       "password":"natthesisa","gender":"MALE","birthDate":"1996-03-12","city":"Accra"}'
```

The response contains a **JWT** (`token`). The website stores it in `localStorage`, the
mobile app in `expo-secure-store` (encrypted). Every protected route reads it in
`backend/src/middleware/auth.js`.

Rules enforced: 18+ only, unique email/phone, passwords hashed with bcrypt (12 rounds).

**Check:** `GET /api/auth/me` with the token in `Authorization: Bearer <token>` returns your user.

---

## Step 8 — Profiles and photos

**Goal:** a profile other people want to look at.
**Tool:** the website (Step 17) or curl.

```bash
curl -X PATCH http://localhost:5000/api/profile/me \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"bio":"Football, fufu and fine conversations.","photos":["https://…/me.jpg"],
       "interests":["Football","Music"],"onboarded":true}'
```

Real uploads (from the app) are multipart: `PATCH /api/profile/me` with the field `photos`
(up to 6 files, 15 MB each) → saved to `backend/public/uploads` by `multer`
(`backend/src/middleware/upload.js`).

> **Going live:** local disk disappears when Render restarts. Swap `fileUrl()` in
> `backend/src/middleware/upload.js` for Cloudinary or S3 (a 20-line change, marked with a comment).

**Check:** `GET /api/profile/me` shows `photos`, `bio`, `interests`, `onboarded: true`.

---

## Step 9 — Discover, likes and matches

**Goal:** the swipe deck.
**Tool:** website → **Discover** tab.

`GET /api/discover/feed` returns profiles filtered by:

- gender you are looking for, age range, max distance (Haversine, `utils/user.js`)
- excluding yourself, people you blocked, already liked, passed, or matched with
- only profiles that have at least one photo and finished onboarding

`POST /api/discover/like/:id` → creates the like; if they already liked you it creates a
**match** and pushes `match:new` over Socket.IO so their app celebrates instantly.
`POST /api/discover/pass/:id` → hides them for good.

Free accounts get **20 likes/24h**, premium **100** (`FREE_DAILY_LIKES` in
`backend/src/utils/user.js`).

**Check:** like a seeded profile, then like back from that profile → the second call
returns `"matched": true`.

---

## Step 10 — Real-time chat

**Goal:** messages arrive instantly, with typing and read receipts.
**Tool:** Socket.IO (client in `web/src/lib/socket.js`).

Flow:

1. On login the client connects with its JWT; the server joins them to a private room `user:<id>`.
2. Opening a chat emits `chat:join` with the `matchId`.
3. `POST /api/chat/:matchId/messages` saves the message **and** emits `message:new` to
   the partner's room — so REST keeps the history and the socket delivers it instantly.
4. `chat:typing` / `chat:stopTyping` / `chat:seen` handle the small signals.

**Check:** open the app in two browser windows (one normal, one incognito), log in as two
different users, match them and chat — messages appear without refreshing.

---

## Step 11 — Status posts (WhatsApp style)

**Goal:** photos, videos or thoughts that vanish after 24 hours.
**Tool:** website → **Status** tab.

- `POST /api/status` — multipart (`media` file) or JSON (`caption`, `background`, `mediaUrl`)
- `GET /api/status/feed` — grouped per person, **your own first**, then matches only
- `POST /api/status/:id/view` — records the view (unique per viewer)
- `GET /api/status/:id/viewers` — who watched *your* status
- `DELETE /api/status/:id` — remove it early

Expiry is enforced in the query (`expiresAt > now()`), so nothing old is ever returned.
Add a cron job later (`DELETE FROM statuses WHERE expires_at < now()`) to keep the table tidy.

**Check:** post a status as Kwame → open Ama → it shows with a purple "unseen" ring → tap →
it is marked seen and appears in Kwame's viewer list.

---

## Step 12 — Production media uploads (do this before launch)

**Goal:** photos that survive a redeploy.
**Tool:** Cloudinary (free tier) or AWS S3.

In `backend/src/middleware/upload.js`, replace the disk storage with a signed upload.
Sketch for Cloudinary:

```js
import { v2 as cloudinary } from "cloudinary";
cloudinary.config({ cloud_name: process.env.CLOUDINARY_URL && undefined, secure: true });

export const fileUrl = async (file) => {
  const result = await cloudinary.uploader.upload(file.path, { folder: "natthesisa" });
  return result.secure_url;
};
```

Then set `UPLOAD_DRIVER=cloudinary` and delete the `public/uploads` static route.

**Check:** upload a photo, restart the API, the photo still loads.

---

## Step 13 — Voice and video calls

**Goal:** real calls between two matched people.
**Tool:** WebRTC (browser or `react-native-webrtc`) + Socket.IO for signalling.

The server never touches media; it only relays:

```
caller ──call:initiate {offer}──► server ──call:incoming──► callee
callee ──call:answer {answer}───► server ──call:answered──► caller
both   ──call:ice {candidate}───► server ──call:ice───────► other side
either ──call:end / call:reject─► server ─────────────────► other side
```

- `GET /api/calls/ice` returns the STUN/TURN servers (set `TURN_URLS` in `.env`).
- Busy detection: `backend/src/sockets/calls.js` keeps `busyUsers` in memory.
- Every call is recorded in `call_sessions` with duration, so you can show call history.

Without a **TURN** server, roughly 10–20% of mobile connections fail. Add one before
launch (Cloudflare Calls, Metered, Twilio, or self-hosted coturn) — see
[05-CALLS-WEBRTC.md](05-CALLS-WEBRTC.md).

**Check:** two browser windows, matched users → press 🎥 → the other window rings →
accept → you see and hear each other.

---

## Step 14 — Mobile money payments (20p / 50p / 100p)

**Goal:** take real money from MTN MoMo, Vodafone Cash and AirtelTigo Money.
**Tool:** Hubtel Ghana **or** Paystack Ghana.

The plans are **rows in the database**, not code — edit them any time:

| Plan | Price | Duration |
| --- | --- | --- |
| Spark | 20 pesewas (GH¢0.20) | 1 day |
| Boost | 50 pesewas (GH¢0.50) | 7 days |
| Gold | 100 pesewas (GH¢1.00) | 30 days |

Change prices in the admin dashboard, or in `backend/src/db/seed.js` then re-seed.

Flow in the apps (`web/src/pages/Premium.jsx`):

1. `GET /api/payments/plans`
2. `POST /api/payments/initiate {planCode, phone, network}` → the provider sends a
   **prompt to the phone**; the user approves with their MoMo PIN
3. The app polls `GET /api/payments/:reference` every 3 s until `SUCCESS` or `FAILED`
4. On success the server extends `premiumUntil` by the plan duration

Switch provider with **one** variable: `MOMO_PROVIDER=mock | hubtel | paystack`.
Full setup instructions → [04-PAYMENTS-MOMO.md](04-PAYMENTS-MOMO.md).

**Check (sandbox):** Premium → Boost → "Approve in sandbox" → the badge in the top bar
turns to **👑 Gold** and the daily likes jump from 20 to 100.

---

## Step 15 — Webhooks

**Goal:** the provider tells your server when money landed.
**Tool:** ngrok (locally), the provider dashboard (in production).

```bash
ngrok http 5000
# copy the https URL, e.g. https://a1b2-3c4d.ngrok-free.app
```

Put that in Hubtel/Paystack as the callback URL:

- Hubtel → `https://<your-url>/api/payments/webhook/hubtel`
- Paystack → `https://<your-url>/api/payments/webhook/paystack`

Paystack's handler verifies the `x-paystack-signature` HMAC (SHA-512 of the raw body) and
rejects anything else with 401. Both handlers are **idempotent** — a second call for the
same reference cannot double-credit an account.

**Check:** complete a sandbox payment; the API log prints
`💚 Payment NT… settled - user@… is premium until …`.

---

## Step 16 — Safety, blocking and the admin dashboard

**Goal:** keep the community safe.
**Tool:** website → `/app/admin`.

- `POST /api/profile/report/:id` — spam, fake profile, harassment, inappropriate, underage
- `POST /api/profile/block/:id` — blocks and deletes the match
- `GET /api/admin/stats` — members, matches, messages, revenue
- `PATCH /api/admin/users/:id` — verify / ban / promote

Promote your own account:

```bash
backend$ npm run make-admin you@example.com
```

**Check:** report a user → it appears in Admin → Reports → ban them → they cannot log in again.

---

## Step 17 — The website

**Goal:** the public site people land on, plus the app experience in the browser.
**Tool:** Vite + React.

```bash
web$ npm install
web$ npm run dev      # http://localhost:5173
```

Pages (`web/src/pages/`): `Landing`, `Login`, `Register`, `Onboarding`, `Discover`,
`Matches`, `Chat`, `Status`, `Premium`, `Profile`, `Admin`.

- All styling lives in one file: `web/src/styles.css` (change the `--brand` variables to re-skin).
- `web/src/lib/api.js` holds every endpoint call — one place to change.
- Vite proxies `/api` and `/socket.io` to port 5000, so there is no CORS pain in dev.
- It is already a **PWA** (`public/manifest.webmanifest`) — Android offers "Install app".

**Check:** register a new account → onboarding → swipe → match → chat → post a status → buy a plan.

---

## Step 18 — The mobile app

**Goal:** a real Android/iOS app.
**Tool:** Expo.

```bash
mobile$ cp .env.example .env        # put your API URL in EXPO_PUBLIC_API_URL
mobile$ npm install
mobile$ npm start                   # scan the QR with the Expo Go app
```

Expo Go is enough for profiles, swiping, chat and status. **Calls need a dev build**
because `react-native-webrtc` ships native code:

```bash
mobile$ npm run prebuild
mobile$ npm run android             # builds and installs on a connected phone/emulator
```

**Check:** log in on your phone with the same account — swipe and chat work against the same API.

---

## Step 19 — Test the whole thing

**Goal:** confidence.
**Tool:** your own two hands, two browsers, one phone.

Run this script before every release:

1. Register two accounts.
2. Complete onboarding on both (photo + bio + interests).
3. A likes B, B likes A → both see "It's a match".
4. Send messages both ways — they arrive instantly, with typing and seen ticks.
5. Post a status on each → visible for 24 h, viewer list populated.
6. Start a video call → ring → accept → mute → camera off → end → it is in call history.
7. Buy each plan with the sandbox → `premiumUntil` extends, likes jump to 100.
8. Report + block → the admin dashboard shows the report.
9. Log out and back in → the session is restored.

Automated tests (both already in the repo — run them with the API running):

```bash
backend$ npm run test:api        # 14 REST checks: register → match → chat → status → call → pay
backend$ npm run test:realtime   # 11 socket checks: auth, typing, message delivery, call signalling
```

---

## Step 20 — Publish

**Goal:** natthesisa live on the internet.
**Tool:** Neon (database) + Render (API) + Vercel (website) + EAS (Android APK).

Everything is step-by-step in **[07-PUBLISH-DEPLOY.md](07-PUBLISH-DEPLOY.md)**:
create the services, paste the environment variables, deploy, add your domain, then
submit the app to the Play Store.

Before you announce it, walk through **[09-LAUNCH-CHECKLIST.md](09-LAUNCH-CHECKLIST.md)**.
