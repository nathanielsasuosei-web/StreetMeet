# Module 2 — Dating features (discover, match, message, moderate)

Second module of the StreetMeet rebuild. Everything here runs on the portable
SQL layer from module 1 (`node:sqlite` in dev, `pg` in production) and is
covered by `backend/scripts/smoke.js` (14 dating checks) and
`website/scripts/ui-smoke.mjs` (10 dating checks).

## 1. Requirement → implementation map

| Requirement | Where it lives |
| --- | --- |
| Discover profiles | `GET /api/discover/deck` → `discoverService.deck` → swipe deck UI (`pages/Discover.jsx`) |
| Search / filter profiles | `GET /api/discover/search` → `discoverService.search` → filter panel + results grid on the same page |
| Like / pass | `POST /api/swipes` → `swipeService.swipe` (decision `LIKE` / `PASS`, stored in `likes.decision`) |
| Mutual likes → match | same endpoint: a `LIKE` that answers an existing `LIKE` creates the `matches` row in the same transaction; UI shows the `MatchModal` celebration |
| Messaging between matches | `GET/POST /api/matches/:id/messages`, `POST /api/matches/:id/read` → `matchService`; UI `pages/Conversation.jsx` |
| Block / report users | `POST/DELETE /api/users/:id/block`, `POST /api/users/:id/report`, `GET /api/blocks` → `moderationService`; UI: conversation menu, profile modal, Settings → Privacy → *Blocked members* |
| Notifications | `GET /api/notifications`, `POST /api/notifications/read`, `POST /api/notifications/:id/read` → `notificationService`; UI: navbar bell (`NotificationBell`) + `pages/Notifications.jsx` |

## 2. Data model (migration `0002_dating.sql`, identical in both dialects)

The legacy tables carried over from `0001_init.sql` were extended, not replaced:

* `likes.decision TEXT NOT NULL DEFAULT 'LIKE'` — a swipe is a like **or a
  pass**; passes persist so the deck never re-offers a skipped profile.
* `messages.match_id TEXT REFERENCES matches(id) ON DELETE CASCADE` — a thread
  belongs to its match, so membership/unread/history are indexed lookups and
  unmatching or blocking cascades the whole conversation.
* `reports.details TEXT` — free text beside the reason enum.
* `notifications` (new): `id, user_id, type LIKE|MATCH|MESSAGE, actor_id,
  match_id, payload TEXT (JSON fragment), read_at, created_at`.

`matches` rows are always stored **ordered** (lexicographically smaller user id
in `user_one_id`), which makes `UNIQUE(user_one_id, user_two_id)` a true
"one match per pair" guarantee.

## 3. Who appears in discovery

Exclusions are pushed into SQL (indexed): the viewer, deactivated accounts,
incomplete profiles (no gender/birth date), `discoverable = 0`,
`profile_visibility = 'PRIVATE'`, anyone the viewer already swiped on (deck
only — search still shows passed profiles), anyone blocked in **either**
direction, and current match partners.

Compatibility is filtered in JS because `interested_in` is a JSON array:
**both** sides must list each other's gender and fall inside each other's age
range. Nobody sees profiles they could never match with. Distance filtering
remains a documented gap (no geocoding yet).

## 4. Behaviour rules worth knowing

* **Swiping twice** on the same profile → `409`. Swiping on a blocked member or
  an already-matched one → `404` / `409`.
* **A match and its notifications are written in one transaction** with the
  reciprocal like; `MATCH` notifications respect each member's
  `matchNotifications` setting, `MESSAGE` notifications respect
  `messageNotifications`, `LIKE` notifications are always on.
* **Messaging** requires match membership. It is refused (`403`) when a block
  exists in either direction or the receiver set `allowMessagesFrom: NOBODY`.
* **Reading** a thread (opening it with unread partner messages, or receiving
  new ones while the tab is focused) calls `POST /api/matches/:id/read`; the
  matches list badge comes from `messages.seen`.
