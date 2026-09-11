import { count, desc, eq, gt, ilike, or, sql, sum } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { callSessions, likes, matches, messages, plans, reports, statuses, transactions, users } from "../db/schema.js";
import { asyncHandler, ok, badRequest, notFound, formatZodError } from "../utils/http.js";
import { toPublicUser } from "../utils/user.js";

export const getStats = asyncHandler(async (_req, res) => {
  const one = async (table) => (await db.select({ value: count() }).from(table))[0]?.value ?? 0;

  const [usersCount, matchesCount, messagesCount, likesCount, callsCount] = await Promise.all([
    one(users),
    one(matches),
    one(messages),
    one(likes),
    one(callSessions),
  ]);

  const [liveStatuses] = await db
    .select({ value: count() })
    .from(statuses)
    .where(gt(statuses.expiresAt, new Date()));

  const [premiumUsers] = await db.select({ value: count() }).from(users).where(gt(users.premiumUntil, new Date()));

  const [paid] = await db
    .select({ value: count(), total: sum(transactions.amountPesewas) })
    .from(transactions)
    .where(eq(transactions.status, "SUCCESS"));

  ok(res, {
    stats: {
      users: usersCount,
      matches: matchesCount,
      messages: messagesCount,
      likes: likesCount,
      calls: callsCount,
      liveStatuses: liveStatuses?.value ?? 0,
      premiumUsers: premiumUsers?.value ?? 0,
      paidTransactions: paid?.value ?? 0,
      revenuePesewas: Number(paid?.total ?? 0),
      revenueMajor: Number(paid?.total ?? 0) / 100,
    },
  });
});

export const listUsers = asyncHandler(async (req, res) => {
  const search = String(req.query.search || "").trim();

  const rows = search
    ? await db
        .select()
        .from(users)
        .where(or(ilike(users.fullName, `%${search}%`), ilike(users.email, `%${search}%`)))
        .orderBy(desc(users.createdAt))
        .limit(100)
    : await db.select().from(users).orderBy(desc(users.createdAt)).limit(100);

  ok(res, { users: rows.map((u) => toPublicUser(u)) });
});

export const setUserStatus = asyncHandler(async (req, res) => {
  const parsed = z
    .object({
      banned: z.coerce.boolean().optional(),
      verified: z.coerce.boolean().optional(),
      role: z.enum(["USER", "MODERATOR", "ADMIN"]).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) throw badRequest("Invalid update", formatZodError(parsed.error));

  const [user] = await db
    .update(users)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(users.id, req.params.id))
    .returning();
  if (!user) throw notFound("User not found");

  ok(res, { user: toPublicUser(user) });
});

export const listReports = asyncHandler(async (req, res) => {
  const status = String(req.query.status || "OPEN");

  const rows = await db.query.reports.findMany({
    where: status === "ALL" ? undefined : eq(reports.status, status),
    with: { reporter: true, reported: true },
    orderBy: [desc(reports.createdAt)],
    limit: 100,
  });

  ok(res, {
    reports: rows.map((r) => ({
      id: r.id,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.createdAt,
      reporter: toPublicUser(r.reporter, { preview: true }),
      reported: toPublicUser(r.reported, { preview: true }),
    })),
  });
});

export const resolveReport = asyncHandler(async (req, res) => {
  const parsed = z.object({ action: z.enum(["DISMISS", "WARN", "BAN"]).default("DISMISS") }).safeParse(req.body || {});
  if (!parsed.success) throw badRequest("Invalid action");

  const [report] = await db.select().from(reports).where(eq(reports.id, req.params.id)).limit(1);
  if (!report) throw notFound("Report not found");

  await db.update(reports).set({ status: parsed.data.action }).where(eq(reports.id, report.id));
  if (parsed.data.action === "BAN") {
    await db.update(users).set({ banned: true, updatedAt: new Date() }).where(eq(users.id, report.reportedId));
  }

  ok(res, { resolved: parsed.data.action });
});

const planSchema = z.object({
  code: z.string().trim().min(2).max(32),
  name: z.string().trim().min(2).max(40),
  tagline: z.string().trim().max(120).optional(),
  pricePesewas: z.coerce.number().int().min(20).max(100000),
  currency: z.string().default("GHS"),
  durationDays: z.coerce.number().int().min(1),
  features: z.array(z.string()).default([]),
  popular: z.coerce.boolean().default(false),
  active: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

export const createPlan = asyncHandler(async (req, res) => {
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Check the plan", formatZodError(parsed.error));

  const [plan] = await db.insert(plans).values(parsed.data).returning();
  ok(res, { plan }, 201);
});

export const updatePlan = asyncHandler(async (req, res) => {
  const parsed = planSchema.partial().safeParse(req.body);
  if (!parsed.success) throw badRequest("Check the plan", formatZodError(parsed.error));

  const [plan] = await db.update(plans).set(parsed.data).where(eq(plans.id, req.params.id)).returning();
  if (!plan) throw notFound("Plan not found");

  ok(res, { plan });
});
