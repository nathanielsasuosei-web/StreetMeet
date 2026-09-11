# Voice and video calls (WebRTC)

Calls are **peer to peer**. Your server never sees or stores the audio/video — it only
passes three messages between the two phones: the *offer*, the *answer*, and *ICE
candidates* (possible network routes).

---

## 1. The signalling protocol

Events live in `backend/src/sockets/calls.js` (server) and `web/src/state/CallContext.jsx`
or `mobile/src/state/CallContext.tsx` (clients).

```
A ──► server  call:initiate { to, matchId, callId, type, offer }
server ──► B  call:incoming { callId, type, offer, from }        (B's phone rings)

B ──► server  call:answer { to, callId, answer }
server ──► A  call:answered { callId, answer }                   (media starts flowing)

both ──►      call:ice { to, callId, candidate }   (many times, in both directions)

either ──►    call:end | call:reject | call:cancel → the other side cleans up
```

Server-side rules:

- You can only call someone you **matched** with (checked against the `matches` table).
- If the other person is already on a call, the caller receives `call:busy`.
- If they are offline, the caller receives `call:unavailable` (the app still shows "Calling…").
- Every call is stored in `call_sessions` with status, start/end time and duration.

---

## 2. ICE servers (STUN and TURN)

`GET /api/calls/ice` returns the list built from your environment:

```env
TURN_URLS=stun:stun.l.google.com:19302
TURN_USERNAME=
TURN_CREDENTIAL=
```

- **STUN** tells a peer its public address. Free, and enough for many home/office connections.
- **TURN** relays media when a direct connection is impossible (most mobile carriers,
  symmetric NAT, corporate Wi-Fi). **You need TURN in production** — without it, expect
  roughly one call in five to connect with no video, or to fail.

Good TURN options:

| Provider | Notes |
| --- | --- |
| [Cloudflare Calls](https://developers.cloudflare.com/calls/) | Pay-as-you-go, generous free tier |
| [Metered.ca](https://metered.ca) | 50 GB/month free TURN |
| [Twilio Network Traversal](https://www.twilio.com/docs/stun-turn) | Reliable, per-GB pricing |
| **coturn** on your own VPS | Free, ~30 min to set up, you pay for bandwidth |

With coturn:

```env
TURN_URLS=turn:turn.natthesisa.app:3478,stun:stun.l.google.com:19302
TURN_USERNAME=natthesisa
TURN_CREDENTIAL=a-long-random-secret
```

Test your TURN server: <https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/>

---

## 3. Web implementation

`web/src/lib/webrtc.js` wraps `RTCPeerConnection`:

```js
const stream = await getLocalMedia("VIDEO");        // camera + mic permission
const peer = new Peer({ iceServers, onRemoteStream, onIceCandidate });
await peer.addLocalStream(stream);
const offer = await peer.createOffer();
socket.emit("call:initiate", { to, matchId, callId, type, offer });
```

Rendering: `web/src/components/CallOverlay.jsx` — remote video fills the screen, your own
camera sits in a small floating tile, with mute / camera / hang-up buttons and a timer.
Incoming calls show a full-screen ringer with Accept / Decline.

Permissions: browsers only allow `getUserMedia` on **https** (or `localhost`). That is
handled for you — the sandbox preview and Vercel both use https.

---

## 4. Mobile implementation

`mobile/src/state/CallContext.tsx` uses `react-native-webrtc`:

```ts
import { mediaDevices, RTCPeerConnection, RTCView } from 'react-native-webrtc';

const stream = await mediaDevices.getUserMedia({ audio: true, video: true });
const peer = new RTCPeerConnection({ iceServers });
peer.addStream(stream);
// <RTCView streamURL={stream.toURL()} />
```

Because it contains native code, calls **do not run in Expo Go**. Build a development
client or an APK:

```bash
mobile$ npx expo prebuild
mobile$ npx expo run:android      # or: eas build --profile preview --platform android
```

Permissions are declared in `mobile/app.json` (`CAMERA`, `RECORD_AUDIO`,
`MODIFY_AUDIO_SETTINGS`) and requested by `expo-image-picker` / the WebRTC library.

---

## 5. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Works on Wi-Fi, black screen on mobile data | No TURN server | Add TURN (section 2) |
| "This browser cannot access the camera" | Page is not https, or permission denied | Use https; click the camera icon in the address bar |
| Rings but never connects | ICE candidates not exchanged | Check both peers reach `/api/calls/ice`; look at `chrome://webrtc-internals` |
| One-way audio/video | A peer blocked the track, or NAT | Toggle mute/camera; add TURN |
| Call ends instantly | `pc.connectionState` hit `failed` and the close handler fired | Usually NAT → TURN |
| Expo Go: "react-native-webrtc not found" | Native module missing | Use a dev build / APK |

### Inspect a live call

Chrome: open `chrome://webrtc-internals` in a second tab before starting the call and
watch ICE candidates, selected pair and bitrate.

---

## 6. Ideas to add later

- **Call history UI** — the data is already saved (`GET /api/calls/history`).
- **Push-to-talk / call on lock screen** — needs Expo Notifications with a call category.
- **Group calls** — use an SFU (LiveKit, Daily, Agora) instead of peer-to-peer.
- **Call quality stats** — `pc.getStats()` sent to your analytics endpoint.