* **Blocking** is one-directional with symmetric effects: both sides vanish
  from each other's deck, the match **and its thread are deleted**, and swipes
  in both directions are dropped — all in one transaction. Unblocking restores
  discovery (the old match stays gone).
* **Unmatching** deletes the match row; messages cascade for both members.
* **Reports** are stored `OPEN` for moderators; the reported member is never
  notified. Reasons: `FAKE_PROFILE, HARASSMENT, SPAM, INAPPROPRIATE_CONTENT,
  UNDERAGE, OTHER`.
* **Polling, not sockets**: the conversation polls every 4 s, the matches list
  every 15 s, the bell every 30 s (plus on window focus, on navigation and on
  a `streetmeet:notifications` event). `src/sockets/callSocket.js` is untouched
  legacy wiring for the future call module.

## 5. API surface (all JWT-protected)

| Method & path | Purpose |
| --- | --- |
| `GET /api/discover/deck?limit` | next compatible cards (`{items, exhausted}`) |
| `GET /api/discover/search?genders&minAge&maxAge&interests&goal&location&q&limit&offset` | filtered grid (`{items, total}`) |
| `POST /api/swipes {targetId, decision}` | like/pass; `201` + `{matched, match}` on a mutual like |
| `GET /api/matches` | my matches with partner card, last message, unread count |
| `GET /api/matches/:id` | match + partner card (conversation header) |
| `GET /api/matches/:id/messages?before&limit` | thread, oldest → newest |
| `POST /api/matches/:id/messages {content}` | send (≤ 1000 chars), notifies receiver |
| `POST /api/matches/:id/read` | mark partner messages read |
| `DELETE /api/matches/:id` | unmatch (thread cascades) |
| `POST /api/users/:id/block`, `DELETE /api/users/:id/block` | block / unblock |
| `GET /api/blocks` | my blocked list |
| `POST /api/users/:id/report {reason, details?}` | file a report |
| `GET /api/notifications?limit` | `{items, unread}` |
| `POST /api/notifications/read`, `POST /api/notifications/:id/read` | mark all / one read |

Rate limits: general API 600/15 min, swipes 200/15 min, message sends 60/5 min.

## 6. Frontend map

* `pages/Discover.jsx` — deck (one card, ✕ / ⓘ / ♥), search & filter mode
  (gender chips, age range, goal, location, free text, shared interests),
  profile modal with like/pass/report/block, `MatchModal` celebration.
* `pages/Matches.jsx` — match list with previews + unread badges (15 s poll).
* `pages/Conversation.jsx` — thread bubbles, composer (Enter sends), safety
  menu (report / block / unmatch), 4 s poll + read receipts.
* `pages/Notifications.jsx` + `components/NotificationBell.jsx` — centre and
  navbar badge; reads fan out through the `streetmeet:notifications` event.
* `components/ProfileCard.jsx`, `MatchModal.jsx`, `ReportDialog.jsx` — shared
  pieces; `pages/Settings.jsx` gained the *Blocked members* panel.
* Routes: `/discover`, `/matches`, `/matches/:matchId`, `/notifications`;
  `/messages` now redirects to `/matches`.

## 7. Seed data & tests

`backend/scripts/seed.js` also writes a small social graph (re-runnable):
Ama ↔ Kwame and Zainab ↔ Efua mutual matches with real threads (one unread
message for Ama), two unanswered likes, one pass, and the matching
notifications — so every demo login has something in Matches and the bell.

Tests: `npm run test:api` (46 checks, 14 of them dating: deck exclusions,
pass/like/match, messaging + unread, search filters, block/unblock, reports,
notifications) and `npm run test:ui` (34 checks, 10 of them dating, driving the
real app against the real API with two throwaway accounts that delete
themselves at the end).

## 8. Known gaps

* No geocoding: `max_distance_km` is stored but not applied to discovery.
* No realtime transport yet (polling instead of socket.io events).
* "Likes you" is not a separate view; a like only arrives as a notification.
* Reports have no moderator console yet (module 6 owns that).
