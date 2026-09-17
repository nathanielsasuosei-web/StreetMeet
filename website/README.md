# StreetMeet web client

React 19 + Vite 8 + React Router 7. No CSS framework and no UI kit - the design system is a single
hand-written stylesheet (`src/index.css`) with tokens for light and dark colour schemes.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

The dev server proxies `/api` and `/uploads` to the backend (default `http://127.0.0.1:5000`,
override with `BACKEND_URL`). Because of that, **every URL in the app is relative** - the browser only
ever talks to the origin that served it, which keeps the client working behind a tunnel, a preview
domain or a CDN with no configuration.

| Script | What it does |
| ------ | ------------ |
| `npm run dev` | Vite dev server on `0.0.0.0:5173` (`allowedHosts: true`) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the build (same proxy as dev) |
| `npm run test:ui` | 23 checks driving the real app in jsdom against the real API |
| `npm run lint` | oxlint |

`npm run test:ui` needs the API running: `cd ../backend && npm run db:setup && npm start`.

## Structure

```
index.html
vite.config.js          dev/preview proxy, host binding, allowed hosts
src/
  main.jsx              ToastProvider > AuthProvider > App
  App.jsx               routes
  index.css             design system: tokens, base, layout, components, pages
  lib/api.js            fetch wrapper - token, envelope unwrapping, ApiError{status,code,fields}
  lib/format.js         age, initials, avatar colours, password checks, image validation
  context/AuthContext   session bootstrap + login/register/logout/refresh/rotateToken/endSession
  context/ToastContext  toasts
  hooks/useCatalogue    one cached request for interests, genders, goals, countries, limits
  hooks/useForm         form state + maps server field errors onto inputs
  components/ui/        Button, Field/TextInput/TextArea/Select/PasswordInput, Toggle, Chip/ChipGroup,
                        Avatar, Card, Modal, PhotoUploader, AgeRange, PasswordStrength
  components/           Navbar, Footer, AppLayout, ProtectedRoute/GuestRoute, ComingSoon
  pages/                Home, Register, Login, Onboarding, Profile, EditProfile, Settings,
                        Terms, Privacy, NotFound, and ComingSoon wrappers for modules 2-6
scripts/ui-smoke.mjs    DOM-level end-to-end test
```

## Routes

| Path | Access | Notes |
| ---- | ------ | ----- |
| `/` | public | Landing page; CTAs change once you are signed in |
| `/login`, `/register` | guests | Signed-in visitors are redirected away (`GuestRoute`) |
| `/terms`, `/privacy` | public | Referenced by the sign-up checkbox |
| `/onboarding` | signed in | Six-step profile wizard |
| `/profile` | signed in | Your profile + completion checklist |
| `/profile/edit` | signed in | Edit everything, including the photo |
| `/settings` | signed in | Five tabs: account, privacy, notifications, preferences, security |
| `/matches`, `/messages`, `/status`, `/premium` | signed in | `ComingSoon` placeholders - those modules are not rebuilt yet |
| `*` | public | 404 |

`ProtectedRoute` sends anonymous visitors to `/login` and remembers where they were heading;
`GuestRoute` sends signed-in visitors to their profile, or to `/onboarding` when the profile is not
finished yet.

## Conventions

* **Session**: the JWT lives in `localStorage` (`streetmeet.token`) and is sent as
  `Authorization: Bearer`. `AuthContext` rehydrates on first paint with `GET /api/auth/me`, and drops
  the session on a 401/403. A password change returns a fresh token, which `rotateToken()` swaps in;
  "sign out everywhere" and account closure call `endSession()`.
* **Errors**: `ApiError` carries `status`, `code` and `fields`. `useForm` spreads `fields` onto the
  matching inputs and keeps anything else as a banner, so one server response drives the whole form.
* **Server state**: profile data comes from `AuthContext.user` (a full private profile, refreshed
  after each write). The catalogue is cached module-wide by `useCatalogue`.
* **Styling**: add tokens to `:root` in `index.css` (and the dark block) rather than inline colours;
  `cx()` joins conditional class names.
* **Adding a module**: pages go in `src/pages/`, route in `App.jsx`. Replace the `ComingSoon`
  placeholder for that path - the API already returns `501 MODULE_NOT_MIGRATED` until the backend
  module is migrated.

## The UI test

`scripts/ui-smoke.mjs` renders the real `App` in jsdom (loading the JSX through Vite's module runner),
polyfills `fetch` to point at the real API, and drives the app with real DOM events:

home → register (weak password refused) → all six wizard steps (two validation refusals asserted) →
profile assertions → settings privacy toggle (asserting the `PATCH` fired) → edit profile save →
a genuine multipart photo upload through `PhotoUploader` → sign out.

It fails if React logs an unexpected `console.error`, which is what catches the classic scaffold bugs
(a page exporting an undefined component, a conditional hook, a missing provider).
