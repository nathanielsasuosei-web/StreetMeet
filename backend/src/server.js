/**
 * StreetMeet API - boot.
 *
 *   npm run dev      # nodemon
 *   npm start        # production
 *   npm run db:setup # migrate + seed the local database
 */
import fs from "node:fs";

import { createApp } from "./app.js";
import { env } from "./config/env.js";
import db, { closeDb } from "./db/index.js";
import { migrate } from "./db/migrate.js";

async function boot() {
  fs.mkdirSync(env.uploads.profilesDir, { recursive: true });

  console.log(`🗄️  database: ${env.database.provider} (${env.database.url})`);

  if (env.autoMigrate) {
    const applied = await migrate({ log: false });
    console.log(
      applied.length
        ? `   ✓ applied ${applied.length} migration(s): ${applied.join(", ")}`
        : "   ✓ schema up to date"
    );
  } else {
    // Fail fast when the schema is missing instead of erroring per request.
    try {
      await db.get("SELECT COUNT(*) AS total FROM users");
    } catch {
      throw new Error(
        'Database is not migrated. Run "npm run db:migrate" (or set AUTO_MIGRATE=true for local development).'
      );
    }
  }

  const app = await createApp();
  const server = app.listen(env.port, env.host, () => {
    console.log(`✅ StreetMeet API listening on http://${env.host}:${env.port}`);
    console.log(`   health:  http://localhost:${env.port}/api/health`);
    console.log(`   client:  ${env.clientUrl}`);
  });

  const shutdown = async (signal) => {
    console.log(`\n${signal} received - shutting down.`);
    server.close(async () => {
      await closeDb();
      process.exit(0);
    });
    // Do not hang forever on stuck connections.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("unhandledRejection", (reason) => {
    console.error("💥 unhandled rejection:", reason);
  });

  return server;
}

boot().catch((error) => {
  console.error("❌ Failed to start the API:", error.message);
  if (env.isDev) console.error(error.stack);
  process.exit(1);
});
