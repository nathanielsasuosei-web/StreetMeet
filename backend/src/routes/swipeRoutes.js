import express from "express";

import { createSwipe } from "../controllers/swipeController.js";
import { authRequired } from "../middleware/authMiddleware.js";
import { swipeLimiter } from "../middleware/rateLimiters.js";
import { validate } from "../middleware/validate.js";
import { swipeRules } from "../validators/datingRules.js";

const router = express.Router();

router.post("/", authRequired, swipeLimiter, swipeRules, validate, createSwipe);

export default router;
