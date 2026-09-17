# StreetMeet

A dating app built around the simple things: who you are, what you are into, and who you want to
meet.

```
backend/   Express 5 API (portable SQL data layer: SQLite in dev, PostgreSQL in production)
website/   React 19 + Vite web client
docs/      Module documentation and the legacy data-model reference
scripts/   Repo-level tooling (runs both apps together)
```

## Status

| # | Module | State |
| - | ------ | ----- |
| 1 | **User accounts** | ✅ **Rebuilt** - sign up/login, profile creation, photo, age/location/bio/interests, gender + dating preferences, edit profile, account settings |
| 2 | Matching & discovery | 🚧 Not migrated - endpoint answers `501 MODULE_NOT_MIGRATED` |
| 3 | Chat & messaging | 🚧 Not migrated |
| 4 | Status updates | 🚧 Not migrated |
| 5 | Premium & payments | 🚧 Not migrated |
| 6 | Admin & moderation | 🚧 Not migrated |

Module 1 is documented in detail in **[docs/USER_ACCOUNTS.md](docs/USER_ACCOUNTS.md)**.

The older modules are still in the repository untouched. They were written against a Prisma client
that this environment cannot download engines for, and two of them (`payments`, `admin`) import files
that do not exist, so they are mounted behind a guard that answers a clear `501` instead of crashing
the API at boot. See [backend/README.md](backend/README.md#legacy-modules).

## Quickstart

Requirements: **Node.js 22.5+** (the dev database uses the built-in `node:sqlite` module - no native
build step, no database server, no Docker).

```bash
npm run setup      # installs backend + website, migrates and seeds the dev database
npm run dev        # API on :5000, web client on :5173 (Ctrl+C stops both)
```

Then open http://localhost:5173 and sign in with a demo account:

```
ama@streetmeet.dev   /   Street1234
kwame@streetmeet.dev /   Street1234
```

Or create your own account - the sign-up wizard walks you through the whole profile.

<details>
<summary>Running the two apps separately</summary>

```bash
# terminal 1 - API
cd backend && npm install && npm run db:setup && npm run dev

# terminal 2 - web client (proxies /api and /uploads to :5000)
cd website && npm install && npm run dev
```
</details>

## Scripts

| Command | What it does |
| ------- | ------------ |
| `npm run setup` | Install everything, migrate and seed the dev database |
| `npm run dev` | API + web client together, with prefixed logs |
| `npm run dev:api` / `npm run dev:web` | One side only |
| `npm run db:migrate` | Apply pending migrations for the active provider |
| `npm run db:seed` | Create/refresh the six demo accounts (with generated avatars) |
| `npm run db:reset` | Drop every table and re-migrate (refuses in production) |
| `npm test` | API smoke test **and** UI smoke test |
| `npm run test:api` | 32 end-to-end API checks against a throwaway database |
| `npm run test:ui` | 23 checks that drive the real React app in jsdom against the real API |
| `npm run build` | Production build of the web client |
| `npm run lint` | oxlint over the web client |

## Database providers

`DATABASE_PROVIDER` picks the driver; the SQL and the API are identical either way.

| | Development | Production |
| - | ----------- | ---------- |
| Provider | `sqlite` | `postgresql` |
| Driver | `node:sqlite` (built into Node) | `pg` (pure JavaScript) |
| URL | `file:./dev.db` | `postgresql://user:pass@host:5432/streetmeet` |
| Migrations | `db/migrations/sqlite/` | `db/migrations/postgresql/` |

```bash
# production-shaped local run
DATABASE_PROVIDER=postgresql \
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/streetmeet \
AUTO_MIGRATE=false npm --prefix backend start
npm run db:migrate   # explicit migration step for PostgreSQL
```

Every migration file exists in **both** dialect folders with the same name. Add a change by creating
`0002_<name>.sql` in each - see [backend/README.md](backend/README.md#adding-a-migration).

## Why not Prisma?

The repository used Prisma. Its schema did not parse (three `User` models and several enums pasted
inline) and its query/schema engines are downloaded from `binaries.prisma.sh` at install time, which
this environment cannot reach - so nothing Prisma-based could be run, migrated or tested here.

The replacement keeps the same shape (a schema, migrations, a data layer, repositories) with two
practical wins: **zero native dependencies** for development, and one SQL model that runs on both
SQLite and PostgreSQL. `docs/legacy-prisma-schema.prisma` holds the cleaned-up Prisma model as a
reference for the remaining modules; if you want Prisma back, only `src/repositories/*` and `src/db`
need to change - services, controllers, routes and the whole web client stay as they are.

## Environment

Copy `backend/.env.example` to `backend/.env`. The committed `backend/.env` holds development
defaults (SQLite, a dev-only JWT secret).

| Variable | Default | Notes |
| -------- | ------- | ----- |
| `NODE_ENV` | `development` | `production` refuses to boot without a strong `JWT_SECRET` |
| `PORT` / `HOST` | `5000` / `0.0.0.0` | |
| `DATABASE_PROVIDER` | `sqlite` | `sqlite` or `postgresql` |
| `DATABASE_URL` | `file:./dev.db` | |
| `JWT_SECRET` | generated | Required in production, 32+ characters |
| `JWT_EXPIRES_IN` | `7d` | |
| `BCRYPT_ROUNDS` | `12` | |
| `CLIENT_URL` | `http://localhost:5173` | CORS allow-list |
| `UPLOAD_MAX_MB` | `5` | Profile photo limit |
| `PUBLIC_UPLOAD_URL` | `/uploads` | Set a CDN origin in production |
| `AUTO_MIGRATE` | `true` for SQLite dev | Always run `npm run db:migrate` yourself in production |

## Repository hygiene

This rebuild also removed dead scaffolding that made the tree hard to read: ~90 empty placeholder
files (`src/context`, `src/hooks`, `src/layouts`, `src/services`, `src/styles`, `src/utils` each
holding empty `Home.jsx`/`Login.jsx`/… copies), a nested `website/frontend` copy of the Vite starter,
a `components/VideoCall.jsx` that contained a pasted copy of the backend's `server.js`, page stubs
that exported an undefined component (so the router crashed), and the broken `prisma/schema.prisma`.

`backend/node_modules` is committed in this repository (7,300 files, with Windows-only Prisma
binaries). New `.gitignore` files stop it growing, but untracking it is a big diff that was left out
of this change on purpose:

```bash
git rm -r --cached backend/node_modules && git commit -m "chore: stop tracking node_modules"
```
