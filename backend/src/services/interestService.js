/**
 * The dating-interest catalogue.
 *
 * Module 4 moved the catalogue from a static list (`constants/profile.js`)
 * into the `interests` table so admins can manage it. The first read after
 * migrating materialises the curated defaults into the table, and admin
 * mutations invalidate the small in-memory cache kept here.
 */
import { INTERESTS } from "../constants/profile.js";
import * as adminRepo from "../repositories/adminRepository.js";

const TTL_MS = 30_000;
let cache = null;
let inflight = null;

export async function ensureMaterialised() {
  if ((await adminRepo.countInterests()) === 0) {
    await adminRepo.insertInterests(INTERESTS);
  }
}

async function rebuild() {
  await ensureMaterialised();
  const rows = await adminRepo.listInterests();
  cache = {
    rows,
    slugs: new Set(rows.map((row) => row.slug)),
    categories: [...new Set(rows.map((row) => row.category))],
    at: Date.now(),
  };
  return cache;
}

/** One rebuild at a time: parallel callers share the same promise. */
function load(force = false) {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache);
  if (!inflight) {
    inflight = rebuild().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** Active interests in catalogue order (what pickers and validation use). */
export async function activeInterests() {
  return (await load()).rows;
}

export async function activeSlugs() {
  return (await load()).slugs;
}

export async function activeCategories() {
  return (await load()).categories;
}

/** Call after any admin mutation of the interests table. */
export function invalidate() {
  cache = null;
}

export default { activeInterests, activeSlugs, activeCategories, ensureMaterialised, invalidate };
