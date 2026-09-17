/**
 * /api/swipes - like / pass, and the mutual-like match.
 */
import * as swipeService from "../services/swipeService.js";
import asyncHandler from "../utils/asyncHandler.js";

export const createSwipe = asyncHandler(async (req, res) => {
  const data = await swipeService.swipe(req.user.id, {
    targetId: req.body.targetId,
    decision: req.body.decision,
  });
  const message = data.matched
    ? "It's a match!"
    : data.decision === "LIKE"
      ? "Liked. We'll tell you if they like you back."
      : "Passed.";
  res.status(data.matched ? 201 : 200).json({ success: true, message, data });
});

export default { createSwipe };
