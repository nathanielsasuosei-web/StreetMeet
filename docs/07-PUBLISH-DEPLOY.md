# Publish — take natthesisa live

You will put three things on the internet:

1. **Database** → Neon (free Postgres)
2. **API** → Render (free web service)
3. **Website** → Vercel or Netlify (free static hosting)

Total cost to start: **GH¢0**. You only pay when you outgrow the free tiers or add a
custom domain (~$12/year).

```
Browser ──► natthesisa.app         (Vercel, static React build)
        ──► api.natthesisa.app     (Render, Node + Socket.IO)
                   │
                   └──► Neon Postgres
                   └──► Hubtel / Paystack (mobile money)
```

---

## Part 1 — Database (Neon) · 5 minutes

1. <https://neon.tech> → **Sign in with GitHub** → **New project**
   - Name: `natthesisa`, Region: closest to your users (Frankfurt is good for Ghana)
   - Postgres version: 16 (default)
2. Copy the **connection string**. It looks like:
   ```
   postgresql://natthesisa_owner:AbCdEf@ep-cool-mud-123456.eu-central-1.aws.neon.tech/natthesisa?sslmode=require
   ```
3. Keep it — you paste it into Render in Part 2.

✅ **Check:** Neon dashboard → **SQL Editor** → run `select now();` → it returns a timestamp.

---

## Part 2 — API (Render) · 10 minutes

### 2.1 Push your code to GitHub

```bash
git add .
git commit -m "natthesisa: ready to deploy"
git push origin main
```

### 2.2 Create the web service

1. <https://render.com> → **New +** → **Web Service**
2. **Connect** your GitHub repository (authorise Render when asked).
3. Settings:

   | Field | Value |
   | --- | --- |
   | Name | `natthesisa-api` |
   | Region | Frankfurt (EU Central) |
   | Branch | `main` |
   | Root Directory | `backend` |
   | Runtime | Node |
   | Build Command | `npm install && npm run db:migrate` |
   | Start Command | `npm start` |
   | Instance Type | **Free** |

   *(The repository ships `render.yaml`, so you can also use **Blueprint** → select the repo
   and Render reads everything automatically.)*

4. **Environment** → add these variables (click *Add Environment Variable*):

   | Key | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` |
   | `DATABASE_URL` | the Neon connection string |
   | `JWT_SECRET` | 64 random characters (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
   | `CLIENT_URL` | `https://natthesisa.vercel.app` (your Vercel URL — you can add the custom domain later) |
   | `APP_URL` | `https://natthesisa-api.onrender.com` |
   | `MOMO_PROVIDER` | `mock` now, `hubtel` or `paystack` when you go live |
   | `TURN_URLS` | `stun:stun.l.google.com:19302` (add a TURN server later) |
   | `ADMIN_EMAIL` | your admin email |
   | `ADMIN_PASSWORD` | a strong password |

   For Hubtel also add `HUBTEL_CLIENT_ID`, `HUBTEL_CLIENT_SECRET`,
   `HUBTEL_MERCHANT_ACCOUNT_NUMBER`. For Paystack add `PAYSTACK_SECRET_KEY`,
   `PAYSTACK_PUBLIC_KEY`.

5. **Create Web Service** → wait 3–5 minutes for the first build.

✅ **Check:** open `https://natthesisa-api.onrender.com/health` →
`{"app":"natthesisa","status":"running",…}`

> **Free tier note:** Render sleeps a free service after ~15 minutes of no traffic; the
> first request after that takes ~50 seconds. For a real launch use the **Starter** plan
> (~$7/month) so chats and calls stay instant.

### 2.3 Seed the production database

Render → your service → **Shell** tab (or run locally with the production `DATABASE_URL`):

```bash
npm run seed         # 20p / 50p / 100p plans
npm run seed:demo    # optional demo profiles
npm run make-admin you@example.com
```

---

## Part 3 — Website (Vercel) · 5 minutes

1. <https://vercel.com> → **Add New** → **Project** → import your GitHub repo.
2. Settings:

   | Field | Value |
   | --- | --- |
   | Framework Preset | Vite |
   | Root Directory | `web` |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |

