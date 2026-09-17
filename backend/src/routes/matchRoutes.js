import express from "express";

import {
  getMatch,
  getMessages,
  listMatches,
  markRead,
  sendMessage,
  unmatch,
} from "../controllers/matchController.js";
import { authRequired } from "../middleware/authMiddleware.js";
import { messageLimiter } from "../middleware/rateLimiters.js";
import { validate } from "../middleware/validate.js";
import {
  matchIdRule,
  messageRules,
  threadQueryRules,
} from "../validators/datingRules.js";

const router = express.Router();

router.get("/", authRequired, listMatches);
router.get("/:matchId", authRequired, matchIdRule, validate, getMatch);
router.get("/:matchId/messages", authRequired, matchIdRule, threadQueryRules, validate, getMessages);
router.post("/:matchId/messages", authRequired, matchIdRule, messageLimiter, messageRules, validate, sendMessage);
router.post("/:matchId/read", authRequired, matchIdRule, validate, markRead);
router.delete("/:matchId", authRequired, matchIdRule, validate, unmatch);

export default router;
