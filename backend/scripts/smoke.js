/**
 * npm run smoke
 *
 * End-to-end exercise of the User Accounts API. Boots the real app on an
 * ephemeral port against a throwaway SQLite database and walks the whole
 * product flow: sign up -> onboarding -> photo -> edit -> preferences ->
 * settings -> password change -> sessions -> deactivation -> reactivation.
 *
 * No test framework needed: `node scripts/smoke.js` exits non-zero on failure.
 */
import fs from "node:fs";
import path from "node:path";

/* Environment must be set before the app modules are imported. */
const DB_FILE = path.resolve(process.cwd(), "smoke-test.db");
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  if (fs.existsSync(DB_FILE + suffix)) fs.rmSync(DB_FILE + suffix);
}

process.env.NODE_ENV = "test";
process.env.DATABASE_PROVIDER = "sqlite";
process.env.DATABASE_URL = `file:${DB_FILE}`;
process.env.AUTO_MIGRATE = "false";
process.env.LOG_REQUESTS = "false";
process.env.JWT_SECRET = "smoke-test-secret-0123456789abcdef0123456789abcdef";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.UPLOAD_MAX_MB = "5";
process.env.BILLING_FREE_LIKE_LIMIT = "2"; // exercise the free-plan like budget

const { createApp } = await import("../src/app.js");
const { migrate } = await import("../src/db/migrate.js");
const { closeDb } = await import("../src/db/index.js");
const sharp = (await import("sharp")).default;

