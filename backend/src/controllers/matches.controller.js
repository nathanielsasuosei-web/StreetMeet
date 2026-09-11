import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { callSessions, likes, matches, messages, passes, users } from "../db/schema.js";
import { asyncHandler, ok, notFound } from "../utils/http.js";
import { toPublicUser } from "../utils/user.js";
import { emitToUser } from "../sockets/index.js";

const other = (match, userId) => (match.userAId === userId ? match.userB : match.userA);

export const listMatches = asyncHandler(async (req, res) => {
  const rows = await db.query.matches.findMany({
    where: or(eq(matches.userAId, req.user.id), eq(matches.userBId, req.user.id)),
    with: {
      userA: true,
      userB: true,
      messages: { limit: 1, orderBy: (m, { desc: d }) => [d(m.createdAt)] },
    },
    orderBy: [desc(matches.lastMessageAt)],
  });

  ok(res, {
    matches: rows.map((match) => {
      const partner = other(match, req.user.id);
      const last = match.messages?.[0];
      return {
        id: match.id,
        partner: toPublicUser(partner, { preview: true }),
        lastMessage: last
          ? {
              body: last.body,
              mediaType: last.mediaType,
              fromMe: last.senderId === req.user.id,
              seenAt: last.seenAt,
              createdAt: last.createdAt,
            }
          : null,
        lastMessageAt: match.lastMessageAt,
        createdAt: match.createdAt,
      };
    }),
  });
});

export const getMatch = asyncHandler(async (req, res) => {
  const match = await db.query.matches.findFirst({
    where: and(
      eq(matches.id, req.params.id),
      or(eq(matches.userAId, req.user.id), eq(matches.userBId, req.user.id))
    ),
    with: { userA: true, userB: true },
  });
  if (!match) throw notFound("Match not found");

  ok(res, {
    match: {
      id: match.id,
      partner: toPublicUser(other(match, req.user.id), { preview: true }),
      createdAt: match.createdAt,
    },
  });
});

export const unmatch = asyncHandler(async (req, res) => {
  const [match] = await db.select().from(matches).where(eq(matches.id, req.params.id)).limit(1);
  if (!match || (match.userAId !== req.user.id && match.userBId !== req.user.id)) {
    throw notFound("Match not found");
  }
  const partnerId = match.userAId === req.user.id ? match.userBId : match.userAId;

  await db.transaction(async (tx) => {
    await tx.delete(messages).where(eq(messages.matchId, match.id));
    await tx.delete(callSessions).where(eq(callSessions.matchId, match.id));
    await tx.delete(matches).where(eq(matches.id, match.id));
    await tx
      .delete(likes)
      .where(
        or(
          and(eq(likes.likerId, req.user.id), eq(likes.likedId, partnerId)),
          and(eq(likes.likerId, partnerId), eq(likes.likedId, req.user.id))
        )
      );
    await tx.insert(passes).values({ passerId: req.user.id, passedId: partnerId }).onConflictDoNothing();
  });

  emitToUser(partnerId, "match:removed", { matchId: match.id });
  ok(res, { message: "Unmatched" });
});
