/**
 * Checkout, verification, webhooks and expiry - the subscription lifecycle.
 *
 * Flow (both channels, card and Ghana Mobile Money):
 *   1. POST /api/billing/checkout   -> PENDING row + Paystack initialize
 *   2. the customer pays on Paystack (approves the MoMo prompt / 3DS page;
 *      mock mode simulates that with POST /api/billing/mock-pay)
 *   3. Paystack's `charge.success` webhook OR the client's verify call hits
 *      the API -> server-side verify -> the row goes ACTIVE with a real
 *      started_at / expires_at window taken from the plan period
 *   4. once expires_at passes, reads treat the member as FREE immediately
 *      and the sweeper flips the row to EXPIRED for honesty.
 */
import { PAYMENT_CHANNELS, planByValue } from "../constants/billing.js";
import * as subscriptionRepository from "../repositories/subscriptionRepository.js";
import * as userRepository from "../repositories/userRepository.js";
import { ApiError } from "../utils/apiError.js";
import { initializeTransaction, paystackMode, verifyTransaction } from "./paystack.js";

const PLACEHOLDER_EXPIRY = "9999-12-31T23:59:59.000Z";

export { paystackMode };

export async function checkout(userId, { plan, channel, phone, provider }) {
  const catalogue = planByValue(plan);
  if (!catalogue || catalogue.priceGhs <= 0) {
    throw ApiError.badRequest("Choose a paid plan (PREMIUM or VIP).");
  }
  if (!PAYMENT_CHANNELS.includes(channel)) {
    throw ApiError.badRequest(`Channel must be one of: ${PAYMENT_CHANNELS.join(", ")}.`);
  }
  if (channel === "mobile_money" && !phone) {
    throw ApiError.badRequest("Mobile money needs the wallet phone number.", {
      fields: { phone: "Enter the mobile money wallet number." },
    });
  }

  const user = await userRepository.findById(userId);
  if (!user) throw ApiError.notFound("Account not found.");

  const amountPesewas = Math.round(catalogue.priceGhs * 100);
  const pending = await subscriptionRepository.createPending({
    userId,
    plan: catalogue.value,
    amountGhs: catalogue.priceGhs,
    amountPesewas,
    reference: `STREET-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    channel,
  });

  const initialized = await initializeTransaction({
    email: user.email,
    amountPesewas,
    channel,
    phone,
    metadata: {
      userId,
      subscriptionId: pending.id,
      plan: catalogue.value,
      ...(provider ? { provider } : {}),
    },
    reference: pending.reference,
  });

  return {
    subscriptionId: pending.id,
    reference: initialized.reference,
    checkoutUrl: initialized.checkoutUrl,
    mode: paystackMode,
    plan: catalogue.value,
    amountGhs: catalogue.priceGhs,
    channel,
  };
}

/** Verify with the provider and, on success, start the paid window. */
async function activateIfPaid(subscription, { mockPaid } = {}) {
  if (!subscription) throw ApiError.notFound("Unknown payment reference.");
  if (subscription.status === "ACTIVE") return subscription;

  const result = await verifyTransaction(subscription.reference, {
    mockPaid: mockPaid ?? Boolean(subscription.payload?.mockApproved),
  });
  if (result.status !== "success") return subscription;

  const catalogue = planByValue(subscription.plan);
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + catalogue.periodDays * 24 * 60 * 60 * 1000);
  return subscriptionRepository.activate(subscription.id, {
    startedAt: startedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    channel: result.channel && result.channel !== "mock" ? result.channel : subscription.channel,
    payload: { ...subscription.payload, verifiedAt: new Date().toISOString(), provider: result },
  });
}

/** Client-side confirmation (also the return-from-checkout path). */
export async function verify(userId, reference) {
  const subscription = await subscriptionRepository.findByReference(reference);
  if (!subscription || subscription.userId !== userId) {
    throw ApiError.notFound("Unknown payment reference.");
  }
  return summarise(await activateIfPaid(subscription));
}

/** Mock mode only: play the customer approving the MoMo prompt / 3DS page. */
export async function mockPay(userId, reference) {
  if (paystackMode !== "mock") throw ApiError.notFound("Mock payments are disabled.");
  const subscription = await subscriptionRepository.findByReference(reference);
  if (!subscription || subscription.userId !== userId) {
    throw ApiError.notFound("Unknown payment reference.");
  }
  if (subscription.status !== "PENDING") {
    throw ApiError.conflict("That payment is not awaiting approval.");
  }
  await subscriptionRepository.storeMockApproval(subscription.id);
  return { approved: true, reference };
}

/** Paystack webhook: `charge.success` activates the subscription. */
export async function handleWebhook(event) {
  if (event?.event !== "charge.success" || !event.data?.reference) {
    return { received: true, ignored: true };
  }
  const subscription = await subscriptionRepository.findByReference(event.data.reference);
  if (!subscription) return { received: true, unknownReference: true };

  const activated = await activateIfPaid(subscription, {
    // the webhook itself is provider confirmation; in mock mode it also plays
    // the role of the approval step
    mockPaid: paystackMode === "mock" ? true : undefined,
  });
  return { received: true, activated: activated.status === "ACTIVE" };
}

export async function current(userId) {
  const [live, history] = await Promise.all([
    subscriptionRepository.findCurrent(userId),
    subscriptionRepository.listFor(userId),
  ]);
  return { subscription: summarise(live), history: history.map(summarise) };
}

/** Hourly (and boot) sweeper - keeps EXPIRED rows honest. */
export async function sweepExpired() {
  return subscriptionRepository.expireStale();
}

function summarise(subscription) {
  if (!subscription) return null;
  const now = new Date().toISOString();
  const pending = subscription.expiresAt === PLACEHOLDER_EXPIRY;
  return {
    id: subscription.id,
    plan: subscription.plan,
    status: subscription.status,
    channel: subscription.channel,
    amountGhs: subscription.amountGhs,
    reference: subscription.reference,
    startedAt: subscription.startedAt,
    expiresAt: pending ? null : subscription.expiresAt,
    active: subscription.status === "ACTIVE" && !pending && subscription.expiresAt > now,
    createdAt: subscription.createdAt,
  };
}

export default { checkout, verify, mockPay, handleWebhook, current, sweepExpired };
