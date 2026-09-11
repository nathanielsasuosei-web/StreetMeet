/**
 * End-to-end smoke test of the REST API.
 *   npm run test:api          (with the dev server running)
 *
 * Creates two throwaway accounts and walks the whole product:
 * register -> onboard -> like -> match -> chat -> status -> call -> payment.
 */
const API = process.env.API_URL ?? "http://localhost:5000";

let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
};

const call = async (path, { method = "GET", token, body } = {}) => {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, data: json?.data, message: json?.message };
};

const stamp = Date.now();
const PHOTO = "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600";

const register = async (name, gender, lookingFor, index) => {
  const result = await call("/api/auth/register", {
    method: "POST",
    body: {
      fullName: name,
      email: `${name.toLowerCase().replace(/\s/g, "")}${stamp}@natthesisa.app`,
      phone: `024${String(stamp).slice(-6)}${index}`, // unique per test account
      password: "natthesisa",
      gender,
      birthDate: "1997-05-05",
      city: "Accra",
    },
  });
  const token = result.data?.token;
  await call("/api/profile/me", {
    method: "PATCH",
    token,
    body: {
      bio: "Test profile",
      photos: [PHOTO],
      interests: ["Music"],
      onboarded: true,
      lookingFor: [lookingFor],
    },
  });
  return { token, user: result.data?.user };
};

console.log(`\nRunning natthesisa smoke test against ${API}\n`);

const health = await call("/health");
check("API is healthy", health.status === 200, health.data?.app);

const a = await register("Test Ama", "FEMALE", "MALE", 1);
const b = await register("Test Kofi", "MALE", "FEMALE", 2);
check("two accounts created", Boolean(a.token && b.token));

const plans = await call("/api/payments/plans");
check(
  "plans are seeded (20p / 50p / 100p)",
  plans.data?.plans?.length === 3,
  plans.data?.plans?.map((p) => p.priceLabel).join(", ")
);

const feed = await call("/api/discover/feed", { token: b.token });
check("discover feed returns profiles", feed.data?.profiles?.length > 0, `${feed.data?.profiles?.length} profile(s)`);

await call(`/api/discover/like/${b.user.id}`, { method: "POST", token: a.token, body: {} });
const likeB = await call(`/api/discover/like/${a.user.id}`, { method: "POST", token: b.token, body: {} });
check("mutual like creates a match", likeB.data?.matched === true, `matchId ${likeB.data?.matchId}`);

const matchId = likeB.data?.matchId;
const message = await call(`/api/chat/${matchId}/messages`, {
  method: "POST",
  token: a.token,
  body: { body: "Hello from the smoke test 👋🏾" },
});
check("message sent", message.status === 201);

const thread = await call(`/api/chat/${matchId}/messages`, { token: b.token });
check("partner can read the thread", thread.data?.messages?.length === 1);

const status = await call("/api/status", {
  method: "POST",
  token: a.token,
  body: { caption: "Smoke test status", background: "#7c3aed" },
});
check("status posted", status.status === 201);

const statusFeed = await call("/api/status/feed", { token: b.token });
check(
  "status visible to a match",
  Boolean(statusFeed.data?.feed?.some((g) => g.items.some((i) => i.id === status.data?.status?.id)))
);

const ice = await call("/api/calls/ice", { token: a.token });
check("ICE servers available", Array.isArray(ice.data?.iceServers));

const started = await call("/api/calls/start", {
  method: "POST",
  token: a.token,
  body: { matchId, type: "VIDEO" },
});
check("call started", started.status === 201);

const ended = await call(`/api/calls/${started.data?.call?.id}/end`, { method: "POST", token: a.token });
check("call ended and recorded", ended.data?.call?.status === "ENDED");

const payment = await call("/api/payments/initiate", {
  method: "POST",
  token: a.token,
  body: { planCode: "spark", phone: "0241112222" },
});
check("20p payment initiated", payment.data?.status === "PENDING" && payment.data?.amountPesewas === 20);

await call("/api/payments/simulate", {
  method: "POST",
  token: a.token,
  body: { reference: payment.data?.reference, outcome: "SUCCESS" },
});
const confirmed = await call(`/api/payments/${payment.data?.reference}`, { token: a.token });
check(
  "payment settles and unlocks premium",
  confirmed.data?.status === "SUCCESS" && confirmed.data?.user?.isPremium === true
);

console.log(failures === 0 ? "\n🎉 Smoke test passed\n" : `\n${failures} check(s) failed\n`);
process.exit(failures === 0 ? 0 : 1);
