/**
 * Apply every migration in ./drizzle to the database.
 *   npm run db:generate   (writes SQL files from src/db/schema.js)
 *   npm run db:migrate    (applies them)
 * Render/VPS runs this automatically on `npm start` (see src/server.js).
 */
import "dotenv/config";
import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index.js";
import { projectRoot } from "../config/env.js";

const folder = path.resolve(projectRoot, "drizzle");

try {
  await migrate(db, { migrationsFolder: folder });
  console.log("✅ Database schema is up to date");
} catch (error) {
  console.error("❌ Migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
