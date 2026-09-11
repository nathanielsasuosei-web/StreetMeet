import { and, asc, desc, eq, isNull, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { matches, messages, users } from "../db/schema.js";
import { asyncHandler, ok, badRequest, notFound } from "../utils/http.js";
import { toPublicUser } from "../utils/user.js";
import { fileUrl } from "../middleware/upload.js";
import { emitToUser } from "../sockets/index.js";

const sendSchema = z.object({
  body: z.string().trim().max(4000).optional(),
  clientId: z.string().max(64).optional(),
});

async function assertMember(matchId, userId) {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match || (match.userAId !== userId && match.userBId !== userId)) {
    throw notFound("Conversation not found");
  }
  return match;
}

export const listMessages = asyncHandler(async (req, res) => {
  const match = await assertMember(req.params.matchId, req.user.id);

  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const before = req.query.before ? new Date(String(req.query.before)) : null;

  const rows = await db
    .select()
    .from(messages)
    .where(
      before
        ? and(eq(messages.matchId, match.id), lt(messages.createdAt, before))
        : eq(messages.matchId, match.id)
    )
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  ok(res, {
    messages: rows.reverse().map((m) => ({
      id: m.id,
      body: m.body,
      mediaUrl: m.mediaUrl,
      mediaType: m.mediaType,
      fromMe: m.senderId === req.user.id,
      senderId: m.senderId,
      seenAt: m.seenAt,
      createdAt: m.createdAt,
    })),
    nextCursor: rows.length === limit ? rows[rows.length - 1].createdAt.toISOString() : null,
  });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const match = await assertMember(req.params.matchId, req.user.id);
  const hasFile = Boolean(req.file);

  if (!hasFile) {
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success || !parsed.data.body?.length) {
      throw badRequest("Write a message first");
    }
  }

  const [message] = await db
    .insert(messages)
    .values({
      matchId: match.id,
      senderId: req.user.id,
      body: req.body?.body?.trim() || null,
      mediaUrl: hasFile ? fileUrl(req.file, req) : null,
      mediaType: hasFile
        ? req.file.mimetype.startsWith("image/")
          ? "IMAGE"
          : req.file.mimetype.startsWith("video/")
            ? "VIDEO"
            : "AUDIO"
        : "TEXT",
    })
    .returning();

  const [sender] = await db
    .select({ fullName: users.fullName, avatarUrl: users.avatarUrl, photos: users.photos })
    .from(users)
    .where(eq(users.id, req.user.id))
    .limit(1);

  await db.update(matches).set({ lastMessageAt: new Date() }).where(eq(matches.id, match.id));

  const recipientId = match.userAId === req.user.id ? match.userBId : match.userAId;
  const payload = {
    id: message.id,
    matchId: match.id,
    body: message.body,
    mediaUrl: message.mediaUrl,
    mediaType: message.mediaType,
    senderId: message.senderId,
    senderName: sender?.fullName,
    clientId: req.body?.clientId ?? null,
    createdAt: message.createdAt,
  };

  emitToUser(recipientId, "message:new", payload);
  ok(res, { message: { ...payload, fromMe: true } }, 201);
});

export const markSeen = asyncHandler(async (req, res) => {
  const match = await assertMember(req.params.matchId, req.user.id);
  const now = new Date();

  await db
    .update(messages)
    .set({ seenAt: now })
    .where(and(eq(messages.matchId, match.id), ne(messages.senderId, req.user.id), isNull(messages.seenAt)));

  const partnerId = match.userAId === req.user.id ? match.userBId : match.userAId;
  emitToUser(partnerId, "message:seen", { matchId: match.id, at: now.toISOString() });
  ok(res, { seen: true });
});

export const listConversations = asyncHandler(async (req, res) => {
  const rows = await db.query.matches.findMany({
    where: or_(req.user.id),
    with: {
      userA: true,
      userB: true,
      messages: { limit: 1, orderBy: (m, { desc: d }) => [d(m.createdAt)] },
    },
    orderBy: [desc(matches.lastMessageAt)],
  });

  ok(res, {
    conversations: rows.map((match) => {
      const partner = match.userAId === req.user.id ? match.userB : match.userA;
      const last = match.messages?.[0];
      return {
        matchId: match.id,
        partner: toPublicUser(partner, { preview: true }),
        lastMessage: last
          ? {
              body: last.body,
              mediaType: last.mediaType,
              fromMe: last.senderId === req.user.id,
              createdAt: last.createdAt,
            }
          : null,
      };
    }),
  });
});

// small helper so the query above stays readable
function or_(userId) {
  return or(eq(matches.userAId, userId), eq(matches.userBId, userId));
}
