/**
 * natthesisa - database schema (PostgreSQL via Drizzle ORM)
 *
 * Why Drizzle: it is pure JavaScript. There is no engine binary to download,
 * so `npm install` works on any machine (and inside CI) without extra steps.
 *
 * Tables are snake_case in Postgres; the JS names are camelCase.
 * Docs: docs/STEP-BY-STEP.md  ->  apply with:  npm run db:generate && npm run db:migrate
 */
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/** Short, URL-safe id (same idea as a cuid, no dependency needed). */
export const newId = () => randomBytes(12).toString("base64url");

/* --------------------------------- enums ---------------------------------- */

export const roleEnum = pgEnum("role", ["USER", "MODERATOR", "ADMIN"]);
export const genderEnum = pgEnum("gender", ["MALE", "FEMALE", "OTHER"]);
export const mediaTypeEnum = pgEnum("media_type", ["TEXT", "IMAGE", "VIDEO", "AUDIO"]);
export const callTypeEnum = pgEnum("call_type", ["AUDIO", "VIDEO"]);
export const callStatusEnum = pgEnum("call_status", ["RINGING", "ONGOING", "ENDED", "MISSED", "REJECTED", "FAILED"]);
export const txStatusEnum = pgEnum("tx_status", ["PENDING", "SUCCESS", "FAILED"]);

const emptyTextArray = sql`'{}'::text[]`;
const now = () => new Date();

/* --------------------------------- tables --------------------------------- */

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    email: text("email").notNull().unique(),
    phone: text("phone").unique(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    gender: genderEnum("gender").notNull().default("OTHER"),
    birthDate: timestamp("birth_date", { withTimezone: true }),
    bio: text("bio"),
    city: text("city"),
    country: text("country").notNull().default("Ghana"),
    avatarUrl: text("avatar_url"),
    photos: text("photos").array().notNull().default(emptyTextArray),
    interests: text("interests").array().notNull().default(emptyTextArray),

    // discovery preferences
    lookingFor: text("looking_for").array().notNull().default(emptyTextArray),
    minAge: integer("min_age").notNull().default(18),
    maxAge: integer("max_age").notNull().default(60),
    maxDistanceKm: integer("max_distance_km").notNull().default(150),
    latitude: real("latitude"),
    longitude: real("longitude"),
    showMe: boolean("show_me").notNull().default(true),

    // account state
    role: roleEnum("role").notNull().default("USER"),
    verified: boolean("verified").notNull().default(false),
    onboarded: boolean("onboarded").notNull().default(false),
    premiumUntil: timestamp("premium_until", { withTimezone: true }),
    banned: boolean("banned").notNull().default(false),

    // daily free-like counter
    likesToday: integer("likes_today").notNull().default(0),
    likesResetAt: timestamp("likes_reset_at", { withTimezone: true }),

    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("users_discovery_idx").on(table.showMe, table.gender, table.lastActiveAt),
    index("users_city_idx").on(table.city),
  ]
);

export const likes = pgTable(
  "likes",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    likerId: text("liker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    likedId: text("liked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    superLike: boolean("super_like").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("likes_unique_idx").on(table.likerId, table.likedId),
    index("likes_liked_idx").on(table.likedId),
  ]
);

export const passes = pgTable(
  "passes",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    passerId: text("passer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    passedId: text("passed_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("passes_unique_idx").on(table.passerId, table.passedId)]
);

