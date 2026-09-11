# natthesisa — start here

**natthesisa** is a Ghanaian dating product: swipe, match, chat, post WhatsApp-style
statuses, and make audio/video calls. Plans cost **20, 50 or 100 pesewas** and are paid
with **MTN MoMo, Vodafone Cash or AirtelTigo Money** (Hubtel or Paystack).

You own three apps in one repository:

| Folder | What it is | Runs on |
| --- | --- | --- |
| `backend/` | Express + Socket.IO API, Drizzle ORM, PostgreSQL, mobile money | Node 20+ |
| `web/` | React + Vite dating **site** (also installable as a PWA) | Browser |
| `mobile/` | Expo / React Native **app** | Android + iOS |

---

## 1. Run it on your computer (15 minutes)

You need **[Node.js 20+](https://nodejs.org)** and **[Git](https://git-scm.com)** installed.
Everything else is installed by npm.

```bash
# 1. open a terminal in the project folder
cd natthesisa

# 2. backend
cd backend
cp .env.example .env          # then edit DATABASE_URL with your Neon/Supabase/local Postgres URL
npm install
npm run db:migrate            # creates all tables
npm run seed                  # creates the 20p / 50p / 100p plans
npm run seed:demo             # 8 demo profiles so the app is not empty
npm run dev                   # http://localhost:5000

# 3. website (new terminal)
cd web
npm install
npm run dev                   # http://localhost:5173
```

Log in with the demo account: **demo@natthesisa.app / natthesisa**
(password `natthesisa` for every seeded profile).

> **No database yet?** The fastest free option is **[neon.tech](https://neon.tech)** →
> create a project → copy the connection string into `backend/.env` as `DATABASE_URL`.
> It takes about 2 minutes and needs no installation.

---

## 2. Where to go next

| I want to… | Read this |
| --- | --- |
| Understand every step and the exact tool to use | **[02-STEP-BY-STEP.md](02-STEP-BY-STEP.md)** 👈 the main guide |
| Set up VS Code properly (extensions, debug, tasks) | [03-VSCODE-SETUP.md](03-VSCODE-SETUP.md) |
| Connect real MTN/Vodafone/AirtelTigo money | [04-PAYMENTS-MOMO.md](04-PAYMENTS-MOMO.md) |
| Fix or improve video/voice calls | [05-CALLS-WEBRTC.md](05-CALLS-WEBRTC.md) |
| Build the Android APK / iOS app | [06-MOBILE-EXPO-BUILD.md](06-MOBILE-EXPO-BUILD.md) |
| **Publish the site + API to the internet** | [07-PUBLISH-DEPLOY.md](07-PUBLISH-DEPLOY.md) |
| See every API endpoint | [08-API-REFERENCE.md](08-API-REFERENCE.md) |
| Launch safely (moderation, privacy, legal) | [09-LAUNCH-CHECKLIST.md](09-LAUNCH-CHECKLIST.md) |
| See the tool for each job at a glance | [01-TOOLS.md](01-TOOLS.md) |

---

## 3. What is already built

- ✅ Email + password auth (JWT, bcrypt), admin/moderator roles
- ✅ Profile with up to 6 photos, bio, interests, age & distance filters
- ✅ Discover deck with swipe, like, super-like, pass, 20 free likes/day (100 with a plan)
- ✅ Matches + real-time chat with typing indicators and read receipts
- ✅ Status posts (text, photo, video) that expire after 24 hours, with a viewer list
- ✅ Audio + video calls over WebRTC with ring, accept, reject, mute, camera off, timer
- ✅ Mobile money checkout (20p / 50p / 100p) with a mock sandbox provider for testing
- ✅ Block, report and an admin dashboard (members, verification, bans, reports, revenue)
- ✅ Realtime notifications for new likes, matches, messages and incoming calls

## 4. What you add when you are ready

- SMS or email verification (Hubtel SMS / Resend) and photo verification
- Push notifications (Expo Notifications) so matches reach people when the app is closed
- Cloud storage for uploads (Cloudinary / S3) instead of the local `uploads/` folder
- A TURN server so calls work on restrictive mobile networks (see [05](05-CALLS-WEBRTC.md))
- Content moderation queue, in-app purchases reconciliation, analytics
