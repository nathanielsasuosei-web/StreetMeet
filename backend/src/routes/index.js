import express from "express";

import authRoutes from "./auth.routes.js";
import profileRoutes from "./profile.routes.js";
import discoverRoutes from "./discover.routes.js";
import matchRoutes from "./match.routes.js";
import chatRoutes from "./chat.routes.js";
import statusRoutes from "./status.routes.js";
import callRoutes from "./call.routes.js";
import paymentRoutes from "./payment.routes.js";
import adminRoutes from "./admin.routes.js";
import { authRequired } from "../middleware/auth.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/profile", authRequired, profileRoutes);
router.use("/discover", authRequired, discoverRoutes);
router.use("/matches", authRequired, matchRoutes);
router.use("/chat", authRequired, chatRoutes);
router.use("/status", authRequired, statusRoutes);
router.use("/calls", authRequired, callRoutes);
router.use("/payments", paymentRoutes); // auth is applied per-route (webhooks are public)
router.use("/admin", authRequired, adminRoutes);

export default router;
