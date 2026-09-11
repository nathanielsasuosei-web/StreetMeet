import { and, eq, isNull, ne, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { matches, messages } from "../db/schema.js";
import { emitToUser } from "./index.js";

export function registerChat(io, socket) {
  const user = socket.data.user;

  socket.on("chat:join", ({ matchId } = {}) => {
    if (!matchId) return;
    socket.join(`match:${matchId}`);
  });

  socket.on("chat:leave", ({ matchId } = {}) => {
    if (matchId) socket.leave(`match:${matchId}`);
  });

  socket.on("chat:typing", async ({ matchId } = {}) => {
    if (!matchId) return;
    const partnerId = await partnerOf(matchId, user.id);
    if (partnerId) emitToUser(partnerId, "chat:typing", { matchId, userId: user.id, name: user.fullName });
  });

  socket.on("chat:stopTyping", async ({ matchId } = {}) => {
    if (!matchId) return;
    const partnerId = await partnerOf(matchId, user.id);
    if (partnerId) emitToUser(partnerId, "chat:stopTyping", { matchId, userId: user.id });
  });

  socket.on("chat:seen", async ({ matchId } = {}) => {
    if (!matchId) return;
    const partnerId = await partnerOf(matchId, user.id);
    if (!partnerId) return;

    await db
      .update(messages)
      .set({ seenAt: new Date() })
      .where(and(eq(messages.matchId, matchId), ne(messages.senderId, user.id), isNull(messages.seenAt)));
    emitToUser(partnerId, "message:seen", { matchId, at: new Date().toISOString() });
  });
}

export async function partnerOf(matchId, userId) {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) return null;
  if (match.userAId !== userId && match.userBId !== userId) return null;
  return match.userAId === userId ? match.userBId : match.userAId;
}