3. **Environment Variables** — add:

   | Key | Value |
   | --- | --- |
   | `VITE_API_URL` | `https://natthesisa-api.onrender.com` |

4. **Deploy** (about 1 minute).

Because the site calls `/api/...` relatively in production, add a rewrite so the browser
talks to Render without CORS problems — `web/vercel.json` already contains:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://natthesisa-api.onrender.com/api/:path*" },
    { "source": "/socket.io", "destination": "https://natthesisa-api.onrender.com/socket.io" }
  ]
}
```

**Replace the Render URL** in that file with your own, then redeploy.

> On **Netlify** instead: root `web`, build `npm run build`, publish `dist`, and use
> `web/netlify.toml` (same idea, already included).

✅ **Check:** open your Vercel URL → the landing page loads → Register an account → the
Discover deck shows demo profiles.

---

## Part 4 — Update the mobile app

```env
# mobile/.env
EXPO_PUBLIC_API_URL=https://natthesisa-api.onrender.com
```

Then rebuild so the change is baked into the binary:

```bash
mobile$ npm run build:apk      # or eas update --branch production
```

---

## Part 5 — Connect real mobile money

1. Finish merchant approval with Hubtel or Paystack.
2. In Render → **Environment**: set `MOMO_PROVIDER=hubtel` (or `paystack`) plus the keys.
   Render restarts automatically.
3. In the provider dashboard set the webhook/callback URL to
   `https://natthesisa-api.onrender.com/api/payments/webhook/hubtel` (or `…/paystack`).
4. Test with your own number: buy the 20p plan, watch the API logs, confirm the 👑 badge.

Full detail: [04-PAYMENTS-MOMO.md](04-PAYMENTS-MOMO.md).

---

## Part 6 — Custom domain (optional, ~$12/year)

1. Buy `natthesisa.com` (or `.app`) from any registrar.
2. **Vercel**: Project → Settings → Domains → add `natthesisa.com` and `www.natthesisa.com`
   → point the registrar's DNS to the values Vercel shows.
3. **Render**: Service → Settings → Custom Domain → add `api.natthesisa.com` → add the CNAME
   record at your registrar. Render issues a free Let's Encrypt certificate.
4. Update `CLIENT_URL` / `APP_URL` in Render and the rewrites in `web/vercel.json`, then redeploy.

---

## Part 7 — After every deploy, check

```bash
# 1. API is alive
curl https://api.natthesisa.com/health

# 2. Plans are seeded
curl https://api.natthesisa.com/api/payments/plans

# 3. Website loads
curl -I https://natthesisa.com

# 4. Sockets connect (open the site, log in, send a message in a second window)
```

---

## Costs

| Item | Free tier | When you upgrade |
| --- | --- | --- |
| Neon Postgres | 0.5 GB storage, 1 project | ~$19/mo for 10 GB + branching |
| Render web service | 750 h/mo, sleeps when idle | Starter **$7/mo** (always on) |
| Vercel | 100 GB bandwidth, hobby projects | Pro $20/mo per seat |
| Hubtel / Paystack | No fixed fee | ~1.5–2.5% per MoMo transaction |
| TURN (calls) | Metered 50 GB/mo free | from ~$0.04/GB |
| Domain | — | ~$12/year |
| Google Play | $25 one-time | — |
| Apple Developer | — | $99/year |

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Build fails: `DATABASE_URL` missing | Add the env var in Render, then **Manual Deploy → Clear build cache & deploy** |
| Website loads but "Failed to fetch" | Wrong API URL in `VITE_API_URL` / `vercel.json` rewrite, or `CLIENT_URL` mismatch → CORS |
| Chat not realtime | Socket.IO needs the websocket upgrade — Render supports it; check the browser console for a 404 on `/socket.io` |
| First request after idle takes ~50 s | Render free tier sleeping → upgrade to Starter |
| Uploaded photos disappear | Local disk is ephemeral on Render → move to Cloudinary/S3 (Step 12 in the main guide) |
| Payment webhook never arrives | Callback URL must be **https** and publicly reachable; test it with `curl -X POST` |
