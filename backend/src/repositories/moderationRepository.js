/**
 * Blocks and reports - the moderation primitives of module 2.
 *
 * A block is one-directional but its effects are symmetric: both sides
 * disappear from each other's deck, an existing match (and its thread) is
 * removed, and pending swipes are dropped. Reports are private: the reported
 * user is never notified.
 */
import db from "../db/index.js";
import { newId } from "../utils/id.js";

export async function anyBlockBetween(a, b, tx = db) {
  return tx.get(
    `SELECT 1 AS blocked FROM blocks
      WHERE (blocker_id = ? AND blocked_user_id = ?)
         OR (blocker_id = ? AND blocked_user_id = ?)`,
    [a, b, b, a],
  );
}

export async function findBlock(blockerId, blockedId, tx = db) {
  return tx.get(
    "SELECT * FROM blocks WHERE blocker_id = ? AND blocked_user_id = ?",
    [blockerId, blockedId],
  );
}

export async function createBlock(blockerId, blockedId, tx = db) {
  const now = new Date().toISOString();
  const id = newId();
  await tx.run(
    "INSERT INTO blocks (id, blocker_id, blocked_user_id, created_at) VALUES (?, ?, ?, ?)",
    [id, blockerId, blockedId, now],
  );
  return { id, blockerId, blockedId, createdAt: now };
}

export async function removeBlock(blockerId, blockedId, tx = db) {
  await tx.run(
    "DELETE FROM blocks WHERE blocker_id = ? AND blocked_user_id = ?",
    [blockerId, blockedId],
  );
}

/** Everyone I blocked or who blocked me - discovery exclusion set. */
export async function listBlockedIdSet(userId) {
  const rows = await db.all(
    `SELECT blocked_user_id AS other_id FROM blocks WHERE blocker_id = ?
     UNION
     SELECT blocker_id AS other_id FROM blocks WHERE blocked_user_id = ?`,
    [userId, userId],
  );
  return new Set(rows.map((row) => row.other_id));
}

/** People I blocked, newest first, with their display columns. */
export async function listBlocksFor(userId) {
  return db.all(
    `SELECT b.created_at AS blocked_at,
            u.id, u.full_name, u.gender, u.birth_date, u.bio, u.city, u.country,
            u.profile_image, s.show_age, s.show_location
       FROM blocks b
       JOIN users u ON u.id = b.blocked_user_id
       JOIN account_settings s ON s.user_id = u.id
      WHERE b.blocker_id = ?
      ORDER BY b.created_at DESC`,
    [userId],
  );
}

export async function createReport({ reporterId, reportedId, reason, details }, tx = db) {
  const now = new Date().toISOString();
  const id = newId();
  await tx.run(
    `INSERT INTO reports (id, reporter_id, reported_user_id, reason, details, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'OPEN', ?)`,
    [id, reporterId, reportedId, reason, details, now],
  );
  return { id, reporterId, reportedId, reason, details, status: "OPEN", createdAt: now };
}
