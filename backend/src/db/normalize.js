/**
 * Row value helpers.
 *
 * The SQLite and PostgreSQL drivers return slightly different JS types for the
 * same logical column (SQLite has no boolean or timestamp type). Every row is
 * passed through these helpers in the repositories so the rest of the app only
 * ever sees plain primitives: `boolean`, `string | null`, `number | null`.
 */

/** SQLite stores booleans as 0/1, PostgreSQL as true/false. */
export function bool(value, fallback = false) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return ["1", "true", "t", "yes"].includes(String(value).toLowerCase());
}

/** Normalise any timestamp/date value to an ISO-8601 string (or null). */
export function iso(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text.endsWith("Z") || text.includes("+") ? text : `${text}Z`);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString();
}

/** Date-only normalisation, e.g. birth dates: always `YYYY-MM-DD`. */
export function dateOnly(value) {
  const asIso = iso(value);
  return asIso ? asIso.slice(0, 10) : null;
}

export function intOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function strOrNull(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

/**
 * JSON array columns: TEXT in SQLite, JSONB in PostgreSQL (already parsed).
 */
export function jsonList(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === "") return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function jsonEncode(value) {
  return JSON.stringify(Array.isArray(value) ? value : []);
}
