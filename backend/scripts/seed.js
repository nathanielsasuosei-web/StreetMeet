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
    role: "ADMIN",
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
  const byEmail = new Map();

  for (const demo of DEMO_USERS) {
    const existing = await users.findByEmail(demo.email);
    const id = existing?.id ?? newId();
    byEmail.set(demo.email, id);

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
        role: demo.role ?? "USER",
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
            role: demo.role ?? "USER",
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


  /* ── Module 2: a small social graph so the demo accounts feel alive ──────
   * Two mutual-like matches with real threads (one unread message for Ama),
   * a couple of unanswered likes and one pass. Re-runnable: the demo-only
   * rows are cleared first, so reseeding never duplicates the graph.      */
  const idOf = (email) => byEmail.get(email);
  const minutesAgo = (mins) => new Date(Date.now() - mins * 60_000).toISOString();
  const demoIds = [...byEmail.values()];
  const ph = demoIds.map(() => "?").join(", ");
  await db.run(`DELETE FROM notifications WHERE user_id IN (${ph})`, demoIds);
  await db.run(`DELETE FROM messages WHERE sender_id IN (${ph})`, demoIds);
  await db.run(`DELETE FROM matches WHERE user_one_id IN (${ph})`, demoIds);
  await db.run(`DELETE FROM likes WHERE sender_id IN (${ph})`, demoIds);

  const addLike = (from, to, decision, mins) =>
    db.run(
      "INSERT INTO likes (id, sender_id, receiver_id, decision, created_at) VALUES (?, ?, ?, ?, ?)",
      [newId(), idOf(from), idOf(to), decision, minutesAgo(mins)],
    );

  const addMatch = async (a, b, mins) => {
    const [one, two] = idOf(a) < idOf(b) ? [idOf(a), idOf(b)] : [idOf(b), idOf(a)];
    const id = newId();
    await db.run(
      "INSERT INTO matches (id, user_one_id, user_two_id, created_at) VALUES (?, ?, ?, ?)",
      [id, one, two, minutesAgo(mins)],
    );
    return id;
  };

  const addMessage = (matchId, from, to, content, mins, seen) =>
    db.run(
      `INSERT INTO messages (id, sender_id, receiver_id, match_id, content, seen, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newId(), idOf(from), idOf(to), matchId, content, seen ? 1 : 0, minutesAgo(mins)],
    );

  const addNotification = (user, type, actor, matchId, payload, mins, read) =>
    db.run(
      `INSERT INTO notifications (id, user_id, type, actor_id, match_id, payload, read_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        idOf(user),
        type,
        actor ? idOf(actor) : null,
        matchId,
        payload ? JSON.stringify(payload) : null,
        read ? minutesAgo(read) : null,
        minutesAgo(mins),
      ],
    );

  // mutual likes -> matches
  await addLike("ama@streetmeet.dev", "kwame@streetmeet.dev", "LIKE", 300);
  await addLike("kwame@streetmeet.dev", "ama@streetmeet.dev", "LIKE", 290);
  const matchOne = await addMatch("ama@streetmeet.dev", "kwame@streetmeet.dev", 288);

  await addLike("zainab@streetmeet.dev", "efua@streetmeet.dev", "LIKE", 250);
  await addLike("efua@streetmeet.dev", "zainab@streetmeet.dev", "LIKE", 240);
  const matchTwo = await addMatch("zainab@streetmeet.dev", "efua@streetmeet.dev", 238);

  // threads
  await addMessage(matchOne, "kwame@streetmeet.dev", "ama@streetmeet.dev", "Hey Ama! Fellow jollof critic, I see. What is your ruling on the Lagos vs Accra debate?", 200, true);
  await addMessage(matchOne, "ama@streetmeet.dev", "kwame@streetmeet.dev", "Haha, diplomatically: Accra wins on spice, Lagos wins on portion size. You?", 190, true);
  await addMessage(matchOne, "kwame@streetmeet.dev", "ama@streetmeet.dev", "Correct answer. I have a playlist and a restaurant shortlist, in that order.", 100, true);
  await addMessage(matchOne, "kwame@streetmeet.dev", "ama@streetmeet.dev", "There is a highlife night on Friday at the beach club - interested?", 20, false);
  await addMessage(matchTwo, "efua@streetmeet.dev", "zainab@streetmeet.dev", "Fellow overthinker detected. Which board game are you destroying me at first?", 150, true);
  await addMessage(matchTwo, "zainab@streetmeet.dev", "efua@streetmeet.dev", "Wingspan. I have been practising on my plant mice.", 140, true);

  // one-way likes and a pass
  await addLike("thabo@streetmeet.dev", "ama@streetmeet.dev", "LIKE", 60);
  await addLike("zainab@streetmeet.dev", "kwame@streetmeet.dev", "LIKE", 50);
  await addLike("kwame@streetmeet.dev", "zainab@streetmeet.dev", "PASS", 40);

  // notifications to match the graph
  await addNotification("ama@streetmeet.dev", "MATCH", "kwame@streetmeet.dev", matchOne, null, 288, 280);
  await addNotification("kwame@streetmeet.dev", "MATCH", "ama@streetmeet.dev", matchOne, null, 288, 280);
  await addNotification("zainab@streetmeet.dev", "MATCH", "efua@streetmeet.dev", matchTwo, null, 238, 230);
  await addNotification("efua@streetmeet.dev", "MATCH", "zainab@streetmeet.dev", matchTwo, null, 238, 230);
  await addNotification("ama@streetmeet.dev", "MESSAGE", "kwame@streetmeet.dev", matchOne, { preview: "There is a highlife night on Friday at the beach club - interested?" }, 20, null);
  await addNotification("ama@streetmeet.dev", "LIKE", "thabo@streetmeet.dev", null, null, 60, null);
  await addNotification("kwame@streetmeet.dev", "LIKE", "zainab@streetmeet.dev", null, null, 50, null);

  console.log("   ✓ social graph: 2 matches, 6 messages, 3 open notifications for ama@");

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
