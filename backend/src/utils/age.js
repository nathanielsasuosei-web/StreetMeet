import { AGE_LIMITS } from "../constants/profile.js";

/**
 * Age is always derived from `birthDate` - never stored. Storing an age column
 * goes stale the day after a birthday.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 'YYYY-MM-DD' (or anything Date understands) -> whole years. */
export function ageFrom(birthDate, now = new Date()) {
  if (!birthDate) return null;
  const birth = new Date(String(birthDate).slice(0, 10));
  if (Number.isNaN(birth.getTime())) return null;

  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  const dayBehind =
    monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate());
  if (dayBehind) age -= 1;

  return age >= 0 && age < 150 ? age : null;
}

/** Validate + normalise a birth date. Returns { value, age } or throws. */
export function normaliseBirthDate(input, now = new Date()) {
  const raw = String(input ?? "").trim().slice(0, 10);
  if (!ISO_DATE.test(raw)) {
    return { error: "Use the format YYYY-MM-DD." };
  }

  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return { error: "That date does not exist." };
  }

  const today = new Date(now.toISOString().slice(0, 10));
  if (parsed > today) return { error: "Birth date cannot be in the future." };

  const age = ageFrom(raw, now);
  if (age === null) return { error: "That date does not look right." };
  if (age < AGE_LIMITS.min) {
    return { error: `You must be at least ${AGE_LIMITS.min} years old to use StreetMeet.` };
  }
  if (age > AGE_LIMITS.max) return { error: "Please enter a valid birth date." };

  return { value: raw, age };
}

/** Latest birth date that still counts as `age` years old today. */
export function birthDateForAge(age, now = new Date()) {
  const year = now.getUTCFullYear() - age;
  return `${year}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(
    now.getUTCDate()
  ).padStart(2, "0")}`;
}

/**
 * Age range -> birth date window, used to filter discovery results in SQL
 * without needing a computed age column.
 */
export function birthDateWindow(minAge, maxAge, now = new Date()) {
  return {
    // oldest allowed birth date  = someone who is maxAge today
    oldest: birthDateForAge(maxAge, now),
    // youngest allowed birth date = someone who turns minAge tomorrow
    youngest: birthDateForAge(minAge, now),
  };
}

export default ageFrom;
