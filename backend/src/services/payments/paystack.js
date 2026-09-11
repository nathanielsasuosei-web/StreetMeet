/**
 * Paystack (Ghana) - Mobile Money via the Charge API
 *
 *   POST https://api.paystack.co/charge      (amount is in PESAWAS)
 *   GET  https://api.paystack.co/transaction/verify/:reference
 *   Webhook: x-paystack-signature = HMAC-SHA512(raw body, secret key)
 *
 * Provider codes: mtn | vod | atl
 * Docs: https://paystack.com/docs/payments/payment-channels/
 */
import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { paystackProvider } from "../../utils/phone.js";

export const name = "paystack";

const BASE = "https://api.paystack.co";

const headers = () => ({
  Authorization: `Bearer ${env.momo.paystack.secretKey}`,
  "Content-Type": "application/json",
});

export async function charge({ reference, amountPesewas, currency = "GHS", phone, network, email }) {
  const response = await fetch(`${BASE}/charge`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      amount: amountPesewas, // pesewas
      email: email || "hello@natthesisa.app",
      currency,
      reference,
      mobile_money: { phone, provider: paystackProvider(network) }, // mtn | vod | atl
    }),
  });

  const data = await response.json().catch(() => ({}));
  const chargeStatus = data?.data?.status || data?.status;

  if (!data.status) {
    return {
      status: "FAILED",
      providerRef: null,
      instructions: null,
      error: data.message || "Paystack could not start the charge",
      raw: data,
    };
  }

  // pay_offline = customer must approve a prompt / dial a USSD code
  return {
    status: chargeStatus === "success" ? "SUCCESS" : "PENDING",
    providerRef: data.data?.reference || reference,
    instructions:
      data.data?.display_text ||
      "Approve the prompt sent to your phone to complete the payment.",
    raw: data,
  };
}

export async function verify({ reference }) {
  try {
    const response = await fetch(`${BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: headers(),
    });
    const data = await response.json().catch(() => ({}));
    const state = String(data?.data?.status || "").toLowerCase();
    return {
      status: state === "success" ? "SUCCESS" : state === "failed" || state === "abandoned" ? "FAILED" : "PENDING",
      providerRef: data?.data?.reference || reference,
      raw: data,
    };
  } catch {
    return { status: "PENDING", providerRef: reference, raw: null };
  }
}

/** Verify the webhook signature before trusting the payload. */
export function verifySignature(rawBody, signature) {
  if (!env.momo.paystack.secretKey || !signature) return false;
  const hash = crypto.createHmac("sha512", env.momo.paystack.secretKey).update(rawBody).digest("hex");
  return hash === signature;
}

export function parseWebhook(payload = {}) {
  const reference = payload?.data?.reference;
  if (!reference) return null;
  return {
    reference,
    status: payload.event === "charge.success" ? "SUCCESS" : payload.event === "charge.failed" ? "FAILED" : "PENDING",
  };
}
