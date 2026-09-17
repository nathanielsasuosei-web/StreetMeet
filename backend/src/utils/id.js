import crypto from "node:crypto";

/** Opaque, URL safe primary keys (replaces the old Prisma cuid()). */
export function newId() {
  return crypto.randomUUID();
}

export default newId;
