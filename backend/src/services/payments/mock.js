/**
 * Mock mobile money provider - used when MOMO_PROVIDER=mock.
 * No keys, no real money: it behaves like a real provider so the whole
 * checkout + webhook + activation flow can be tested locally.
 *
 * In "instant" mode a transaction turns SUCCESS as soon as it is verified.
 */
import crypto from "node:crypto";

const store = new Map(); // reference -> { status, providerRef, amountPesewas, phone, network }

export const name = "mock";

export async function charge({ reference, amountPesewas, phone, network }) {
  const providerRef = `MOCK-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
  store.set(reference, { status: "PENDING", providerRef, amountPesewas, phone, network, age: Date.now() });
  return {
    status: "PENDING",
    providerRef,
    instructions: `Mock prompt sent to ${phone}. Approve it in the natthesisa sandbox (dev only).`,
    raw: { reference, providerRef },
  };
}

export async function verify({ reference }) {
  const record = store.get(reference);
  if (!record) return { status: "PENDING", providerRef: null, raw: null };

  // Auto-approve 12 seconds after initiation so the UI's polling shows the
  // real progression PENDING -> SUCCESS, exactly like a live MoMo prompt.
  if (record.status === "PENDING" && Date.now() - record.age > 12_000) {
    record.status = "SUCCESS";
  }
  return { status: record.status, providerRef: record.providerRef, raw: record };
}

/** Dev helper: force a transaction to succeed or fail on demand. */
export function forceStatus(reference, status) {
  const record = store.get(reference);
  if (!record) return false;
  record.status = status === "SUCCESS" ? "SUCCESS" : "FAILED";
  return true;
}

export function parseWebhook(payload) {
  if (!payload?.reference) return null;
  return {
    reference: payload.reference,
    status: payload.status === "success" ? "SUCCESS" : payload.status === "failed" ? "FAILED" : "PENDING",
  };
}
