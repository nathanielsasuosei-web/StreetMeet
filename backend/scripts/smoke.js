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

async function api(method, route, { body, token, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

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

/* ── other modules stay honest ─────────────────────────────────────────── */
await check("unmigrated modules answer 501 instead of crashing", async () => {
  const { status, body } = await api("GET", "/api/matches/discover", { token: session.token });
  assertEqual(status, 501, "status");
  assertEqual(body.code, "MODULE_NOT_MIGRATED", "code");
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
