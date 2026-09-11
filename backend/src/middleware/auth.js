import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { verifyToken } from "../utils/jwt.js";
import { unauthorized, forbidden } from "../utils/http.js";

function readToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  if (req.query?.token) return String(req.query.token);
  return null;
}

const sessionSelect = {
  id: users.id,
  email: users.email,
  fullName: users.fullName,
  role: users.role,
  banned: users.banned,
  premiumUntil: users.premiumUntil,
  likesToday: users.likesToday,
  likesResetAt: users.likesResetAt,
  onboarded: users.onboarded,
};

/** Verifies the JWT and attaches req.user (never the password hash). */
export async function authRequired(req, _res, next) {
  try {
    const token = readToken(req);
    if (!token) return next(unauthorized());

    const payload = verifyToken(token);
    const [user] = await db.select(sessionSelect).from(users).where(eq(users.id, payload.sub)).limit(1);

    if (!user) return next(unauthorized("Account no longer exists"));
    if (user.banned) return next(forbidden("This account has been suspended"));

    req.user = user;
    next();
  } catch (error) {
    next(unauthorized("Session expired, please log in again"));
  }
}

/** Optional auth: attaches req.user when a valid token is present. */
export async function authOptional(req, _res, next) {
  try {
    const token = readToken(req);
    if (!token) return next();
    const payload = verifyToken(token);
    const [user] = await db
      .select({ id: users.id, role: users.role, premiumUntil: users.premiumUntil, banned: users.banned })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);
    if (user && !user.banned) req.user = user;
    next();
  } catch {
    next();
  }
}

export const adminOnly = (req, _res, next) => {
  if (req.user?.role !== "ADMIN") return next(forbidden("Admins only"));
  next();
};

export const premiumOnly = (req, _res, next) => {
  const premium = req.user?.premiumUntil && new Date(req.user.premiumUntil).getTime() > Date.now();
  if (!premium) return next(forbidden("This feature needs an active natthesisa plan"));
  next();
};
