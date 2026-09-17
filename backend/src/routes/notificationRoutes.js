import express from "express";

import {
  listNotifications,
  markAllRead,
  markOneRead,
} from "../controllers/notificationController.js";
import { authRequired } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import { notificationIdRule, notificationQueryRules } from "../validators/datingRules.js";

const router = express.Router();

router.get("/", authRequired, notificationQueryRules, validate, listNotifications);
router.post("/read", authRequired, markAllRead);
router.post("/:id/read", authRequired, notificationIdRule, validate, markOneRead);

export default router;
