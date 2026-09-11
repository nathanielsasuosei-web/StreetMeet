/**
 * WebRTC signalling. The server NEVER touches media - it only relays offers,
 * answers and ICE candidates between the two peers (plus busy/end states).
 */
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { callSessions, matches } from "../db/schema.js";
import { emitToUser, presence, busyUsers } from "./index.js";

export function registerCalls(io, socket) {
  const user = socket.data.user;

  // caller starts the call --------------------------------------------------
  socket.on("call:initiate", async ({ to, matchId, callId, type = "VIDEO", offer } = {}) => {
    try {
      if (!to || !offer) return;

      const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
      const isMatch = match && (match.userAId === user.id || match.userBId === user.id);
      if (!isMatch) {
        return socket.emit("call:failed", { to, reason: "You can only call your matches" });
      }

      if (!presence.has(to)) {
        socket.emit("call:unavailable", { to, reason: "That member is offline" });
      }

      if (busyUsers.has(to)) {
        return socket.emit("call:busy", { to, reason: "That member is on another call" });
      }

      const call = callId
        ? (await db.select().from(callSessions).where(eq(callSessions.id, callId)).limit(1))[0]
        : (
            await db
              .insert(callSessions)
              .values({ matchId, callerId: user.id, calleeId: to, type, status: "RINGING" })
              .returning()
          )[0];

      if (!call) return socket.emit("call:failed", { to, reason: "Call not found" });

      busyUsers.set(user.id, call.id);
      socket.data.callId = call.id;

      emitToUser(to, "call:incoming", {
        callId: call.id,
        matchId,
        type: call.type,
        offer,
        from: {
          id: user.id,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl || user.photos?.[0] || null,
        },
      });
    } catch (error) {
      socket.emit("call:failed", { to, reason: error.message });
    }
  });

  socket.on("call:answer", async ({ to, callId, answer } = {}) => {
    try {
      const [call] = await db.select().from(callSessions).where(eq(callSessions.id, callId)).limit(1);
      if (call && call.calleeId === user.id) {
        busyUsers.set(user.id, callId);
        await db
          .update(callSessions)
          .set({ status: "ONGOING", startedAt: new Date() })
          .where(eq(callSessions.id, callId));
      }
      emitToUser(to, "call:answered", { callId, answer });
    } catch {
      socket.emit("call:failed", { to, reason: "Could not answer" });
    }
  });

  socket.on("call:ice", ({ to, callId, candidate } = {}) => {
    if (!candidate) return;
    emitToUser(to, "call:ice", { callId, candidate });
  });

  socket.on("call:reject", async ({ to, callId, missed = false } = {}) => {
    if (callId) {
      await db
        .update(callSessions)
        .set({ status: missed ? "MISSED" : "REJECTED", endedAt: new Date() })
        .where(eq(callSessions.id, callId))
        .catch(() => {});
    }
    busyUsers.delete(user.id);
    emitToUser(to, "call:rejected", { callId, by: user.id });
  });

  socket.on("call:end", async ({ to, callId } = {}) => {
    busyUsers.delete(user.id);
    if (callId) {
      const [call] = await db.select().from(callSessions).where(eq(callSessions.id, callId)).limit(1).catch(() => []);
      if (call && ["RINGING", "ONGOING"].includes(call.status)) {
        const endedAt = new Date();
        await db
          .update(callSessions)
          .set({
            status: "ENDED",
            endedAt,
            durationSec: call.startedAt ? Math.round((endedAt - new Date(call.startedAt)) / 1000) : 0,
          })
          .where(eq(callSessions.id, callId))
          .catch(() => {});
      }
    }
    emitToUser(to, "call:ended", { callId, by: user.id });
  });

  socket.on("call:cancel", async ({ to, callId } = {}) => {
    busyUsers.delete(user.id);
    if (callId) {
      await db
        .update(callSessions)
        .set({ status: "MISSED", endedAt: new Date() })
        .where(eq(callSessions.id, callId))
        .catch(() => {});
    }
    emitToUser(to, "call:cancelled", { callId, by: user.id });
  });
}
