/**
 * The in-app notification centre: likes, matches and messages addressed to
 * me, with an unread counter for the navbar badge.
 */
import * as notificationRepository from "../repositories/notificationRepository.js";
import { iso, } from "../db/index.js";
import { toNotificationItem } from "../utils/serialize.js";
import { ApiError } from "../utils/apiError.js";

export async function listNotifications(userId, { limit = 30 } = {}) {
  const [rows, unread] = await Promise.all([
    notificationRepository.listFor(userId, limit),
    notificationRepository.unreadCount(userId),
  ]);
  return { items: rows.map((row) => toNotificationItem({ row })), unread };
}

export async function markAllRead(userId) {
  const changed = await notificationRepository.markAllRead(userId);
  return { markedRead: changed, unread: 0 };
}

export async function markOneRead(userId, id) {
  const changed = await notificationRepository.markOneRead(id, userId);
  if (!changed) {
    // either unknown, not mine, or already read - only the last is fine
    const rows = await notificationRepository.listFor(userId, 50);
    if (!rows.some((row) => row.id === id)) throw ApiError.notFound("Notification not found.");
  }
  const unread = await notificationRepository.unreadCount(userId);
  return { markedRead: changed, unread, readAt: iso(new Date()) };
}
