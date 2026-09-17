/**
 * Authentication: sign up, sign in, session identity, reactivation.
 */
import db from "../db/index.js";
import { ApiError } from "../utils/apiError.js";
import { comparePassword, hashPassword } from "../utils/hash.js";
import { newId } from "../utils/id.js";
import { createToken } from "../utils/jwt.js";
import { firstNameOf, toPrivateProfile } from "../utils/serialize.js";

import * as users from "../repositories/userRepository.js";
import * as profileRepo from "../repositories/profileRepository.js";
import * as settingsRepo from "../repositories/settingsRepository.js";
import { loadProfileBundle } from "./profileService.js";

const DEFAULT_INTERESTED_IN = ["MAN", "WOMAN", "NON_BINARY", "OTHER"];

/**
 * bcrypt hash of a throwaway password.
 *
 * Login for an unknown account still runs a full bcrypt comparison against this
 * value, so the two cases cost the same time and the endpoint cannot be used to
 * enumerate members by measuring response latency.
 */
const DUMMY_PASSWORD_HASH = "$2b$12$DuCpoXyA1wAYcenyEGQ.x.7GsbAs5Ha7SLPICy9lGqtqxMKRxUXN2";

/** Create the account plus its 1:1 preference/settings rows atomically. */
export async function register({ fullName, email, password }) {
  const normalisedEmail = String(email).trim().toLowerCase();

  if (await users.emailTaken(normalisedEmail)) {
    throw ApiError.conflict("An account with that email already exists.", {
      code: "EMAIL_TAKEN",
      fields: { email: "That email is already registered." },
    });
  }

  const now = new Date().toISOString();
  const id = newId();
  const passwordHash = await hashPassword(password);

  await db.transaction(async (tx) => {
    await users.create(
      {
        id,
        fullName: String(fullName).trim().replace(/\s+/g, " "),
        email: normalisedEmail,
        passwordHash,
        role: "USER",
        verified: false,
        tokenVersion: 0,
        createdAt: now,
        updatedAt: now,
      },
      tx
    );

    await settingsRepo.ensureSettings(id, tx);
    await profileRepo.upsertPreferences(
      id,
      { interestedIn: DEFAULT_INTERESTED_IN, minAge: 18, maxAge: 45, openToNearby: true },
      tx
    );
  });

  const user = await users.findById(id);
  const bundle = await loadProfileBundle(user);

  return {
    token: createToken(user),
    user: toPrivateProfile(bundle),
    message: "Account created. Let's build your profile.",
  };
}

export async function login({ email, password }) {
  const identifier = String(email || "").trim().toLowerCase();
  const user =
    (await users.findByEmail(identifier)) ||
    (await users.findByPhone(String(email || "").trim()));

  // Same status, same message and the same amount of work whether the account
  // exists or not.
  const matches = await comparePassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !matches) {
    throw ApiError.unauthorized("Incorrect email or password.", { code: "BAD_CREDENTIALS" });
  }

  if (user.deactivatedAt) {
    throw new ApiError(403, "This account is deactivated. Reactivate it to continue.", {
      code: "ACCOUNT_DEACTIVATED",
    });
  }

  await users.touchLogin(user.id);
  const fresh = await users.findById(user.id);
  const bundle = await loadProfileBundle(fresh);

  return {
    token: createToken(fresh),
    user: toPrivateProfile(bundle),
    message: `Welcome back, ${firstNameOf(fresh.fullName)}!`,
  };
}

export async function currentUser(user) {
  return toPrivateProfile(await loadProfileBundle(user));
}

/** Bring a soft-deleted account back (email + password, no token needed). */
export async function reactivate({ email, password }) {
  const user = await users.findByEmail(String(email || "").trim().toLowerCase());
  const matches = await comparePassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !matches) {
    throw ApiError.unauthorized("Incorrect email or password.", { code: "BAD_CREDENTIALS" });
  }
  if (!user.deactivatedAt) {
    throw ApiError.badRequest("That account is already active.", { code: "ACCOUNT_ACTIVE" });
  }

  const restored = await users.reactivate(user.id);
  const bundle = await loadProfileBundle(restored);

  return {
    token: createToken(restored),
    user: toPrivateProfile(bundle),
    message: "Your account is back. Welcome!",
  };
}

/** End every session for the account (bumps token_version). */
export async function logoutEverywhere(userId) {
  await users.bumpTokenVersion(userId);
  return { message: "Signed out of all devices." };
}

export default { register, login, currentUser, reactivate, logoutEverywhere };
