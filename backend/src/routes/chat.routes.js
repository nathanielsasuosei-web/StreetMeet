import express from "express";
import { listMessages, sendMessage, markSeen, listConversations } from "../controllers/chat.controller.js";
import { upload } from "../middleware/upload.js";
import { messageLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

router.get("/", listConversations);
router.get("/:matchId/messages", listMessages);
router.post("/:matchId/messages", messageLimiter, upload.single("media"), sendMessage);
router.post("/:matchId/seen", markSeen);

export default router;
