import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { callSessions, matches } from "../db/schema.js";
import { env } from "../config/env.js";
import { asyncHandler, ok, badRequest, notFound, forbidden } from "../utils/http.js";
import { toPublicUser } from "../utils/user.js";

/** WebRTC needs ICE servers - hand them to the apps so TURN stays server-side. */
export const getIceConfig = asyncHandler(async (_req, res) => {
  ok(res, {
    iceServers: [
      { urls: env.turn.urls },
      ...(env.turn.username
        ? [{ urls: env.turn.urls, username: env.turn.username, credential: env.turn.credential }]
        : []),
    ],
  });
});

export const startCall = asyncHandler(async (req, res) => {
  const parsed = z
    .object({ matchId: z.string().min(1), type: z.enum(["AUDIO", "VIDEO"]) })
    .safeParse(req.body);
  if (!parsed.success) throw badRequest("matchId and type (AUDIO|VIDEO) are required");

  const [match] = await db.select().from(matches).where(eq(matches.id, parsed.data.matchId)).limit(1);
  if (!match || (match.userAId !== req.user.id && match.userBId !== req.user.id)) {
    throw notFound("You can only call people you matched with");
  }
  const calleeId = match.userAId === req.user.id ? match.userBId : match.userAId;

  const [call] = await db
    .insert(callSessions)
    .values({ matchId: match.id, callerId: req.user.id, calleeId, type: parsed.data.type, status: "RINGING" })
    .returning();

  ok(res, { call: { id: call.id, type: call.type, status: call.status, calleeId } }, 201);
});

export const endCall = asyncHandler(async (req, res) => {
  const [call] = await db.select().from(callSessions).where(eq(callSessions.id, req.params.id)).limit(1);
  if (!call || (call.callerId !== req.user.id && call.calleeId !== req.user.id)) throw notFound("Call not found");

  if (["ENDED", "MISSED", "REJECTED"].includes(call.status)) return ok(res, { call });

  const endedAt = new Date();
  const [updated] = await db
    .update(callSessions)
    .set({
      status: "ENDED",
      endedAt,
      durationSec: call.startedAt ? Math.round((endedAt - new Date(call.startedAt)) / 1000) : 0,
    })
    .where(eq(callSessions.id, call.id))
    .returning();

  ok(res, { call: updated });
});

export const callHistory = asyncHandler(async (req, res) => {
  const rows = await db.query.callSessions.findMany({
    where: or(eq(callSessions.callerId, req.user.id), eq(callSessions.calleeId, req.user.id)),
    with: { caller: true, callee: true },
    orderBy: [desc(callSessions.createdAt)],
    limit: 50,
  });

  ok(res, {
    calls: rows.map((call) => ({
      id: call.id,
      type: call.type,
      status: call.status,
      durationSec: call.durationSec,
      createdAt: call.createdAt,
      outgoing: call.callerId === req.user.id,
      partner: toPublicUser(call.callerId === req.user.id ? call.callee : call.caller, { preview: true }),
    })),
  });
});

export const acceptCall = asyncHandler(async (req, res) => {
  const [call] = await db.select().from(callSessions).where(eq(callSessions.id, req.params.id)).limit(1);
  if (!call || call.calleeId !== req.user.id) throw forbidden("This call is not for you");
  if (call.status !== "RINGING") throw badRequest("This call has already ended");

  const [updated] = await db
    .update(callSessions)
    .set({ status: "ONGOING", startedAt: new Date() })
    .where(and(eq(callSessions.id, call.id), eq(callSessions.status, "RINGING")))
    .returning();

  ok(res, { call: updated });
});

export const rejectCall = asyncHandler(async (req, res) => {
  const [call] = await db.select().from(callSessions).where(eq(callSessions.id, req.params.id)).limit(1);
  if (!call || call.calleeId !== req.user.id) throw forbidden("This call is not for you");

  const [updated] = await db
    .update(callSessions)
    .set({ status: req.body?.missed ? "MISSED" : "REJECTED", endedAt: new Date() })
    .where(eq(callSessions.id, call.id))
    .returning();

  ok(res, { call: updated });
});
