# Module 1 - User accounts

Everything in this document is implemented, running and covered by tests.

| Requirement | Where it lives |
| ----------- | -------------- |
| **Sign up / login** | `POST /api/auth/register`, `POST /api/auth/login` · `services/authService.js` · `pages/Register.jsx`, `pages/Login.jsx` |
| **Profile creation** | `POST /api/profile/onboard` (one request writes the whole profile) · six-step wizard in `pages/Onboarding.jsx` |
| **Profile photo** | `POST /api/profile/photo` (multipart) + `DELETE /api/profile/photo` · `middleware/upload.js` (multer + sharp) · `components/ui/PhotoUploader.jsx` |
| **Age** | Derived from `birth_date`, never stored · `utils/age.js` · 18+ enforced in the validator, the service and the database (`CHECK` on PostgreSQL) |
| **Location** | `city` + `country` on the profile, hideable via `showLocation` |
| **Bio** | `bio`, max 500 characters, live counter in the UI |
| **Interests** | 44-item curated catalogue (`constants/profile.js`), stored as rows in `user_interests`, min 3 / max 10 |
| **Gender** | `gender` on the profile: `WOMAN`, `MAN`, `NON_BINARY`, `OTHER` |
| **Dating preferences** | `dating_preferences` (1:1): who you want to meet, age range, distance, relationship goal, nearby-first |
| **Edit profile** | `PATCH /api/profile/me`, `PATCH /api/profile/preferences` · `pages/EditProfile.jsx` |
| **Account settings** | `GET/PATCH /api/settings`, email, password, sessions, deactivation, deletion · `pages/Settings.jsx` |

---

## 1. Data model

Four tables own this module (the rest of the schema is carried over for modules 2-6).

```
users                1 ──── 0..n  user_interests
  id (uuid)                            (user_id, slug)
  full_name, email, password_hash
  phone_number, gender, birth_date     1 ──── 1  dating_preferences
  bio, city, country                            interested_in (JSON array), min_age, max_age
  profile_image, cover_image                    max_distance_km, relationship_goal, open_to_nearby
  role, verified, token_version
  deactivated_at, last_login_at        1 ──── 1  account_settings
  created_at, updated_at                        profile_visibility, show_age, show_location,
                                                show_online_status, discoverable,
                                                allow_messages_from, 5 notification flags,
                                                two_factor_enabled
```

Decisions worth knowing:

* **Age is derived, never stored.** `utils/age.js` converts `birth_date` to an age on read; the API
  returns `age` and never the exact date. Discovery can still filter by age because `birth_date` is
  stored as `YYYY-MM-DD`, where lexicographic order equals chronological order
  (`utils/age.js → birthDateWindow`).
* **Interests are rows, not a JSON blob**, so "people who share my interests" stays an indexed join
  when module 2 is built.
* **`token_version` on `users`** is the session revocation mechanism: bumping it invalidates every
  JWT already issued, which is how password changes and "sign out of all devices" work without a
  server-side session table.
* **No enums, no scalar lists.** Both would break the SQLite provider, so enums are `TEXT` validated
  in `constants/profile.js` and lists are join tables or JSON. On PostgreSQL, `CHECK` constraints
  enforce the same vocabulary in the database as well.
* **Cascade deletes.** Removing a `users` row removes its interests, preferences, settings, photos
  reference, likes, messages and the rest - which is what "delete my account" has to mean.

Migrations live in `backend/db/migrations/<dialect>/0001_init.sql` and must be added to **both**
dialect folders with the same file name.

## 2. API

Base URL `/api`. Successful responses are `{ "success": true, "message"?: string, "data": … }`.
Failures are `{ "success": false, "message": string, "code": string, "fields"?: { field: message } }`
- `fields` is what the web client renders inline under each input.

Authenticated routes expect `Authorization: Bearer <token>`.

### Auth - `/api/auth`

