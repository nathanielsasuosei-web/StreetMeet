/**
 * Validation chains for module 2 (dating): swipes, messages, reports and the
 * discovery search query.
 */
import { body, param, query } from "express-validator";

import {
  AGE_LIMITS,
  DECK_LIMIT_MAX,
  GENDER_VALUES,
  INTEREST_SLUGS,
  MESSAGE_MAX_LENGTH,
  NOTIFICATION_LIMIT_MAX,
  RELATIONSHIP_GOAL_VALUES,
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  SEARCH_LIMIT_MAX,
} from "../constants/profile.js";

const csv = (value) =>
  String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

/* ── swipes ────────────────────────────────────────────────────────────── */

export const swipeRules = [
  body("targetId").trim().isLength({ min: 1, max: 64 }).withMessage("Missing profile id."),
  body("decision").isIn(["LIKE", "PASS"]).withMessage("Decision must be LIKE or PASS."),
];

/* ── messages ──────────────────────────────────────────────────────────── */

export const matchIdRule = param("matchId").trim().isLength({ min: 1, max: 64 });

export const messageRules = [
  body("content")
    .isString()
    .trim()
    .isLength({ min: 1, max: MESSAGE_MAX_LENGTH })
    .withMessage(`Messages must be 1-${MESSAGE_MAX_LENGTH} characters.`),
];

export const threadQueryRules = [
  query("before").optional({ values: "null" }).isISO8601().withMessage("Invalid cursor."),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
];

/* ── discovery ─────────────────────────────────────────────────────────── */

export const deckQueryRules = [
  query("limit").optional().isInt({ min: 1, max: DECK_LIMIT_MAX }).toInt(),
];

export const searchQueryRules = [
  query("genders")
    .optional({ values: "null" })
    .custom((value) => csv(value).every((gender) => GENDER_VALUES.includes(gender)))
    .withMessage(`Unknown gender filter. Use: ${GENDER_VALUES.join(", ")}.`),
  query("minAge")
    .optional({ values: "null" })
    .isInt({ min: AGE_LIMITS.min, max: AGE_LIMITS.max })
    .toInt(),
  query("maxAge")
    .optional({ values: "null" })
    .isInt({ min: AGE_LIMITS.min, max: AGE_LIMITS.max })
    .toInt(),
  query("interests")
    .optional({ values: "null" })
    .custom((value) => csv(value).every((slug) => INTEREST_SLUGS.includes(slug)))
    .withMessage("Unknown interest filter."),
  query("goal")
    .optional({ values: "null" })
    .isIn(RELATIONSHIP_GOAL_VALUES)
    .withMessage("Unknown relationship goal filter."),
  query("location").optional({ values: "null" }).trim().isLength({ max: 80 }),
  query("q").optional({ values: "null" }).trim().isLength({ max: 80 }),
  query("limit").optional().isInt({ min: 1, max: SEARCH_LIMIT_MAX }).toInt(),
  query("offset").optional().isInt({ min: 0 }).toInt(),
];

/* ── moderation ────────────────────────────────────────────────────────── */

export const userIdRule = param("userId").trim().isLength({ min: 1, max: 64 });

export const reportRules = [
  body("reason").isIn(REPORT_REASONS).withMessage("Pick a reason for the report."),
  body("details")
    .optional({ values: "null" })
    .trim()
    .isLength({ max: REPORT_DETAILS_MAX })
    .withMessage(`Details must be under ${REPORT_DETAILS_MAX} characters.`),
];

/* ── notifications ─────────────────────────────────────────────────────── */

export const notificationQueryRules = [
  query("limit").optional().isInt({ min: 1, max: NOTIFICATION_LIMIT_MAX }).toInt(),
];

export const notificationIdRule = param("id").trim().isLength({ min: 1, max: 64 });
