/**
 * /api/matches - my matches, threads, sending, read receipts, unmatching.
 */
import * as matchService from "../services/matchService.js";
import asyncHandler from "../utils/asyncHandler.js";

export const listMatches = asyncHandler(async (req, res) => {
  const data = await matchService.listMatches(req.user.id);
  res.json({ success: true, data });
});

export const getMatch = asyncHandler(async (req, res) => {
  const data = await matchService.getMatch(req.user.id, req.params.matchId);
  res.json({ success: true, data });
});

export const getMessages = asyncHandler(async (req, res) => {
  const data = await matchService.getThread(req.user.id, req.params.matchId, {
    before: req.query.before ?? null,
    limit: req.query.limit ?? 50,
  });
  res.json({ success: true, data });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const data = await matchService.sendMessage(req.user.id, req.params.matchId, req.body.content);
  res.status(201).json({ success: true, message: "Message sent.", data });
});

export const markRead = asyncHandler(async (req, res) => {
  const data = await matchService.markRead(req.user.id, req.params.matchId);
  res.json({ success: true, data });
});

export const unmatch = asyncHandler(async (req, res) => {
  const data = await matchService.unmatch(req.user.id, req.params.matchId);
  res.json({ success: true, message: "Unmatched.", data });
});

export default { listMatches, getMatch, getMessages, sendMessage, markRead, unmatch };
