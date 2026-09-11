/**
 * Realtime layer: presence + chat + WebRTC call signalling.
 *
 * NOTE FOR SCALING: the presence/busy maps live in process memory, which is
 * fine for one instance. When you run more than one Render instance, add the
 * Redis adapter (see docs/STEP-BY-STEP.md -> Step 15).
 */
import { Server } from "socket.io";
import { eq } from "drizzle-orm";
import { registerChat } from "./chat.js";
import { registerCalls } from "./calls.js";
import { verifyToken } from "../utils/jwt.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";

/** userId -> Set<socketId> */
export const presence = new Map();
/** socketId -> userId */
const socketOwners = new Map();
/** userId -> active callId */
export const busyUsers = new Map();

let io = null;

export function initSockets(httpServer, { origin }) {
  io = new Server(httpServer, {
    cors: { origin, credentials: true },
    path: "/socket.io",
  });

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "");
      if (!token) return next(new Error("unauthorized"));
      const payload = verifyToken(token);
      const [user] = await db
        .select({
          id: users.id,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
          photos: users.photos,
          role: users.role,
          banned: users.banned,
        })
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1);
      if (!user || user.banned) return next(new Error("unauthorized"));
      socket.data.user = user;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;

    socket.join(`user:${user.id}`);
    socketOwners.set(socket.id, user.id);
    if (!presence.has(user.id)) presence.set(user.id, new Set());
    presence.get(user.id).add(socket.id);

    broadcastPresence(user.id, true);
    socket.emit("presence:mine", { online: true });
    socket.on("presence:who", (userIds = [], ack) => {
      const online = (Array.isArray(userIds) ? userIds : []).filter((id) => presence.has(id));
      if (typeof ack === "function") ack({ online });
    });

    registerChat(io, socket);
    registerCalls(io, socket);

    socket.on("disconnect", () => {
      const userId = socketOwners.get(socket.id);
      socketOwners.delete(socket.id);
      busyUsers.delete(user.id);
      if (userId && presence.has(userId)) {
        presence.get(userId).delete(socket.id);
        if (presence.get(userId).size === 0) {
          presence.delete(userId);
          broadcastPresence(userId, false);
        }
      }
    });
  });

  return io;
}

export function getIO() {
  return io;
}

export function isOnline(userId) {
  return presence.has(userId);
}

export function emitToUser(userId, event, payload) {
  if (!io || !userId) return false;
  io.to(`user:${userId}`).emit(event, payload);
  return presence.has(userId);
}

function broadcastPresence(userId, online) {
  if (!io) return;
  io.emit("presence:update", { userId, online });
}
