import bcrypt from "bcrypt";

import { env } from "../config/env.js";

export async function hashPassword(password) {
  return bcrypt.hash(password, env.auth.bcryptRounds);
}

export async function comparePassword(password, hash) {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

/**
 * Password policy: >= 8 characters, at least one letter and one digit.
 * Returns null when the password is acceptable, otherwise a human message.
 */
export function passwordProblem(password) {
  const value = String(password ?? "");
  if (value.length < 8) return "Use at least 8 characters.";
  if (value.length > 128) return "That password is too long (max 128 characters).";
  if (!/[A-Za-z]/.test(value)) return "Include at least one letter.";
  if (!/\d/.test(value)) return "Include at least one number.";
  if (/(.)\1{3,}/.test(value)) return "Avoid repeating the same character 4+ times.";
  return null;
}

export const COMMON_PASSWORDS = new Set([
  "password1",
  "password123",
  "12345678a",
  "streetmeet1",
  "qwerty123",
  "iloveyou1",
]);
