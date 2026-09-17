/**
 * Admin control panel queries: the member directory, moderation actions,
 * report review, the subscription/payment ledger, the editable interest
 * catalogue, announcements and the platform statistics.
 *
 * Everything is intentionally portable SQL (text ISO timestamps, `?`
 * placeholders, booleans coerced by the driver) so SQLite and PostgreSQL run
 * the same statements. Day-level activity buckets use `substr(created_at, 1, 10)`.
 */
import db from "../db/index.js";
import { bool, intOrNull, iso, strOrNull } from "../db/normalize.js";
import { newId } from "../utils/id.js";

/* ── members ─────────────────────────────────────────────────────────────── */

const MEMBER_COLUMNS = `
  u.id, u.full_name, u.email, u.phone_number, u.gender, u.birth_date, u.city,
  u.country, u.profile_image, u.role, u.verified, u.account_status,
  u.moderation_note, u.moderated_at, u.featured_at, u.deactivated_at,
  u.last_login_at, u.created_at`;

function mapMember(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phoneNumber: strOrNull(row.phone_number),
    gender: strOrNull(row.gender),
    birthDate: strOrNull(row.birth_date),
    city: strOrNull(row.city),
    country: strOrNull(row.country),
    profileImage: strOrNull(row.profile_image),
    role: row.role ?? "USER",
    verified: bool(row.verified),
    accountStatus: row.account_status ?? "OK",
    moderationNote: strOrNull(row.moderation_note),
    moderatedAt: iso(row.moderated_at),
    featuredAt: iso(row.featured_at),
    deactivatedAt: iso(row.deactivated_at),
    lastLoginAt: iso(row.last_login_at),
    createdAt: iso(row.created_at),
  };
}

