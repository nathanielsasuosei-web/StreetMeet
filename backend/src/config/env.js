import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(__dirname, "..", "..");

const bool = (value, fallback = false) =>
  value === undefined ? fallback : ["1", "true", "yes", "on"].includes(String(value).toLowerCase());

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProd: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT || 5000),

  databaseUrl: required("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/natthesisa"),

  jwtSecret: required("JWT_SECRET", "dev-only-secret-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "30d",

  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  appUrl: process.env.APP_URL || process.env.CLIENT_URL || "http://localhost:5173",

  uploadDriver: process.env.UPLOAD_DRIVER || "local",
  uploadDir: path.resolve(projectRoot, process.env.UPLOAD_DIR || "public/uploads"),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 15),

  momo: {
    provider: (process.env.MOMO_PROVIDER || "mock").toLowerCase(),
    currency: process.env.MOMO_CURRENCY || "GHS",
    hubtel: {
      clientId: process.env.HUBTEL_CLIENT_ID || "",
      clientSecret: process.env.HUBTEL_CLIENT_SECRET || "",
      merchantAccountNumber: process.env.HUBTEL_MERCHANT_ACCOUNT_NUMBER || "",
      webhookToken: process.env.HUBTEL_WEBHOOK_TOKEN || "",
    },
    paystack: {
      secretKey: process.env.PAYSTACK_SECRET_KEY || "",
      publicKey: process.env.PAYSTACK_PUBLIC_KEY || "",
    },
  },

  turn: {
    urls: (process.env.TURN_URLS || "stun:stun.l.google.com:19302").split(",").map((s) => s.trim()).filter(Boolean),
    username: process.env.TURN_USERNAME || "",
    credential: process.env.TURN_CREDENTIAL || "",
  },

  admin: {
    email: process.env.ADMIN_EMAIL || "admin@natthesisa.com",
    password: process.env.ADMIN_PASSWORD || "ChangeMe123!",
  },

  trustProxy: bool(process.env.TRUST_PROXY, false),
};

export default env;
