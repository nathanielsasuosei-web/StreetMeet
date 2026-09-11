import { io } from "socket.io-client";
import { tokenStore } from "./api.js";

let socket = null;

/** Connect (or reuse) the realtime socket. Called after login. */
export function connectSocket() {
  const token = tokenStore.get();
  if (!token) return null;

  if (socket?.connected) return socket;

  socket = io({
    withCredentials: true,
    transports: ["websocket", "polling"],
    auth: { token },
  });

  socket.on("connect_error", (error) => {
    if (error?.message === "unauthorized") {
      tokenStore.clear();
      window.location.href = "/login";
    }
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
