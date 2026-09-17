/**
 * Profile: the member-facing record (identity details, photo, interests) plus
 * dating preferences.
 */
import {
  AGE_LIMITS,
  BIO_MAX_LENGTH,
  COUNTRIES,
  DISTANCE_STEPS_KM,
  GENDERS,
  GENDER_VALUES,
  INTERESTS,
  INTEREST_CATEGORIES,
  INTERESTS_MAX,
  INTERESTS_MIN,
  NAME_MAX_LENGTH,
  RELATIONSHIP_GOALS,
  RELATIONSHIP_GOAL_VALUES,
  normaliseInterests,
} from "../constants/profile.js";
import { ApiError } from "../utils/apiError.js";
import { normaliseBirthDate } from "../utils/age.js";
import { removeStoredImage, storeProfileImage } from "../middleware/upload.js";
import { toPrivateProfile, toPublicProfile } from "../utils/serialize.js";

import * as users from "../repositories/userRepository.js";
import * as profileRepo from "../repositories/profileRepository.js";
import * as settingsRepo from "../repositories/settingsRepository.js";

/** Load the member plus their interests, preferences and settings. */
export async function loadProfileBundle(user) {
  const [interests, preferences, settings] = await Promise.all([
    profileRepo.listInterests(user.id),
    profileRepo.findPreferences(user.id),
    settingsRepo.findSettings(user.id),
  ]);

  return { user, interests, preferences, settings };
}

export function catalogue() {
  return {
    interests: INTERESTS,
    interestCategories: INTEREST_CATEGORIES,
    genders: GENDERS,
    relationshipGoals: RELATIONSHIP_GOALS,
    countries: COUNTRIES,
    limits: {
      minAge: AGE_LIMITS.min,
      maxAge: AGE_LIMITS.max,
      interestsMin: INTERESTS_MIN,
      interestsMax: INTERESTS_MAX,
      bioMaxLength: BIO_MAX_LENGTH,
      nameMaxLength: NAME_MAX_LENGTH,
      distanceStepsKm: DISTANCE_STEPS_KM,
    },
  };
}

/* ── validation shared by PATCH /profile and POST /profile/onboard ──────── */

function assertGender(value) {
  if (value === undefined || value === null || value === "") return null;
  const gender = String(value).toUpperCase();
  if (!GENDER_VALUES.includes(gender)) {
    throw ApiError.unprocessable("Choose a gender option.", {
      fields: { gender: "Pick one of the available options." },
    });
  }
  return gender;
}

function assertBirthDate(value) {
  if (value === undefined || value === null || value === "") return null;
  const result = normaliseBirthDate(value);
  if (result.error) {
    throw ApiError.unprocessable(result.error, { fields: { birthDate: result.error } });
  }
  return result.value;
}

function assertInterests(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw ApiError.unprocessable("Interests must be a list.", {
      fields: { interests: "Select your interests from the list." },
    });
  }

  const clean = normaliseInterests(value);
  const unknown = value
    .map((slug) => String(slug ?? "").trim().toLowerCase())
    .filter((slug) => slug && !clean.includes(slug));

  if (unknown.length) {
    throw ApiError.unprocessable(`Unknown interest(s): ${unknown.join(", ")}.`, {
      fields: { interests: "Some interests are not in the catalogue." },
    });
  }
  if (clean.length > INTERESTS_MAX) {
    throw ApiError.unprocessable(`Pick at most ${INTERESTS_MAX} interests.`, {
      fields: { interests: `Remove ${clean.length - INTERESTS_MAX} interest(s).` },
    });
  }
  return clean;
}

function assertBio(value) {
  if (value === undefined || value === null) return null;
  const bio = String(value).trim();
  if (bio.length > BIO_MAX_LENGTH) {
    throw ApiError.unprocessable(`Bio must be ${BIO_MAX_LENGTH} characters or fewer.`, {
      fields: { bio: `Shorten it by ${bio.length - BIO_MAX_LENGTH} characters.` },
    });
  }
  return bio || null;
}

function assertPhone(value) {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === "") return null;
  const phone = String(value).trim();
  if (!/^\+?[0-9\s()-]{7,20}$/.test(phone)) {
    throw ApiError.unprocessable("Enter a valid phone number.", {
      fields: { phoneNumber: "Digits, spaces and + only (7-20 characters)." },
    });
  }
  return phone;
}

/* ── reads ─────────────────────────────────────────────────────────────── */

