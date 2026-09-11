import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { plans, transactions, users } from "../db/schema.js";
import { env } from "../config/env.js";
import { asyncHandler, ok, badRequest, notFound, formatZodError } from "../utils/http.js";
import { normalizePhone, detectNetwork } from "../utils/phone.js";
import { addDays } from "../utils/date.js";
import { toPublicUser } from "../utils/user.js";
import * as payments from "../services/payments/index.js";
import * as paystackProvider from "../services/payments/paystack.js";
import * as mockProvider from "../services/payments/mock.js";

export const listPlans = asyncHandler(async (_req, res) => {
  const rows = await db
    .select()
    .from(plans)
    .where(eq(plans.active, true))
    .orderBy(plans.sortOrder);

  const symbol = env.momo.currency === "GHS" ? "GH¢" : `${env.momo.currency} `;

  ok(res, {
    currency: env.momo.currency,
    provider: payments.activeProvider(),
    paystackPublicKey: env.momo.paystack.publicKey || null,
    plans: rows.map((plan) => ({
      ...plan,
      priceLabel: `${symbol}${(plan.pricePesewas / 100).toFixed(2)}`,
      priceMajor: plan.pricePesewas / 100,
    })),
  });
});

const initiateSchema = z.object({
  planCode: z.string().min(1),
  phone: z.string().min(6, "Enter the MoMo number"),
  network: z.enum(["mtn", "vodafone", "airteltigo"]).optional(),
});

export const initiatePayment = asyncHandler(async (req, res) => {
  const parsed = initiateSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Check your payment details", formatZodError(parsed.error));

  const [plan] = await db.select().from(plans).where(eq(plans.code, parsed.data.planCode)).limit(1);
  if (!plan || !plan.active) throw notFound("That plan does not exist");

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) throw badRequest("Enter a valid Ghanaian MoMo number, e.g. 0241234567");

  const network = parsed.data.network || detectNetwork(phone);
  const [user] = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);

  const reference = `NT${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`.slice(0, 32);

  const [transaction] = await db
    .insert(transactions)
    .values({
      reference,
      userId: req.user.id,
      planId: plan.id,
      amountPesewas: plan.pricePesewas,
      currency: plan.currency,
      provider: payments.activeProvider(),
      network,
      phone,
      status: "PENDING",
    })
    .returning();

  const result = await payments.charge({
    reference,
    amountPesewas: plan.pricePesewas,
    currency: plan.currency,
    phone,
    network,
    email: user?.email,
    customerName: user?.fullName,
    description: `${plan.name} - natthesisa`,
  });

  if (result.status === "FAILED") {
    await db
      .update(transactions)
      .set({ status: "FAILED", failureReason: result.error || "Provider rejected the request", rawResponse: result.raw ?? null, updatedAt: new Date() })
      .where(eq(transactions.id, transaction.id));
    throw badRequest(result.error || "The mobile money provider rejected the request");
  }

  const [updated] = await db
    .update(transactions)
    .set({
      status: result.status,
      providerRef: result.providerRef,
      instructions: result.instructions,
      rawResponse: result.raw ?? null,
      paidAt: result.status === "SUCCESS" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, transaction.id))
    .returning();

  if (result.status === "SUCCESS") await activatePlan(transaction.reference);

  ok(
    res,
    {
      reference: updated.reference,
      status: updated.status,
      instructions: updated.instructions,
      amountPesewas: updated.amountPesewas,
      currency: updated.currency,
      network,
      phone,
      provider: updated.provider,
    },
    201
  );
});

/** Poll this from the app until status is SUCCESS or FAILED. */
export const checkPayment = asyncHandler(async (req, res) => {
  const [transaction] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.reference, req.params.reference), eq(transactions.userId, req.user.id)))
    .limit(1);
  if (!transaction) throw notFound("Payment not found");

  if (transaction.status === "PENDING") {
    const result = await payments.verify({
      reference: transaction.reference,
      providerRef: transaction.providerRef,
    });

    if (result.status !== transaction.status) {
      await db
        .update(transactions)
        .set({
          status: result.status,
          providerRef: result.providerRef || transaction.providerRef,
          rawResponse: result.raw ?? undefined,
          paidAt: result.status === "SUCCESS" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, transaction.id));

      if (result.status === "SUCCESS") await activatePlan(transaction.reference);
    }
  }

  const [fresh] = await db.select().from(transactions).where(eq(transactions.id, transaction.id)).limit(1);
  const [plan] = await db.select().from(plans).where(eq(plans.id, fresh.planId)).limit(1);
  const [user] = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);

  ok(res, {
    reference: fresh.reference,
    status: fresh.status,
    instructions: fresh.instructions,
    failureReason: fresh.failureReason,
    plan: { code: plan?.code, name: plan?.name },
    user: toPublicUser(user),
  });
});

