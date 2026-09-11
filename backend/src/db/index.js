import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";
import { env } from "../config/env.js";

const needsSsl = /sslmode=require|neon\.tech|supabase\.(com|co)|render\.com|amazonaws\.com/.test(env.databaseUrl);

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

export const db = drizzle(pool, { schema });

pool.on("error", (error) => console.error("[db] idle client error", error.message));

export async function ping() {
  const { rows } = await pool.query("select now() as now");
  return rows[0];
}

export { schema };
