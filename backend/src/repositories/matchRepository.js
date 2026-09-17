/**
 * Matches and their message threads.
 *
 * A match row is the conversation: messages carry match_id, so membership,
 * history and unread counts are single indexed lookups. Match pairs are
 * stored ordered (smaller user id first) which makes UNIQUE(user_one_id,
 * user_two_id) a real "one match per pair" guarantee.
 */
import db from "../db/index.js";
import { newId } from "../utils/id.js";

export function orderedPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

export async function findMatchBetween(a, b, tx = db) {
  const [one, two] = orderedPair(a, b);
  return tx.get(
    "SELECT * FROM matches WHERE user_one_id = ? AND user_two_id = ?",
    [one, two],
  );
}

export async function findMatchById(id, tx = db) {
  return tx.get("SELECT * FROM matches WHERE id = ?", [id]);
}

export async function createMatch(a, b, tx = db) {
  const [one, two] = orderedPair(a, b);
  const now = new Date().toISOString();
  const id = newId();
  await tx.run(
    "INSERT INTO matches (id, user_one_id, user_two_id, created_at) VALUES (?, ?, ?, ?)",
    [id, one, two, now],
  );
  return { id, userOneId: one, userTwoId: two, createdAt: now };
}

export async function deleteMatch(id, tx = db) {
  // messages cascade: unmatching closes the thread for both sides
  await tx.run("DELETE FROM matches WHERE id = ?", [id]);
}

/**
 * My matches with the other side's display columns attached.
 * The CASE join picks the partner regardless of which slot I occupy.
 */
export async function listMatchesFor(userId) {
  return db.all(
    `SELECT m.id, m.created_at,
            p.id              AS partner_id,
            p.full_name       AS partner_name,
            p.gender          AS partner_gender,
            p.birth_date      AS partner_birth_date,
            p.bio             AS partner_bio,
            p.city            AS partner_city,
            p.country         AS partner_country,
            p.profile_image   AS partner_image,
            s.show_age        AS partner_show_age,
            s.show_location   AS partner_show_location
       FROM matches m
       JOIN users p
         ON p.id = CASE WHEN m.user_one_id = ? THEN m.user_two_id ELSE m.user_one_id END
       JOIN account_settings s ON s.user_id = p.id
      WHERE m.user_one_id = ? OR m.user_two_id = ?
      ORDER BY m.created_at DESC`,
    [userId, userId, userId],
  );
}

/** Ids of my current match partners - discovery exclusion set. */
export async function listPartnerIdSet(userId) {
  const rows = await db.all(
    `SELECT user_two_id AS other_id FROM matches WHERE user_one_id = ?
     UNION
     SELECT user_one_id AS other_id FROM matches WHERE user_two_id = ?`,
    [userId, userId],
  );
  return new Set(rows.map((row) => row.other_id));
}

/** The other side's display row for a match I belong to (else undefined). */
export async function partnerRowFor(matchId, userId) {
  return db.get(
    `SELECT p.id, p.full_name, p.gender, p.birth_date, p.bio, p.city, p.country,
            p.profile_image, s.show_age, s.show_location, dp.relationship_goal
       FROM matches m
       JOIN users p
         ON p.id = CASE WHEN m.user_one_id = ? THEN m.user_two_id ELSE m.user_one_id END
       JOIN account_settings s ON s.user_id = p.id
       LEFT JOIN dating_preferences dp ON dp.user_id = p.id
      WHERE m.id = ? AND (m.user_one_id = ? OR m.user_two_id = ?)`,
    [userId, matchId, userId, userId],
  );
}

/** Newest message per match (window functions exist in both dialects). */
export async function lastMessagesFor(matchIds) {
  if (!matchIds.length) return new Map();
  const placeholders = matchIds.map(() => "?").join(", ");
  const rows = await db.all(
    `SELECT id, match_id, sender_id, receiver_id, content, seen, created_at FROM (
       SELECT m.*,
              ROW_NUMBER() OVER (PARTITION BY m.match_id ORDER BY m.created_at DESC, m.id DESC) AS rn
         FROM messages m
        WHERE m.match_id IN (${placeholders})
     ) ranked WHERE rn = 1`,
    matchIds,
  );
  return new Map(rows.map((row) => [row.match_id, row]));
}

/** Unread inbox counts per match, for one reader. */
export async function unreadCountsFor(readerId, matchIds) {
  if (!matchIds.length) return new Map();
  const placeholders = matchIds.map(() => "?").join(", ");
  const rows = await db.all(
    `SELECT match_id, COUNT(*) AS unread
       FROM messages
      WHERE receiver_id = ? AND seen = 0 AND match_id IN (${placeholders})
      GROUP BY match_id`,
    [readerId, ...matchIds],
  );
  return new Map(rows.map((row) => [row.match_id, row.unread]));
}

/** One thread, newest first (callers reverse for display). */
export async function listThread(matchId, { before = null, limit = 50 } = {}) {
  const rows = before
    ? await db.all(
        `SELECT * FROM messages
          WHERE match_id = ? AND created_at < ?
          ORDER BY created_at DESC, id DESC
          LIMIT ?`,
        [matchId, before, limit],
      )
    : await db.all(
        `SELECT * FROM messages
          WHERE match_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT ?`,
        [matchId, limit],
      );
  return rows.reverse();
}

export async function insertMessage({ matchId, senderId, receiverId, content }, tx = db) {
  const now = new Date().toISOString();
  const id = newId();
  await tx.run(
    `INSERT INTO messages (id, sender_id, receiver_id, match_id, content, seen, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [id, senderId, receiverId, matchId, content, now],
  );
  return { id, matchId, senderId, receiverId, content, seen: false, createdAt: now };
}

/** Mark everything the other side sent me in this thread as read. */
export async function markThreadRead(matchId, readerId, tx = db) {
  const result = await tx.run(
    "UPDATE messages SET seen = 1 WHERE match_id = ? AND receiver_id = ? AND seen = 0",
    [matchId, readerId],
  );
  return result.changes;
}
