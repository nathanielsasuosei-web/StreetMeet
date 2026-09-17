/**
 * SQLite driver, built on Node's native `node:sqlite` module.
 *
 * Zero native dependencies to install - this is what makes `npm install && npm
 * run dev` work on any machine with Node >= 22.5. The interface matches the
 * PostgreSQL driver exactly, so repositories never care which one is active.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { Mutex } from "./mutex.js";

/** node:sqlite only binds null/number/string/bigint/Buffer. */
function bind(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function plain(row) {
  return row === undefined ? undefined : { ...row };
}

export function createSqliteDriver(filename) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });

  const db = new DatabaseSync(filename);
  const mutex = new Mutex();

  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");

  function all(sql, params = []) {
    return db
      .prepare(sql)
      .all(...params.map(bind))
      .map(plain);
  }

  function get(sql, params = []) {
    return plain(db.prepare(sql).get(...params.map(bind)));
  }

  function run(sql, params = []) {
    const result = db.prepare(sql).run(...params.map(bind));
    return { changes: Number(result.changes), lastId: result.lastInsertRowid };
  }

  function exec(sql) {
    db.exec(sql);
  }

  const connection = { all, get, run, exec };

  return {
    dialect: "sqlite",
    filename,

    all: (sql, params) => mutex.run(() => connection.all(sql, params)),
    get: (sql, params) => mutex.run(() => connection.get(sql, params)),
    run: (sql, params) => mutex.run(() => connection.run(sql, params)),
    exec: (sql) => mutex.run(() => connection.exec(sql)),

    async transaction(task) {
      return mutex.run(async () => {
        db.exec("BEGIN");
        try {
          const result = await task(connection);
          db.exec("COMMIT");
          return result;
        } catch (error) {
          try {
            db.exec("ROLLBACK");
          } catch {
            /* the transaction was already aborted */
          }
          throw error;
        }
      });
    },

    async close() {
      db.close();
    },
  };
}

export default createSqliteDriver;
