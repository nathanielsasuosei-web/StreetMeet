# StreetMeet API

Express 5 + a portable SQL data layer. Module 1 (user accounts) is complete and tested; modules 2-6
are still in the tree and answer `501`.

Full API reference: **[`../docs/USER_ACCOUNTS.md`](../docs/USER_ACCOUNTS.md)**.

## Run it

```bash
npm install
npm run db:setup     # migrate + seed six demo accounts (password: Street1234)
npm run dev          # nodemon on :5000
```

Requires **Node 22.5+**: the development database is Node's built-in `node:sqlite`, so there is no
database server, no native module and no engine download.

| Script | What it does |
| ------ | ------------ |
| `npm run dev` / `npm start` | API server |
| `npm run db:migrate` | Apply pending migrations for the active provider |
| `npm run db:reset` | Drop all tables and re-migrate (refuses when `NODE_ENV=production`) |
| `npm run db:seed` | Create/refresh demo accounts, generating a gradient avatar for each |
| `npm run smoke` | 32 end-to-end API checks against a throwaway SQLite file |
| `npm run check` | Syntax check of the entry point |

## Environment

`cp .env.example .env` - the committed `.env` holds development defaults.

| Variable | Default | Notes |
| -------- | ------- | ----- |
| `NODE_ENV` | `development` | `production` requires a 32+ character `JWT_SECRET` and disables migration-on-boot |
| `PORT` / `HOST` | `5000` / `0.0.0.0` | |
| `DATABASE_PROVIDER` | `sqlite` | `sqlite` or `postgresql` |
| `DATABASE_URL` | `file:./dev.db` | e.g. `postgresql://user:pass@host:5432/streetmeet` |
| `DATABASE_SSL` | `false` | Managed PostgreSQL usually needs `true` |
| `DATABASE_POOL_MAX` | `10` | PostgreSQL only |
| `JWT_SECRET` | generated | Ephemeral in dev (warns), required in production |
| `JWT_EXPIRES_IN` | `7d` | |
| `BCRYPT_ROUNDS` | `12` | Clamped to 8-15 |
| `CLIENT_URL` / `CORS_ORIGINS` | `http://localhost:5173` | Comma separated list |
| `UPLOAD_DIR` | `uploads` | Relative to `backend/` |
| `UPLOAD_MAX_MB` | `5` | Clamped to 1-25 |
| `UPLOAD_MAX_DIMENSION` | `1000` | Photos are re-encoded to fit |
| `PUBLIC_UPLOAD_URL` | `/uploads` | Set a CDN origin in production |
| `AUTO_MIGRATE` | `true` (SQLite dev) | Off for PostgreSQL unless you set it |

## Layout

```
db/migrations/<sqlite|postgresql>/NNNN_name.sql   forward-only migrations, one file per dialect
scripts/migrate.js · seed.js · smoke.js           tooling

src/
  server.js            boot: mkdir uploads, migrate, listen, graceful shutdown
  app.js               Express assembly: helmet, CORS, JSON, logging, static uploads, routes, errors
  config/env.js        validated environment (fails fast on a bad value)
  config/prisma.js     legacy placeholder - answers 501 for unmigrated modules
  db/index.js          one interface over both drivers
  db/sqlite.js         node:sqlite driver, mutex-serialised
  db/postgres.js       pg driver, ? -> $n rewriting, row normalisation
  db/migrate.js        migration runner (+ reset)
  db/normalize.js      bool / iso / dateOnly / jsonList helpers
  db/sqlBuilder.js     guarded UPDATE builder
  constants/profile.js genders, interests, goals, limits - the product vocabulary
  repositories/        SQL only: userRepository, profileRepository, settingsRepository, mappers
  services/            rules and transactions: authService, profileService, settingsService
  controllers/         thin: read req, call a service, respond
  validators/          express-validator chains
  middleware/          authMiddleware, validate, upload, rateLimiters, errorHandler
  utils/               apiError, asyncHandler, hash, jwt, age, id, serialize
```

**Rule of thumb:** SQL only in repositories, decisions only in services, HTTP only in controllers.
Swapping the data layer (for Prisma, Drizzle or anything else) means touching `src/db` and
`src/repositories` - nothing above them.

### Adding a migration

Create the same file name in both dialect folders:

```
db/migrations/sqlite/0002_add_coordinates.sql
db/migrations/postgresql/0002_add_coordinates.sql
```

They are applied in filename order and recorded in `_migrations`. SQLite has no boolean, timestamp or
enum type - use `INTEGER 0/1`, `TEXT` ISO-8601 and `TEXT` + `CHECK`, then normalise the row in
`src/db/normalize.js` or a repository mapper so services never see the difference.

### Legacy modules

`src/routes/{match,chat,status,payment,admin}Routes.js` and their controllers are untouched from the
previous implementation. They depend on a Prisma client this environment cannot install, and two of
them (`paymentController.js` imports `src/models/Subscription.js`, `adminRoutes.js` imports
`adminController.js` while the file is `adminControllers.js`) reference files that do not exist, so
they would crash the process at import time.

`app.js` probes each one at boot, logs a warning when it cannot load, and mounts the path behind a
guard that returns:

```json
{ "success": false, "message": "The matching module is not part of this rebuild yet.", "code": "MODULE_NOT_MIGRATED" }
```

When you migrate a module, delete its guard line in `app.js` and mount the router normally.
`src/config/prisma.js` is a placeholder that throws the same 501 for any `prisma.*` call - delete it
once no controller imports it.

## Uploads

`POST /api/profile/photo` (multipart, field `photo`) keeps the file in memory, checks the MIME type
against an allow-list, then re-encodes it with sharp: EXIF (including GPS) stripped, attention-cropped
to at most `UPLOAD_MAX_DIMENSION`, saved as JPEG quality 82 under a random UUID name. SVG is rejected
because it can execute script. The previous file is deleted when it is replaced.

Files are served from `/uploads` with `X-Content-Type-Options: nosniff` and
`Content-Security-Policy: default-src 'none'; img-src 'self'`. In production, point
`PUBLIC_UPLOAD_URL` at a CDN or object storage and replace `storeProfileImage()` in
`src/middleware/upload.js`.

## Notes

* Requests are logged one line each in development (`LOG_REQUESTS=false` to silence).
* `express-rate-limit` uses `trust proxy = 1`; put the API behind exactly one proxy in production.
* Graceful shutdown closes the HTTP server and the database pool on `SIGINT`/`SIGTERM`.
* SQLite is a development convenience. Production runs PostgreSQL - the same SQL, the same
  repositories, `DATABASE_PROVIDER=postgresql`.
