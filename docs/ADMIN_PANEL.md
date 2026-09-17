# Module 4 — Admin control panel

Fourth module of the StreetMeet rebuild: a staff dashboard for running the
platform. Everything lives under `/api/admin` (guarded by
`requireRole("ADMIN", "MODERATOR")`) and `/admin` in the React app, and is
covered by `backend/scripts/smoke.js` (11 admin checks) and
`website/scripts/ui-smoke.mjs` (3 admin checks).

## 1. Requirement → implementation map

| Requirement | Where it lives |
| --- | --- |
| View users | `GET /api/admin/users` (paginated directory) → Members tab |
| Search users | same endpoint: `q` matches name, email or city; plus `status`, `role`, `verified` filters |
| Suspend / ban accounts | `POST /api/admin/users/:id/suspend \| ban \| reinstate` → `users.account_status` (`OK/SUSPENDED/BANNED`) + `moderation_note`; enforced in `authService.login` **and** `authMiddleware` (403 `ACCOUNT_SUSPENDED` / `ACCOUNT_BANNED`), and `token_version` is bumped so live sessions die instantly |
| Verify profiles | `POST /api/admin/users/:id/verify {verified}` → `users.verified` → ✓ on avatars/cards app-wide |
| Review reported accounts | `GET /api/admin/reports?status=OPEN\|RESOLVED`, `POST /api/admin/reports/:id/resolve {resolution, note}` — resolutions `DISMISSED / WARNED / SUSPENDED / BANNED`; a sanction resolution is applied to the reported member in the same call |
| Manage subscriptions | `GET /api/admin/subscriptions` (filters + search), `POST /api/admin/subscriptions/:id/terminate` — ends the paid window immediately and drops the member back to Free |
| View payments | same ledger: every Paystack charge (pending → active → expired/failed) with member, plan, GHS amount, channel/provider/phone and reference |
| Manage dating categories/interests | `GET/POST /api/admin/interests`, `PATCH/DELETE /api/admin/interests/:slug` — the catalogue moved from a static list into the `interests` table; deactivating hides an option from pickers without touching profiles, deleting is blocked while profiles use it |
| Send announcements | `POST /api/admin/announcements {title, body}` — stored in `announcements` and fanned out as `ANNOUNCEMENT` notifications to every member in good standing |
| View platform statistics | `GET /api/admin/stats` — totals (members, verified, matches, likes, messages, open reports, active subs by plan, revenue in GHS, moderated/featured counts), gender mix, newest members, latest payments |
| Manage featured profiles | `POST /api/admin/users/:id/feature {featured}` → `users.featured_at`; featured profiles sort first in everyone's deck and wear a ⭐ FEATURED badge |
| Registration & subscription activity | `stats.registrations` / `stats.subscriptionActivity` — 14 zero-filled day buckets, rendered as bar charts on the Overview tab |

## 2. Data model (migration `0004_admin.sql`, both dialects)

* `users` gains `account_status TEXT DEFAULT 'OK'` (`OK | SUSPENDED | BANNED`),
  `moderation_note`, `moderated_at`, `featured_at`.
* `reports` gains `resolution`, `resolution_note`, `resolved_by`, `resolved_at`
  (the `status OPEN|RESOLVED` column already existed from module 2).
* `interests` (new): `slug PK, label, emoji, category, sort_order, active,
  created_at`. Seeded on first read from the curated list in
  `constants/profile.js` (`interestService.ensureMaterialised`, guarded against
  concurrent double-inserts).
* `announcements` (new): `id, title, body, created_by, created_at`.
* `notifications.type` CHECK widened to include `ANNOUNCEMENT` (table rebuilt
  on SQLite, constraint swapped on PostgreSQL).

Role model: `users.role` (`USER | MODERATOR | ADMIN`) existed since module 1 —
both staff roles reach the panel; the seeded demo admin is
**nana@streetmeet.dev** (`Street1234`). Role changes take effect per-request
(no session kill); suspend/ban bump `token_version` so every live JWT dies.

## 3. Enforcement reach

Moderation is not cosmetic:

* suspended/banned members cannot log in **or** use existing tokens (403);
* they disappear from discover decks, search and "likes you"
  (`account_status = 'OK'` is part of the candidate SQL);
* announcements skip suspended, banned, deactivated accounts and other admins;
* featured members (`featured_at`) sort to the top of the deck ahead of VIP,
  and their card badge reads `⭐ FEATURED`.

## 4. Frontend

`pages/Admin.jsx` is a tabbed shell (Overview / Members / Reports /
Subscriptions & payments / Interests / Announcements) rendered only for staff —
everyone else is redirected to `/discover`, and the navbar shows the **Admin**
link only for `ADMIN`/`MODERATOR` roles. Tab components live in
`pages/admin/`. Members get one-click verify/feature/suspend/reinstate, a ban
modal with a moderation note, and role delegation (self-demotion is refused by
the API with 422). The notification centre renders announcements with a 📣.

## 5. Tests

* `backend/scripts/smoke.js` — 67 checks total. The admin section promotes the
  throwaway session account via SQL, then exercises: 401/403 gating, stats
  shape (14-day buckets, recent movement), directory search + filters, the
  suspend → login-blocked → reinstate loop, ban, verify + feature reaching
  discover cards (`FEATURED` badge), report review (warn, then a second report
  resolved with `SUSPENDED` sanction applied), interest CRUD (public catalogue
  updates instantly, in-use interests are protected with 409), the payments
  ledger + terminate (perks revoked immediately, double-terminate 409),
  announcement fan-out into a member's notification feed, and role delegation
  (moderator access, self-demotion 422, demotion revokes access).
* `website/scripts/ui-smoke.mjs` — 40 checks total: staff sign-in as the seeded
  admin, Overview statistics, Members search + suspend + reinstate, and the
  Reports/Payments/Interests/Announcements tabs rendering live data.
