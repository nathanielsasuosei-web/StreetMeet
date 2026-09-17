import express from "express";

import {
  blockUser,
  listBlocked,
  reportUser,
  unblockUser,
} from "../controllers/moderationController.js";
import { authRequired } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import { reportRules, userIdRule } from "../validators/datingRules.js";

const router = express.Router();

router.post("/users/:userId/block", authRequired, userIdRule, validate, blockUser);
router.delete("/users/:userId/block", authRequired, userIdRule, validate, unblockUser);
router.post("/users/:userId/report", authRequired, userIdRule, reportRules, validate, reportUser);
router.get("/blocks", authRequired, listBlocked);

export default router;
