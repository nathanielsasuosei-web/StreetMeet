/**
 * npm run db:seed
 *
 * Creates a handful of complete demo accounts so the UI has something to show.
 * Safe to run repeatedly: demo accounts are matched by email and updated.
 *
 *   Every demo password is: Street1234
 */
import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

import { env } from "../src/config/env.js";
import db, { closeDb } from "../src/db/index.js";
import { migrate } from "../src/db/migrate.js";
import { hashPassword } from "../src/utils/hash.js";
import { newId } from "../src/utils/id.js";

import { removeStoredImage } from "../src/middleware/upload.js";
import * as users from "../src/repositories/userRepository.js";
import * as profileRepo from "../src/repositories/profileRepository.js";
import * as settingsRepo from "../src/repositories/settingsRepository.js";

const PASSWORD = "Street1234";

function yearsAgo(age) {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - age);
  // subtract a day so the birthday has definitely passed
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

const DEMO_USERS = [
  {
    fullName: "Ama Serwaa",
    email: "ama@streetmeet.dev",
    gender: "WOMAN",
    age: 26,
    city: "Accra",
    country: "Ghana",
    bio: "Product designer who judges a city by its jollof. Weekends are for the beach, live highlife gigs and far too much coffee.",
    interests: ["art", "fashion", "coffee", "beach", "live-music", "travel"],
    preferences: { interestedIn: ["MAN"], minAge: 25, maxAge: 34, relationshipGoal: "SERIOUS", maxDistanceKm: 25 },
    settings: { discoverable: true, profileVisibility: "PUBLIC" },
    photo: { from: "#f472b6", to: "#fb923c" },
  },
  {
    fullName: "Kwame Mensah",
    email: "kwame@streetmeet.dev",
    gender: "MAN",
    age: 29,
    city: "Accra",
    country: "Ghana",
    bio: "Backend engineer by day, DJ by night. I will absolutely make you a playlist after one conversation.",
    interests: ["tech", "music", "live-music", "cooking", "running"],
    preferences: { interestedIn: ["WOMAN"], minAge: 24, maxAge: 33, relationshipGoal: "DATING", maxDistanceKm: 50 },
    settings: { discoverable: true, profileVisibility: "PUBLIC" },
    photo: { from: "#22c55e", to: "#0ea5e9" },
  },
  {
    fullName: "Zainab Okoye",
    email: "zainab@streetmeet.dev",
    gender: "WOMAN",
    age: 24,
    city: "Lagos",
    country: "Nigeria",
    bio: "Med student, plant mum, terrible at parking. Looking for someone to try every new restaurant in Lekki with.",
    interests: ["reading", "plants", "foodie", "yoga", "series"],
    preferences: { interestedIn: ["MAN", "NON_BINARY"], minAge: 24, maxAge: 35, relationshipGoal: "CASUAL" },
    settings: { discoverable: true, showAge: true },
    photo: { from: "#a78bfa", to: "#ec4899" },
  },
  {
    fullName: "Thabo Molefe",
    email: "thabo@streetmeet.dev",
    gender: "MAN",
    age: 32,
    city: "Johannesburg",
    country: "South Africa",
    bio: "Trail runner and amateur photographer. Ask me about the time I got lost in Drakensberg for nine hours.",
    interests: ["hiking", "photography", "running", "camping", "coffee"],
    preferences: { interestedIn: ["WOMAN"], minAge: 26, maxAge: 40, relationshipGoal: "SERIOUS", maxDistanceKm: 100 },
    settings: { discoverable: true },
    photo: { from: "#f59e0b", to: "#ef4444" },
  },
  {
    fullName: "Efua Boateng",
    email: "efua@streetmeet.dev",
    gender: "NON_BINARY",
    age: 27,
    city: "London",
    country: "United Kingdom",
    bio: "Illustrator, board game hoarder, professional overthinker. Fluent in sarcasm and Twi.",
    interests: ["art", "board-games", "anime", "podcasts", "brunch"],
    preferences: { interestedIn: ["MAN", "WOMAN", "NON_BINARY"], minAge: 24, maxAge: 36, relationshipGoal: "FRIENDSHIP" },
    settings: { discoverable: true, showLocation: false },
    photo: { from: "#38bdf8", to: "#818cf8" },
  },
  {
    fullName: "Nana Adjei",
    email: "nana@streetmeet.dev",
    gender: "MAN",
    age: 35,
    city: "Kumasi",
    country: "Ghana",
    bio: "Chef. If I cook for you once you will never want to eat out again. Quiet nights in beat loud clubs.",
    interests: ["cooking", "street-food", "football", "music", "family"],
    preferences: { interestedIn: ["WOMAN"], minAge: 28, maxAge: 42, relationshipGoal: "MARRIAGE" },
    settings: { discoverable: false, profileVisibility: "MATCHES_ONLY" },
    photo: { from: "#34d399", to: "#0f766e" },
  },
];