| Method | Path | Body | Returns |
| ------ | ---- | ---- | ------- |
| POST | `/register` | `fullName`, `email`, `password` | `201` `{ token, user }` - profile starts incomplete |
| POST | `/login` | `email`, `password` | `{ token, user }` |
| POST | `/reactivate` | `email`, `password` | `{ token, user }` - restores a deactivated account |
| GET | `/me` | – | `{ user }` - full private profile |
| POST | `/logout` | – | `{ message }` - tokens are stateless, the client discards it |

`user` is the **private profile**: every field plus `interests[]`, `preferences{}`, `settings{}`,
`profileComplete`, `missingFields[]` and `completion` (0-100).

```jsonc
{
  "id": "281aec98-…", "fullName": "Ama Serwaa", "firstName": "Ama",
  "email": "ama@streetmeet.dev", "phoneNumber": null,
  "gender": "WOMAN", "birthDate": "2000-09-16", "age": 26,
  "bio": "Product designer who…", "city": "Accra", "country": "Ghana",
  "location": "Accra, Ghana", "profileImage": "/uploads/profiles/9b0f….jpg",
  "interests": ["live-music", "art", "coffee", "travel", "beach"],
  "preferences": {
    "interestedIn": ["MAN"], "minAge": 25, "maxAge": 34,
    "maxDistanceKm": 25, "relationshipGoal": "SERIOUS", "openToNearby": true
  },
  "settings": { "profileVisibility": "PUBLIC", "showAge": true, "discoverable": true, "…": "…" },
  "role": "USER", "verified": true,
  "profileComplete": true, "missingFields": [], "completion": 100
}
```

### Profile - `/api/profile`

| Method | Path | Auth | Notes |
| ------ | ---- | ---- | ----- |
| GET | `/catalogue` | public | 44 interests (grouped in 8 categories), 4 genders, 5 relationship goals, country list, limits |
| GET | `/me` | ✅ | Own private profile |
| PATCH | `/me` | ✅ | Partial update: `fullName`, `gender`, `birthDate`, `bio`, `city`, `country`, `phoneNumber`, `interests[]`, `preferences{}` |
| POST | `/onboard` | ✅ | The sign-up wizard in one request. Accepts preferences nested or flat |
| GET | `/preferences` | ✅ | Creates defaults if missing |
| PATCH | `/preferences` | ✅ | `interestedIn[]`, `minAge`, `maxAge`, `maxDistanceKm`, `relationshipGoal`, `openToNearby` |
| POST | `/photo` | ✅ | `multipart/form-data`, field name **`photo`** |
| DELETE | `/photo` | ✅ | Removes the file and clears the field |
| GET | `/:id` | ✅ | **Public** view of another member, filtered by their settings |

`PATCH /me` only touches the keys present in the body, so the edit form never accidentally blanks a
field. Sending `null` for `bio`, `city`, `country`, `phoneNumber`, `maxDistanceKm` or
`relationshipGoal` clears it.

### Settings - `/api/settings`

| Method | Path | Body | Effect |
| ------ | ---- | ---- | ------ |
| GET | `/` | – | `{ settings, account, defaults }` |
| PATCH | `/` | any settings key | Privacy + notification switches; unknown or invalid values are ignored |
| PATCH | `/email` | `email`, `password` | Password confirmed, uniqueness checked, `verified` reset to false |
| PATCH | `/password` | `currentPassword`, `newPassword` | Rotates the token, bumps `token_version` → **all other devices signed out**; returns the new `token` |
| POST | `/logout-everywhere` | – | Bumps `token_version`; every existing token stops working |
| DELETE | `/account` | `password`, `mode`, `confirmText?` | `mode: "deactivate"` (default, reversible) or `"delete"` (permanent, requires `confirmText: "DELETE"`) |

### Meta

| Path | Notes |
| ---- | ----- |
| `GET /` | Service info and module status |
| `GET /api/health` | `{ status, provider, database, members, uptimeSeconds, environment }` |
| `GET /uploads/profiles/<file>.jpg` | Served with `X-Content-Type-Options: nosniff`, a restrictive CSP and a 7-day cache |
| `GET /api/matches/*`, `/api/chat/*`, `/api/status/*`, `/api/payment/*`, `/api/admin/*` | `501 MODULE_NOT_MIGRATED` |

