# API reference

Base URL in development: `http://localhost:5000`
Base URL in production: `https://api.natthesisa.com` (or your Render URL)

Every response is wrapped:

```json
{ "success": true, "data": { … } }
{ "success": false, "message": "Human readable error", "details": { "field": "message" } }
```

Protected routes need `Authorization: Bearer <token>`.

---

## Auth

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | `fullName, email, password, gender, phone?, birthDate?, city?` | 18+ only, returns `token` + `user` + `likes` |
| POST | `/api/auth/login` | `email, password` | returns `token` + `user` + `likes` |
| GET | `/api/auth/me` | – | current user + like budget |
| POST | `/api/auth/change-password` | `currentPassword, newPassword` | |
| DELETE | `/api/auth/me` | – | deletes the account and all its data |

## Profile

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/profile/me` | full profile |
| PATCH | `/api/profile/me` | JSON (`fullName, bio, city, gender, birthDate, phone, interests[], lookingFor[], minAge, maxAge, maxDistanceKm, showMe, latitude, longitude, photos[], avatarUrl, removePhotos[]`) **or** multipart with a `photos` field |
| DELETE | `/api/profile/me/photo` | `{ url }` |
| GET | `/api/profile/:id` | public profile |
| GET | `/api/profile/blocked` | |
| POST | `/api/profile/block/:id` | blocks and deletes the match |
| DELETE | `/api/profile/block/:id` | |
| POST | `/api/profile/report/:id` | `{ reason: SPAM\|FAKE_PROFILE\|HARASSMENT\|INAPPROPRIATE\|UNDERAGE\|OTHER, details? }` |

## Discover

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/discover/feed?limit=20` | profiles + `{ likes: { likesToday, limit, remaining } }` |
| POST | `/api/discover/like/:id` | `{ superLike?: boolean }` → `{ liked, matched, matchId }` |
| POST | `/api/discover/pass/:id` | hides the profile |
| GET | `/api/discover/likes/received` | who likes you (blurred unless premium) |
| GET | `/api/discover/likes/budget` | `{ likesToday, limit, remaining }` |

## Matches & chat

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/matches` | conversations with partner + last message |
| GET | `/api/matches/:id` | one match |
| DELETE | `/api/matches/:id` | unmatch (deletes messages and likes) |
| GET | `/api/chat` | conversation list |
| GET | `/api/chat/:matchId/messages?before=<iso>&limit=50` | newest last, `nextCursor` for paging |
| POST | `/api/chat/:matchId/messages` | JSON `{ body }` or multipart `media` |
| POST | `/api/chat/:matchId/seen` | marks the partner's messages seen |

## Status

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/status/feed` | grouped per person, yours first, 24 h only |
| GET | `/api/status/mine` | your live statuses |
| POST | `/api/status` | JSON `{ caption, background, mediaUrl?, mediaType? }` or multipart `media` |
| POST | `/api/status/:id/view` | records a view |
| GET | `/api/status/:id/viewers` | owner only |
| DELETE | `/api/status/:id` | |

## Calls

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/calls/ice` | STUN/TURN servers for WebRTC |
| POST | `/api/calls/start` | `{ matchId, type: AUDIO\|VIDEO }` |
| POST | `/api/calls/:id/accept` | callee only |
| POST | `/api/calls/:id/reject` | `{ missed?: boolean }` |
| POST | `/api/calls/:id/end` | records duration |
| GET | `/api/calls/history` | |

## Payments

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/payments/plans` | active plans + `provider` + `priceLabel` |
| POST | `/api/payments/initiate` | `{ planCode, phone, network? }` → `{ reference, status, instructions }` |
| GET | `/api/payments/:reference` | poll until `SUCCESS` / `FAILED` |
| GET | `/api/payments` | your history |
| POST | `/api/payments/simulate` | **sandbox only** `{ reference, outcome }` |
| POST | `/api/payments/webhook/hubtel` | provider → you |
| POST | `/api/payments/webhook/paystack` | provider → you (HMAC verified) |

## Admin (role ADMIN)

| Method | Path |
| --- | --- |
| GET | `/api/admin/stats` |
| GET | `/api/admin/users?search=` |
| PATCH | `/api/admin/users/:id` → `{ banned?, verified?, role? }` |
| GET | `/api/admin/reports?status=OPEN\|ALL` |
| POST | `/api/admin/reports/:id/resolve` → `{ action: DISMISS\|WARN\|BAN }` |
| POST | `/api/admin/plans` |
| PATCH | `/api/admin/plans/:id` |

---

## Socket.IO events

**Client → server**

| Event | Payload |
| --- | --- |
| `chat:join` / `chat:leave` | `{ matchId }` |
| `chat:typing` / `chat:stopTyping` | `{ matchId }` |
| `chat:seen` | `{ matchId }` |
| `presence:who` | `[userId, …]` (with ack) |
| `call:initiate` | `{ to, matchId, callId, type, offer }` |
| `call:answer` | `{ to, callId, answer }` |
| `call:ice` | `{ to, callId, candidate }` |
| `call:reject` / `call:end` / `call:cancel` | `{ to, callId }` |

**Server → client**

| Event | Payload |
| --- | --- |
| `presence:update` | `{ userId, online }` |
| `like:new` | `{ from, superLike, at }` |
| `match:new` | `{ matchId, user, at }` |
| `match:removed` | `{ matchId }` |
| `message:new` | `{ id, matchId, body, mediaUrl, mediaType, senderId, createdAt }` |
| `message:seen` | `{ matchId, at }` |
| `chat:typing` / `chat:stopTyping` | `{ matchId, userId, name? }` |
| `call:incoming` | `{ callId, matchId, type, offer, from }` |
| `call:answered` | `{ callId, answer }` |
| `call:ice` | `{ callId, candidate }` |
| `call:rejected` / `call:ended` / `call:cancelled` | `{ callId }` |
| `call:busy` / `call:unavailable` / `call:failed` | `{ reason }` |

Connect with the JWT:

```js
import { io } from "socket.io-client";
const socket = io("https://api.natthesisa.com", { auth: { token } });
```

---

## Quick smoke test

```bash
API=http://localhost:5000

curl -s -X POST $API/api/auth/register -H "Content-Type: application/json" \
  -d '{"fullName":"Test User","email":"test@example.com","password":"natthesisa","gender":"MALE"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])" > /tmp/token

TOKEN=$(cat /tmp/token)
curl -s $API/api/auth/me -H "Authorization: Bearer $TOKEN"
curl -s $API/api/payments/plans
curl -s $API/api/discover/feed -H "Authorization: Bearer $TOKEN"
```
