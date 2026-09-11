# Tools — what to use, and when

Every step of the build has one tool. Install these once and you are set.

## Everyday

| Job | Tool | Cost | Install |
| --- | --- | --- | --- |
| Write code | **Visual Studio Code** | Free | [code.visualstudio.com](https://code.visualstudio.com) |
| Run commands | VS Code **terminal** (`Ctrl`+`` ` ``) or PowerShell / Terminal | Free | built in |
| Run JavaScript | **Node.js 20 LTS** | Free | [nodejs.org](https://nodejs.org) |
| Version control | **Git** + **GitHub Desktop** (optional) | Free | [git-scm.com](https://git-scm.com) · [desktop.github.com](https://desktop.github.com) |
| Test the API | **Postman** or the **REST Client** VS Code extension | Free | [postman.com](https://www.postman.com) · ext: `humao.rest-client` |
| Look at the database | **Drizzle Studio** (`npm run db:studio`) or **DBeaver** | Free | [dbeaver.io](https://dbeaver.io) |
| Design screens (optional) | **Figma** or **Excalidraw** | Free | [figma.com](https://figma.com) |

### Recommended VS Code extensions

```
esbenp.prettier-vscode        # format on save
dbaeumer.vscode-eslint        # catch mistakes
bradlc.vscode-tailwindcss     # (only if you add Tailwind later)
Prisma.prisma                 # (only if you switch back to Prisma)
expo.vscode-expo-tools        # Expo / React Native debugging
ms-vscode.vscode-node-debug   # attach to the API
christian-kohler.npm-intellisense
eamodio.gitlens               # see who changed what
humao.rest-client             # send requests from a .http file
ms-azuretools.vscode-docker   # if you use Docker locally
```

Install them all at once:

```bash
code --install-extension esbenp.prettier-vscode dbaeumer.vscode-eslint expo.vscode-expo-tools humao.rest-client eamodio.gitlens
```

---

## Running and testing each part

| Part | Tool | Command |
| --- | --- | --- |
| API (auto-restart on save) | **nodemon** | `npm run dev` inside `backend/` |
| Website (instant refresh) | **Vite** | `npm run dev` inside `web/` |
| Mobile app on a real phone | **Expo Go** app from Play Store / App Store | `npm start` inside `mobile/`, scan the QR |
| Mobile app with camera + calls | **Expo dev build** (needs the native code) | `npm run prebuild && npm run android` |
| Realtime (chat, calls, presence) | **Socket.IO** — test with `web/src` or `scripts/` | built in |
| WebRTC calls | **Chrome** (`chrome://webrtc-internals`) | built in |
| Mobile money webhooks locally | **ngrok** or **Cloudflare Tunnel** | `ngrok http 5000` |

---

## Data and hosting

| Job | Tool | Why |
| --- | --- | --- |
| Database | **Neon** (free Postgres) or **Supabase** | Serverless Postgres, no install, generous free tier |
| Local database (optional) | **Docker** + `postgres:16` image, or Postgres installer | Same engine as production |
| API hosting | **Render** (free web service) or **Railway** / **Fly.io** | Deploys straight from GitHub |
| Website hosting | **Vercel** or **Netlify** | Free static hosting, instant rollbacks |
| Media uploads | **Cloudinary** or **AWS S3** (start with local disk) | Serves images fast, keeps the API stateless |
| Mobile money | **Hubtel Ghana** or **Paystack Ghana** | MTN MoMo, Vodafone Cash, AirtelTigo Money |
| Android builds | **EAS Build** (`eas build -p android`) | Builds the APK in the cloud — no Android Studio needed |
| iOS builds | **EAS Build** + Apple Developer account ($99/yr) | Required to publish on the App Store |
| Emails (optional) | **Resend** or **Brevo** | Password resets, receipts |
| SMS OTP (optional) | **Hubtel SMS** or **Arkesel** | Phone verification in Ghana |
| Error monitoring | **Sentry** | Know about crashes before users complain |
| Analytics (optional) | **PostHog** (self-hostable) or **Plausible** | Funnels: signup → swipe → match → pay |

---

## Design

| Job | Tool |
| --- | --- |
| Colours & logo | **Coolors** (palette), **Fontshare** / **Google Fonts** (Plus Jakarta Sans is already wired in) |
| App icons | **Figma** export, or `[npx expo prebuild]` then Android Studio's Image Asset Studio |
| Screenshots for Play Store | **Previewed** (`previewed.app`) or Figma frames |

---

## Money checklist before you take real payments

1. Register a business (Ghana: Registrar General's Department) and get a TIN.
2. Open a merchant account with **Hubtel** or **Paystack** with that business.
3. Connect a settlement bank account or MoMo merchant wallet.
4. Set `MOMO_PROVIDER=hubtel` (or `paystack`) **only after** webhooks are verified in production.
5. Publish a refund policy + contact email — payment providers and Google both require it.