## 3. Validation and rules

Every rule is enforced **twice**: in the browser for instant feedback, and on the server because the
browser cannot be trusted. Server-side validation is `express-validator` chains in `src/validators/`
plus service-level checks in `src/services/`.

| Field | Rule |
| ----- | ---- |
| Name | 2-120 characters, letters/spaces/hyphens/apostrophes, whitespace collapsed |
| Email | Valid format, ≤ 320 characters, normalised to lower case, unique |
| Password | ≥ 8 characters, ≥ 1 letter, ≥ 1 digit, no character repeated 4+ times, ≤ 128 |
| Birth date | `YYYY-MM-DD`, real date, not in the future, **18-99** |
| Bio | ≤ 500 characters (20+ recommended - the completion checklist asks for it) |
| City / country | ≤ 80 characters each |
| Phone | Optional, unique, `+`, digits, spaces, `()` and `-`, 7-20 characters |
| Interests | 3-10, must exist in the catalogue, de-duplicated, returned in catalogue order |
| Gender | One of `WOMAN` / `MAN` / `NON_BINARY` / `OTHER` |
| Interested in | ≥ 1 gender from the same list |
| Age range | Integers 18-99, `minAge ≤ maxAge` |
| Distance | `null` (anywhere) or an integer 1-1000 km |
| Visibility | `PUBLIC` / `MATCHES_ONLY` / `PRIVATE` |
| Messages from | `EVERYONE` / `MATCHES` / `NOBODY` |
| Photo | JPEG/PNG/WebP only, ≤ 5 MB, re-encoded to JPEG ≤ 1000×1000 |

**Profile completion** (`profileComplete`, `missingFields`, `completion`) requires gender, birth
date, city, a 20+ character bio, a photo, ≥ 3 interests and preferences. The web client uses it for
the checklist on the profile page and the "Finish profile" button in the navbar.

## 4. Security decisions

* **Passwords** hashed with bcrypt, cost 12 (`BCRYPT_ROUNDS`). The hash never leaves the service
  layer; the API cannot return it (`safeUser()` and the DTO mappers only pick known fields).
* **Login is deliberately uniform**: a missing account and a wrong password produce the same status,
  message and roughly the same timing (bcrypt still runs against a dummy hash path), so the endpoint
  cannot be used to enumerate members.
* **JWT** (HS256, 7 days) carrying `sub`, `tv` (token version) and `role`. `authMiddleware` loads the
  account and rejects the token when `tv` differs or the account is deactivated.
* **Session revocation without a session table**: password change, "sign out of all devices",
  deactivation and deletion all bump `token_version`. The device that changed the password receives a
  fresh token in the response.
* **Uploads** are held in memory (never written raw), validated by MIME type, then re-encoded by
  sharp: EXIF (including GPS) is stripped, dimensions are capped, and any payload hidden in the
  original bytes does not survive. SVG is rejected because it can execute script. Files are stored
  under random UUID names and served with `nosniff` + a `default-src 'none'` CSP.
* **Rate limits**: 300 requests / 15 min per IP for the API, 20 / 15 min for credential endpoints
  (counting failures only), 30 photo uploads / hour.
* **helmet** on every response, `crossOriginResourcePolicy: cross-origin` so the SPA can load photos,
  CORS allow-list from `CLIENT_URL`/`CORS_ORIGINS` plus localhost and common preview hosts.
* **Privacy is applied on the server**, not in the UI: `GET /api/profile/:id` returns a filtered view
  based on the owner's `profile_visibility`, `show_age` and `show_location`. A `PRIVATE` profile
  returns `{ "private": true }` and nothing else; `MATCHES_ONLY` returns first name, photo and up to
  three interests until the matching module can confirm a match.

## 5. Web client

