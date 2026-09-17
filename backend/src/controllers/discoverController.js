/**
 * /api/discover - the swipe deck and the search/filter grid.
 */
import * as discoverService from "../services/discoverService.js";
import asyncHandler from "../utils/asyncHandler.js";

export const getDeck = asyncHandler(async (req, res) => {
  const data = await discoverService.deck(req.user.id, { limit: req.query.limit });
  res.json({ success: true, data });
});

export const searchProfiles = asyncHandler(async (req, res) => {
  const { genders, interests, minAge, maxAge, goal, location, q, limit, offset } = req.query;
  const data = await discoverService.search(req.user.id, {
    genders: genders ? String(genders).split(",").map((v) => v.trim()).filter(Boolean) : null,
    interests: interests ? String(interests).split(",").map((v) => v.trim()).filter(Boolean) : null,
    minAge: minAge ?? null,
    maxAge: maxAge ?? null,
    goal: goal ?? null,
    location: location ?? null,
    q: q ?? null,
    limit: limit ?? undefined,
    offset: offset ?? undefined,
  });
  res.json({ success: true, data });
});

export default { getDeck, searchProfiles };
