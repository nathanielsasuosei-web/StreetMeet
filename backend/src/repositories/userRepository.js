/**
 * users table.
 */
import db, { bool, dateOnly, intOrNull, iso, strOrNull } from "../db/index.js";
import { buildUpdate } from "../db/sqlBuilder.js";

/** camelCase field -> column, the only fields callers are allowed to write. */
const WRITABLE = {
  id: "id",
  fullName: "full_name",
  email: "email",
  passwordHash: "password_hash",
  phoneNumber: "phone_number",
  gender: "gender",
  birthDate: "birth_date",
  bio: "bio",
  city: "city",
  country: "country",
  profileImage: "profile_image",
  coverImage: "cover_image",
  role: "role",
  verified: "verified",
  tokenVersion: "token_version",
  deactivatedAt: "deactivated_at",
  lastLoginAt: "last_login_at",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

function toColumns(fields) {
  const data = {};
  for (const [key, value] of Object.entries(fields)) {
    const column = WRITABLE[key];
    if (!column) throw new Error(`users: "${key}" is not a writable field`);
    data[column] = value === undefined ? null : value;
  }
  return data;
}

/** Row -> internal object (still snake-free, but NOT an API response). */
export function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    passwordHash: row.password_hash,
    phoneNumber: strOrNull(row.phone_number),
    gender: strOrNull(row.gender),
    birthDate: dateOnly(row.birth_date),
    bio: strOrNull(row.bio),
    city: strOrNull(row.city),
    country: strOrNull(row.country),
    profileImage: strOrNull(row.profile_image),
    coverImage: strOrNull(row.cover_image),
    role: row.role ?? "USER",
    verified: bool(row.verified),
    tokenVersion: intOrNull(row.token_version) ?? 0,
    accountStatus: row.account_status ?? "OK",
    moderationNote: strOrNull(row.moderation_note),
    moderatedAt: iso(row.moderated_at),
    featuredAt: iso(row.featured_at),
    deactivatedAt: iso(row.deactivated_at),
    lastLoginAt: iso(row.last_login_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    raw: row,
  };
}

export async function findById(id, tx = db) {
  const row = await tx.get("SELECT * FROM users WHERE id = ?", [id]);
  return mapUser(row);
}

export async function findByEmail(email, tx = db) {
  const row = await tx.get("SELECT * FROM users WHERE email = ?", [
    String(email || "").trim().toLowerCase(),
  ]);
  return mapUser(row);
}

export async function findByPhone(phoneNumber, tx = db) {
  const row = await tx.get("SELECT * FROM users WHERE phone_number = ?", [
    String(phoneNumber || "").trim(),
  ]);
  return mapUser(row);
}

export async function emailTaken(email, { exceptId } = {}) {
  const row = exceptId
    ? await db.get("SELECT id FROM users WHERE email = ? AND id <> ?", [
        String(email).trim().toLowerCase(),
        exceptId,
      ])
    : await db.get("SELECT id FROM users WHERE email = ?", [String(email).trim().toLowerCase()]);
  return Boolean(row);
}

export async function phoneTaken(phoneNumber, { exceptId } = {}) {
  const value = String(phoneNumber || "").trim();
  if (!value) return false;
  const row = exceptId
    ? await db.get("SELECT id FROM users WHERE phone_number = ? AND id <> ?", [value, exceptId])
    : await db.get("SELECT id FROM users WHERE phone_number = ?", [value]);
  return Boolean(row);
}

export async function create(fields, tx = db) {
  const data = toColumns(fields);
  const columns = Object.keys(data);
  const sql = `INSERT INTO users (${columns.join(", ")}) VALUES (${columns
    .map(() => "?")
    .join(", ")})`;

  await tx.run(sql, columns.map((column) => data[column]));
  return findById(data.id, tx);
}

export async function update(id, fields, tx = db) {
  const data = toColumns(fields);
  data.updated_at = new Date().toISOString();

  const built = buildUpdate("users", data, id);
  if (!built) return findById(id, tx);

  await tx.run(built.sql, built.params);
  return findById(id, tx);
}

export async function touchLogin(id) {
  await db.run("UPDATE users SET last_login_at = ? WHERE id = ?", [
    new Date().toISOString(),
    id,
  ]);
}

/** Invalidate every JWT already issued for this account. */
export async function bumpTokenVersion(id, tx = db) {
  await tx.run("UPDATE users SET token_version = token_version + 1, updated_at = ? WHERE id = ?", [
    new Date().toISOString(),
    id,
  ]);
  const user = await findById(id, tx);
  return user.tokenVersion;
}

export async function deactivate(id) {
  await db.run("UPDATE users SET deactivated_at = ?, updated_at = ? WHERE id = ?", [
    new Date().toISOString(),
    new Date().toISOString(),
    id,
  ]);
  return bumpTokenVersion(id);
}

export async function reactivate(id) {
  await db.run(
    "UPDATE users SET deactivated_at = NULL, last_login_at = ?, updated_at = ? WHERE id = ?",
    [new Date().toISOString(), new Date().toISOString(), id]
  );
  return findById(id);
}

/** Members visible in discovery - the accounts module owns the filters. */
export async function listDiscoverable({ limit = 20, offset = 0, city, gender, excludeId }) {
  const clauses = ["u.deactivated_at IS NULL", "s.discoverable = ?", "s.profile_visibility <> 'PRIVATE'"];
  const params = [db.dialect === "postgresql" ? true : 1];

  if (excludeId) {
    clauses.push("u.id <> ?");
    params.push(excludeId);
  }
  if (city) {
    clauses.push("LOWER(u.city) = LOWER(?)");
    params.push(city);
  }
  if (gender) {
    clauses.push("u.gender = ?");
    params.push(gender);
  }

  const rows = await db.all(
    `SELECT u.*, s.profile_visibility, s.show_age, s.show_location
       FROM users u
       JOIN account_settings s ON s.user_id = u.id
      WHERE ${clauses.join(" AND ")}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return rows;
}

export async function countAll() {
  const row = await db.get("SELECT COUNT(*) AS total FROM users WHERE deactivated_at IS NULL");
  return Number(row?.total ?? 0);
}

export default {
  findById,
  findByEmail,
  findByPhone,
  emailTaken,
  phoneTaken,
  create,
  update,
  touchLogin,
  bumpTokenVersion,
  deactivate,
  reactivate,
  listDiscoverable,
  countAll,
};