export async function listMembers({ q, status, role, verified, page = 1, limit = 25 } = {}) {
  const where = [];
  const params = [];

  if (q) {
    const needle = `%${String(q).trim().toLowerCase()}%`;
    where.push("(LOWER(u.full_name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(COALESCE(u.city, '')) LIKE ?)");
    params.push(needle, needle, needle);
  }
  if (status === "SUSPENDED" || status === "BANNED") {
    where.push("u.account_status = ?");
    params.push(status);
  } else if (status === "DEACTIVATED") {
    where.push("u.deactivated_at IS NOT NULL");
  } else if (status === "OK") {
    where.push("u.account_status = 'OK' AND u.deactivated_at IS NULL");
  }
  if (role) {
    where.push("u.role = ?");
    params.push(role);
  }
  if (verified === "true" || verified === true) where.push("u.verified = 1");
  else if (verified === "false" || verified === false) where.push("u.verified = 0");

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = intOrNull((await db.get(`SELECT COUNT(*) AS n FROM users u ${clause}`, params))?.n) ?? 0;
  const perPage = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const currentPage = Math.max(Number(page) || 1, 1);
  const rows = await db.all(
    `SELECT ${MEMBER_COLUMNS} FROM users u ${clause}
     ORDER BY u.featured_at IS NOT NULL DESC, u.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, perPage, (currentPage - 1) * perPage],
  );
  return {
    items: rows.map(mapMember),
    total,
    page: currentPage,
    pages: Math.max(Math.ceil(total / perPage), 1),
  };
}

export async function findMember(id) {
  const row = await db.get(`SELECT ${MEMBER_COLUMNS} FROM users u WHERE u.id = ?`, [id]);
  return row ? mapMember(row) : null;
}

export async function setAccountStatus(id, status, { note = null } = {}) {
  await db.run(
    `UPDATE users
        SET account_status = ?, moderation_note = ?, moderated_at = ?,
            token_version = token_version + 1, updated_at = ?
      WHERE id = ?`,
    [status, note, new Date().toISOString(), new Date().toISOString(), id],
  );
}

export async function setVerified(id, verified) {
  await db.run("UPDATE users SET verified = ?, updated_at = ? WHERE id = ?", [
    verified,
    new Date().toISOString(),
    id,
  ]);
}

export async function setFeatured(id, featured) {
  await db.run("UPDATE users SET featured_at = ?, updated_at = ? WHERE id = ?", [
    featured ? new Date().toISOString() : null,
    new Date().toISOString(),
    id,
  ]);
}

export async function setRole(id, role) {
  // No token_version bump: roles are read from the database per request, so
  // promotions and demotions apply immediately without killing sessions.
  await db.run("UPDATE users SET role = ?, updated_at = ? WHERE id = ?", [
    role,
    new Date().toISOString(),
    id,
  ]);
}

/* ── reports ─────────────────────────────────────────────────────────────── */

const REPORT_SELECT = `
  SELECT r.id, r.reason, r.details, r.status, r.resolution, r.resolution_note,
         r.created_at, r.resolved_at,
         r.reporter_id, rp.full_name AS reporter_name, rp.email AS reporter_email,
         r.reported_user_id, tg.full_name AS target_name, tg.email AS target_email,
         tg.account_status AS target_status, tg.verified AS target_verified,
         r.resolved_by, ad.full_name AS resolver_name
    FROM reports r
    JOIN users rp ON rp.id = r.reporter_id
    JOIN users tg ON tg.id = r.reported_user_id
    LEFT JOIN users ad ON ad.id = r.resolved_by`;

function mapReport(row) {
  return {
    id: row.id,
    reason: row.reason,
    details: strOrNull(row.details),
    status: row.status,
    resolution: strOrNull(row.resolution),
    resolutionNote: strOrNull(row.resolution_note),
    createdAt: iso(row.created_at),
    resolvedAt: iso(row.resolved_at),
    reporter: { id: row.reporter_id, fullName: row.reporter_name, email: row.reporter_email },
    target: {
      id: row.reported_user_id,
      fullName: row.target_name,
      email: row.target_email,
      accountStatus: row.target_status ?? "OK",
      verified: bool(row.target_verified),
    },
    resolvedBy: row.resolved_by
      ? { id: row.resolved_by, fullName: strOrNull(row.resolver_name) }
      : null,
  };
}

export async function listReports({ status, userId, limit = 50 } = {}) {
  const where = [];
  const params = [];
  if (status === "OPEN" || status === "RESOLVED") {
    where.push("r.status = ?");
    params.push(status);
  }
  if (userId) {
    where.push("(r.reporter_id = ? OR r.reported_user_id = ?)");
    params.push(userId, userId);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await db.all(
    `${REPORT_SELECT} ${clause} ORDER BY r.created_at DESC LIMIT ?`,
    [...params, Math.min(Math.max(Number(limit) || 50, 1), 200)],
  );
  return rows.map(mapReport);
}

export async function findReport(id) {
  const row = await db.get(`${REPORT_SELECT} WHERE r.id = ?`, [id]);
  return row ? mapReport(row) : null;
}

export async function resolveReport(id, { resolution, note, adminId }) {
  const now = new Date().toISOString();
  await db.run(
    `UPDATE reports
        SET status = 'RESOLVED', resolution = ?, resolution_note = ?,
            resolved_by = ?, resolved_at = ?
      WHERE id = ?`,
    [resolution, note ?? null, adminId, now, id],
  );
}

/* ── subscriptions / payments ledger ─────────────────────────────────────── */

const LEDGER_SELECT = `
  SELECT s.id, s.user_id, s.plan, s.status, s.payment_reference, s.channel,
         s.amount, s.amount_pesewas, s.currency, s.provider_payload,
         s.started_at, s.expires_at, s.created_at, u.full_name, u.email`;

function ledgerPayload(row) {
  if (!row.provider_payload) return {};
  try {
    return JSON.parse(row.provider_payload) ?? {};
  } catch {
    return {};
  }
}

function mapLedgerRow(row) {
  const payload = ledgerPayload(row);
  return {
    id: row.id,
    user: { id: row.user_id, fullName: row.full_name, email: row.email },
    plan: row.plan,
    status: row.status,
    reference: row.payment_reference,
    channel: row.channel,
    provider: strOrNull(payload.provider ?? null),
    phone: strOrNull(payload.phone ?? null),
    amountGhs: Number(row.amount) || (intOrNull(row.amount_pesewas) ?? 0) / 100,
    currency: row.currency ?? "GHS",
    startedAt: iso(row.started_at),
    expiresAt: iso(row.expires_at),
    createdAt: iso(row.created_at),
    active: row.status === "ACTIVE" && iso(row.expires_at) > new Date().toISOString(),
  };
}

export async function listSubscriptions({ status, plan, q, limit = 100 } = {}) {
  const where = [];
  const params = [];
  if (status) {
    where.push("s.status = ?");
    params.push(status);
  }
  if (plan) {
    where.push("s.plan = ?");
    params.push(plan);
  }
  if (q) {
    const needle = `%${String(q).trim().toLowerCase()}%`;
    where.push("(LOWER(u.full_name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(s.payment_reference) LIKE ?)");
    params.push(needle, needle, needle);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await db.all(
    `${LEDGER_SELECT} FROM subscriptions s JOIN users u ON u.id = s.user_id
     ${clause} ORDER BY s.created_at DESC LIMIT ?`,
    [...params, Math.min(Math.max(Number(limit) || 100, 1), 500)],
  );
  return rows.map(mapLedgerRow);
}

export async function findSubscription(id) {
  const row = await db.get(
    `${LEDGER_SELECT} FROM subscriptions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    [id],
  );
  return row ? mapLedgerRow(row) : null;
}

