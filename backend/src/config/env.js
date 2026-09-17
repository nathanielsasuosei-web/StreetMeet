/**
 * Central, validated environment configuration.
 *
 * Everything the app reads from `process.env` goes through here so a missing or
 * malformed value fails fast at boot instead of deep inside a request.
 */
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "dotenv/config";

const here = path.dirname(fileURLToPath(import.meta.url));

/** backend/ */
export const ROOT_DIR = path.resolve(here, "..", "..");
/** backend/src */
export const SRC_DIR = path.resolve(here, "..");

const NODE_ENV = (process.env.NODE_ENV || "development").toLowerCase();
const isProd = NODE_ENV === "production";

function int(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function list(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/* ── database ─────────────────────────────────────────────────────────── */
const provider = (process.env.DATABASE_PROVIDER || "sqlite").toLowerCase();
if (provider !== "sqlite" && provider !== "postgresql") {
  throw new Error(
    `DATABASE_PROVIDER must be "sqlite" or "postgresql" (got "${provider}")`
  );
}

const databaseUrl =
  process.env.DATABASE_URL ||
  (provider === "sqlite" ? "file:./dev.db" : undefined);

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

/* ── secrets ──────────────────────────────────────────────────────────── */
let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (isProd) {
    throw new Error("JWT_SECRET is required in production");
  }
  jwtSecret = crypto.randomBytes(32).toString("hex");
  console.warn(
    "⚠️  JWT_SECRET is not set - generated an ephemeral one. Every restart will log users out."
  );
} else if (isProd && jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production");
}

/* ── uploads ──────────────────────────────────────────────────────────── */
const uploadMaxMb = Math.min(Math.max(int(process.env.UPLOAD_MAX_MB, 5), 1), 25);

export const env = {
  nodeEnv: NODE_ENV,
  isProd,
  isDev: !isProd,
  port: int(process.env.PORT, 5000),
  host: process.env.HOST || "0.0.0.0",

  database: {
    provider,
    url: databaseUrl,
    ssl: bool(process.env.DATABASE_SSL, false),
    /** SQLite resolves relative `file:` paths against backend/ */
    file: databaseUrl.startsWith("file:")
      ? path.resolve(ROOT_DIR, databaseUrl.slice("file:".length))
      : null,
    poolMax: int(process.env.DATABASE_POOL_MAX, 10),
  },

  auth: {
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
    bcryptRounds: Math.min(Math.max(int(process.env.BCRYPT_ROUNDS, 12), 8), 15),
  },

  clientUrl: (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, ""),
  corsOrigins: list(process.env.CORS_ORIGINS || process.env.CLIENT_URL),

  uploads: {
    dir: path.resolve(ROOT_DIR, process.env.UPLOAD_DIR || "uploads"),
    profilesDir: path.resolve(
      ROOT_DIR,
      process.env.UPLOAD_DIR || "uploads",
      "profiles"
    ),
    publicUrl: (process.env.PUBLIC_UPLOAD_URL || "/uploads").replace(/\/$/, ""),
    maxBytes: uploadMaxMb * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxDimension: int(process.env.UPLOAD_MAX_DIMENSION, 1000),
  },

  autoMigrate: bool(
    process.env.AUTO_MIGRATE,
    provider === "sqlite" && !isProd
  ),
  logRequests: bool(process.env.LOG_REQUESTS, !isProd),
};

export default env;
