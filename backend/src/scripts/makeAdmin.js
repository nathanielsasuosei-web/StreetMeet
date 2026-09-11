/**
 * Promote a user to ADMIN:  node src/scripts/makeAdmin.js you@example.com
 * Handy for the very first admin account after you deploy.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "../db/index.js";
import { users } from "../db/schema.js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node src/scripts/makeAdmin.js you@example.com");
  process.exit(1);
}

const [user] = await db
  .update(users)
  .set({ role: "ADMIN", updatedAt: new Date() })
  .where(eq(users.email, email.toLowerCase()))
  .returning({ id: users.id, email: users.email, fullName: users.fullName, role: users.role });

if (!user) {
  console.error(`No user found with email ${email}`);
  process.exitCode = 1;
} else {
  console.log(`✅ ${user.fullName} (${user.email}) is now ${user.role}`);
}

await pool.end();
