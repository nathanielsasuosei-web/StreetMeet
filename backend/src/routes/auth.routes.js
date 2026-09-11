import express from "express";
import { register, login, me, changePassword, deleteAccount } from "../controllers/auth.controller.js";
import { authRequired } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.get("/me", authRequired, me);
router.post("/change-password", authRequired, changePassword);
router.delete("/me", authRequired, deleteAccount);

export default router;
