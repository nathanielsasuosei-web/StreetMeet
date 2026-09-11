import express from "express";
import {
  getStats,
  listUsers,
  setUserStatus,
  listReports,
  resolveReport,
  createPlan,
  updatePlan,
} from "../controllers/admin.controller.js";
import { adminOnly } from "../middleware/auth.js";

const router = express.Router();

router.use(adminOnly);

router.get("/stats", getStats);
router.get("/users", listUsers);
router.patch("/users/:id", setUserStatus);
router.get("/reports", listReports);
router.post("/reports/:id/resolve", resolveReport);
router.post("/plans", createPlan);
router.patch("/plans/:id", updatePlan);

export default router;
