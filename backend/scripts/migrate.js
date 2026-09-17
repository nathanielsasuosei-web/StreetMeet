/**
 * npm run db:migrate [-- --fresh]
 *
 * Applies every pending migration in db/migrations/<dialect>/. With --fresh it
 * first drops all tables (development only - refused in production).
 */
import { env } from "../src/config/env.js";
import db, { closeDb } from "../src/db/index.js";
import { migrate, reset } from "../src/db/migrate.js";

const fresh = process.argv.includes("--fresh");

console.log(
  `StreetMeet migrations - ${env.database.provider} (${env.isProd ? "production" : env.nodeEnv})`
);

try {
  if (fresh) await reset();
  else await migrate();

  const row = await db.get("SELECT COUNT(*) AS total FROM users");
  console.log(`   ✓ users table ready (${row?.total ?? 0} row(s))`);
} catch (error) {
  console.error("❌ Migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
