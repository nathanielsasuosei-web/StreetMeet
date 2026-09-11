/**
 * Seed the subscription plans (20p / 50p / 100p) and a demo account.
 *   npm run seed
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, pool } from "./index.js";
import { plans, statuses, users } from "./schema.js";
import { statusExpiry } from "../utils/date.js";

const PLANS = [
  {
    code: "spark",
    name: "Spark",
    tagline: "One day of everything unlocked",
    pricePesewas: 20, // GH¢0.20
    durationDays: 1,
    features: ["See who likes you", "100 likes for 24 hours", "Rewind your last swipe", "Message read receipts"],
    sortOrder: 1,
  },
  {
    code: "boost",
    name: "Boost",
    tagline: "A full week of serious matching",
    pricePesewas: 50, // GH¢0.50
    durationDays: 7,
    features: ["See who likes you", "100 likes a day", "Unlimited rewinds", "Audio calls", "Priority in the deck"],
    popular: true,
    sortOrder: 2,
  },
  {
    code: "gold",
    name: "Gold",
    tagline: "The whole natthesisa experience",
    pricePesewas: 100, // GH¢1.00
    durationDays: 30,
    features: [
      "Everything in Boost",
      "Video calls with your matches",
      "Travel mode - match in any city",
      "See who viewed your status",
      "No ads, ever",
    ],
    sortOrder: 3,
  },
];

async function main() {
  console.log("Seeding natthesisa...\n");

  for (const plan of PLANS) {
    await db
      .insert(plans)
      .values({ ...plan, currency: "GHS", active: true })
      .onConflictDoUpdate({ target: plans.code, set: { ...plan, active: true } });
  }

  const demoEmail = "demo@natthesisa.app";
  const [existing] = await db.select().from(users).where(eq(users.email, demoEmail)).limit(1);

  const demoUser =
    existing ??
    (
      await db
        .insert(users)
        .values({
          email: demoEmail,
          fullName: "Ama Demo",
          passwordHash: await bcrypt.hash("natthesisa", 12),
          gender: "FEMALE",
          birthDate: new Date("1999-06-15"),
          city: "Accra",
          bio: "Swiftie, jollof loyalist, and firm believer that the right person is one good conversation away.",
          interests: ["Music", "Travel", "Food", "Football"],
          onboarded: true,
          verified: true,
          lookingFor: ["MALE"],
        })
        .returning()
    )[0];

  const [existingStatus] = await db.select().from(statuses).where(eq(statuses.userId, demoUser.id)).limit(1);
  if (!existingStatus) {
    await db.insert(statuses).values({
      userId: demoUser.id,
      caption: "New here. Say hi before my status disappears 👋🏾",
      mediaType: "TEXT",
      background: "#7c3aed",
      expiresAt: statusExpiry(),
    });
  }

  const rows = await db.select().from(plans).orderBy(plans.sortOrder);
  console.table(
    rows.map((p) => ({
      plan: p.name,
      price: `GH¢${(p.pricePesewas / 100).toFixed(2)}`,
      duration: `${p.durationDays} day(s)`,
      pesewas: p.pricePesewas,
    }))
  );
  console.log(`\nDemo login -> ${demoEmail} / natthesisa\n`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
