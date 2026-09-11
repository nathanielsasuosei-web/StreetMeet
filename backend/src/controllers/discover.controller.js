import { and, arrayContains, desc, eq, gt, inArray, notInArray, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { blocks, likes, matches, passes, users } from "../db/schema.js";
import { asyncHandler, ok, badRequest } from "../utils/http.js";
import { toPublicUser, refreshLikeWindow, likeBudget, distanceKm, isPremium, spendLike } from "../utils/user.js";
import { ageFromBirthDate } from "../utils/date.js";
import { emitToUser } from "../sockets/index.js";

/** Ids the current user must never see again: self, blocked, likes, passes, matches. */
async function excludedIds(userId) {
  const [sentLikes, sentPasses, blocked, blockers, myMatches] = await Promise.all([
    db.select({ id: likes.likedId }).from(likes).where(eq(likes.likerId, userId)),
    db.select({ id: passes.passedId }).from(passes).where(eq(passes.passerId, userId)),
    db.select({ id: blocks.blockedId }).from(blocks).where(eq(blocks.blockerId, userId)),
    db.select({ id: blocks.blockerId }).from(blocks).where(eq(blocks.blockedId, userId)),
    db.select({ a: matches.userAId, b: matches.userBId }).from(matches).where(or(eq(matches.userAId, userId), eq(matches.userBId, userId))),
  ]);

  return [
    ...new Set([
      userId,
      ...sentLikes.map((r) => r.id),
      ...sentPasses.map((r) => r.id),
      ...blocked.map((r) => r.id),
      ...blockers.map((r) => r.id),
      ...myMatches.map((m) => (m.a === userId ? m.b : m.a)),
    ]),
  ];
}

export const getFeed = asyncHandler(async (req, res) => {
  const [me] = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
  if (!me.onboarded) {
    return ok(res, { profiles: [], reason: "Finish your profile to start matching" });
  }

  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const excluded = await excludedIds(me.id);

  const conditions = [
    notInArray(users.id, excluded),
    eq(users.showMe, true),
    eq(users.banned, false),
    eq(users.onboarded, true),
    gt(sql`array_length(${users.photos}, 1)`, 0),
  ];
  if (me.lookingFor?.length) conditions.push(inArray(users.gender, me.lookingFor));

  const candidates = await db
    .select()
    .from(users)
    .where(and(...conditions))
    .orderBy(desc(users.lastActiveAt))
    .limit(limit * 4);

  const profiles = candidates
    .map((candidate) => ({ candidate, distance: distanceKm(me, candidate) }))
    .filter(({ candidate, distance }) => {
      const age = ageFromBirthDate(candidate.birthDate);
      if (age != null && (age < me.minAge || age > me.maxAge)) return false;
      if (distance != null && distance > me.maxDistanceKm) return false;
      return true;
    })
    .slice(0, limit)
    .map(({ candidate, distance }) => toPublicUser(candidate, { distanceKm: distance, preview: true }));

  ok(res, { profiles, likes: await refreshLikeWindow(me.id) });
});

export const likeUser = asyncHandler(async (req, res) => {
  const targetId = req.params.id;
  const superLike = req.body?.superLike === true;
  if (targetId === req.user.id) throw badRequest("You cannot like yourself");

  const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
  if (!target) throw badRequest("That profile no longer exists");

  const [me] = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
  const budget = await refreshLikeWindow(me.id);

  const cost = superLike && !isPremium(me) ? 2 : 1;
  if (budget.remaining < cost) {
    throw badRequest("You are out of likes for today - come back tomorrow or upgrade");
  }

  await db
    .insert(likes)
    .values({ likerId: me.id, likedId: targetId, superLike })
    .onConflictDoUpdate({ target: [likes.likerId, likes.likedId], set: { superLike } });

  await spendLike(me.id, cost);

  // Did they like me back? -> create the match
  const [reciprocal] = await db
    .select()
    .from(likes)
    .where(and(eq(likes.likerId, targetId), eq(likes.likedId, me.id)))
    .limit(1);

  let match = null;
  if (reciprocal) {
    const [a, b] = [me.id, targetId].sort();
    const inserted = await db
      .insert(matches)
      .values({ userAId: a, userBId: b })
      .onConflictDoNothing()
      .returning();
    match = inserted[0] ?? (await db.select().from(matches).where(and(eq(matches.userAId, a), eq(matches.userBId, b))).limit(1))[0];

    emitToUser(targetId, "match:new", {
      matchId: match?.id,
      user: toPublicUser(me, { preview: true }),
      at: new Date().toISOString(),
    });
  } else {
    emitToUser(targetId, "like:new", {
      from: toPublicUser(me, { preview: true }),
      superLike,
      at: new Date().toISOString(),
    });
  }

  ok(res, { liked: true, matched: Boolean(match), matchId: match?.id ?? null, likes: await refreshLikeWindow(me.id) });
});

export const passUser = asyncHandler(async (req, res) => {
  await db
    .insert(passes)
    .values({ passerId: req.user.id, passedId: req.params.id })
    .onConflictDoNothing();
  ok(res, { passed: true });
});

/** "Who likes me" - blurred unless the viewer has an active plan. */
export const getLikers = asyncHandler(async (req, res) => {
  const [me] = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
  const premium = isPremium(me);

  const rows = await db
    .select({ liker: users, createdAt: likes.createdAt, superLike: likes.superLike })
    .from(likes)
    .innerJoin(users, eq(users.id, likes.likerId))
    .where(eq(likes.likedId, me.id))
    .orderBy(desc(likes.createdAt))
    .limit(60);

  ok(res, {
    premium,
    count: rows.length,
    likes: await refreshLikeWindow(me.id),
    likers: rows.map(({ liker }) => {
      const user = toPublicUser(liker, { preview: true });
      if (premium) return user;
      return {
        id: user.id,
        fullName: "Secret admirer",
        age: user.age,
        city: user.city,
        avatarUrl: null,
        photos: [],
        blurred: true,
      };
    }),
  });
});

export const getBudget = asyncHandler(async (req, res) => {
  const [me] = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
  ok(res, { likes: likeBudget(me) });
});
