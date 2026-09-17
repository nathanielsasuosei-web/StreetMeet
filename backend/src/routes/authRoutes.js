import express from "express";

import { login, logout, me, reactivate, register } from "../controllers/authController.js";
import { authRequired } from "../middleware/authMiddleware.js";
import { authLimiter } from "../middleware/rateLimiters.js";
import { validate } from "../middleware/validate.js";
import { loginRules, reactivateRules, registerRules } from "../validators/authRules.js";

const router = express.Router();

router.post("/register", authLimiter, registerRules, validate, register);
router.post("/login", authLimiter, loginRules, validate, login);
router.post("/reactivate", authLimiter, reactivateRules, validate, reactivate);

router.get("/me", authRequired, me);
router.post("/logout", authRequired, logout);

export default router;
