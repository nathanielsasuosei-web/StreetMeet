/**
 * Add realistic demo profiles so the app is not empty the first time you open it.
 *   npm run seed:demo
 * Safe to run twice - it skips emails that already exist.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, pool } from "../db/index.js";
import { statuses, users } from "../db/schema.js";
import { statusExpiry } from "../utils/date.js";

const PHOTO = (id, w = 700) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

const PROFILES = [
  {
    fullName: "Nana Adjoa",
    email: "nana@natthesisa.app",
    gender: "FEMALE",
    birthDate: new Date("1998-11-02"),
    city: "Accra",
    latitude: 5.6037,
    longitude: -0.187,
    bio: "Architecture by day, highlife playlists by night. Looking for someone who can finish my sentences.",
    interests: ["Architecture", "Music", "Brunch"],
    photos: [PHOTO("1531123897727-8f129e1688ce"), PHOTO("1524504388940-b1c1722653e1")],
    statuses: [{ caption: "Site visit in East Legon ☀️", background: "#7c3aed" }],
  },
  {
    fullName: "Yaw Boateng",
    email: "yaw@natthesisa.app",
    gender: "MALE",
    birthDate: new Date("1994-02-18"),
    city: "Kumasi",
    latitude: 6.6885,
    longitude: -1.6244,
    bio: "Tech bro who still queues for waakye. Arsenal fan, forgive me.",
    interests: ["Football", "Tech", "Food"],
    photos: [PHOTO("1500648767791-00dcc994a43e"), PHOTO("1507003211169-0a1dd7228f2d")],
    statuses: [{ caption: "Kumasi to Accra road trip this weekend 🚗", background: "#0ea5e9" }],
  },
  {
    fullName: "Efua Serwaa",
    email: "efua@natthesisa.app",
    gender: "FEMALE",
    birthDate: new Date("2000-07-25"),
    city: "Tema",
    latitude: 5.6698,
    longitude: -0.0166,
    bio: "Nurse. Coffee enthusiast. I will beat you at ludo, fair warning.",
    interests: ["Health", "Games", "Coffee"],
    photos: [PHOTO("1517841905240-472988babdf9"), PHOTO("1529626455594-4ff0802cfb7e")],
    statuses: [{ caption: "Night shift done. Finally. 🌙", background: "#f43f5e" }],
  },
  {
    fullName: "Kofi Asante",
    email: "kofi@natthesisa.app",
    gender: "MALE",
    birthDate: new Date("1992-09-09"),
    city: "Accra",
    latitude: 5.556,
    longitude: -0.1969,
    bio: "Chef. I make a mean jollof and an even better breakfast. Ask me about my pepper sauce.",
    interests: ["Cooking", "Travel", "Music"],
    photos: [PHOTO("1519085360753-af0119f7cbe7"), PHOTO("1560250097-0b93528c311a")],
    statuses: [{ caption: "New menu dropping Friday 🔥", background: "#f59e0b" }],
  },
  {
    fullName: "Abena Owusu",
    email: "abena@natthesisa.app",
    gender: "FEMALE",
    birthDate: new Date("1997-04-30"),
    city: "Takoradi",
    latitude: 4.8845,
    longitude: -1.7554,
    bio: "Marine biologist. If you can talk about the ocean for an hour we will get along fine.",
    interests: ["Nature", "Diving", "Books"],
    photos: [PHOTO("1494790108377-be9c29b29330"), PHOTO("1487412720507-e7ab37603c6f")],
    statuses: [{ caption: "Beach clean-up tomorrow, come through 🌊", background: "#10b981" }],
  },
  {
    fullName: "Selorm Dzikunu",
    email: "selorm@natthesisa.app",
    gender: "MALE",
    birthDate: new Date("1995-12-14"),
    city: "Accra",
    latitude: 5.6356,
    longitude: -0.1714,
    bio: "Photographer. I will take 400 pictures of you and you will like 3. That is love.",
    interests: ["Photography", "Art", "Cycling"],
    photos: [PHOTO("1506794778202-cad84cf45f1d"), PHOTO("1531427186611-ecfd6d936c79")],
    statuses: [{ caption: "Golden hour hits different in Osu 📷", background: "#8b5cf6" }],
  },
  {
    fullName: "Akosua Frimpong",
    email: "akosua@natthesisa.app",
    gender: "FEMALE",
    birthDate: new Date("1999-01-20"),
    city: "Cape Coast",
    latitude: 5.1053,
    longitude: -1.2466,
    bio: "Law student, part-time poet. Debate me and lose, politely.",
    interests: ["Books", "Law", "Poetry"],
    photos: [PHOTO("1526510747491-58f928ec870f"), PHOTO("1502823403499-6ccfcf4fb453")],
    statuses: [{ caption: "Moot court in 2 hours, wish me luck ⚖️", background: "#ec4899" }],
  },
  {
    fullName: "Michael Tetteh",
    email: "michael@natthesisa.app",
    gender: "MALE",
    birthDate: new Date("1993-06-05"),
    city: "Kumasi",
    latitude: 6.7,
    longitude: -1.6167,
    bio: "Gym at 5am, spreadsheet by 9. Looking for someone to split plantain with.",
    interests: ["Fitness", "Business", "Football"],
    photos: [PHOTO("1568602471122-7832951cc4c5"), PHOTO("1570295999919-56ceb5ecca61")],
    statuses: [{ caption: "Leg day. Send help. 🏋🏾‍♂️", background: "#ef4444" }],
  },
];

async function main() {
  const passwordHash = await bcrypt.hash("natthesisa", 12);
  let created = 0;

  for (const profile of PROFILES) {
    const { statuses: statusList, ...rest } = profile;
    const [existing] = await db.select().from(users).where(eq(users.email, profile.email)).limit(1);
    if (existing) continue;

    const [user] = await db
      .insert(users)
      .values({
        ...rest,
        passwordHash,
        avatarUrl: profile.photos[0],
        lookingFor: profile.gender === "MALE" ? ["FEMALE"] : ["MALE"],
        onboarded: true,
        verified: true,
      })
      .returning();

    for (const status of statusList) {
      await db.insert(statuses).values({ userId: user.id, expiresAt: statusExpiry(), ...status });
    }
    created += 1;
  }

  // Give the seeded demo account a photo too so her card shows up
  const [demo] = await db.select().from(users).where(eq(users.email, "demo@natthesisa.app")).limit(1);
  if (demo && !demo.photos.length) {
    await db
      .update(users)
      .set({ photos: [PHOTO("1494790108377-be9c29b29330")], avatarUrl: PHOTO("1494790108377-be9c29b29330") })
      .where(eq(users.id, demo.id));
  }

  console.log(`✅ Seed complete - ${created} demo profiles added (password: natthesisa)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
