/**
 * Blocks and reports: /api/users/:userId/block, /api/users/:userId/report and
 * /api/blocks.
 */
import * as moderationService from "../services/moderationService.js";
import asyncHandler from "../utils/asyncHandler.js";

export const blockUser = asyncHandler(async (req, res) => {
  const data = await moderationService.block(req.user.id, req.params.userId);
  res.json({ success: true, message: "Blocked. They can no longer see you.", data });
});

export const unblockUser = asyncHandler(async (req, res) => {
  const data = await moderationService.unblock(req.user.id, req.params.userId);
  res.json({ success: true, message: "Unblocked.", data });
});

export const listBlocked = asyncHandler(async (req, res) => {
  const data = await moderationService.listBlocked(req.user.id);
  res.json({ success: true, data });
});

export const reportUser = asyncHandler(async (req, res) => {
  const data = await moderationService.report(req.user.id, req.params.userId, {
    reason: req.body.reason,
    details: req.body.details,
  });
  res.status(201).json({
    success: true,
    message: "Report received. Our moderators will review it.",
    data,
  });
});

export default { blockUser, unblockUser, listBlocked, reportUser };