export async function getOwnProfile(userId) {
  const user = await users.findById(userId);
  if (!user) throw ApiError.notFound("Profile not found.");
  return toPrivateProfile(await loadProfileBundle(user));
}

export async function getPublicProfile(id, _viewer = null) {
  const user = await users.findById(id);
  if (!user || user.deactivatedAt) throw ApiError.notFound("That profile is not available.");

  const [interests, settings] = await Promise.all([
    profileRepo.listInterests(user.id),
    settingsRepo.findSettings(user.id),
  ]);

  return toPublicProfile({
    user,
    interests,
    settings,
    isMatch: false, // filled in by the matching module (module 2)
  });
}

/* ── writes ────────────────────────────────────────────────────────────── */

/**
 * PATCH /api/profile - partial update. Only keys present in `payload` change.
 */
export async function updateProfile(userId, payload) {
  const user = await users.findById(userId);
  if (!user) throw ApiError.notFound("Profile not found.");

  const fields = {};

  if (payload.fullName !== undefined) {
    const fullName = String(payload.fullName).trim().replace(/\s+/g, " ");
    if (fullName.length < 2) {
      throw ApiError.unprocessable("Enter your full name.", {
        fields: { fullName: "At least 2 characters." },
      });
    }
    if (fullName.length > NAME_MAX_LENGTH) {
      throw ApiError.unprocessable(`Name must be ${NAME_MAX_LENGTH} characters or fewer.`, {
        fields: { fullName: "That name is too long." },
      });
    }
    fields.fullName = fullName;
  }

  if (payload.gender !== undefined) {
    const gender = assertGender(payload.gender);
    if (gender) fields.gender = gender;
  }

  if (payload.birthDate !== undefined) {
    const birthDate = assertBirthDate(payload.birthDate);
    if (birthDate) fields.birthDate = birthDate;
  }

  if (payload.bio !== undefined) fields.bio = assertBio(payload.bio);

  if (payload.phoneNumber !== undefined) {
    const phone = assertPhone(payload.phoneNumber);
    if (phone && (await users.phoneTaken(phone, { exceptId: userId }))) {
      throw ApiError.conflict("That phone number is linked to another account.", {
        fields: { phoneNumber: "Already in use." },
      });
    }
    fields.phoneNumber = phone;
  }

  if (payload.city !== undefined) {
    const city = String(payload.city ?? "").trim();
    if (city.length > 80) throw ApiError.unprocessable("City is too long.");
    fields.city = city || null;
  }

  if (payload.country !== undefined) {
    const country = String(payload.country ?? "").trim();
    if (country.length > 80) throw ApiError.unprocessable("Country is too long.");
    fields.country = country || null;
  }

  const interests = assertInterests(payload.interests);

  if (Object.keys(fields).length > 0) {
    await users.update(userId, fields);
  }

  if (interests !== undefined) await profileRepo.setInterests(userId, interests);

  if (payload.preferences && typeof payload.preferences === "object") {
    await updatePreferences(userId, payload.preferences);
  }

  return getOwnProfile(userId);
}

const FLAT_PREFERENCE_KEYS = [
  "interestedIn",
  "minAge",
  "maxAge",
  "maxDistanceKm",
  "relationshipGoal",
  "openToNearby",
];

/**
 * POST /api/profile/onboard - the sign-up wizard in one request.
 *
 * Accepts preferences either nested (`{ preferences: {...} }`) or flat
 * (`{ interestedIn: [...], minAge: 21 }`) so the wizard can post one payload.
 * The photo is uploaded separately with POST /api/profile/photo (multipart).
 */
export async function completeOnboarding(userId, payload) {
  const preferences =
    payload.preferences ??
    Object.fromEntries(
      FLAT_PREFERENCE_KEYS.filter((key) => payload[key] !== undefined).map((key) => [
        key,
        payload[key],
      ])
    );

  await updateProfile(userId, {
    ...payload,
    preferences: Object.keys(preferences || {}).length ? preferences : undefined,
  });

  return getOwnProfile(userId);
}

/* ── preferences ───────────────────────────────────────────────────────── */

export async function getPreferences(userId) {
  const preferences = await profileRepo.findPreferences(userId);
  if (!preferences) {
    return profileRepo.upsertPreferences(userId, {
      interestedIn: ["MAN", "WOMAN", "NON_BINARY", "OTHER"],
      minAge: AGE_LIMITS.defaultMin,
      maxAge: AGE_LIMITS.defaultMax,
      openToNearby: true,
    });
  }
  return preferences;
}

