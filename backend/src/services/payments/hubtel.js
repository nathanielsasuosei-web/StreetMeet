/**
 * Hubtel (Ghana) - Receive Mobile Money
 *
 *   POST https://payproxyapi.hubtel.com/receive/initiate
 *   Auth: Basic base64(ClientID:ClientSecret)
 *
 * The customer gets a USSD prompt on the handset ("approve payment") and
 * Hubtel calls PrimaryCallbackUrl with the final status.
 *
 * Docs: https://developers.hubtel.com  |  https://businessdocs-developers.hubtel.com
 */
import { env } from "../../config/env.js";
import { hubtelChannel } from "../../utils/phone.js";

export const name = "hubtel";

const BASE = "https://payproxyapi.hubtel.com";

const authHeader = () =>
  "Basic " +
  Buffer.from(`${env.momo.hubtel.clientId}:${env.momo.hubtel.clientSecret}`).toString("base64");

export async function charge({
  reference,
  amountPesewas,
  currency = "GHS",
  phone,
  network,
  email,
  customerName,
  description,
}) {
  const body = {
    CustomerName: customerName || "natthesisa member",
    CustomerMsisdn: phone,
    CustomerEmail: email || "hello@natthesisa.app",
    // Hubtel expects the major unit (cedis), Paystack expects pesewas.
    Amount: Number((amountPesewas / 100).toFixed(2)),
    Currency: currency,
    Description: description || "natthesisa plan",
    Channel: hubtelChannel(network), // mtn-gh | vodafone-gh | airtel-gh
    ClientReference: reference.slice(0, 32), // Hubtel limit: 32 chars
    PrimaryCallbackUrl: `${env.appUrl}/api/payments/webhook/hubtel`,
  };

  const response = await fetch(`${BASE}/receive/initiate`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  const code = String(data.ResponseCode ?? data.responseCode ?? "");

  // "00" / "0000" = prompt successfully delivered to the handset
  if (code !== "00" && code !== "0000") {
    return {
      status: "FAILED",
      providerRef: null,
      instructions: null,
      error: data.ResponseMessage || data.message || "Hubtel could not send the payment prompt",
      raw: data,
    };
  }

  return {
    status: "PENDING",
    providerRef: data.TransactionId || data.Data?.TransactionId || null,
    instructions:
      "A prompt has been sent to your phone. Dial your MoMo PIN / approve the prompt to finish.",
    raw: data,
  };
}

/**
 * Polling fallback. The webhook is the source of truth; this only exists so
 * the app can show a result if the callback is delayed. If Hubtel changes the
 * URL shape, we simply keep the transaction PENDING instead of guessing.
 */
export async function verify({ reference, providerRef }) {
  if (!providerRef) return { status: "PENDING", providerRef, raw: null };
  try {
    const url = `${BASE}/transactions/${env.momo.hubtel.merchantAccountNumber}/${providerRef}/status`;
    const response = await fetch(url, { headers: { Authorization: authHeader() } });
    if (!response.ok) return { status: "PENDING", providerRef, raw: null };

    const data = await response.json();
    const rows = Array.isArray(data?.Data) ? data.Data : Array.isArray(data) ? data : [data];
    const first = rows[0] || {};
    const state = String(first.TransactionStatus || first.Status || "").toLowerCase();

    return {
      status: state === "completed" || state === "success" || state === "successful"
        ? "SUCCESS"
        : state.includes("fail") || state.includes("cancel") || state.includes("declin")
          ? "FAILED"
          : "PENDING",
      providerRef,
      raw: data,
    };
  } catch {
    return { status: "PENDING", providerRef, raw: null };
  }
}

/** Hubtel posts the final status to PrimaryCallbackUrl. */
export function parseWebhook(payload = {}, query = {}) {
  const reference = payload.ClientReference || payload.clientReference || query.ClientReference;
  if (!reference) return null;

  const state = String(payload.Status || payload.status || "").toLowerCase();
  return {
    reference,
    status: state === "completed" || state === "success" || state === "successful"
      ? "SUCCESS"
      : state.includes("fail") || state.includes("cancel") || state.includes("declin")
        ? "FAILED"
        : "PENDING",
  };
}
