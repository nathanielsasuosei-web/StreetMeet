/**
 * PostgreSQL driver, built on `pg` (pure JavaScript, no native build step).
 *
 * Repositories write portable SQL with `?` placeholders; this module rewrites
 * them to `$1, $2, ...` and normalises rows so they look like the SQLite ones
 * (timestamps become ISO strings, BIGINT counts become numbers).
 */
import pg from "pg";

const { Pool, types } = pg;

// TIMESTAMP / TIMESTAMPTZ -> ISO string instead of a JS Date
types.setTypeParser(1114, (value) => value);
types.setTypeParser(1184, (value) => value);
// BIGINT counts -> number (we never store values above 2^53)
types.setTypeParser(20, (value) => Number.parseInt(value, 10));

/**
 * Replace `?` placeholders with `$n`, ignoring anything inside string
 * literals, quoted identifiers, and `??` (JSONB existence operator).
 */
export function toPositional(sql) {
  if (!sql.includes("?")) return { text: sql, needsParams: false };

  let out = "";
  let index = 0;
  let quote = null;
  let i = 0;

  while (i < sql.length) {
    const char = sql[i];

    // Inside a quoted literal: copy verbatim, handle doubled-quote escapes.
    if (quote) {
      if (char === quote && sql[i + 1] === quote) {
        out += quote + quote;
        i += 2;
        continue;
      }
      if (char === quote) quote = null;
      out += char;
      i += 1;
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      out += char;
      i += 1;
      continue;
    }

    // `??` is PostgreSQL's JSONB existence operator - never a placeholder.
    if (char === "?" && sql[i + 1] === "?") {
      out += "??";
      i += 2;
      continue;
    }

    if (char === "?") {
      index += 1;
      out += `$${index}`;
      i += 1;
      continue;
    }

    out += char;
    i += 1;
  }

  return { text: out, needsParams: index > 0 };
}

function normaliseRow(row) {
  if (!row) return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = value instanceof Date ? value.toISOString() : value;
  }
  return out;
}

export function createPostgresDriver({ connectionString, ssl = false, max = 10 }) {
  const pool = new Pool({
    connectionString,
    max,
    ssl: ssl ? { rejectUnauthorized: false } : undefined,
  });

  pool.on("error", (error) => {
    console.error("💥 Unexpected PostgreSQL pool error:", error.message);
  });

  function make(executor) {
    return {
      async all(sql, params = []) {
        const { text } = toPositional(sql);
        const result = await executor.query(text, params);
        return result.rows.map(normaliseRow);
      },
      async get(sql, params = []) {
        const { text } = toPositional(sql);
        const result = await executor.query(text, params);
        return normaliseRow(result.rows[0]);
      },
      async run(sql, params = []) {
        const { text } = toPositional(sql);
        const result = await executor.query(text, params);
        return { changes: result.rowCount ?? 0, lastId: null };
      },
      async exec(sql) {
        await executor.query(sql);
      },
    };
  }

  const connection = make(pool);

  return {
    dialect: "postgresql",
    ...connection,

    async transaction(task) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await task(make(client));
        await client.query("COMMIT");
        return result;
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {
          /* connection already broken */
        }
        throw error;
      } finally {
        client.release();
      }
    },

    async close() {
      await pool.end();
    },
  };
}

export default createPostgresDriver;
