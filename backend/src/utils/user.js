import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { ageFromBirthDate } from "./date.js";

export const FREE_DAILY_LIKES = 20;
export const PREMIUM_DAILY_LIKES = 100;

export const isPremium = (user) =>
  Boolean(user?.premiumUntil && new Date(user.premiumUntil).getTime() > Date.now());

/** Shape a user row for the API (adds age + premium flag + online flag). */
export function toPublicUser(user, { online = false, distanceKm = null, preview = false } = {}) {
  if (!user) return null;

  const base = {
    id: user.id,
    fullName: user.fullName,
    gender: user.gender,
    age: ageFromBirthDate(user.birthDate),
    bio: user.bio,
    city: user.city,
    country: user.country,
    avatarUrl: user.avatarUrl ?? user.photos?.[0] ?? null,
    photos: user.photos ?? [],
    interests: user.interests ?? [],
    verified: user.verified,
    isPremium: isPremium(user),
    premiumUntil: user.premiumUntil,
    lastActiveAt: user.lastActiveAt,
    online,
    distanceKm,
  };

  // Preview (discover cards, matches) never leaks email/phone/role
  if (preview) return base;

  return {
    ...base,
    email: user.email,
    phone: user.phone,
    role: user.role,
    onboarded: user.onboarded,
    lookingFor: user.lookingFor ?? [],
    minAge: user.minAge,
    maxAge: user.maxAge,
  };
}

/** Reset the daily like counter once the 24h window has passed. */
export async function refreshLikeWindow(userId) {
  const [user] = await db
    .select({
      likesToday: users.likesToday,
      likesResetAt: users.likesResetAt,
      premiumUntil: users.premiumUntil,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return { likesToday: 0, limit: FREE_DAILY_LIKES, remaining: FREE_DAILY_LIKES };

  const stale =
    !user.likesResetAt || Date.now() - new Date(user.likesResetAt).getTime() > 24 * 60 * 60 * 1000;

  if (stale) {
    const [updated] = await db
      .update(users)
      .set({ likesToday: 0, likesResetAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({ likesToday: users.likesToday, premiumUntil: users.premiumUntil });
    return likeBudget(updated);
  }

  return likeBudget(user);
}

export function likeBudget(user) {
  const limit = isPremium(user) ? PREMIUM_DAILY_LIKES : FREE_DAILY_LIKES;
  const used = user?.likesToday ?? 0;
  return { likesToday: used, limit, remaining: Math.max(0, limit - used) };
}

/** Bump the like counter (used when someone swipes). */
export async function spendLike(userId, cost = 1) {
  await db
    .update(users)
    .set({ likesToday: sql`${users.likesToday} + ${cost}`, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

/** Haversine distance in kilometres. */
export function distanceKm(a, b) {
  if (a?.latitude == null || b?.latitude == null) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}
