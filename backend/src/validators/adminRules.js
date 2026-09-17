/**
 * Validation chains for module 4 (admin control panel).
 */
import { body, param, query } from "express-validator";

import { ROLES } from "../constants/profile.js";

const MEMBER_STATUSES = ["OK", "SUSPENDED", "BANNED", "DEACTIVATED"];
const REPORT_STATUSES = ["OPEN", "RESOLVED"];
const SUBSCRIPTION_STATUSES = ["PENDING", "ACTIVE", "EXPIRED", "CANCELLED", "FAILED"];

export const idParamRules = [
  param("id").trim().isLength({ min: 1, max: 64 }).withMessage("Missing member id."),
];

export const slugParamRules = [
  param("slug")
    .trim()
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage("Unknown interest slug."),
];

export const memberQueryRules = [
  query("q").optional({ values: "null" }).trim().isLength({ max: 120 }),
  query("status").optional({ values: "null" }).isIn(MEMBER_STATUSES).withMessage("Unknown status."),
  query("role").optional({ values: "null" }).isIn(ROLES).withMessage("Unknown role."),
  query("verified").optional({ values: "null" }).isIn(["true", "false"]).withMessage("Unknown filter."),
  query("page").optional({ values: "null" }).isInt({ min: 1 }).withMessage("Page must be 1 or more."),
  query("limit").optional({ values: "null" }).isInt({ min: 1, max: 100 }).withMessage("Limit is 1-100."),
];

export const moderationNoteRules = [
  body("note")
    .optional({ values: "null" })
    .trim()
    .isLength({ max: 280 })
    .withMessage("Notes are limited to 280 characters."),
];

export const verifiedRules = [
  body("verified").isBoolean().withMessage("verified must be true or false."),
];

export const featuredRules = [
  body("featured").isBoolean().withMessage("featured must be true or false."),
];

export const roleRules = [body("role").isIn(ROLES).withMessage(`Role must be one of: ${ROLES.join(", ")}.`)];

export const reportQueryRules = [
  query("status").optional({ values: "null" }).isIn(REPORT_STATUSES).withMessage("Unknown status."),
];

export const resolveReportRules = [
  body("resolution")
    .trim()
    .toUpperCase()
    .isIn(["DISMISSED", "WARNED", "SUSPENDED", "BANNED"])
    .withMessage("Resolution must be DISMISSED, WARNED, SUSPENDED or BANNED."),
  body("note")
    .optional({ values: "null" })
    .trim()
    .isLength({ max: 280 })
    .withMessage("Notes are limited to 280 characters."),
];

export const ledgerQueryRules = [
  query("status").optional({ values: "null" }).isIn(SUBSCRIPTION_STATUSES).withMessage("Unknown status."),
  query("plan").optional({ values: "null" }).trim().isLength({ max: 32 }),
  query("q").optional({ values: "null" }).trim().isLength({ max: 120 }),
  query("limit").optional({ values: "null" }).isInt({ min: 1, max: 500 }).withMessage("Limit is 1-500."),
];

export const interestCreateRules = [
  body("label").trim().isLength({ min: 2, max: 40 }).withMessage("Label must be 2-40 characters."),
  body("emoji").optional({ values: "null" }).trim().isLength({ max: 8 }).withMessage("Emoji is too long."),
  body("category").optional({ values: "null" }).trim().isLength({ max: 40 }).withMessage("Category is too long."),
  body("slug")
    .optional({ values: "null" })
    .trim()
    .toLowerCase()
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage("Slug must look like street-art."),
];

export const interestUpdateRules = [
  body("label").optional({ values: "null" }).trim().isLength({ min: 2, max: 40 }).withMessage("Label must be 2-40 characters."),
  body("emoji").optional({ values: "null" }).trim().isLength({ max: 8 }).withMessage("Emoji is too long."),
  body("category").optional({ values: "null" }).trim().isLength({ max: 40 }).withMessage("Category is too long."),
  body("active").optional({ values: "null" }).isBoolean().withMessage("active must be true or false."),
  body("sortOrder").optional({ values: "null" }).isInt({ min: 0, max: 9999 }).withMessage("sortOrder must be 0-9999."),
];

export const announcementRules = [
  body("title").trim().isLength({ min: 3, max: 120 }).withMessage("Title must be 3-120 characters."),
  body("body").trim().isLength({ min: 3, max: 1000 }).withMessage("Body must be 3-1000 characters."),
];
