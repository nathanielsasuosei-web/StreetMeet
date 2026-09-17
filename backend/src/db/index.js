/**
 * Database entry point.
 *
 *   import db from "../db/index.js";
 *   const rows = await db.all("SELECT * FROM users WHERE city = ?", [city]);
 *
 * One interface, two providers, chosen by `DATABASE_PROVIDER`:
 *   - sqlite      -> node:sqlite (built into Node, file based, great for dev)
 *   - postgresql  -> pg pool (production)
 */
import { env } from "../config/env.js";

import { createPostgresDriver } from "./postgres.js";
import { createSqliteDriver } from "./sqlite.js";

let driver = null;

export function getDb() {
  if (!driver) {
    driver =
      env.database.provider === "postgresql"
        ? createPostgresDriver({
            connectionString: env.database.url,
            ssl: env.database.ssl,
            max: env.database.poolMax,
          })
        : createSqliteDriver(env.database.file);
  }
  return driver;
}

export async function closeDb() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

/** The active driver. Import this in repositories. */
export const db = {
  get dialect() {
    return getDb().dialect;
  },
  all(sql, params) {
    return getDb().all(sql, params);
  },
  get(sql, params) {
    return getDb().get(sql, params);
  },
  run(sql, params) {
    return getDb().run(sql, params);
  },
  exec(sql) {
    return getDb().exec(sql);
  },
  transaction(task) {
    return getDb().transaction(task);
  },
  close() {
    return closeDb();
  },
};

export { bool, dateOnly, intOrNull, iso, jsonEncode, jsonList, strOrNull } from "./normalize.js";

export default db;
