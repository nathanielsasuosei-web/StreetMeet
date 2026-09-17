/**
 * Account settings: privacy, notifications, email, password, sessions and
 * account closure.
 */
import db from "../db/index.js";
import { ApiError } from "../utils/apiError.js";
import { comparePassword, hashPassword, passwordProblem } from "../utils/hash.js";
import { createToken } from "../utils/jwt.js";
import { removeStoredImage } from "../middleware/upload.js";


import * as users from "../repositories/userRepository.js";
import * as settingsRepo from "../repositories/settingsRepository.js";
import { loadProfileBundle } from "./profileService.js";

/** Everything the Settings page needs in one round trip. */
export async function getAccountOverview(user) {
  const settings = (await settingsRepo.findSettings(user.id)) ?? (await settingsRepo.ensureSettings(user.id));

  return {
    settings,
    account: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      verified: user.verified,
      hasPassword: true,
      twoFactorEnabled: settings.twoFactorEnabled,
      activeSessions: "current",
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      deactivatedAt: user.deactivatedAt,
    },
    defaults: settingsRepo.DEFAULT_SETTINGS,
  };
}

export async function updateSettings(userId, fields) {
  return settingsRepo.updateSettings(userId, fields);
}

export async function changeEmail(userId, { email, password }) {
  const user = await users.findById(userId);
  if (!user) throw ApiError.notFound("Account not found.");

  if (!(await comparePassword(password, user.passwordHash))) {
    throw ApiError.unauthorized("Your password is incorrect.", {
      fields: { password: "Enter your current password to change your email." },
    });
  }

  const nextEmail = String(email || "").trim().toLowerCase();
  if (nextEmail === user.email) {
    throw ApiError.badRequest("That is already your email address.");
  }
  if (await users.emailTaken(nextEmail, { exceptId: userId })) {
    throw ApiError.conflict("That email is already in use.", {
      fields: { email: "Another account uses this email." },
    });
  }

  await users.update(userId, { email: nextEmail, verified: false });
  return { email: nextEmail, message: "Email updated. You may need to verify it again." };
}

/**
 * Changing the password bumps `token_version`, so every other device is signed
 * out. The caller gets a fresh token for the device they are on.
 */
export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await users.findById(userId);
  if (!user) throw ApiError.notFound("Account not found.");

  if (!(await comparePassword(currentPassword, user.passwordHash))) {
    throw ApiError.unauthorized("Your current password is incorrect.", {
      fields: { currentPassword: "That password does not match our records." },
    });
  }

  const problem = passwordProblem(newPassword);
  if (problem) {
    throw ApiError.unprocessable(problem, { fields: { newPassword: problem } });
  }
  if (await comparePassword(newPassword, user.passwordHash)) {
    throw ApiError.badRequest("Choose a password you have not used before.", {
      fields: { newPassword: "Must be different from your current password." },
    });
  }

  const passwordHash = await hashPassword(newPassword);

  await db.transaction(async (tx) => {
    await users.update(userId, { passwordHash }, tx);
    await users.bumpTokenVersion(userId, tx);
  });

  const updated = await users.findById(userId);
  return {
    token: createToken(updated),
    message: "Password changed. Other devices have been signed out.",
  };
}

export async function logoutEverywhere(userId) {
  await users.bumpTokenVersion(userId);
  return { message: "All other devices have been signed out." };
}

/**
 * Close the account.
 *   mode "deactivate" (default) - hidden immediately, restorable with email+password
 *   mode "delete"               - row and all related data are removed
 */
export async function closeAccount(userId, { password, mode = "deactivate" }) {
  const user = await users.findById(userId);
  if (!user) throw ApiError.notFound("Account not found.");

  if (!(await comparePassword(password, user.passwordHash))) {
    throw ApiError.unauthorized("Confirm your password to close this account.", {
      fields: { password: "Incorrect password." },
    });
  }

  if (mode === "delete") {
    if (user.profileImage) removeStoredImage(user.profileImage);
    if (user.coverImage) removeStoredImage(user.coverImage);
    await db.run("DELETE FROM users WHERE id = ?", [userId]);
    return { deleted: true, message: "Your account and data have been permanently deleted." };
  }

  await users.deactivate(userId);
  return {
    deleted: false,
    message:
      "Your account is deactivated. Your profile is hidden - you can reactivate it any time by signing in.",
  };
}

export { loadProfileBundle };
export default {
  getAccountOverview,
  updateSettings,
  changeEmail,
  changePassword,
  logoutEverywhere,
  closeAccount,
};