/* ── tiny harness ──────────────────────────────────────────────────────── */
let passed = 0;
const failures = [];

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  \u001b[32m✓\u001b[0m ${name}`);
  } catch (error) {
    failures.push({ name, message: error.message });
    console.log(`  \u001b[31m✗ ${name}\u001b[0m\n      ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label || "value"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

let baseUrl = "";

async function api(method, route, { body, token, form, headers: extraHeaders } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  Object.assign(headers, extraHeaders || {});

  const options = { method, headers };
  if (form) options.body = form;
  else if (body !== undefined) options.body = JSON.stringify(body);

  const response = await fetch(`${baseUrl}${route}`, options);

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: response.status, body: json };
}

/* ── boot ──────────────────────────────────────────────────────────────── */
await migrate({ log: false });
const app = await createApp();
const server = await new Promise((resolve) => {
  const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
});
baseUrl = `http://127.0.0.1:${server.address().port}`;

const email = `smoke+${Date.now()}@streetmeet.dev`;
const password = "Street1234";
const session = {};

console.log(`\nStreetMeet smoke test - ${baseUrl}\n`);

/* ── health + catalogue ────────────────────────────────────────────────── */
await check("GET /api/health reports a connected database", async () => {
  const { status, body } = await api("GET", "/api/health");
  assertEqual(status, 200, "status");
  assertEqual(body.data.status, "ok", "database status");
  assertEqual(body.data.provider, "sqlite", "provider");
});

await check("GET /api/profile/catalogue is public and complete", async () => {
  const { status, body } = await api("GET", "/api/profile/catalogue");
  assertEqual(status, 200, "status");
  assert(body.data.interests.length >= 20, "expected a curated interest catalogue");
  assert(body.data.genders.length === 4, "expected 4 gender options");
  assertEqual(body.data.limits.interestsMin, 3, "minimum interests");
});

/* ── sign up ───────────────────────────────────────────────────────────── */
await check("POST /api/auth/register creates an incomplete account + token", async () => {
  const { status, body } = await api("POST", "/api/auth/register", {
    body: { fullName: "Smoke Tester", email, password, confirmPassword: password },
  });
  assertEqual(status, 201, "status");
  assert(body.data.token, "expected a JWT");
  assertEqual(body.data.user.email, email, "email");
  assertEqual(body.data.user.profileComplete, false, "profileComplete");
  assert(body.data.user.missingFields.includes("photo"), "photo should be missing");
  assert(body.data.user.preferences, "default preferences should exist");
  assert(body.data.user.settings, "default settings should exist");
  assert(body.data.user.password === undefined, "password must never be returned");
  session.token = body.data.token;
  session.id = body.data.user.id;
});

await check("POST /api/auth/register rejects a weak password with field errors", async () => {
  const { status, body } = await api("POST", "/api/auth/register", {
    body: { fullName: "Weak", email: `weak+${Date.now()}@streetmeet.dev`, password: "abc" },
  });
  assertEqual(status, 422, "status");
  assert(body.fields?.password, "expected a password field error");
});

await check("POST /api/auth/register rejects a duplicate email (409)", async () => {
  const { status, body } = await api("POST", "/api/auth/register", {
    body: { fullName: "Duplicate", email, password },
  });
  assertEqual(status, 409, "status");
  assertEqual(body.code, "EMAIL_TAKEN", "code");
});

await check("GET /api/auth/me requires a token", async () => {
  const { status } = await api("GET", "/api/auth/me");
  assertEqual(status, 401, "status");
});

await check("GET /api/auth/me returns the profile for a valid token", async () => {
  const { status, body } = await api("GET", "/api/auth/me", { token: session.token });
  assertEqual(status, 200, "status");
  assertEqual(body.data.user.id, session.id, "user id");
});

/* ── onboarding ────────────────────────────────────────────────────────── */
await check("POST /api/profile/onboard completes the profile in one call", async () => {
  const { status, body } = await api("POST", "/api/profile/onboard", {
    token: session.token,
    body: {
      gender: "WOMAN",
      birthDate: "1998-04-12",
      city: "Accra",
      country: "Ghana",
      bio: "Designer who loves street food, live music and long walks in Osu looking for the best kebab.",
      interests: ["art", "coffee", "street-food", "live-music", "travel"],
      interestedIn: ["MAN"],
      minAge: 25,
      maxAge: 38,
      maxDistanceKm: 25,
      relationshipGoal: "SERIOUS",
    },
  });
  assertEqual(status, 200, "status");
  const profile = body.data.profile;
  assertEqual(profile.gender, "WOMAN", "gender");
  assertEqual(profile.age >= 25 && profile.age <= 40, true, "derived age");
  assertEqual(profile.birthDate, "1998-04-12", "birthDate");
  assertEqual(profile.interests.length, 5, "interests stored");
  assertEqual(profile.preferences.interestedIn.join(","), "MAN", "interestedIn");
  assertEqual(profile.preferences.minAge, 25, "minAge");
  assertEqual(profile.preferences.relationshipGoal, "SERIOUS", "goal");
  assert(profile.missingFields.includes("photo"), "only the photo should be missing");
});

await check("POST /api/profile/onboard refuses an under-18 birth date", async () => {
  const { status, body } = await api("POST", "/api/profile/onboard", {
    token: session.token,
    body: { birthDate: `${new Date().getUTCFullYear() - 15}-01-01` },
  });
  assertEqual(status, 422, "status");
  assert(/18/.test(body.fields?.birthDate || body.message), "expected an age error");
});

await check("POST /api/profile/onboard refuses an unknown interest", async () => {
  const { status, body } = await api("POST", "/api/profile/onboard", {
    token: session.token,
    body: { interests: ["art", "coffee", "not-a-real-interest"] },
  });
  assertEqual(status, 422, "status");
  assert(body.fields?.interests, "expected an interests field error");
});

/* ── photo ─────────────────────────────────────────────────────────────── */
await check("POST /api/profile/photo stores a re-encoded image", async () => {
  const jpeg = await sharp({
    create: { width: 1600, height: 1200, channels: 3, background: { r: 240, g: 90, b: 140 } },
  })
    .jpeg()
    .toBuffer();

  const form = new FormData();
  form.append("photo", new Blob([jpeg], { type: "image/jpeg" }), "me.jpg");

  const { status, body } = await api("POST", "/api/profile/photo", {
    token: session.token,
    form,
  });

  assertEqual(status, 200, "status");
  const image = body.data.profile.profileImage;
  assert(image?.startsWith("/uploads/profiles/"), `unexpected path: ${image}`);
  assertEqual(body.data.profile.profileComplete, true, "profileComplete");

  const file = await fetch(`${baseUrl}${image}`);
  assertEqual(file.status, 200, "image fetch status");
  const bytes = Buffer.from(await file.arrayBuffer());
  const meta = await sharp(bytes).metadata();
  assertEqual(meta.format, "jpeg", "re-encoded format");
  assert(meta.width <= 1000, `expected a resized image, got ${meta.width}px wide`);
});

await check("POST /api/profile/photo rejects a non-image upload", async () => {
  const form = new FormData();
  form.append("photo", new Blob([Buffer.from("console.log(1)")], { type: "text/javascript" }), "x.js");

  const { status } = await api("POST", "/api/profile/photo", { token: session.token, form });
  assert(status === 400 || status === 415, `expected a 4xx rejection, got ${status}`);
});

/* ── edit profile ──────────────────────────────────────────────────────── */
await check("PATCH /api/profile/me updates only the fields sent", async () => {
  const { status, body } = await api("PATCH", "/api/profile/me", {
    token: session.token,
    body: { city: "Tema", bio: "Now in Tema - still hunting for the best kebab in the country." },
  });
  assertEqual(status, 200, "status");
  assertEqual(body.data.profile.city, "Tema", "city");
  assertEqual(body.data.profile.gender, "WOMAN", "gender untouched");
  assertEqual(body.data.profile.interests.length, 5, "interests untouched");
});

await check("PATCH /api/profile/me replaces the interest set", async () => {
  const { status, body } = await api("PATCH", "/api/profile/me", {
    token: session.token,
    body: { interests: ["music", "yoga", "reading", "coffee"] },
  });
  assertEqual(status, 200, "status");
  assertEqual(body.data.profile.interests.join(","), "music,coffee,yoga,reading", "catalogue order");
});

await check("PATCH /api/profile/me rejects too few interests", async () => {
  const { status } = await api("PATCH", "/api/profile/me", {
    token: session.token,
    body: { interests: ["music"] },
  });
  assertEqual(status, 422, "status");
});

/* ── preferences ───────────────────────────────────────────────────────── */
await check("PATCH /api/profile/preferences updates the age range", async () => {
  const { status, body } = await api("PATCH", "/api/profile/preferences", {
    token: session.token,
    body: { minAge: 27, maxAge: 45, maxDistanceKm: null, openToNearby: false },
  });
  assertEqual(status, 200, "status");
  assertEqual(body.data.preferences.minAge, 27, "minAge");
  assertEqual(body.data.preferences.maxDistanceKm, null, "distance cleared");
  assertEqual(body.data.preferences.openToNearby, false, "openToNearby");
});

await check("PATCH /api/profile/preferences rejects min > max", async () => {
  const { status, body } = await api("PATCH", "/api/profile/preferences", {
    token: session.token,
    body: { minAge: 50, maxAge: 30 },
  });
  assertEqual(status, 422, "status");
  assert(body.fields?.minAge, "expected a minAge field error");
});

/* ── public profile ────────────────────────────────────────────────────── */
await check("GET /api/profile/:id returns a privacy-filtered public profile", async () => {
  const { status, body } = await api("GET", `/api/profile/${session.id}`, { token: session.token });
  assertEqual(status, 200, "status");
  assertEqual(body.data.profile.id, session.id, "id");
  assert(body.data.profile.email === undefined, "email must not leak");
  assert(body.data.profile.passwordHash === undefined, "hash must not leak");
});

await check("GET /api/profile/:id hides everything when visibility is PRIVATE", async () => {
  await api("PATCH", "/api/settings", {
    token: session.token,
    body: { profileVisibility: "PRIVATE" },
  });
  const { body } = await api("GET", `/api/profile/${session.id}`, { token: session.token });
  assertEqual(body.data.profile.private, true, "private flag");
  assertEqual(body.data.profile.profileImage, null, "photo hidden");
  await api("PATCH", "/api/settings", { token: session.token, body: { profileVisibility: "PUBLIC" } });
});

await check("GET /api/profile/unknown-id returns 404", async () => {
  const { status } = await api("GET", "/api/profile/does-not-exist", { token: session.token });
  assertEqual(status, 404, "status");
});

/* ── module 2: discover, swipe, match, message, moderate, notify ───────── */
const dating = {};

async function registerOnboard({ name, gender, birthDate, city, interestedIn, minAge, maxAge }) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const mail = `smoke.${slug}.${Date.now()}@streetmeet.dev`;
  const reg = await api("POST", "/api/auth/register", {
    body: { fullName: name, email: mail, password, confirmPassword: password },
  });
  assertEqual(reg.status, 201, `${name} register`);
  const onboard = await api("POST", "/api/profile/onboard", {
    token: reg.body.data.token,
    body: {
      gender,
      birthDate,
      city,
      country: "Ghana",
      bio: "Smoke test profile with enough words in the bio to pass validation rules.",
      interests: ["coffee", "tech", "travel"],
      interestedIn,
      minAge,
      maxAge,
    },
  });
  assertEqual(onboard.status, 200, `${name} onboard`);
  return { token: reg.body.data.token, id: reg.body.data.user.id, email: mail };
}

await check("GET /api/discover/deck offers only compatible, complete members", async () => {
  dating.b = await registerOnboard({
    name: "Smoke Buddy", gender: "MAN", birthDate: "1985-02-02", city: "Tema",
    interestedIn: ["WOMAN"], minAge: 25, maxAge: 40,
  });
  dating.d = await registerOnboard({
    name: "Smoke Decoy", gender: "MAN", birthDate: "1990-06-06", city: "Tema",
    interestedIn: ["WOMAN"], minAge: 25, maxAge: 40,
  });
  dating.incomplete = await api("POST", "/api/auth/register", {
    body: {
      fullName: "Incomplete Person",
      email: `smoke.incomplete.${Date.now()}@streetmeet.dev`,
      password,
      confirmPassword: password,
    },
  });

  const { status, body } = await api("GET", "/api/discover/deck", { token: session.token });
  assertEqual(status, 200, "status");
  const ids = body.data.items.map((card) => card.id);
  assert(ids.includes(dating.b.id), "compatible onboarded member is offered");
  assert(ids.includes(dating.d.id), "second compatible member is offered");
  assert(!ids.includes(dating.incomplete.body.data.user.id), "incomplete profiles stay hidden");
  const card = body.data.items.find((entry) => entry.id === dating.b.id);
  assertEqual(card.age, 41, "card age is derived");
  assert(card.interests.length === 3, "card carries interests");
});

await check("POST /api/swipes PASS removes the profile from the deck", async () => {
  const swipe = await api("POST", "/api/swipes", {
    token: session.token,
    body: { targetId: dating.d.id, decision: "PASS" },
  });
  assertEqual(swipe.status, 200, "status");
  assertEqual(swipe.body.data.matched, false, "a pass never matches");

  const deck = await api("GET", "/api/discover/deck", { token: session.token });
  assert(!deck.body.data.items.some((card) => card.id === dating.d.id), "passed profile is gone");
});

await check("POST /api/swipes LIKE without a reciprocal like does not match", async () => {
  const { status, body } = await api("POST", "/api/swipes", {
    token: session.token,
    body: { targetId: dating.b.id, decision: "LIKE" },
  });
  assertEqual(status, 200, "status");
  assertEqual(body.data.matched, false, "one-sided like is not a match");

  const dup = await api("POST", "/api/swipes", {
    token: session.token,
    body: { targetId: dating.b.id, decision: "LIKE" },
  });
  assertEqual(dup.status, 409, "swiping twice is a conflict");
});

await check("a reciprocal LIKE creates the match and notifies both", async () => {
  const { status, body } = await api("POST", "/api/swipes", {
    token: dating.b.token,
    body: { targetId: session.id, decision: "LIKE" },
  });
  assertEqual(status, 201, "status");
  assertEqual(body.data.matched, true, "mutual like matches");
  dating.matchId = body.data.match.id;

  const mine = await api("GET", "/api/matches", { token: session.token });
  assert(mine.body.data.items.some((m) => m.id === dating.matchId), "match listed for me");
  const theirs = await api("GET", "/api/matches", { token: dating.b.token });
  const row = theirs.body.data.items.find((m) => m.id === dating.matchId);
  assert(row, "match listed for them");
  assertEqual(row.partner.id, session.id, "partner card is me");

  const notes = await api("GET", "/api/notifications", { token: session.token });
  assert(notes.body.data.items.some((n) => n.type === "MATCH"), "match notification for me");
});

await check("matched partners leave the discover deck", async () => {
  const { body } = await api("GET", "/api/discover/deck", { token: session.token });
  assert(!body.data.items.some((card) => card.id === dating.b.id), "partner not re-offered");
});

await check("POST /api/matches/:id/messages sends and notifies the receiver", async () => {
  const { status, body } = await api("POST", `/api/matches/${dating.matchId}/messages`, {
    token: session.token,
    body: { content: "Hello from the smoke test!" },
  });
  assertEqual(status, 201, "status");
  assertEqual(body.data.mine, true, "message echoes as mine");

  const theirs = await api("GET", "/api/matches", { token: dating.b.token });
  const row = theirs.body.data.items.find((m) => m.id === dating.matchId);
  assertEqual(row.unread, 1, "receiver sees one unread");
  assertEqual(row.lastMessage.content, "Hello from the smoke test!", "preview text");

  const notes = await api("GET", "/api/notifications", { token: dating.b.token });
  const note = notes.body.data.items.find((n) => n.type === "MESSAGE");
  assert(note, "message notification exists");
  assertEqual(note.payload.preview, "Hello from the smoke test!", "preview payload");
});

await check("GET /api/matches/:id/messages returns the thread in order", async () => {
  await api("POST", `/api/matches/${dating.matchId}/messages`, {
    token: dating.b.token,
    body: { content: "And a reply." },
  });
  const { status, body } = await api("GET", `/api/matches/${dating.matchId}/messages`, {
    token: session.token,
  });
  assertEqual(status, 200, "status");
  assertEqual(body.data.items.length, 2, "two messages");
  assertEqual(body.data.items[0].mine, true, "oldest first");
  assertEqual(body.data.items[1].content, "And a reply.", "newest last");

  const stranger = await api("GET", "/api/matches/not-a-match/messages", { token: session.token });
  assertEqual(stranger.status, 404, "unknown match is 404");
});

await check("POST /api/matches/:id/read clears the unread counter", async () => {
  const { status } = await api("POST", `/api/matches/${dating.matchId}/read`, {
    token: dating.b.token,
  });
  assertEqual(status, 200, "status");
  const theirs = await api("GET", "/api/matches", { token: dating.b.token });
  const row = theirs.body.data.items.find((m) => m.id === dating.matchId);
  assertEqual(row.unread, 0, "unread cleared");
});

await check("GET /api/discover/search honours gender, age and location filters", async () => {
  const hit = await api("GET", "/api/discover/search?genders=MAN&minAge=35&maxAge=45&location=tema", {
    token: session.token,
  });
  // search keeps passed profiles but hides current match partners
  assert(hit.body.data.items.some((card) => card.id === dating.d.id), "filter finds the passed member");
  assert(!hit.body.data.items.some((card) => card.id === dating.b.id), "current match stays out of search");

  const missGender = await api("GET", "/api/discover/search?genders=WOMAN", { token: session.token });
  assert(!missGender.body.data.items.some((card) => card.id === dating.b.id), "gender filter excludes");

  const missPlace = await api("GET", "/api/discover/search?location=atlantis", { token: session.token });
  assertEqual(missPlace.body.data.total, 0, "location filter excludes");

  const bad = await api("GET", "/api/discover/search?genders=ROBOT", { token: session.token });
  assertEqual(bad.status, 422, "unknown gender filter is rejected");
});

await check("blocking removes the match, the thread and both decks", async () => {
  const { status } = await api("POST", `/api/users/${dating.b.id}/block`, { token: session.token });
  assertEqual(status, 200, "status");

  const mine = await api("GET", "/api/matches", { token: session.token });
  assertEqual(mine.body.data.items.length, 0, "my matches are gone");
  const theirs = await api("GET", "/api/matches", { token: dating.b.token });
  assertEqual(theirs.body.data.items.length, 0, "their matches are gone");

  const myDeck = await api("GET", "/api/discover/deck", { token: session.token });
  assert(!myDeck.body.data.items.some((c) => c.id === dating.b.id), "blocked member hidden from me");
  const theirDeck = await api("GET", "/api/discover/deck", { token: dating.b.token });
  assert(!theirDeck.body.data.items.some((c) => c.id === session.id), "I am hidden from them");

  const blocked = await api("GET", "/api/blocks", { token: session.token });
  assertEqual(blocked.body.data.items[0].profile.id, dating.b.id, "block list shows them");

  const send = await api("POST", `/api/matches/${dating.matchId}/messages`, {
    token: session.token,
    body: { content: "still there?" },
  });
  assertEqual(send.status, 404, "deleted match refuses messages");
});

await check("unblocking restores discovery but not the old match", async () => {
  const { status } = await api("DELETE", `/api/users/${dating.b.id}/block`, { token: session.token });
  assertEqual(status, 200, "status");
  const myDeck = await api("GET", "/api/discover/deck", { token: session.token });
  assert(myDeck.body.data.items.some((c) => c.id === dating.b.id), "swipes were dropped, deck is fresh");
});

await check("reports need a valid reason and are stored open", async () => {
  const ok = await api("POST", `/api/users/${dating.b.id}/report`, {
    token: session.token,
    body: { reason: "SPAM", details: "Smoke test report." },
  });
  assertEqual(ok.status, 201, "status");
  assertEqual(ok.body.data.status, "OPEN", "report opens");

  const bad = await api("POST", `/api/users/${dating.b.id}/report`, {
    token: session.token,
    body: { reason: "BECAUSE" },
  });
  assertEqual(bad.status, 422, "invalid reason rejected");
  assert(bad.body.fields?.reason, "field error for reason");
});

await check("notifications list unread counts and mark-all-read", async () => {
  const before = await api("GET", "/api/notifications", { token: dating.b.token });
  assert(before.body.data.unread >= 1, "they have unread notifications");

  const all = await api("POST", "/api/notifications/read", { token: dating.b.token });
  assertEqual(all.status, 200, "status");
  assertEqual(all.body.data.unread, 0, "unread cleared");

  const after = await api("GET", "/api/notifications", { token: dating.b.token });
  assert(after.body.data.items.every((n) => n.readAt), "everything read");
});

await check("messaging requires a real match you belong to", async () => {
  const stranger = await api("POST", `/api/matches/${dating.matchId}/messages`, {
    token: dating.d.token,
    body: { content: "let me in" },
  });
  assertEqual(stranger.status, 404, "non-members get 404");
});

/* ── settings ──────────────────────────────────────────────────────────── */
await check("GET /api/settings returns settings + account summary", async () => {
  const { status, body } = await api("GET", "/api/settings", { token: session.token });
  assertEqual(status, 200, "status");
  assertEqual(body.data.settings.profileVisibility, "PUBLIC", "visibility");
  assertEqual(body.data.account.email, email, "email");
  assert(body.data.account.passwordHash === undefined, "no hash in settings");
});

await check("PATCH /api/settings toggles privacy and notifications", async () => {
  const { status, body } = await api("PATCH", "/api/settings", {
    token: session.token,
    body: {
      showAge: false,
      discoverable: false,
      allowMessagesFrom: "EVERYONE",
      productUpdates: true,
      matchNotifications: false,
    },
  });
  assertEqual(status, 200, "status");
  assertEqual(body.data.settings.showAge, false, "showAge");
  assertEqual(body.data.settings.discoverable, false, "discoverable");
  assertEqual(body.data.settings.allowMessagesFrom, "EVERYONE", "messages");
  assertEqual(body.data.settings.productUpdates, true, "productUpdates");
  assertEqual(body.data.settings.matchNotifications, false, "matchNotifications");
});

await check("PATCH /api/settings ignores an invalid visibility value", async () => {
  const { status, body } = await api("PATCH", "/api/settings", {
    token: session.token,
    body: { profileVisibility: "SEMI_PUBLIC" },
  });
  assertEqual(status, 422, "status");
  assert(body.fields?.profileVisibility, "expected a field error");
});

/* ── password / sessions ───────────────────────────────────────────────── */
await check("PATCH /api/settings/password rejects a wrong current password", async () => {
  const { status } = await api("PATCH", "/api/settings/password", {
    token: session.token,
    body: { currentPassword: "wrong-password1", newPassword: "NewStreet1234" },
  });
  assertEqual(status, 401, "status");
});

await check("PATCH /api/settings/password rotates the token and revokes old ones", async () => {
  const newPassword = "NewStreet1234";
  const { status, body } = await api("PATCH", "/api/settings/password", {
    token: session.token,
    body: { currentPassword: password, newPassword, confirmPassword: newPassword },
  });
  assertEqual(status, 200, "status");
  assert(body.data.token, "expected a fresh token");
  assert(body.data.token !== session.token, "token should have changed");

  const stale = await api("GET", "/api/auth/me", { token: session.token });
  assertEqual(stale.status, 401, "old token must be revoked");
  assertEqual(stale.body.code, "TOKEN_REVOKED", "revocation code");

  const fresh = await api("GET", "/api/auth/me", { token: body.data.token });
  assertEqual(fresh.status, 200, "new token must work");

  session.token = body.data.token;
  session.password = newPassword;
});

await check("PATCH /api/settings/email requires the password and updates login", async () => {
  const nextEmail = `smoke-renamed+${Date.now()}@streetmeet.dev`;

  const refused = await api("PATCH", "/api/settings/email", {
    token: session.token,
    body: { email: nextEmail, password: "not-my-password" },
  });
  assertEqual(refused.status, 401, "wrong password must be refused");

  const accepted = await api("PATCH", "/api/settings/email", {
    token: session.token,
    body: { email: nextEmail, password: session.password },
  });
  assertEqual(accepted.status, 200, "status");

  const login = await api("POST", "/api/auth/login", {
    body: { email: nextEmail, password: session.password },
  });
  assertEqual(login.status, 200, "login with the new email");
  session.email = nextEmail;
});

await check("POST /api/settings/logout-everywhere invalidates the current token", async () => {
  const { status } = await api("POST", "/api/settings/logout-everywhere", { token: session.token });
  assertEqual(status, 200, "status");

  const after = await api("GET", "/api/auth/me", { token: session.token });
  assertEqual(after.status, 401, "token must be revoked");

  const login = await api("POST", "/api/auth/login", {
    body: { email: session.email, password: session.password },
  });
  assertEqual(login.status, 200, "login again");
  session.token = login.body.data.token;
});

/* ── login errors ──────────────────────────────────────────────────────── */
await check("POST /api/auth/login rejects a wrong password with a generic message", async () => {
  const { status, body } = await api("POST", "/api/auth/login", {
    body: { email: session.email, password: "DefinitelyWrong1" },
  });
  assertEqual(status, 401, "status");
  assert(!/no such user|not found/i.test(body.message), "must not reveal whether the account exists");
});

/* ── deactivation + reactivation ───────────────────────────────────────── */
await check("DELETE /api/settings/account deactivates and blocks login", async () => {
  const { status } = await api("DELETE", "/api/settings/account", {
    token: session.token,
    body: { password: session.password, mode: "deactivate" },
  });
  assertEqual(status, 200, "status");

  const blocked = await api("POST", "/api/auth/login", {
    body: { email: session.email, password: session.password },
  });
  assertEqual(blocked.status, 403, "login must be blocked");
  assertEqual(blocked.body.code, "ACCOUNT_DEACTIVATED", "code");

  const me = await api("GET", "/api/auth/me", { token: session.token });
  assertEqual(me.status, 403, "existing token must stop working");
});

await check("POST /api/auth/reactivate restores the account", async () => {
  const { status, body } = await api("POST", "/api/auth/reactivate", {
    body: { email: session.email, password: session.password },
  });
  assertEqual(status, 200, "status");
  assert(body.data.token, "expected a token");
  assertEqual(body.data.user.profileComplete, true, "profile survived deactivation");

  const me = await api("GET", "/api/auth/me", { token: body.data.token });
  assertEqual(me.status, 200, "token works");
});

/* ── module 3: plans, checkout, paystack (mock), perks, expiry ─────────── */
const billing = {};

// module 1's session tests (logout-everywhere, deactivate/reactivate) killed
// the original token, so the billing section signs back in first
const billingLogin = await api("POST", "/api/auth/login", {
  body: { email: session.email, password: session.password },
});
assertEqual(billingLogin.status, 200, "billing section re-login");
session.token = billingLogin.body.data.token;

await check("GET /api/billing/plans publishes the catalogue and my free state", async () => {
  const { status, body } = await api("GET", "/api/billing/plans", { token: session.token });
  assertEqual(status, 200, "status");
  assertEqual(body.data.plans.length, 3, "three plans");
  assertEqual(body.data.plan, "FREE", "current plan");
  assertEqual(body.data.perks.unlimitedLikes, false, "free perk matrix");
  assertEqual(body.data.limits.freeLikesPerDay, 2, "env-driven like limit");
});

await check("advanced search filters are a paid perk", async () => {
  const { status, body } = await api("GET", "/api/discover/search?interests=coffee", {
    token: session.token,
  });
  assertEqual(status, 402, "status");
  assertEqual(body.code, "PLAN_REQUIRED", "code");

  const basic = await api("GET", "/api/discover/search?location=accra", { token: session.token });
  assertEqual(basic.status, 200, "basic filters stay free");
});

await check("seeing who liked you is VIP-only", async () => {
  const { status, body } = await api("GET", "/api/discover/likes-you", { token: session.token });
  assertEqual(status, 402, "status");
  assertEqual(body.code, "PLAN_REQUIRED", "code");
});

await check("the free like budget stops the third like", async () => {
  const second = await api("POST", "/api/swipes", {
    token: session.token,
    body: { targetId: dating.b.id, decision: "LIKE" },
  });
  assertEqual(second.status, 200, "second like of the day");

  billing.buddy3 = await registerOnboard({
    name: "Smoke Third", gender: "MAN", birthDate: "1988-03-03", city: "Accra",
    interestedIn: ["WOMAN"], minAge: 25, maxAge: 45,
  });
  const third = await api("POST", "/api/swipes", {
    token: session.token,
    body: { targetId: billing.buddy3.id, decision: "LIKE" },
  });
  assertEqual(third.status, 200, "second like of the day");

  billing.buddy4 = await registerOnboard({
    name: "Smoke Fourth", gender: "MAN", birthDate: "1987-07-07", city: "Accra",
    interestedIn: ["WOMAN"], minAge: 25, maxAge: 45,
  });
  const over = await api("POST", "/api/swipes", {
    token: session.token,
    body: { targetId: billing.buddy4.id, decision: "LIKE" },
  });
  assertEqual(over.status, 402, "third like is refused");
  assertEqual(over.body.code, "LIKE_LIMIT_REACHED", "code");
});

await check("checkout validates plan, channel and wallet phone", async () => {
  const free = await api("POST", "/api/billing/checkout", {
    token: session.token,
    body: { plan: "FREE", channel: "card" },
  });
  assertEqual(free.status, 422, "FREE is not a paid plan");

  const noPhone = await api("POST", "/api/billing/checkout", {
    token: session.token,
    body: { plan: "PREMIUM", channel: "mobile_money" },
  });
  assertEqual(noPhone.status, 422, "momo needs a phone");
  assert(noPhone.body.fields?.phone, "phone field error");
});

await check("checkout creates a PENDING subscription and a mock checkout url", async () => {
  const { status, body } = await api("POST", "/api/billing/checkout", {
    token: session.token,
    body: { plan: "PREMIUM", channel: "mobile_money", phone: "0244000000", provider: "mtn" },
  });
  assertEqual(status, 201, "status");
  assertEqual(body.data.mode, "mock", "mock paystack without a secret key");
  assert(body.data.reference, "reference");
  assert(body.data.checkoutUrl.includes("reference="), "checkout url carries the reference");
  billing.reference = body.data.reference;

  const current = await api("GET", "/api/billing/subscription", { token: session.token });
  assertEqual(current.body.data.history[0].status, "PENDING", "subscription pending");
  assertEqual(current.body.data.subscription, null, "nothing live yet");

  const early = await api("POST", "/api/billing/verify", {
    token: session.token,
    body: { reference: billing.reference },
  });
  assertEqual(early.body.data.active, false, "unapproved payment does not activate");
});

await check("approving the payment activates the plan with a real window", async () => {
  const approved = await api("POST", "/api/billing/mock-pay", {
    token: session.token,
    body: { reference: billing.reference },
  });
  assertEqual(approved.status, 200, "mock approval");

  const verified = await api("POST", "/api/billing/verify", {
    token: session.token,
    body: { reference: billing.reference },
  });
  assertEqual(verified.body.data.active, true, "subscription active");
  assertEqual(verified.body.data.plan, "PREMIUM", "plan");
  assert(verified.body.data.expiresAt > new Date().toISOString(), "expiry in the future");

  const plans = await api("GET", "/api/billing/plans", { token: session.token });
  assertEqual(plans.body.data.plan, "PREMIUM", "catalogue reflects premium");
  assertEqual(plans.body.data.perks.advancedFilters, true, "premium perk");

  const search = await api("GET", "/api/discover/search?interests=coffee", { token: session.token });
  assertEqual(search.status, 200, "advanced filters unlocked");
});

await check("premium unlocks unlimited likes and read receipts", async () => {
  const third = await api("POST", "/api/swipes", {
    token: session.token,
    body: { targetId: billing.buddy4.id, decision: "LIKE" },
  });
  assertEqual(third.status, 200, "unlimited likes now");

  const back = await api("POST", "/api/swipes", {
    token: billing.buddy4.token,
    body: { targetId: session.id, decision: "LIKE" },
  });
  assertEqual(back.status, 201, "mutual like matches");
  billing.matchId = back.body.data.match.id;

  await api("POST", `/api/matches/${billing.matchId}/messages`, {
    token: session.token,
    body: { content: "Testing read receipts." },
  });
  const readResp = await api("POST", `/api/matches/${billing.matchId}/read`, { token: billing.buddy4.token });
  assertEqual(readResp.status, 200, "partner marks the thread read");

  const thread = await api("GET", `/api/matches/${billing.matchId}/messages`, {
    token: session.token,
  });
  assertEqual(thread.body.data.readReceipts, true, "receipts on for premium");
  const mine = thread.body.data.items.find((message) => message.mine);
  assertEqual(mine.seen, true, "my message shows as read");
});

await check("a signed charge.success webhook activates VIP", async () => {
  const checkout = await api("POST", "/api/billing/checkout", {
    token: session.token,
    body: { plan: "VIP", channel: "card" },
  });
  assertEqual(checkout.status, 201, "vip checkout");
  billing.vipReference = checkout.body.data.reference;

  const crypto = await import("node:crypto");
  const payload = JSON.stringify({
    event: "charge.success",
    data: { reference: billing.vipReference },
  });
  const signature = crypto
    .createHmac("sha512", "streetmeet-mock-paystack-secret")
    .update(payload, "utf8")
    .digest("hex");

  const bad = await api("POST", "/api/billing/webhook", {
    body: JSON.parse(payload),
    headers: { "x-paystack-signature": "nope" },
  });
  assertEqual(bad.status, 400, "bad signature rejected");

  const good = await api("POST", "/api/billing/webhook", {
    body: JSON.parse(payload),
    headers: { "x-paystack-signature": signature },
  });
  assert(
    good.body.data?.activated === true,
    `webhook responded ${good.status}: ${JSON.stringify(good.body)}`,
  );

  const plans = await api("GET", "/api/billing/plans", { token: session.token });
  assertEqual(plans.body.data.plan, "VIP", "vip is live");
  const likesYou = await api("GET", "/api/discover/likes-you", { token: session.token });
  assertEqual(likesYou.status, 200, "likes-you unlocked for vip");
});

await check("expired subscriptions drop back to free and get swept", async () => {
  const { db } = await import("../src/db/index.js");
  await db.run("UPDATE subscriptions SET expires_at = ? WHERE user_id = ?", [
    "2020-01-01T00:00:00.000Z",
    session.id,
  ]);

  const plans = await api("GET", "/api/billing/plans", { token: session.token });
  assertEqual(plans.body.data.plan, "FREE", "expiry is honoured on read");

  const { expireStale } = await import("../src/repositories/subscriptionRepository.js");
  const flipped = await expireStale();
  assert(flipped >= 1, "sweeper flips stale rows");

  const current = await api("GET", "/api/billing/subscription", { token: session.token });
  assert(
    current.body.data.history.every((row) => row.active === false),
    "nothing stays live after expiry",
  );
  assert(
    current.body.data.history.some((row) => row.status === "EXPIRED"),
    "swept rows are marked EXPIRED",
  );
});

/* ── module 4: admin control panel ───────────────────────────────────────── */
const admin = {};

await check("the admin API is closed to regular members", async () => {
  const denied = await api("GET", "/api/admin/stats", { token: billing.buddy4.token });
  assertEqual(denied.status, 403, "members are forbidden");

  const anonymous = await api("GET", "/api/admin/stats");
  assertEqual(anonymous.status, 401, "strangers are unauthorized");
});

await check("a promoted admin sees platform statistics and activity", async () => {
  const { db } = await import("../src/db/index.js");
  await db.run("UPDATE users SET role = 'ADMIN' WHERE id = ?", [session.id]);

  const { status, body } = await api("GET", "/api/admin/stats", { token: session.token });
  assertEqual(status, 200, "status");
  assert(body.data.totals.members >= 6, "member count");
  assert(body.data.totals.openReports >= 1, "the module-2 report is still open");
  assertEqual(body.data.registrations.length, 14, "two weeks of registration buckets");
  assertEqual(body.data.subscriptionActivity.length, 14, "two weeks of subscription buckets");
  assert(body.data.recentMembers.length >= 5, "recent members");
  assert(body.data.recentPayments.length >= 1, "the billing section left payments behind");
});

await check("admins can search and filter the member directory", async () => {
  const found = await api("GET", "/api/admin/users?q=Fourth", { token: session.token });
  assertEqual(found.status, 200, "status");
  assert(found.body.data.items.some((member) => member.id === billing.buddy4.id), "name search matches");

  const unverified = await api("GET", "/api/admin/users?verified=false", { token: session.token });
  assert(unverified.body.data.items.every((member) => member.verified === false), "verified filter");
  assert(unverified.body.data.pages >= 1, "pagination metadata");
});

await check("suspend blocks login and live tokens until reinstated", async () => {
  const suspended = await api("POST", `/api/admin/users/${billing.buddy3.id}/suspend`, {
    token: session.token,
    body: { note: "Spamming likes" },
  });
  assertEqual(suspended.status, 200, "status");
  assertEqual(suspended.body.data.accountStatus, "SUSPENDED", "account status");
  assertEqual(suspended.body.data.moderationNote, "Spamming likes", "note stored");

  const stale = await api("GET", "/api/auth/me", { token: billing.buddy3.token });
  assertEqual(stale.status, 403, "live token refused");
  assertEqual(stale.body.code, "ACCOUNT_SUSPENDED", "code");

  const login = await api("POST", "/api/auth/login", {
    body: { email: billing.buddy3.email, password },
  });
  assertEqual(login.status, 403, "login refused");
  assertEqual(login.body.code, "ACCOUNT_SUSPENDED", "code");

  const reinstated = await api("POST", `/api/admin/users/${billing.buddy3.id}/reinstate`, {
    token: session.token,
  });
  assertEqual(reinstated.body.data.accountStatus, "OK", "reinstated");

  const back = await api("POST", "/api/auth/login", {
    body: { email: billing.buddy3.email, password },
  });
  assertEqual(back.status, 200, "login works again");
  billing.buddy3.token = back.body.data.token;
});

await check("ban is enforced everywhere until an admin lifts it", async () => {
  const banned = await api("POST", `/api/admin/users/${billing.buddy3.id}/ban`, {
    token: session.token,
    body: { note: "Repeat offender" },
  });
  assertEqual(banned.body.data.accountStatus, "BANNED", "banned");

  const stale = await api("GET", "/api/auth/me", { token: billing.buddy3.token });
  assertEqual(stale.body.code, "ACCOUNT_BANNED", "token refused");

  const login = await api("POST", "/api/auth/login", {
    body: { email: billing.buddy3.email, password },
  });
  assertEqual(login.body.code, "ACCOUNT_BANNED", "login refused");
});

await check("verification and featuring reach discover cards", async () => {
  admin.viewer = await registerOnboard({
    name: "Smoke Viewer", gender: "WOMAN", birthDate: "1995-05-05", city: "Accra",
    interestedIn: ["MAN"], minAge: 25, maxAge: 45,
  });

  const verified = await api("POST", `/api/admin/users/${billing.buddy4.id}/verify`, {
    token: session.token,
    body: { verified: true },
  });
  assertEqual(verified.body.data.verified, true, "verified");

  const featured = await api("POST", `/api/admin/users/${billing.buddy4.id}/feature`, {
    token: session.token,
    body: { featured: true },
  });
  assert(featured.body.data.featuredAt, "featured timestamp set");

  const search = await api("GET", "/api/discover/search?q=Fourth", { token: admin.viewer.token });
  const card = search.body.data.items.find((item) => item.id === billing.buddy4.id);
  assert(card, "buddy4 is discoverable by the fresh viewer");
  assertEqual(card.badge, "FEATURED", "featured badge wins over VIP");
});

await check("admins review reports and apply the resolution", async () => {
  const reported = await api("POST", `/api/users/${billing.buddy4.id}/report`, {
    token: admin.viewer.token,
    body: { reason: "SPAM", details: "Crypto spam in the bio" },
  });
  assertEqual(reported.status, 201, "report filed");

  const open = await api("GET", "/api/admin/reports?status=OPEN", { token: session.token });
  const row = open.body.data.items.find((item) => item.target.id === billing.buddy4.id);
  assert(row, "report listed for review");
  assertEqual(row.target.fullName, "Smoke Fourth", "target joined");
  assertEqual(row.reporter.id, admin.viewer.id, "reporter joined");

  const warned = await api("POST", `/api/admin/reports/${row.id}/resolve`, {
    token: session.token,
    body: { resolution: "warned", note: "First offence" },
  });
  assertEqual(warned.body.data.status, "RESOLVED", "resolved");
  assertEqual(warned.body.data.resolution, "WARNED", "resolution uppercased");
  assertEqual(warned.body.data.resolvedBy.id, session.id, "resolver recorded");

  const twice = await api("POST", `/api/admin/reports/${row.id}/resolve`, {
    token: session.token,
    body: { resolution: "DISMISSED" },
  });
  assertEqual(twice.status, 409, "cannot resolve twice");

  await api("POST", `/api/users/${billing.buddy4.id}/report`, {
    token: admin.viewer.token,
    body: { reason: "HARASSMENT" },
  });
  const openAgain = await api("GET", "/api/admin/reports?status=OPEN", { token: session.token });
  const second = openAgain.body.data.items.find(
    (item) => item.target.id === billing.buddy4.id && item.reason === "HARASSMENT",
  );
  const harsh = await api("POST", `/api/admin/reports/${second.id}/resolve`, {
    token: session.token,
    body: { resolution: "SUSPENDED", note: "Second offence" },
  });
  assertEqual(harsh.status, 200, "resolved with sanction");

  const member = await api("GET", `/api/admin/users/${billing.buddy4.id}`, { token: session.token });
  assertEqual(member.body.data.accountStatus, "SUSPENDED", "sanction applied to the target");
  assert(member.body.data.reports.length >= 2, "member detail includes their reports");
});

await check("admins manage the interest catalogue", async () => {
  const created = await api("POST", "/api/admin/interests", {
    token: session.token,
    body: { label: "Afrobeats", emoji: "🥁", category: "Creative" },
  });
  assertEqual(created.status, 201, "created");
  assertEqual(created.body.data.slug, "afrobeats", "slug generated");

  const catalogue = await api("GET", "/api/profile/catalogue");
  assert(catalogue.body.data.interests.some((entry) => entry.slug === "afrobeats"), "pickers see it");

  const off = await api("PATCH", "/api/admin/interests/afrobeats", {
    token: session.token,
    body: { active: false },
  });
  assertEqual(off.body.data.active, false, "deactivated");

  const hidden = await api("GET", "/api/profile/catalogue");
  assert(!hidden.body.data.interests.some((entry) => entry.slug === "afrobeats"), "hidden from pickers");

  const deleted = await api("DELETE", "/api/admin/interests/afrobeats", { token: session.token });
  assertEqual(deleted.status, 200, "unused interest deleted");

  const inUse = await api("DELETE", "/api/admin/interests/coffee", { token: session.token });
  assertEqual(inUse.status, 409, "in-use interests are protected");
});

await check("admins manage subscriptions and the payments ledger", async () => {
  const checkout = await api("POST", "/api/billing/checkout", {
    token: session.token,
    body: { plan: "PREMIUM", channel: "card" },
  });
  assertEqual(checkout.status, 201, "checkout");
  await api("POST", "/api/billing/mock-pay", {
    token: session.token,
    body: { reference: checkout.body.data.reference },
  });
  const live = await api("POST", "/api/billing/verify", {
    token: session.token,
    body: { reference: checkout.body.data.reference },
  });
  assertEqual(live.body.data.active, true, "premium active again");

  const ledger = await api("GET", "/api/admin/subscriptions?status=ACTIVE", { token: session.token });
  const row = ledger.body.data.items.find((item) => item.reference === checkout.body.data.reference);
  assert(row, "the payment shows in the ledger");
  assertEqual(row.plan, "PREMIUM", "plan");
  assertEqual(row.amountGhs, 49, "amount in GHS");
  assert(row.user.email, "payer attached");

  const terminated = await api("POST", `/api/admin/subscriptions/${row.id}/terminate`, {
    token: session.token,
  });
  assertEqual(terminated.body.data.status, "EXPIRED", "terminated");

  const plans = await api("GET", "/api/billing/plans", { token: session.token });
  assertEqual(plans.body.data.plan, "FREE", "perks revoked immediately");

  const twice = await api("POST", `/api/admin/subscriptions/${row.id}/terminate`, {
    token: session.token,
  });
  assertEqual(twice.status, 409, "cannot terminate twice");
});

await check("announcements broadcast to every member", async () => {
  const sent = await api("POST", "/api/admin/announcements", {
    token: session.token,
    body: { title: "Safety week", body: "New reporting tools are live - here is how to use them well." },
  });
  assertEqual(sent.status, 201, "sent");
  assert(sent.body.data.deliveredTo >= 2, `delivered to ${sent.body.data.deliveredTo} members`);

  const inbox = await api("GET", "/api/notifications?limit=10", { token: admin.viewer.token });
  const announcement = inbox.body.data.items.find((item) => item.type === "ANNOUNCEMENT");
  assert(announcement, "a member received the announcement");
  assertEqual(announcement.payload.title, "Safety week", "payload carries the title");

  const history = await api("GET", "/api/admin/announcements", { token: session.token });
  assertEqual(history.body.data.items[0].title, "Safety week", "announcement history");
});

await check("roles can be delegated - and you cannot demote yourself", async () => {
  const promoted = await api("POST", `/api/admin/users/${admin.viewer.id}/role`, {
    token: session.token,
    body: { role: "MODERATOR" },
  });
  assertEqual(promoted.body.data.role, "MODERATOR", "promoted");

  const modAccess = await api("GET", "/api/admin/reports", { token: admin.viewer.token });
  assertEqual(modAccess.status, 200, "moderators reach the panel");

  const self = await api("POST", `/api/admin/users/${session.id}/role`, {
    token: session.token,
    body: { role: "USER" },
  });
  assertEqual(self.status, 422, "self-demotion refused");

  const demoted = await api("POST", `/api/admin/users/${admin.viewer.id}/role`, {
    token: session.token,
    body: { role: "USER" },
  });
  assertEqual(demoted.body.data.role, "USER", "demoted");

  const lockedOut = await api("GET", "/api/admin/stats", { token: admin.viewer.token });
  assertEqual(lockedOut.status, 403, "panel access revoked");
});

/* ── other modules stay honest ─────────────────────────────────────────── */
await check("unmigrated modules answer 501 instead of crashing", async () => {
  const { status, body } = await api("GET", "/api/status/feed", { token: session.token });
  assertEqual(status, 501, "status");
  assertEqual(body.code, "MODULE_NOT_MIGRATED", "code");

  // admin has migrated: it must demand credentials, not answer 501
  const adminNow = await api("GET", "/api/admin/stats");
  assertEqual(adminNow.status, 401, "admin is a real module now");
});

await check("unknown API routes answer 404 JSON", async () => {
  const { status, body } = await api("GET", "/api/nope");
  assertEqual(status, 404, "status");
  assertEqual(body.success, false, "success flag");
});

/* ── teardown ──────────────────────────────────────────────────────────── */
server.close();
await closeDb();
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  if (fs.existsSync(DB_FILE + suffix)) fs.rmSync(DB_FILE + suffix);
}

console.log(
  `\n${failures.length === 0 ? "\u001b[32m" : "\u001b[31m"}${passed} passed, ${failures.length} failed\u001b[0m\n`
);
process.exit(failures.length === 0 ? 0 : 1);
