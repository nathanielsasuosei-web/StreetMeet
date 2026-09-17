/**
 * Subscription rows and their lifecycle (PENDING -> ACTIVE -> EXPIRED).
 *
 * "Current plan" is always a read-time computation (status ACTIVE and
 * expires_at in the future) so an expired plan stops granting perks even
 * before the sweeper flips the row; the sweeper exists to keep the table
 * honest for analytics and admin views.
 */
import db, { iso } from "../db/index.js";

import { env } from "../config/env.js";
import { newId } from "../utils/id.js";

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function mapSubscription(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    plan: row.plan,
    status: row.status,
    channel: row.channel,
    currency: row.currency,
    amountGhs: row.amount,
    amountPesewas: row.amount_pesewas,
    reference: row.payment_reference,
    startedAt: iso(row.started_at),
    expiresAt: iso(row.expires_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    payload: row.provider_payload ? safeParse(row.provider_payload) : null,
  };
}

export async function createPending({
  userId,
  plan,
  amountGhs,
  amountPesewas,
  reference,
  channel,
  tx = db,
}) {
  const now = new Date().toISOString();
  const id = newId();
  await tx.run(
    `INSERT INTO subscriptions
       (id, user_id, plan, amount, amount_pesewas, payment_reference, active, status, channel, currency, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 'PENDING', ?, ?, ?, ?, ?)`,
    // expires_at starts as a far-future placeholder so the legacy NOT NULL
    // column stays satisfied while the payment is pending; activation sets
    // the real window.
    [id, userId, plan, amountGhs, amountPesewas, reference, channel, env.paystack.currency, "9999-12-31T23:59:59.000Z", now, now],
  );
  return mapSubscription(await tx.get("SELECT * FROM subscriptions WHERE id = ?", [id]));
}

export async function findByReference(reference, tx = db) {
  return mapSubscription(
    await tx.get("SELECT * FROM subscriptions WHERE payment_reference = ?", [reference]),
  );
}

export async function findById(id, tx = db) {
  return mapSubscription(await tx.get("SELECT * FROM subscriptions WHERE id = ?", [id]));
}

/** The subscription granting perks right now, if any. */
export async function findCurrent(userId, now = new Date().toISOString(), tx = db) {
  return mapSubscription(
    await tx.get(
      `SELECT * FROM subscriptions
        WHERE user_id = ? AND status = 'ACTIVE' AND expires_at > ?
        ORDER BY expires_at DESC
        LIMIT 1`,
      [userId, now],
    ),
  );
}

export async function listFor(userId, tx = db) {
  const rows = await tx.all(
    "SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 25",
    [userId],
  );
  return rows.map(mapSubscription);
}

/** Flip PENDING/ACTIVE to the paid window; stores verify evidence. */
export async function activate(id, { startedAt, expiresAt, channel, payload }, tx = db) {
  const now = new Date().toISOString();
  await tx.run(
    `UPDATE subscriptions
        SET status = 'ACTIVE', active = 1, started_at = ?, expires_at = ?,
            channel = COALESCE(?, channel), provider_payload = ?, updated_at = ?
      WHERE id = ?`,
    [startedAt, expiresAt, channel, payload ? JSON.stringify(payload) : null, now, id],
  );
  return findById(id, tx);
}

export async function markFailed(id, payload, tx = db) {
  const now = new Date().toISOString();
  await tx.run(
    "UPDATE subscriptions SET status = 'FAILED', active = 0, provider_payload = ?, updated_at = ? WHERE id = ?",
    [payload ? JSON.stringify(payload) : null, now, id],
  );
  return findById(id, tx);
}

/** Mock mode: record that the customer approved the prompt for this charge. */
export async function storeMockApproval(id, tx = db) {
  const now = new Date().toISOString();
  const current = await findById(id, tx);
  const payload = { ...current?.payload, mockApproved: true, approvedAt: now };
  await tx.run(
    "UPDATE subscriptions SET provider_payload = ?, updated_at = ? WHERE id = ?",
    [JSON.stringify(payload), now, id],
  );
  return findById(id, tx);
}

/** Sweeper: close rows whose window ended. Returns how many flipped. */
export async function expireStale(now = new Date().toISOString(), tx = db) {
  const result = await tx.run(
    "UPDATE subscriptions SET status = 'EXPIRED', active = 0, updated_at = ? WHERE status = 'ACTIVE' AND expires_at <= ?",
    [now, now],
  );
  return result.changes;
}

/** Members with a live VIP subscription - deck priority and badges. */
export async function vipSet(userIds) {
  if (!userIds.length) return new Set();
  const now = new Date().toISOString();
  const placeholders = userIds.map(() => "?").join(", ");
  const rows = await db.all(
    `SELECT DISTINCT user_id FROM subscriptions
      WHERE user_id IN (${placeholders}) AND status = 'ACTIVE' AND expires_at > ? AND plan = 'VIP'`,
    [...userIds, now],
  );
  return new Set(rows.map((row) => row.user_id));
}

