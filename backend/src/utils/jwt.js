import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

/**
 * Access tokens carry the user id and the account's `tokenVersion`.
 *
 * Bumping `token_version` in the database instantly invalidates every token
 * already issued for that account - that is how "change password" and "log out
 * of all devices" work without a server-side session table.
 */
export function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      // kept for backwards compatibility with older middleware
      userId: user.id,
      tv: user.tokenVersion ?? 0,
      role: user.role ?? "USER",
    },
    env.auth.jwtSecret,
    { expiresIn: env.auth.jwtExpiresIn, issuer: "streetmeet-api" }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, env.auth.jwtSecret, { issuer: "streetmeet-api" });
}

/** Extract a bearer token from an Authorization header. */
export function bearerFrom(headerValue) {
  if (!headerValue) return null;
  const [scheme, token] = String(headerValue).split(" ");
  if (!token || scheme.toLowerCase() !== "bearer") return null;
  return token.trim();
}

export default createToken;
