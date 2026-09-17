/**
 * account_settings - privacy, discovery and notification switches.
 */
import db from "../db/index.js";
import { MESSAGE_POLICY, PROFILE_VISIBILITY } from "../constants/profile.js";
import { toSettings } from "./mappers.js";

const BOOLEAN_COLUMNS = [
  "show_age",
  "show_location",
  "show_online_status",
  "discoverable",
  "email_notifications",
  "push_notifications",
  "match_notifications",
  "message_notifications",
  "product_updates",
  "two_factor_enabled",
];

const CAMEL_TO_COLUMN = {
  profileVisibility: "profile_visibility",
  allowMessagesFrom: "allow_messages_from",
  showAge: "show_age",
  showLocation: "show_location",
  showOnlineStatus: "show_online_status",
  discoverable: "discoverable",
  emailNotifications: "email_notifications",
  pushNotifications: "push_notifications",
  matchNotifications: "match_notifications",
  messageNotifications: "message_notifications",
  productUpdates: "product_updates",
  twoFactorEnabled: "two_factor_enabled",
};

export const DEFAULT_SETTINGS = {
  profile_visibility: "PUBLIC",
  show_age: true,
  show_location: true,
  show_online_status: true,
  discoverable: true,
  allow_messages_from: "MATCHES",
  email_notifications: true,
  push_notifications: true,
  match_notifications: true,
  message_notifications: true,
  product_updates: false,
  two_factor_enabled: false,
};

function storeBoolean(column, value) {
  if (typeof value !== "boolean") return value;
  return db.dialect === "postgresql" ? value : value ? 1 : 0;
}

export async function findSettings(userId, tx = db) {
  const row = await tx.get("SELECT * FROM account_settings WHERE user_id = ?", [userId]);
  return row ? toSettings(row) : null;
}

export async function findSettingsRow(userId, tx = db) {
  return tx.get("SELECT * FROM account_settings WHERE user_id = ?", [userId]);
}

/** Create the row with defaults - called inside the registration transaction. */
export async function ensureSettings(userId, tx = db) {
  const existing = await tx.get("SELECT user_id FROM account_settings WHERE user_id = ?", [userId]);
  if (existing) return findSettings(userId, tx);

  const data = {
    user_id: userId,
    ...DEFAULT_SETTINGS,
    updated_at: new Date().toISOString(),
  };
  for (const column of BOOLEAN_COLUMNS) data[column] = storeBoolean(column, data[column]);

  const columns = Object.keys(data);
  await tx.run(
    `INSERT INTO account_settings (${columns.join(", ")}) VALUES (${columns
      .map(() => "?")
      .join(", ")})`,
    columns.map((column) => data[column])
  );

  return findSettings(userId, tx);
}

export async function updateSettings(userId, fields, tx = db) {
  await ensureSettings(userId, tx);

  const changes = {};
  for (const [key, value] of Object.entries(fields)) {
    const column = CAMEL_TO_COLUMN[key];
    if (!column || value === undefined) continue;

    if (column === "profile_visibility" && !PROFILE_VISIBILITY.includes(value)) continue;
    if (column === "allow_messages_from" && !MESSAGE_POLICY.includes(value)) continue;

    changes[column] = BOOLEAN_COLUMNS.includes(column)
      ? storeBoolean(column, Boolean(value))
      : value;
  }

  if (Object.keys(changes).length === 0) return findSettings(userId, tx);

  const assignments = Object.keys(changes)
    .map((column) => `${column} = ?`)
    .concat("updated_at = ?");

  await tx.run(
    `UPDATE account_settings SET ${assignments.join(", ")} WHERE user_id = ?`,
    [...Object.values(changes), new Date().toISOString(), userId]
  );

  return findSettings(userId, tx);
}

export default {
  DEFAULT_SETTINGS,
  findSettings,
  findSettingsRow,
  ensureSettings,
  updateSettings,
};
