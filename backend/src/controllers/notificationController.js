/**
 * /api/notifications - the in-app notification centre.
 */
import * as notificationService from "../services/notificationService.js";
import asyncHandler from "../utils/asyncHandler.js";

export const listNotifications = asyncHandler(async (req, res) => {
  const data = await notificationService.listNotifications(req.user.id, {
    limit: req.query.limit ?? undefined,
  });
  res.json({ success: true, data });
});

export const markAllRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markAllRead(req.user.id);
  res.json({ success: true, data });
});

export const markOneRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markOneRead(req.user.id, req.params.id);
  res.json({ success: true, data });
});

export default { listNotifications, markAllRead, markOneRead };