export const paymentHistory = asyncHandler(async (req, res) => {
  const rows = await db
    .select({ tx: transactions, plan: plans })
    .from(transactions)
    .innerJoin(plans, eq(plans.id, transactions.planId))
    .where(eq(transactions.userId, req.user.id))
    .orderBy(desc(transactions.createdAt))
    .limit(50);

  ok(res, {
    transactions: rows.map(({ tx, plan }) => ({
      reference: tx.reference,
      amountPesewas: tx.amountPesewas,
      currency: tx.currency,
      status: tx.status,
      provider: tx.provider,
      network: tx.network,
      phone: tx.phone,
      plan: { code: plan.code, name: plan.name, durationDays: plan.durationDays },
      createdAt: tx.createdAt,
      paidAt: tx.paidAt,
    })),
  });
});

/* -------------------------------------------------------------------------- */
/*  Webhooks - the mobile money provider calls these                          */
/* -------------------------------------------------------------------------- */

export const hubtelWebhook = asyncHandler(async (req, res) => {
  const parsed = payments.parseWebhook(req.body || {}, req.query || {});
  if (!parsed?.reference) return res.status(200).json({ received: false });

  await settle(parsed.reference, parsed.status, req.body);
  res.status(200).json({ received: true });
});

export const paystackWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-paystack-signature"];
  const raw = req.rawBody || JSON.stringify(req.body || {});

  if (!paystackProvider.verifySignature(raw, signature)) {
    return res.status(401).json({ received: false, message: "Invalid signature" });
  }

  const parsed = paystackProvider.parseWebhook(req.body || {});
  if (!parsed?.reference) return res.status(200).json({ received: false });

  await settle(parsed.reference, parsed.status, req.body);
  res.status(200).json({ received: true });
});

/** Dev-only: settle a mock transaction by hand (MOMO_PROVIDER=mock). */
export const simulatePayment = asyncHandler(async (req, res) => {
  if (env.momo.provider !== "mock") throw badRequest("Only available with MOMO_PROVIDER=mock");

  const { reference, outcome } = z
    .object({ reference: z.string().min(1), outcome: z.enum(["SUCCESS", "FAILED"]).default("SUCCESS") })
    .parse(req.body);

  mockProvider.forceStatus(reference, outcome);
  await settle(reference, outcome, { simulated: true });
  ok(res, { settled: true });
});

/* -------------------------------------------------------------------------- */
/*  Shared settlement logic                                                   */
/* -------------------------------------------------------------------------- */

export async function settle(reference, status, payload) {
  const [transaction] = await db.select().from(transactions).where(eq(transactions.reference, reference)).limit(1);
  if (!transaction) return null;
  if (transaction.status === "SUCCESS") return transaction; // idempotent

  if (status === "SUCCESS") {
    await db
      .update(transactions)
      .set({ status: "SUCCESS", paidAt: new Date(), rawResponse: payload ?? undefined, updatedAt: new Date() })
      .where(eq(transactions.id, transaction.id));
    return activatePlan(reference);
  }

  if (status === "FAILED") {
    const [updated] = await db
      .update(transactions)
      .set({ status: "FAILED", rawResponse: payload ?? undefined, updatedAt: new Date() })
      .where(eq(transactions.id, transaction.id))
      .returning();
    return updated;
  }

  return transaction;
}

/** Give the user their plan: extend premiumUntil by the plan duration. */
export async function activatePlan(reference) {
  const [transaction] = await db.select().from(transactions).where(eq(transactions.reference, reference)).limit(1);
  if (!transaction || transaction.status !== "SUCCESS") return null;

  const [user] = await db.select().from(users).where(eq(users.id, transaction.userId)).limit(1);
  const [plan] = await db.select().from(plans).where(eq(plans.id, transaction.planId)).limit(1);

  const base =
    user.premiumUntil && new Date(user.premiumUntil) > new Date() ? new Date(user.premiumUntil) : new Date();

  const [updated] = await db
    .update(users)
    .set({ premiumUntil: addDays(base, plan.durationDays), updatedAt: new Date() })
    .where(eq(users.id, transaction.userId))
    .returning();

  console.log(`💚 Payment ${reference} settled - ${user.email} is premium until ${updated.premiumUntil.toISOString()}`);
  return { transaction, user: updated };
}
