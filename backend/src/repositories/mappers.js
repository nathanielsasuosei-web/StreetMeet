/**
 * Row -> camelCase mappers for the 1:1 profile tables.
 *
 * Kept next to the repositories (not in utils/serialize.js) because they know
 * about columns; serialize.js only knows about domain objects.
 */
import { bool, intOrNull, iso, jsonList, strOrNull } from "../db/normalize.js";

export function toPreferences(row) {
  if (!row) return null;

  return {
    interestedIn: jsonList(row.interested_in),
    minAge: intOrNull(row.min_age) ?? 18,
    maxAge: intOrNull(row.max_age) ?? 45,
    maxDistanceKm: intOrNull(row.max_distance_km),
    relationshipGoal: strOrNull(row.relationship_goal),
    openToNearby: bool(row.open_to_nearby, true),
    updatedAt: iso(row.updated_at),
  };
}

export function toSettings(row) {
  if (!row) return null;

  return {
    profileVisibility: strOrNull(row.profile_visibility) || "PUBLIC",
    showAge: bool(row.show_age, true),
    showLocation: bool(row.show_location, true),
    showOnlineStatus: bool(row.show_online_status, true),
    discoverable: bool(row.discoverable, true),
    allowMessagesFrom: strOrNull(row.allow_messages_from) || "MATCHES",
    emailNotifications: bool(row.email_notifications, true),
    pushNotifications: bool(row.push_notifications, true),
    matchNotifications: bool(row.match_notifications, true),
    messageNotifications: bool(row.message_notifications, true),
    productUpdates: bool(row.product_updates, false),
    twoFactorEnabled: bool(row.two_factor_enabled, false),
    updatedAt: iso(row.updated_at),
  };
}

export default { toPreferences, toSettings };
