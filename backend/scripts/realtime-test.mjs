/**
 * Realtime test: Socket.IO auth, chat delivery, typing, presence and WebRTC signalling.
 *   npm run test:realtime      (with the dev server running)
 *
 * Uses the demo account plus any account you pass in:
 *   USER_A_EMAIL=kwame@natthesisa.app USER_B_EMAIL=demo@natthesisa.app npm run test:realtime
 */
import { io } from "socket.io-client";

const API = process.env.API_URL ?? "http://localhost:5000";
const EMAIL_A = process.env.USER_A_EMAIL ?? "kwame@natthesisa.app";
const EMAIL_B = process.env.USER_B_EMAIL ?? "demo@natthesisa.app";

let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const rest = async (path, { method = "GET", token, body } = {}) => {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  return json?.data;
};

const login = async (email) => {
  const data = await rest("/api/auth/login", { method: "POST", body: { email, password: "natthesisa" } });
  if (!data?.token) throw new Error(`Could not log in as ${email} (password: natthesisa)`);
  return data;
};

console.log(`\nRunning natthesisa realtime test against ${API}\n`);

const a = await login(EMAIL_A);
const b = await login(EMAIL_B);

const matchData = await rest("/api/matches", { token: a.token });
let match = matchData?.matches?.[0];

// If they have not matched yet, create the match first
if (!match) {
  await rest(`/api/discover/like/${b.user.id}`, { method: "POST", token: a.token, body: {} });
  const back = await rest(`/api/discover/like/${a.user.id}`, { method: "POST", token: b.token, body: {} });
  if (back?.matchId) {
    match = (await rest(`/api/matches/${back.matchId}`, { token: a.token }))?.match;
    match = { id: back.matchId, partner: match?.partner };
  }
}
if (!match) {
  console.log("❌ Could not create a match between the two test accounts");
  process.exit(1);
}
console.log(`Using match ${match.id} (${a.user.fullName} ↔ ${b.user.fullName})\n`);

const socketA = io(API, { transports: ["websocket"], auth: { token: a.token } });
const socketB = io(API, { transports: ["websocket"], auth: { token: b.token } });

await Promise.all([
  new Promise((resolve, reject) => {
    socketA.on("connect", resolve);
    socketA.on("connect_error", reject);
  }),
  new Promise((resolve, reject) => {
    socketB.on("connect", resolve);
    socketB.on("connect_error", reject);
  }),
]);
check("both sockets authenticate with the JWT", socketA.connected && socketB.connected);

socketA.emit("chat:join", { matchId: match.id });
socketB.emit("chat:join", { matchId: match.id });
await wait(300);

/* ------------------------------- typing ---------------------------------- */
const gotTyping = new Promise((resolve) => socketA.once("chat:typing", resolve));
socketB.emit("chat:typing", { matchId: match.id });
check("typing indicator delivered", Boolean(await Promise.race([gotTyping, wait(1500)])));

/* ------------------------------- messages -------------------------------- */
const gotMessage = new Promise((resolve) => socketA.once("message:new", resolve));
const sent = await rest(`/api/chat/${match.id}/messages`, {
  method: "POST",
  token: b.token,
  body: { body: "Hello from the realtime test 👋🏾" },
});
const received = await Promise.race([gotMessage, wait(2000)]);
check("message delivered instantly over the socket", received?.body === "Hello from the realtime test 👋🏾");
check("message persisted in the database", Boolean(sent?.message?.id));

/* ------------------------------ call signalling -------------------------- */
const call = await rest("/api/calls/start", {
  method: "POST",
  token: a.token,
  body: { matchId: match.id, type: "VIDEO" },
});
const callId = call?.call?.id;
check("call session created", Boolean(callId));

const gotIncoming = new Promise((resolve) => socketB.once("call:incoming", resolve));
const gotAnswered = new Promise((resolve) => socketA.once("call:answered", resolve));
const gotIce = new Promise((resolve) => socketB.once("call:ice", resolve));

socketA.emit("call:initiate", {
  to: b.user.id,
  matchId: match.id,
  callId,
  type: "VIDEO",
  offer: { sdp: "fake-offer", type: "offer" },
});
const incoming = await Promise.race([gotIncoming, wait(2000)]);
check("callee receives call:incoming with the offer", incoming?.offer?.sdp === "fake-offer");

socketB.emit("call:answer", { to: a.user.id, callId, answer: { sdp: "fake-answer", type: "answer" } });
const answered = await Promise.race([gotAnswered, wait(2000)]);
check("caller receives call:answered", answered?.answer?.sdp === "fake-answer");

socketA.emit("call:ice", { to: b.user.id, callId, candidate: { candidate: "candidate:1 1 udp" } });
const ice = await Promise.race([gotIce, wait(2000)]);
check("ICE candidate relayed between peers", ice?.candidate?.candidate === "candidate:1 1 udp");

const gotEnded = new Promise((resolve) => socketB.once("call:ended", resolve));
socketA.emit("call:end", { to: b.user.id, callId });
check("call:end reaches the other side", Boolean(await Promise.race([gotEnded, wait(2000)])));

const history = await rest("/api/calls/history", { token: a.token });
check("call recorded in history", history?.calls?.[0]?.status === "ENDED");

/* ------------------------------- presence -------------------------------- */
const who = await new Promise((resolve) => socketA.emit("presence:who", [b.user.id], resolve));
check("presence reports the partner online", Boolean(who?.online?.includes(b.user.id)));

socketA.close();
socketB.close();

console.log(failures === 0 ? "\n🎉 Realtime test passed\n" : `\n${failures} check(s) failed\n`);
process.exit(failures === 0 ? 0 : 1);
