/**
 * Swipes (likes / passes) - the `likes` table with its `decision` column.
 *
 * A pass is stored on purpose: the discover deck must never re-offer a
 * profile someone already skipped, and a like is what turns into a match
 * when the other side likes back.
 */
import db from "../db/index.js";
import { newId } from "../utils/id.js";

export async function findSwipe(senderId, receiverId, tx = db) {
  return tx.get(
    "SELECT * FROM likes WHERE sender_id = ? AND receiver_id = ?",
    [senderId, receiverId],
  );
}

/** The other side's like towards `userId`, if any. */
export async function findLikeFrom(senderId, receiverId, tx = db) {
  return tx.get(
    "SELECT * FROM likes WHERE sender_id = ? AND receiver_id = ? AND decision = 'LIKE'",
    [senderId, receiverId],
  );
}

export async function recordSwipe(senderId, receiverId, decision, tx = db) {
  const now = new Date().toISOString();
  const id = newId();
  await tx.run(
    "INSERT INTO likes (id, sender_id, receiver_id, decision, created_at) VALUES (?, ?, ?, ?, ?)",
    [id, senderId, receiverId, decision, now],
  );
  return { id, senderId, receiverId, decision, createdAt: now };
}

/** Drop likes in both directions (used when a block erases the history). */
export async function deleteLikesBetween(a, b, tx = db) {
  await tx.run(
    `DELETE FROM likes
      WHERE (sender_id = ? AND receiver_id = ?)
         OR (sender_id = ? AND receiver_id = ?)`,
    [a, b, b, a],
  );
}

/** How many likes I sent since `sinceIso` - the free-plan daily budget. */
export async function countLikesSince(userId, sinceIso, tx = db) {
  const row = await tx.get(
    "SELECT COUNT(*) AS total FROM likes WHERE sender_id = ? AND decision = 'LIKE' AND created_at >= ?",
    [userId, sinceIso],
  );
  return row?.total ?? 0;
}

/** Ids of everyone I already swiped on (like or pass) - deck exclusion. */
export async function listSwipedIds(userId) {
  const rows = await db.all("SELECT receiver_id FROM likes WHERE sender_id = ?", [userId]);
  return new Set(rows.map((row) => row.receiver_id));
}