export const matches = pgTable(
  "matches",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    userAId: text("user_a_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userBId: text("user_b_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("matches_unique_idx").on(table.userAId, table.userBId)]
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body"),
    mediaUrl: text("media_url"),
    mediaType: mediaTypeEnum("media_type").notNull().default("TEXT"),
    seenAt: timestamp("seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("messages_match_idx").on(table.matchId, table.createdAt)]
);

/** WhatsApp-style status: disappears 24 hours after posting. */
export const statuses = pgTable(
  "statuses",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    caption: text("caption"),
    mediaUrl: text("media_url"),
    mediaType: mediaTypeEnum("media_type").notNull().default("TEXT"),
    background: text("background").notNull().default("#7c3aed"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("statuses_user_idx").on(table.userId, table.expiresAt)]
);

export const statusViews = pgTable(
  "status_views",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    statusId: text("status_id")
      .notNull()
      .references(() => statuses.id, { onDelete: "cascade" }),
    viewerId: text("viewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("status_views_unique_idx").on(table.statusId, table.viewerId)]
);

/** Prices are stored in PESAWAS (1 GHS = 100 pesewas). Seeded: 20p / 50p / 100p. */
export const plans = pgTable("plans", {
  id: text("id").primaryKey().$defaultFn(newId),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  pricePesewas: integer("price_pesewas").notNull(),
  currency: text("currency").notNull().default("GHS"),
  durationDays: integer("duration_days").notNull(),
  features: text("features").array().notNull().default(emptyTextArray),
  popular: boolean("popular").notNull().default(false),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    reference: text("reference").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id),
    amountPesewas: integer("amount_pesewas").notNull(),
    currency: text("currency").notNull().default("GHS"),
    provider: text("provider").notNull().default("mock"),
    network: text("network"),
    phone: text("phone"),
    status: txStatusEnum("status").notNull().default("PENDING"),
    providerRef: text("provider_ref"),
    instructions: text("instructions"),
    failureReason: text("failure_reason"),
    rawResponse: jsonb("raw_response"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("transactions_user_idx").on(table.userId, table.status)]
);

export const callSessions = pgTable(
  "call_sessions",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    callerId: text("caller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    calleeId: text("callee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: callTypeEnum("type").notNull().default("VIDEO"),
    status: callStatusEnum("status").notNull().default("RINGING"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSec: integer("duration_sec").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("call_sessions_callee_idx").on(table.calleeId, table.createdAt)]
);

export const reports = pgTable(
  "reports",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reportedId: text("reported_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    details: text("details"),
    status: text("status").notNull().default("OPEN"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("reports_unique_idx").on(table.reporterId, table.reportedId)]
);

export const blocks = pgTable(
  "blocks",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    blockerId: text("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("blocks_unique_idx").on(table.blockerId, table.blockedId)]
);

export const deviceTokens = pgTable(
  "device_tokens",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: text("platform").notNull().default("android"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("device_tokens_unique_idx").on(table.userId, table.token)]
);

/* ------------------------------- relations -------------------------------- */
/*  These power db.query.users.findMany({ with: { ... } })                    */

export const usersRelations = relations(users, ({ many }) => ({
  likesSent: many(likes, { relationName: "likes_sent" }),
  likesReceived: many(likes, { relationName: "likes_received" }),
  passesMade: many(passes, { relationName: "passes_made" }),
  matchesA: many(matches, { relationName: "matches_a" }),
  matchesB: many(matches, { relationName: "matches_b" }),
  messages: many(messages),
  statuses: many(statuses),
  transactions: many(transactions),
  callsMade: many(callSessions, { relationName: "calls_made" }),
  callsReceived: many(callSessions, { relationName: "calls_received" }),
}));

export const likesRelations = relations(likes, ({ one }) => ({
  liker: one(users, { fields: [likes.likerId], references: [users.id], relationName: "likes_sent" }),
  liked: one(users, { fields: [likes.likedId], references: [users.id], relationName: "likes_received" }),
}));

export const passesRelations = relations(passes, ({ one }) => ({
  passer: one(users, { fields: [passes.passerId], references: [users.id], relationName: "passes_made" }),
  passed: one(users, { fields: [passes.passedId], references: [users.id], relationName: "passes_received" }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  userA: one(users, { fields: [matches.userAId], references: [users.id], relationName: "matches_a" }),
  userB: one(users, { fields: [matches.userBId], references: [users.id], relationName: "matches_b" }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  match: one(matches, { fields: [messages.matchId], references: [matches.id] }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
}));

export const statusesRelations = relations(statuses, ({ one, many }) => ({
  user: one(users, { fields: [statuses.userId], references: [users.id] }),
  views: many(statusViews),
}));

export const statusViewsRelations = relations(statusViews, ({ one }) => ({
  status: one(statuses, { fields: [statusViews.statusId], references: [statuses.id] }),
  viewer: one(users, { fields: [statusViews.viewerId], references: [users.id] }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  plan: one(plans, { fields: [transactions.planId], references: [plans.id] }),
}));

export const callSessionsRelations = relations(callSessions, ({ one }) => ({
  match: one(matches, { fields: [callSessions.matchId], references: [matches.id] }),
  caller: one(users, { fields: [callSessions.callerId], references: [users.id], relationName: "calls_made" }),
  callee: one(users, { fields: [callSessions.calleeId], references: [users.id], relationName: "calls_received" }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, { fields: [reports.reporterId], references: [users.id], relationName: "reports_filed" }),
  reported: one(users, { fields: [reports.reportedId], references: [users.id], relationName: "reports_against" }),
}));

export const blocksRelations = relations(blocks, ({ one }) => ({
  blocker: one(users, { fields: [blocks.blockerId], references: [users.id], relationName: "blocks_made" }),
  blocked: one(users, { fields: [blocks.blockedId], references: [users.id], relationName: "blocks_against" }),
}));
