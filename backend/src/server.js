import http from "node:http";
import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import "dotenv/config";

import { env, projectRoot } from "./config/env.js";
import { pool } from "./db/index.js";
import routes from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { globalLimiter } from "./middleware/rateLimit.js";
import { initSockets } from "./sockets/index.js";

const app = express();

const allowedOrigins = [
  env.clientUrl,
  env.appUrl,
  "http://localhost:5173",
  "http://localhost:8081", // Expo dev server
  "exp://localhost:8081",
  process.env.EXTRA_ORIGIN,
].filter(Boolean);

app.set("trust proxy", env.trustProxy ? 1 : false);

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin / server-to-server requests with no Origin header
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (/(^|\.)e2b\.app$/.test(origin)) return callback(null, true); // sandbox previews
      if (env.isProd) return callback(new Error(`Origin ${origin} not allowed by CORS`));
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(globalLimiter);

// Keep the raw body for Paystack's HMAC signature check
app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      if (req.originalUrl?.includes("/webhook/")) req.rawBody = buf.toString("utf8");
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Uploaded photos/videos (swap for a CDN in production)
app.use("/uploads", express.static(env.uploadDir));
app.use("/public", express.static(path.resolve(projectRoot, "public")));

app.get("/health", (_req, res) => {
  res.json({
    app: "natthesisa",
    status: "running",
    provider: env.momo.provider,
    env: env.nodeEnv,
    time: new Date().toISOString(),
  });
});

app.get("/", (_req, res) => {
  res.json({
    app: "natthesisa API",
    tagline: "Dating, chat, status and calls - made in Ghana",
    docs: "/api",
  });
});

app.get("/api", (_req, res) => {
  res.json({
    endpoints: [
      "POST   /api/auth/register",
      "POST   /api/auth/login",
      "GET    /api/auth/me",
      "GET    /api/discover/feed",
      "POST   /api/discover/like/:id",
      "GET    /api/matches",
      "GET    /api/chat/:matchId/messages",
      "POST   /api/chat/:matchId/messages",
      "GET    /api/status/feed",
      "POST   /api/status",
      "GET    /api/calls/ice",
      "GET    /api/payments/plans",
      "POST   /api/payments/initiate",
      "GET    /api/payments/:reference",
      "GET    /api/admin/stats",
    ],
  });
});

app.use("/api", routes);

app.use(notFoundHandler);
app.use(errorHandler);

const server = http.createServer(app);
initSockets(server, { origin: allowedOrigins });

const PORT = env.port;

/**
 * Apply any pending migrations automatically on boot so deployments are
 * hands-free (set AUTO_MIGRATE=false to switch this off).
 */
async function autoMigrate() {
  if (process.env.AUTO_MIGRATE === "false") return;
  try {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const { db } = await import("./db/index.js");
    await migrate(db, { migrationsFolder: path.resolve(projectRoot, "drizzle") });
    console.log("✅ Database schema is up to date");
  } catch (error) {
    console.error("⚠️  Could not run migrations:", error.message);
  }
}

await autoMigrate();

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  natthesisa API running on http://localhost:${PORT}`);
  console.log(`  Mobile money provider: ${env.momo.provider.toUpperCase()}`);
  console.log(`  Realtime: socket.io ready\n`);
});

async function shutdown(signal) {
  console.log(`\n${signal} received - shutting down gracefully`);
  server.close();
  await pool.end().catch(() => {});
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { app, server };
