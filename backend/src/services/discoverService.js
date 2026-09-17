/**
 * Discovery: the swipe deck and the search/filter grid.
 *
 * Exclusions (SQL, indexed): me, deactivated accounts, incomplete profiles,
 * non-discoverable or PRIVATE members, anyone I already swiped on, anyone
 * blocked in either direction, and current match partners.
 *
 * Compatibility (JS, because interested_in is a JSON array): both sides must
 * list each other's gender and fall inside each other's age range - nobody
 * sees profiles they could never match with.
 */
import db from "../db/index.js";
import { GENDER_VALUES, RELATIONSHIP_GOAL_VALUES } from "../constants/profile.js";
import { listPartnerIdSet } from "../repositories/matchRepository.js";
import { listBlockedIdSet } from "../repositories/moderationRepository.js";
import {
  listInterestsForMany,
  findPreferences,
} from "../repositories/profileRepository.js";
import { listSwipedIds } from "../repositories/swipeRepository.js";
import * as userRepository from "../repositories/userRepository.js";
import { ageFrom, birthDateWindow } from "../utils/age.js";
import { ApiError } from "../utils/apiError.js";
import { jsonList } from "../db/normalize.js";
import { toDiscoverCard } from "../utils/serialize.js";

const DECK_LIMIT = 12;
const FETCH_CAP = 200; // compatibility filter runs in JS, so over-fetch a little

function parseInterestedIn(value) {
  const list = jsonList(value);
  return list.length ? list : GENDER_VALUES;
}

function compatible(me, them) {
  if (!me.gender || !them.gender) return false;
  if (!me.interestedIn.includes(them.gender)) return false;
  if (!them.interestedIn.includes(me.gender)) return false;
  if (them.age === null || me.age === null) return false;
  if (them.age < me.minAge || them.age > me.maxAge) return false;
  if (me.age < them.minAge || me.age > them.maxAge) return false;
  return true;
}

async function myContext(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw ApiError.notFound("Account not found.");
  const prefs = await findPreferences(userId);
  return {
    id: userId,
    gender: user.gender,
    age: ageFrom(user.birthDate),
    interestedIn: prefs?.interestedIn?.length ? prefs.interestedIn : GENDER_VALUES,
    minAge: prefs?.minAge ?? 18,
    maxAge: prefs?.maxAge ?? 99,
  };
}

/** Candidate rows with every exclusion pushed into SQL. */
async function candidateRows(userId, { filters = {}, fetchLimit } = {}) {
  const where = [
    "u.id <> ?",
    "u.deactivated_at IS NULL",
    "u.gender IS NOT NULL",
    "u.birth_date IS NOT NULL",
    "s.discoverable = 1",
    "s.profile_visibility <> 'PRIVATE'",
  ];
  const params = [userId];

  if (filters.genders?.length) {
    where.push(`u.gender IN (${filters.genders.map(() => "?").join(", ")})`);
    params.push(...filters.genders);
  }
  if (filters.minAge || filters.maxAge) {
    const window = birthDateWindow(filters.minAge ?? 18, filters.maxAge ?? 99);
    where.push("u.birth_date BETWEEN ? AND ?");
    params.push(window.oldest, window.youngest);
  }
  if (filters.interests?.length) {
    where.push(
      `EXISTS (SELECT 1 FROM user_interests ui
                WHERE ui.user_id = u.id AND ui.slug IN (${filters.interests.map(() => "?").join(", ")}))`,
    );
    params.push(...filters.interests);
  }
  if (filters.location) {
    where.push("(u.city LIKE ? OR u.country LIKE ?)");
    params.push(`%${filters.location}%`, `%${filters.location}%`);
  }
  if (filters.q) {
    where.push("(u.full_name LIKE ? OR u.bio LIKE ?)");
    params.push(`%${filters.q}%`, `%${filters.q}%`);
  }
  if (filters.goal) {
    where.push("p.relationship_goal = ?");
    params.push(filters.goal);
  }

  return db.all(
    `SELECT u.id, u.full_name, u.gender, u.birth_date, u.bio, u.city, u.country,
            u.profile_image, s.show_age, s.show_location, p.relationship_goal,
            p.interested_in, p.min_age, p.max_age
       FROM users u
       JOIN dating_preferences p ON p.user_id = u.id
       JOIN account_settings s ON s.user_id = u.id
      WHERE ${where.join(" AND ")}
      ORDER BY u.created_at DESC
      LIMIT ?`,
    [...params, fetchLimit],
  );
}

async function toCards(rows) {
  const interests = await listInterestsForMany(rows.map((row) => row.id));
  return rows.map((row) =>
    toDiscoverCard({ row, interests: interests.get(row.id) ?? [] }),
  );
}

/** The swipe deck: compatible people I have not swiped on yet. */
export async function deck(userId, { limit = DECK_LIMIT } = {}) {
  const me = await myContext(userId);
  const [swiped, blocked, partners] = await Promise.all([
    listSwipedIds(userId),
    listBlockedIdSet(userId),
    listPartnerIdSet(userId),
  ]);

  const rows = await candidateRows(userId, { fetchLimit: Math.min(FETCH_CAP, limit * 6 + 20) });
  const picked = [];
  for (const row of rows) {
    if (picked.length >= limit) break;
    if (swiped.has(row.id) || blocked.has(row.id) || partners.has(row.id)) continue;
    const them = {
      gender: row.gender,
      age: ageFrom(row.birth_date),
      interestedIn: parseInterestedIn(row.interested_in),
      minAge: row.min_age,
      maxAge: row.max_age,
    };
    if (!compatible(me, them)) continue;
    picked.push(row);
  }

  return { items: await toCards(picked), exhausted: picked.length < limit };
}

/**
 * Search grid: the same exclusions plus explicit filters. Unlike the deck,
 * search does not hide people I already passed on (that is what "search" is
 * for), but it still hides blocks and current matches.
 */
export async function search(userId, filters = {}) {
  const me = await myContext(userId);
  const [blocked, partners] = await Promise.all([
    listBlockedIdSet(userId),
    listPartnerIdSet(userId),
  ]);

  const rows = await candidateRows(userId, { filters, fetchLimit: FETCH_CAP });
  const picked = [];
  for (const row of rows) {
    if (blocked.has(row.id) || partners.has(row.id)) continue;
    const them = {
      gender: row.gender,
      age: ageFrom(row.birth_date),
      interestedIn: parseInterestedIn(row.interested_in),
      minAge: row.min_age,
      maxAge: row.max_age,
    };
    if (!compatible(me, them)) continue;
    picked.push(row);
  }

  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 24;
  return {
    items: await toCards(picked.slice(offset, offset + limit)),
    total: picked.length,
    offset,
    limit,
  };
}

export const SEARCH_GENDERS = GENDER_VALUES;
export const SEARCH_GOALS = RELATIONSHIP_GOAL_VALUES;