/** Gradient avatar with initials, so the demo accounts have real photos. */
async function generatePhoto(name, { from, to }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/>
    </linearGradient></defs>
    <rect width="600" height="600" fill="url(#g)"/>
    <text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Helvetica,Arial,sans-serif"
      font-size="220" font-weight="700" fill="rgba(255,255,255,0.92)">${initials}</text>
  </svg>`;

  const filename = `${newId()}.jpg`;
  const target = path.join(env.uploads.profilesDir, filename);
  fs.mkdirSync(env.uploads.profilesDir, { recursive: true });
  await sharp(Buffer.from(svg)).resize(600, 600).jpeg({ quality: 85 }).toFile(target);

  return `${env.uploads.publicUrl}/profiles/${filename}`;
}

async function seed() {
  await migrate({ log: false });

  const passwordHash = await hashPassword(PASSWORD);
  const now = new Date().toISOString();
  let created = 0;

  for (const demo of DEMO_USERS) {
    const existing = await users.findByEmail(demo.email);
    const id = existing?.id ?? newId();

    // replace the previous avatar instead of leaving orphaned files behind
    if (existing?.profileImage) removeStoredImage(existing.profileImage);

    const profileImage = await generatePhoto(demo.fullName, demo.photo);

    if (existing) {
      await users.update(id, {
        fullName: demo.fullName,
        bio: demo.bio,
        city: demo.city,
        country: demo.country,
        gender: demo.gender,
        birthDate: yearsAgo(demo.age),
        profileImage,
        verified: true,
      });
    } else {
      await db.transaction(async (tx) => {
        await users.create(
          {
            id,
            fullName: demo.fullName,
            email: demo.email,
            passwordHash,
            gender: demo.gender,
            birthDate: yearsAgo(demo.age),
            bio: demo.bio,
            city: demo.city,
            country: demo.country,
            profileImage,
            role: "USER",
            verified: true,
            tokenVersion: 0,
            createdAt: now,
            updatedAt: now,
          },
          tx
        );
        await settingsRepo.ensureSettings(id, tx);
      });
      created += 1;
    }

    await settingsRepo.updateSettings(id, demo.settings || {});
    await profileRepo.upsertPreferences(id, { openToNearby: true, ...demo.preferences });
    const stored = await profileRepo.setInterests(id, demo.interests);
    const dropped = demo.interests.filter((slug) => !stored.includes(slug));
    if (dropped.length) {
      console.warn(`     ⚠ ${demo.email}: unknown interest slug(s) dropped -> ${dropped.join(", ")}`);
    }

    console.log(`   ✓ ${demo.email.padEnd(26)} ${demo.fullName} (${demo.age}, ${demo.city})`);
  }

  console.log(
    `\n   ${created} created, ${DEMO_USERS.length - created} updated. Password for all demo accounts: ${PASSWORD}`
  );
}

console.log(`Seeding StreetMeet (${env.database.provider})`);
try {
  await seed();
} catch (error) {
  console.error("❌ Seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
