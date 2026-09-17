/**
 * Validation chains for module 3 (subscriptions & billing).
 */
import { body } from "express-validator";

import { MOMO_PROVIDERS, PAYMENT_CHANNELS, PAID_PLAN_VALUES } from "../constants/billing.js";

export const checkoutRules = [
  body("plan").isIn(PAID_PLAN_VALUES).withMessage("Choose PREMIUM or VIP."),
  body("channel").isIn(PAYMENT_CHANNELS).withMessage("Channel must be card or mobile_money."),
  body("phone").custom((value, { req }) => {
    if (req.body?.channel !== "mobile_money") return true;
    if (!value) throw new Error("Mobile money needs the wallet phone number.");
    if (!/^[0-9+\s-]{9,17}$/.test(String(value).trim())) {
      throw new Error("Enter a valid wallet phone number.");
    }
    return true;
  }),
  body("provider")
    .optional({ values: "null" })
    .isIn(MOMO_PROVIDERS.map((entry) => entry.value))
    .withMessage("Unknown mobile money provider."),
];

export const referenceRules = [
  body("reference").trim().isLength({ min: 6, max: 120 }).withMessage("Missing payment reference."),
];
