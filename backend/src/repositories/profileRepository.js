/**
 * user_interests + dating_preferences.
 *
 * Interests are rows (not a JSON blob) so "people who like the same things"
 * stays a plain indexed join when the matching module is built.
 */
import db, { jsonEncode } from "../db/index.js";
import { normaliseInterests } from "../constants/profile.js";
import { toPreferences } from "./mappers.js";

/* ── interests ─────────────────────────────────────────────────────────── */

export async function listInterests(userId, tx = db) {
  const rows = await tx.all(
    "SELECT slug FROM user_interests WHERE user_id = ? ORDER BY slug",
    [userId]
  );
  // keep catalogue order so the UI is stable
  return normaliseInterests(rows.map((row) => row.slug));
}

export async function listInterestsForMany(userIds) {
  if (!userIds.length) return new Map();
  const placeholders = userIds.map(() => "?").join(", ");
  const rows = await db.all(
    `SELECT user_id, slug FROM user_interests WHERE user_id IN (${placeholders})`,
    userIds
  );

  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.user_id)) grouped.set(row.user_id, []);
    grouped.get(row.user_id).push(row.slug);
  }
  for (const [key, value] of grouped) grouped.set(key, normaliseInterests(value));
  return grouped;
}

/** Replace the whole set in one transaction. */
export async function setInterests(userId, slugs, tx = db) {
  const clean = normaliseInterests(slugs);

  const apply = async (connection) => {
    await connection.run("DELETE FROM user_interests WHERE user_id = ?", [userId]);
    for (const slug of clean) {
      await connection.run(
        "INSERT INTO user_interests (user_id, slug) VALUES (?, ?)",
        [userId, slug]
      );
    }
    return clean;
  };

  return tx === db ? db.transaction(apply) : apply(tx);
}

/* ── dating preferences ────────────────────────────────────────────────── */

export async function findPreferences(userId, tx = db) {
  const row = await tx.get("SELECT * FROM dating_preferences WHERE user_id = ?", [userId]);
  return row ? toPreferences(row) : null;
}

export async function upsertPreferences(userId, fields, tx = db) {
  const existing = await tx.get("SELECT user_id FROM dating_preferences WHERE user_id = ?", [
    userId,
  ]);
  const now = new Date().toISOString();

  const data = {
    user_id: userId,
    updated_at: now,
  };

  if (fields.interestedIn !== undefined) {
    data.interested_in = jsonEncode(
      Array.isArray(fields.interestedIn) ? fields.interestedIn : [fields.interestedIn]
    );
  }
  if (fields.minAge !== undefined) data.min_age = fields.minAge;
  if (fields.maxAge !== undefined) data.max_age = fields.maxAge;
  if (fields.maxDistanceKm !== undefined) data.max_distance_km = fields.maxDistanceKm;
  if (fields.relationshipGoal !== undefined) data.relationship_goal = fields.relationshipGoal;
  if (fields.openToNearby !== undefined) data.open_to_nearby = fields.openToNearby;

  if (existing) {
    const { updated_at: _ignored, user_id: _alsoIgnored, ...changes } = data;
    const assignments = Object.keys(changes)
      .map((column) => `${column} = ?`)
      .concat("updated_at = ?");
    await tx.run(
      `UPDATE dating_preferences SET ${assignments.join(", ")} WHERE user_id = ?`,
      [...Object.values(changes), now, userId]
    );
  } else {
    const columns = Object.keys(data);
    await tx.run(
      `INSERT INTO dating_preferences (${columns.join(", ")}) VALUES (${columns
        .map(() => "?")
        .join(", ")})`,
      columns.map((column) => data[column])
    );
  }

  return findPreferences(userId, tx);
}

export default {
  listInterests,
  listInterestsForMany,
  setInterests,
  findPreferences,
  upsertPreferences,
};
