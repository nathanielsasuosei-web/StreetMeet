import express from "express";

import {
  getCurrent,
  getPlans,
  mockPay,
  startCheckout,
  verifyPayment,
  webhook,
} from "../controllers/billingController.js";
import { authRequired } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import { checkoutRules, referenceRules } from "../validators/billingRules.js";

const router = express.Router();

router.get("/plans", authRequired, getPlans);
router.get("/subscription", authRequired, getCurrent);
router.post("/checkout", authRequired, checkoutRules, validate, startCheckout);
router.post("/verify", authRequired, referenceRules, validate, verifyPayment);
router.post("/mock-pay", authRequired, referenceRules, validate, mockPay);

// rawBody is captured by the app-level JSON parser for signature checks
router.post("/webhook", webhook);

export default router;
