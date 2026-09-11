import express from "express";
import {
  listPlans,
  initiatePayment,
  checkPayment,
  paymentHistory,
  hubtelWebhook,
  paystackWebhook,
  simulatePayment,
} from "../controllers/payments.controller.js";
import { authRequired } from "../middleware/auth.js";
import { paymentLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

// Public: plan catalogue + provider webhooks
router.get("/plans", listPlans);
router.post("/webhook/hubtel", express.json(), hubtelWebhook);
router.post("/webhook/paystack", express.json(), paystackWebhook);

// Logged in
router.post("/initiate", authRequired, paymentLimiter, initiatePayment);
router.get("/:reference", authRequired, checkPayment);
router.get("/", authRequired, paymentHistory);
router.post("/simulate", authRequired, simulatePayment);

export default router;