export async function updatePreferences(userId, payload = {}) {
  const changes = {};

  if (payload.interestedIn !== undefined) {
    const list = Array.isArray(payload.interestedIn)
      ? payload.interestedIn
      : [payload.interestedIn];
    const clean = [...new Set(list.map((value) => String(value ?? "").toUpperCase()))].filter(
      (value) => GENDER_VALUES.includes(value)
    );
    if (clean.length === 0) {
      throw ApiError.unprocessable("Select at least one gender you want to meet.", {
        fields: { interestedIn: "Select at least one option." },
      });
    }
    changes.interestedIn = clean;
  }

  const minAge = payload.minAge === undefined ? undefined : Number(payload.minAge);
  const maxAge = payload.maxAge === undefined ? undefined : Number(payload.maxAge);

  for (const [label, value] of [
    ["minAge", minAge],
    ["maxAge", maxAge],
  ]) {
    if (value === undefined) continue;
    if (!Number.isInteger(value) || value < AGE_LIMITS.min || value > AGE_LIMITS.max) {
      throw ApiError.unprocessable(`${label} must be a whole number between ${AGE_LIMITS.min} and ${AGE_LIMITS.max}.`, {
        fields: { [label]: `Between ${AGE_LIMITS.min} and ${AGE_LIMITS.max}.` },
      });
    }
  }

  const current = await profileRepo.findPreferences(userId);
  const effectiveMin = minAge ?? current?.minAge ?? AGE_LIMITS.defaultMin;
  const effectiveMax = maxAge ?? current?.maxAge ?? AGE_LIMITS.defaultMax;

  if (effectiveMin > effectiveMax) {
    throw ApiError.unprocessable("The minimum age cannot be higher than the maximum age.", {
      fields: { minAge: "Must be less than or equal to the maximum age." },
    });
  }
  if (minAge !== undefined) changes.minAge = minAge;
  if (maxAge !== undefined) changes.maxAge = maxAge;

  if (payload.maxDistanceKm !== undefined) {
    const distance = payload.maxDistanceKm === null || payload.maxDistanceKm === "" ? null : Number(payload.maxDistanceKm);
    if (distance !== null && (!Number.isInteger(distance) || distance <= 0 || distance > 1000)) {
      throw ApiError.unprocessable("Distance must be a whole number of kilometres (1-1000).", {
        fields: { maxDistanceKm: "Use one of the suggested distances." },
      });
    }
    changes.maxDistanceKm = distance;
  }

  if (payload.relationshipGoal !== undefined) {
    const goal = payload.relationshipGoal === null || payload.relationshipGoal === ""
      ? null
      : String(payload.relationshipGoal).toUpperCase();
    if (goal && !RELATIONSHIP_GOAL_VALUES.includes(goal)) {
      throw ApiError.unprocessable("Choose a valid relationship goal.", {
        fields: { relationshipGoal: "Pick one of the available options." },
      });
    }
    changes.relationshipGoal = goal;
  }

  if (payload.openToNearby !== undefined) {
    changes.openToNearby = Boolean(payload.openToNearby);
  }

  return profileRepo.upsertPreferences(userId, changes);
}

/* ── photo ─────────────────────────────────────────────────────────────── */

export async function setPhotoFromBuffer(userId, buffer) {
  const user = await users.findById(userId);
  if (!user) throw ApiError.notFound("Profile not found.");

  const publicPath = await storeProfileImage(buffer, { previous: user.profileImage });
  await users.update(userId, { profileImage: publicPath });

  return publicPath;
}

export async function removePhoto(userId) {
  const user = await users.findById(userId);
  if (!user) throw ApiError.notFound("Profile not found.");

  if (user.profileImage) removeStoredImage(user.profileImage);
  await users.update(userId, { profileImage: null });

  return getOwnProfile(userId);
}

/** Convenience for controllers that already ran multer. */
export async function uploadPhoto(userId, file) {
  if (!file?.buffer?.length) {
    throw ApiError.badRequest("Choose an image file to upload (field name: photo).");
  }
  await setPhotoFromBuffer(userId, file.buffer);
  return getOwnProfile(userId);
}
export default {
  catalogue,
  getOwnProfile,
  getPublicProfile,
  updateProfile,
  completeOnboarding,
  getPreferences,
  updatePreferences,
  uploadPhoto,
  removePhoto,
  loadProfileBundle,
};
