/**
 * In-app notifications: LIKE, MATCH and MESSAGE events addressed to a user.
 * payload is a small JSON fragment (message preview, …) - kept as TEXT so
 * both dialects store it identically.
 */
import db from "../db/index.js";
import { newId } from "../utils/id.js";

export async function createNotification(
  { userId, type, actorId = null, matchId = null, payload = null },
  tx = db,
) {
  const now = new Date().toISOString();
  const id = newId();
  await tx.run(
    `INSERT INTO notifications (id, user_id, type, actor_id, match_id, payload, read_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
    // payload is a free-form object, unlike the JSON *arrays* jsonEncode serves
    [id, userId, type, actorId, matchId, payload ? JSON.stringify(payload) : null, now],
  );
  return { id, userId, type, actorId, matchId, payload, readAt: null, createdAt: now };
}

/** Newest first, with the actor's display columns joined in. */
export async function listFor(userId, limit = 30) {
  return db.all(
    `SELECT n.id, n.type, n.match_id, n.payload, n.read_at, n.created_at,
            a.id AS actor_id, a.full_name AS actor_name, a.profile_image AS actor_image
       FROM notifications n
       LEFT JOIN users a ON a.id = n.actor_id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT ?`,
    [userId, limit],
  );
}

export async function unreadCount(userId) {
  const row = await db.get(
    "SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND read_at IS NULL",
    [userId],
  );
  return row?.unread ?? 0;
}

export async function markAllRead(userId, tx = db) {
  const now = new Date().toISOString();
  const result = await tx.run(
    "UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL",
    [now, userId],
  );
  return result.changes;
}

export async function markOneRead(id, userId, tx = db) {
  const now = new Date().toISOString();
  const result = await tx.run(
    "UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL",
    [now, id, userId],
  );
  return result.changes;
}
