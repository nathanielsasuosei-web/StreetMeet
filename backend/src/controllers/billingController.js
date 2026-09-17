/**
 * /api/billing - plans, checkout, verification, webhook, current subscription.
 */
import * as billingService from "../services/billingService.js";
import * as planService from "../services/planService.js";
import asyncHandler from "../utils/asyncHandler.js";
import { signatureMatches } from "../services/paystack.js";

export const getPlans = asyncHandler(async (req, res) => {
  const data = await planService.catalogue(req.user.id);
  res.json({ success: true, data });
});

export const getCurrent = asyncHandler(async (req, res) => {
  const data = await billingService.current(req.user.id);
  res.json({ success: true, data });
});

export const startCheckout = asyncHandler(async (req, res) => {
  const data = await billingService.checkout(req.user.id, {
    plan: req.body.plan,
    channel: req.body.channel,
    phone: req.body.phone,
    provider: req.body.provider,
  });
  res.status(201).json({ success: true, message: "Checkout started.", data });
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const data = await billingService.verify(req.user.id, req.body.reference);
  const message = data.active
    ? `${data.plan} is live - thank you!`
    : "Payment not confirmed yet. We will activate it the moment Paystack confirms.";
  res.json({ success: true, message, data });
});

export const mockPay = asyncHandler(async (req, res) => {
  const data = await billingService.mockPay(req.user.id, req.body.reference);
  res.json({ success: true, message: "Payment approved (mock mode).", data });
});

/** Paystack posts here; the signature is HMAC SHA512 of the raw body. */
export const webhook = asyncHandler(async (req, res) => {
  if (!signatureMatches(req.rawBody, req.get("x-paystack-signature"))) {
    res.status(400).json({ success: false, message: "Invalid signature.", code: "BAD_SIGNATURE" });
    return;
  }
  const data = await billingService.handleWebhook(req.body);
  res.json({ success: true, data });
});

export default { getPlans, getCurrent, startCheckout, verifyPayment, mockPay, webhook };
