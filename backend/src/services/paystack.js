/**
 * Paystack client - Ghana Mobile Money and cards.
 *
 * Two modes, chosen by configuration (src/config/env.js):
 *   live  real calls to api.paystack.co with PAYSTACK_SECRET_KEY
 *   mock  deterministic offline stand-in used in dev, demos and the smoke
 *         test: `initialize` mints a reference, `mockPay` plays the role of
 *         the customer approving the MoMo prompt, and `verify` only succeeds
 *         after that approval - so the whole activate-on-success path runs
 *         without network access or secrets.
 *
 * Amounts go to Paystack in pesewas (GHS x 100).
 */
import crypto from "node:crypto";

import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";

export const paystackMode = env.paystack.mode === "live" && env.paystack.secret ? "live" : "mock";
export const WEBHOOK_SECRET = env.paystack.secret || "streetmeet-mock-paystack-secret";

async function paystackRequest(path, { method = "GET", body } = {}) {
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${env.paystack.secret}`,
      "Content-Type": "application/json",
    },
  };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(`${env.paystack.baseUrl}${path}`, options);
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.data) {
    throw new ApiError(502, payload?.message || "Paystack rejected the request.", {
      code: "PAYMENT_PROVIDER_ERROR",
    });
  }
  return payload.data;
}

/**
 * Start a charge. Returns `{ reference, checkoutUrl }`.
 * `paid` is the mock-mode approval flag stored by `mockPay`.
 */
export async function initializeTransaction({
  email,
  amountPesewas,
  channel,
  phone,
  metadata,
  reference,
}) {
  if (paystackMode === "mock") {
    const mockReference = reference || `MOCK-${crypto.randomBytes(8).toString("hex")}`;
    return {
      reference: mockReference,
      checkoutUrl: `${env.clientUrl}/premium?pay=mock&reference=${mockReference}`,
      channel,
    };
  }

  const data = await paystackRequest("/transaction/initialize", {
    method: "POST",
    body: {
      email,
      amount: amountPesewas,
      currency: env.paystack.currency,
      channels: [channel],
      reference,
      callback_url: `${env.clientUrl}/premium`,
      metadata: {
        ...metadata,
        ...(channel === "mobile_money" && phone ? { mobile_money: { phone, provider: metadata?.provider || "mtn" } } : {}),
      },
    },
  });
  return { reference: data.reference, checkoutUrl: data.authorization_url, channel };
}

/**
 * Confirm a charge. Mock mode succeeds only after `mockPay` approved the
 * reference, mirroring "the customer entered their OTP / approved the prompt".
 */
export async function verifyTransaction(reference, { mockPaid = false } = {}) {
  if (paystackMode === "mock") {
    if (!mockPaid) {
      return { status: "pending", reference, channel: null, paidAt: null, amount: null };
    }
    return {
      status: "success",
      reference,
      channel: "mock",
      paidAt: new Date().toISOString(),
      amount: null,
    };
  }

  const data = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
  return {
    status: data.status,
    reference: data.reference,
    channel: data.channel ?? null,
    paidAt: data.paid_at ?? null,
    amount: data.amount ?? null,
  };
}

/** Verify the `x-paystack-signature` header (HMAC SHA512 of the raw body). */
export function signatureMatches(rawBody, signature) {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha512", WEBHOOK_SECRET)
    .update(rawBody || "", "utf8")
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
  } catch {
    return false;
  }
}

export default { initializeTransaction, verifyTransaction, signatureMatches, paystackMode };
