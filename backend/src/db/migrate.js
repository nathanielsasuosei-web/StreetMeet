/**
 * Tiny forward-only SQL migration runner.
 *
 * Migrations live in `backend/db/migrations/<dialect>/NNNN_name.sql` and are
 * applied in filename order, recorded in a `_migrations` table. Because the
 * SQLite and PostgreSQL dialects differ, each provider keeps its own folder,
 * but the file names must stay in lock-step.
 */
import fs from "node:fs";
import path from "node:path";

import { ROOT_DIR } from "../config/env.js";
import { env } from "../config/env.js";

import db from "./index.js";

const MIGRATIONS_ROOT = path.join(ROOT_DIR, "db", "migrations");

export function migrationsDir(dialect = env.database.provider) {
  return path.join(MIGRATIONS_ROOT, dialect);
}

export function listMigrationFiles(dialect = env.database.provider) {
  const dir = migrationsDir(dialect);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

async function ensureTable() {
  const isPg = db.dialect === "postgresql";
  await db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       ${isPg ? "VARCHAR(255)" : "TEXT"} PRIMARY KEY,
      applied_at ${isPg ? "TIMESTAMPTZ" : "TEXT"} NOT NULL
    )
  `);
}

export async function appliedMigrations() {
  await ensureTable();
  const rows = await db.all("SELECT name FROM _migrations ORDER BY name");
  return new Set(rows.map((row) => row.name));
}

/** Apply every pending migration. Returns the list it applied. */
export async function migrate({ log = true } = {}) {
  const dialect = db.dialect;
  const files = listMigrationFiles(dialect);
  const applied = await appliedMigrations();
  const pending = files.filter((file) => !applied.has(file));

  if (log && files.length === 0) {
    console.warn(`⚠️  No migrations found for "${dialect}" in ${migrationsDir(dialect)}`);
  }

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(migrationsDir(dialect), file), "utf8");
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.run("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)", [
        file,
        new Date().toISOString(),
      ]);
    });
    if (log) console.log(`   ✓ applied ${file}`);
  }

  if (log && pending.length === 0) {
    console.log(`   ✓ database is up to date (${dialect}, ${applied.size} migration(s))`);
  }

  return pending;
}

/** Drop every table - used by `npm run db:reset` in development. */
export async function reset({ log = true } = {}) {
  if (env.isProd) {
    throw new Error("Refusing to reset the database while NODE_ENV=production");
  }

  const dialect = db.dialect;

  if (dialect === "postgresql") {
    const rows = await db.all(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
    );
    for (const row of rows) {
      await db.exec(`DROP TABLE IF EXISTS "${row.tablename}" CASCADE`);
    }
  } else {
    await db.exec("PRAGMA foreign_keys = OFF");
    const tables = await db.all(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
    );
    for (const table of tables) {
      await db.exec(`DROP TABLE IF EXISTS "${table.name}"`);
    }
    await db.exec("PRAGMA foreign_keys = ON");
  }

  if (log) console.log(`   ✓ dropped all tables (${dialect})`);
  return migrate({ log });
}

export default migrate;
