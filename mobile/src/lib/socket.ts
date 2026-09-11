import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from './config';
import { tokenStore } from './api';

let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket> {
  const token = await tokenStore.get();
  if (!token) throw new Error('No session');

  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    auth: { token },
    reconnectionAttempts: 5,
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