export async function terminateSubscription(id) {
  const now = new Date().toISOString();
  await db.run(
    `UPDATE subscriptions
        SET status = 'EXPIRED', expires_at = ?, active = 0, updated_at = ?
      WHERE id = ? AND status = 'ACTIVE'`,
    [now, now, id],
  );
}

/* ── interest catalogue ──────────────────────────────────────────────────── */

function mapInterest(row) {
  return {
    slug: row.slug,
    label: row.label,
    emoji: row.emoji,
    category: row.category,
    sortOrder: intOrNull(row.sort_order) ?? 0,
    active: bool(row.active, true),
    createdAt: iso(row.created_at),
  };
}

export async function listInterests({ includeInactive = false } = {}) {
  const rows = await db.all(
    `SELECT slug, label, emoji, category, sort_order, active, created_at
       FROM interests ${includeInactive ? "" : "WHERE active = 1"}
      ORDER BY sort_order, label`,
    [],
  );
  return rows.map(mapInterest);
}

export async function countInterests() {
  return intOrNull((await db.get("SELECT COUNT(*) AS n FROM interests", []))?.n) ?? 0;
}

export async function insertInterests(interests, tx = db) {
  const now = new Date().toISOString();
  for (const [index, entry] of interests.entries()) {
    await tx.run(
      `INSERT INTO interests (slug, label, emoji, category, sort_order, active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
      [entry.slug, entry.label, entry.emoji ?? "•", entry.category ?? "Other", index, now],
    );
  }
}

export async function findInterest(slug) {
  const row = await db.get(
    "SELECT slug, label, emoji, category, sort_order, active, created_at FROM interests WHERE slug = ?",
    [slug],
  );
  return row ? mapInterest(row) : null;
}

export async function createInterest({ slug, label, emoji, category }) {
  const now = new Date().toISOString();
  const maxOrder =
    intOrNull((await db.get("SELECT MAX(sort_order) AS n FROM interests", []))?.n) ?? -1;
  await db.run(
    `INSERT INTO interests (slug, label, emoji, category, sort_order, active, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [slug, label, emoji ?? "•", category ?? "Other", maxOrder + 1, now],
  );
  return findInterest(slug);
}

export async function updateInterest(slug, patch) {
  const fields = [];
  const params = [];
  for (const [column, key] of [
    ["label", "label"],
    ["emoji", "emoji"],
    ["category", "category"],
    ["active", "active"],
    ["sort_order", "sortOrder"],
  ]) {
    if (patch[key] !== undefined) {
      fields.push(`${column} = ?`);
      params.push(patch[key]);
    }
  }
  if (!fields.length) return findInterest(slug);
  await db.run(`UPDATE interests SET ${fields.join(", ")} WHERE slug = ?`, [...params, slug]);
  return findInterest(slug);
}

export async function interestUsage(slug) {
  return (
    intOrNull(
      (await db.get("SELECT COUNT(*) AS n FROM user_interests WHERE slug = ?", [slug]))?.n,
    ) ?? 0
  );
}

export async function deleteInterest(slug) {
  await db.run("DELETE FROM interests WHERE slug = ?", [slug]);
}

/* ── announcements ───────────────────────────────────────────────────────── */

export async function createAnnouncement({ title, body, adminId }) {
  const now = new Date().toISOString();
  const id = newId();
  await db.run(
    `INSERT INTO announcements (id, title, body, created_by, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, title, body, adminId, now],
  );
  return { id, title, body, createdBy: adminId, createdAt: now };
}

export async function listAnnouncements(limit = 50) {
  const rows = await db.all(
    `SELECT a.id, a.title, a.body, a.created_at, a.created_by, u.full_name AS author_name
       FROM announcements a
       LEFT JOIN users u ON u.id = a.created_by
      ORDER BY a.created_at DESC
      LIMIT ?`,
    [Math.min(Math.max(Number(limit) || 50, 1), 200)],
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: iso(row.created_at),
    author: row.created_by
      ? { id: row.created_by, fullName: strOrNull(row.author_name) }
      : null,
  }));
}

/** Every account that should receive a broadcast (skips deactivated). */
export async function broadcastRecipients() {
  const rows = await db.all(
    `SELECT id FROM users
      WHERE deactivated_at IS NULL AND account_status = 'OK' AND role <> 'ADMIN'`,
    [],
  );
  return rows.map((row) => row.id);
}

/* ── statistics ──────────────────────────────────────────────────────────── */

async function count(sql, params = []) {
  return intOrNull((await db.get(`SELECT COUNT(*) AS n ${sql}`, params))?.n) ?? 0;
}

export async function platformStats() {
  const now = new Date();
  const daysAgo = (n) => new Date(now.getTime() - n * 86_400_000).toISOString();

  const [
    members,
    verified,
    suspended,
    banned,
    deactivated,
    newToday,
    newWeek,
    matches,
    likes,
    messages,
    openReports,
    activeSubscriptions,
    premiumActive,
    vipActive,
    featured,
  ] = await Promise.all([
    count("FROM users WHERE deactivated_at IS NULL"),
    count("FROM users WHERE verified = 1 AND deactivated_at IS NULL"),
    count("FROM users WHERE account_status = 'SUSPENDED'"),
    count("FROM users WHERE account_status = 'BANNED'"),
    count("FROM users WHERE deactivated_at IS NOT NULL"),
    count("FROM users WHERE created_at >= ?", [daysAgo(1).slice(0, 10)]),
    count("FROM users WHERE created_at >= ?", [daysAgo(7)]),
    count("FROM matches"),
    count("FROM likes WHERE decision = 'LIKE'"),
    count("FROM messages"),
    count("FROM reports WHERE status = 'OPEN'"),
    count("FROM subscriptions WHERE status = 'ACTIVE' AND expires_at > ?", [now.toISOString()]),
    count("FROM subscriptions WHERE status = 'ACTIVE' AND expires_at > ? AND plan = 'PREMIUM'", [
      now.toISOString(),
    ]),
    count("FROM subscriptions WHERE status = 'ACTIVE' AND expires_at > ? AND plan = 'VIP'", [
      now.toISOString(),
    ]),
    count("FROM users WHERE featured_at IS NOT NULL AND deactivated_at IS NULL"),
  ]);

  const revenueRow = await db.get(
    `SELECT COALESCE(SUM(amount_pesewas), 0) AS pesewas
       FROM subscriptions
      WHERE started_at IS NOT NULL AND status IN ('ACTIVE', 'EXPIRED')`,
    [],
  );

  const registrationRows = await db.all(
    `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n
       FROM users
      WHERE created_at >= ?
      GROUP BY substr(created_at, 1, 10)
      ORDER BY day`,
    [daysAgo(13).slice(0, 10)],
  );

  const subscriptionRows = await db.all(
    `SELECT substr(created_at, 1, 10) AS day, plan, status, COUNT(*) AS n
       FROM subscriptions
      WHERE created_at >= ?
      GROUP BY substr(created_at, 1, 10), plan, status
      ORDER BY day`,
    [daysAgo(13).slice(0, 10)],
  );

  const genderRows = await db.all(
    `SELECT gender, COUNT(*) AS n FROM users
      WHERE deactivated_at IS NULL AND gender IS NOT NULL
      GROUP BY gender ORDER BY n DESC`,
    [],
  );

  const recentMembers = await db.all(
    `SELECT ${MEMBER_COLUMNS} FROM users u ORDER BY u.created_at DESC LIMIT 5`,
    [],
  );
  const recentPayments = await db.all(
    `${LEDGER_SELECT} FROM subscriptions s JOIN users u ON u.id = s.user_id
      ORDER BY s.created_at DESC LIMIT 5`,
    [],
  );

  // zero-fill the 14-day windows so charts render a bar per day
  const registrations = [];
  const subscriptionActivity = [];
  for (let offset = 13; offset >= 0; offset -= 1) {
    const day = daysAgo(offset).slice(0, 10);
    registrations.push({
      day,
      count: intOrNull(registrationRows.find((row) => row.day === day)?.n) ?? 0,
    });
    subscriptionActivity.push({
      day,
      count:
        subscriptionRows
          .filter((row) => row.day === day && row.status !== "FAILED")
          .reduce((sum, row) => sum + (intOrNull(row.n) ?? 0), 0) ?? 0,
    });
  }

  return {
    totals: {
      members,
      verified,
      suspended,
      banned,
      deactivated,
      newToday,
      newWeek,
      matches,
      likes,
      messages,
      openReports,
      activeSubscriptions,
      premiumActive,
      vipActive,
      featured,
      revenueGhs: (intOrNull(revenueRow?.pesewas) ?? 0) / 100,
    },
    genders: genderRows.map((row) => ({ gender: row.gender, count: intOrNull(row.n) ?? 0 })),
    registrations,
    subscriptionActivity,
    recentMembers: recentMembers.map(mapMember),
    recentPayments: recentPayments.map(mapLedgerRow),
  };
}

export default {
  listMembers,
  findMember,
  setAccountStatus,
  setVerified,
  setFeatured,
  setRole,
  listReports,
  findReport,
  resolveReport,
  listSubscriptions,
  findSubscription,
  terminateSubscription,
  listInterests,
  countInterests,
  insertInterests,
  findInterest,
  createInterest,
  updateInterest,
  interestUsage,
  deleteInterest,
  createAnnouncement,
  listAnnouncements,
  broadcastRecipients,
  platformStats,
};
