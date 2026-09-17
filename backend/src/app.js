/**
 * Express application assembly (no listening - see server.js).
 *
 * Exported separately so the smoke test can boot the exact same app on an
 * ephemeral port.
 */
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import db from "./db/index.js";

import authRoutes from "./routes/authRoutes.js";
import billingRoutes from "./routes/billingRoutes.js";
import discoverRoutes from "./routes/discoverRoutes.js";
import matchRoutes from "./routes/matchRoutes.js";
import moderationRoutes from "./routes/moderationRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import swipeRoutes from "./routes/swipeRoutes.js";

import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiters.js";

/**
 * Modules 2-6 were written against the old Prisma client and are not part of
 * this rebuild. They stay in the repository untouched, but they are mounted
 * behind a guard that answers 501 ("not migrated yet") instead of crashing the
 * API at boot - several of them import files that no longer exist.
 */
const LEGACY_MODULES = [
  { mount: "/api/status", name: "status", file: "./routes/statusRoutes.js" },
  { mount: "/api/admin", name: "admin", file: "./routes/adminRoutes.js" },
];

async function probeLegacyModules() {
  const probed = [];
  for (const module of LEGACY_MODULES) {
    try {
      await import(module.file);
      probed.push({ ...module, loadable: true });
    } catch (error) {
      probed.push({ ...module, loadable: false, reason: error.message.split("\n")[0] });
      if (env.isDev) {
        console.warn(`⚠️  ${module.name}: not loadable yet (${probed.at(-1).reason})`);
      }
    }
  }
  return probed;
}

const PREVIEW_HOST = /^[a-z0-9-]+\.(e2b\.app|onrender\.com|vercel\.app)$/i;

function originAllowed(origin) {
  if (!origin) return true; // curl / server-to-server / same-origin via the dev proxy
  if (env.corsOrigins.includes(origin)) return true;

  let hostname;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return false;
  }
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  return PREVIEW_HOST.test(hostname);
}

export async function createApp() {
  const app = express();
  const legacy = await probeLegacyModules();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    helmet({
      // Profile images are fetched by the SPA (possibly on another origin).
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false,
    })
  );

  app.use(
    cors({
      origin: (origin, callback) => callback(null, originAllowed(origin)),
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  app.use(express.json({ limit: "1mb", verify: (req, _res, buf) => { req.rawBody = buf.toString("utf8"); } }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  if (env.logRequests) {
    app.use((req, res, next) => {
      const started = Date.now();
      res.on("finish", () => {
        if (req.path === "/api/health") return;
        console.log(`${res.statusCode} ${req.method} ${req.originalUrl} ${Date.now() - started}ms`);
      });
      next();
    });
  }

  // Uploaded media: no sniffing, no script execution, cached for a week.
  app.use(
    env.uploads.publicUrl,
    (_req, res, next) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'");
      next();
    },
    express.static(env.uploads.dir, { maxAge: "7d", index: false, dotfiles: "ignore" })
  );

  app.get("/", (_req, res) => {
    res.json({
      app: "StreetMeet API",
      status: "running",
      version: "2.0.0",
      modules: {
        accounts: "ready",
        profile: "ready",
        settings: "ready",
        ...Object.fromEntries(legacy.map((module) => [module.name, "not migrated"])),
      },
      health: "/api/health",
    });
  });

  app.get("/api/health", async (_req, res) => {
    let database = "unknown";
    let members = null;
    try {
      const row = await db.get("SELECT COUNT(*) AS total FROM users");
      members = Number(row?.total ?? 0);
      database = "connected";
    } catch (error) {
      database = `unreachable (${error.message})`;
    }

    res.json({
      success: true,
      data: {
        status: database === "connected" ? "ok" : "degraded",
        provider: env.database.provider,
        database,
        members,
        uptimeSeconds: Math.round(process.uptime()),
        environment: env.nodeEnv,
      },
    });
  });

  app.use("/api", apiLimiter);

  /* ── Module 1: user accounts ─────────────────────────────────────────── */
  app.use("/api/auth", authRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/settings", settingsRoutes);

  /* ── Module 2: dating ────────────────────────────────────────────────── */
  app.use("/api/discover", discoverRoutes);
  app.use("/api/swipes", swipeRoutes);
  app.use("/api/matches", matchRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/billing", billingRoutes);
  app.use("/api", moderationRoutes); // /users/:id/block|report, /blocks

  /* ── Modules 2-6: guarded until they are rebuilt ─────────────────────── */
  for (const module of legacy) {
    app.use(module.mount, (_req, res) => {
      res.status(501).json({
        success: false,
        message: `The ${module.name} module is not part of this rebuild yet.`,
        code: "MODULE_NOT_MIGRATED",
        ...(module.loadable ? {} : { detail: module.reason }),
      });
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
