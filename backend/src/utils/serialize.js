/**
 * Domain object -> API response mapping.
 *
 * Everything below receives camelCase objects (see repositories/userRepository
 * `mapUser`, and the preference/settings repositories) so the API layer never
 * has to know what the columns are called.
 *
 * Two views of a member:
 *   `toPrivateProfile`  everything, for the account owner (and admins)
 *   `toPublicProfile`   only what that owner's settings allow others to see
 */
import { INTERESTS_MIN } from "../constants/profile.js";
import { ageFrom } from "./age.js";

export function firstNameOf(fullName) {
  return String(fullName || "").trim().split(/\s+/)[0] || "there";
}

function locationOf(user) {
  return [user.city, user.country].filter(Boolean).join(", ") || null;
}

/** Fields that must be filled in before the account is considered complete. */
export function missingProfileFields({ user, interests, preferences }) {
  const missing = [];

  if (!user.gender) missing.push("gender");
  if (!user.birthDate) missing.push("birthDate");
  if (!user.city) missing.push("city");
  if (!user.bio || user.bio.trim().length < 20) missing.push("bio");
  if (!user.profileImage) missing.push("photo");
  if ((interests?.length ?? 0) < INTERESTS_MIN) missing.push("interests");
  if (!preferences?.interestedIn?.length) missing.push("preferences");

  return missing;
}

/** Rough 0-100 progress for the onboarding checklist in the UI. */
export function completionScore(missing) {
  const total = 7;
  return Math.round(((total - missing.length) / total) * 100);
}

export function toPrivateProfile({ user, interests = [], preferences = null, settings = null }) {
  const missing = missingProfileFields({ user, interests, preferences });

  return {
    id: user.id,
    fullName: user.fullName,
    firstName: firstNameOf(user.fullName),
    email: user.email,
    phoneNumber: user.phoneNumber,
    gender: user.gender,
    birthDate: user.birthDate,
    age: ageFrom(user.birthDate),
    bio: user.bio,
    city: user.city,
    country: user.country,
    location: locationOf(user),
    profileImage: user.profileImage,
    coverImage: user.coverImage,
    interests: interests ?? [],
    preferences,
    settings,
    role: user.role,
    verified: user.verified,
    deactivatedAt: user.deactivatedAt,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    profileComplete: missing.length === 0,
    missingFields: missing,
    completion: completionScore(missing),
  };
}

/**
 * What another member is allowed to see. Honours the owner's visibility level
 * and per-field switches. `isMatch` is supplied by the matching module later.
 */
export function toPublicProfile({ user, interests = [], settings = null, isMatch = false }) {
  const visibility = settings?.profileVisibility ?? "PUBLIC";

  if (visibility === "PRIVATE" || user.deactivatedAt) {
    return {
      id: user.id,
      fullName: "Private profile",
      firstName: "Private",
      profileImage: null,
      private: true,
      restricted: true,
    };
  }

  const restricted = visibility === "MATCHES_ONLY" && !isMatch;
  const showAge = settings?.showAge ?? true;
  const showLocation = settings?.showLocation ?? true;

  return {
    id: user.id,
    fullName: restricted ? firstNameOf(user.fullName) : user.fullName,
    firstName: firstNameOf(user.fullName),
    gender: user.gender,
    age: showAge ? ageFrom(user.birthDate) : null,
    bio: restricted ? null : user.bio,
    city: showLocation ? user.city : null,
    country: showLocation ? user.country : null,
    location: showLocation ? locationOf(user) : null,
    profileImage: user.profileImage,
    interests: restricted ? interests.slice(0, 3) : interests,
    verified: user.verified,
    restricted,
    private: false,
  };
}

export default { toPrivateProfile, toPublicProfile, missingProfileFields, firstNameOf };