```
src/
  lib/api.js             fetch wrapper: token handling, envelope unwrapping, ApiError{status,code,fields}
  lib/format.js          age, initials, avatar colours, password checks, image validation
  context/AuthContext    session bootstrap, login/register/logout/refresh/rotateToken
  context/ToastContext   success/error/info toasts
  hooks/useCatalogue     one cached request for the interest + gender + goal catalogue
  hooks/useForm          form state + server field-error mapping
  components/ui/         Button, Field/TextInput/TextArea/Select/PasswordInput, Toggle, Chip/ChipGroup,
                         Avatar, Card, Modal, PhotoUploader, AgeRange, PasswordStrength
  components/            Navbar (auth aware), Footer, AppLayout, ProtectedRoute/GuestRoute, ComingSoon
  pages/                 Home, Register, Login, Onboarding, Profile, EditProfile, Settings,
                         Terms, Privacy, NotFound + ComingSoon wrappers for modules 2-6
```

Screens:

* **`/register`** - name, email, password with a live strength meter, confirm, terms. On success the
  session is adopted and the wizard opens.
* **`/login`** - email + password, a demo-account shortcut, and a reactivation mode for deactivated
  accounts.
* **`/onboarding`** - six steps (gender + birth date → city/country → interests → bio → preferences →
  photo). Progress is saved to `localStorage` so a reload does not lose it, each step validates before
  you can continue, and the photo is uploaded as soon as it is chosen. Server field errors jump the
  wizard back to the offending step.
* **`/profile`** - your profile as others see it, plus the completion checklist, interests,
  preferences and a visibility summary.
* **`/profile/edit`** - every field, the photo uploader (drag & drop, replace, remove) and
  preferences, with unsaved-change tracking and a `beforeunload` guard.
* **`/settings`** - five tabs: Account (email, password, sessions), Privacy & visibility,
  Notifications, Dating preferences, Security & closure (deactivate / delete). Switches save
  optimistically as soon as they are flipped and roll back with a toast if the API refuses.

All URLs are relative (`/api`, `/uploads`), so the browser only ever talks to the origin that served
it. Vite proxies both to the API in development - no hard-coded host, works behind any tunnel or
preview domain.

## 6. Tests

```bash
npm run test:api   # backend/scripts/smoke.js - 32 checks
npm run test:ui    # website/scripts/ui-smoke.mjs - 23 checks (needs the API running)
```

**API smoke test** boots the real app on an ephemeral port against a throwaway SQLite file and walks
the product flow: health, catalogue, register (+ weak password, + duplicate email), auth required,
onboarding (+ under-18, + unknown interest), photo upload (asserting the stored file is a resized
JPEG) and a rejected non-image, partial profile updates, interest replacement, preference updates
(+ `min > max`), the privacy-filtered public profile (+ `PRIVATE`), settings reads/writes, password
rotation and token revocation, email change, "sign out everywhere", wrong-password login,
deactivation blocking login, reactivation, `501` for unmigrated modules and `404` JSON for unknown
routes.

**UI smoke test** renders the actual React app in jsdom, pointed at the real API, and drives it with
real DOM events: home → register (including the weak-password refusal) → all six wizard steps
(including two validation refusals) → profile assertions → settings privacy toggle (asserting the
`PATCH` happened) → edit profile save → a genuine multipart photo upload through `PhotoUploader` →
sign out. It also fails if React logs an unexpected `console.error`.

## 7. Known gaps and next steps

* **Email verification** is modelled (`users.verified`, reset to `false` on email change) but there
  is no mail transport in this repo yet.
* **Password reset by email** is deliberately absent for the same reason; the login screen says so
  rather than pretending. Deactivation + reactivation covers the "I am locked out but I know my
  password" case.
* **Two-factor authentication** has a setting and a UI row marked "soon"; it needs the verification
  module.
* **`isMatch`** in `toPublicProfile` is still supplied by callers as `false`; module 2 now knows
  match state (see docs/DATING_FEATURES.md) but the public-profile view has not been switched to
  members matched - `MATCHES_ONLY` profiles are therefore restricted for everyone right now.
* **Distance filtering** stores `max_distance_km` and `city` but has no geocoding yet; module 2 will
  need coordinates (or a city-distance table) to use it.
* **Cover photo** has a column (`users.cover_image`) and no UI yet.
