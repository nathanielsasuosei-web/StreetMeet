/**
 * JWT authentication.
 *
 * `requireAuth` resolves the bearer token, loads the account and rejects it
 * when the stored `token_version` no longer matches the token (password change
 * or "log out everywhere") or when the account is deactivated.
 */
import { ApiError } from "../utils/apiError.js";
import { bearerFrom, verifyToken } from "../utils/jwt.js";
import * as users from "../repositories/userRepository.js";

async function resolve(req) {
  const token = bearerFrom(req.headers.authorization);
  if (!token) return null;

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw ApiError.unauthorized("Your session has expired. Please sign in again.", {
      code: "TOKEN_INVALID",
    });
  }

  const id = payload.sub || payload.userId;
  if (!id) throw ApiError.unauthorized("Malformed token.", { code: "TOKEN_INVALID" });

  const user = await users.findById(id);
  if (!user) {
    throw ApiError.unauthorized("That account no longer exists.", { code: "USER_NOT_FOUND" });
  }

  if (user.deactivatedAt) {
    throw new ApiError(403, "This account is deactivated.", { code: "ACCOUNT_DEACTIVATED" });
  }

  if (user.accountStatus === "SUSPENDED") {
    throw new ApiError(403, "This account is suspended. Contact support if you think this is a mistake.", {
      code: "ACCOUNT_SUSPENDED",
    });
  }

  if (user.accountStatus === "BANNED") {
    throw new ApiError(403, "This account has been banned for violating our community rules.", {
      code: "ACCOUNT_BANNED",
    });
  }

  if ((payload.tv ?? 0) !== user.tokenVersion) {
    throw ApiError.unauthorized("Your session was ended by a security change.", {
      code: "TOKEN_REVOKED",
    });
  }

  return user;
}

export function requireAuth(handler) {
  return async function (req, _res, next) {
    try {
      const user = await resolve(req);
      if (!user) throw ApiError.unauthorized();
      req.user = user;
      req.token = bearerFrom(req.headers.authorization);
      return handler ? handler(req) : next();
    } catch (error) {
      return next(error);
    }
  };
}

/** Attach req.user when a valid token is present, but never block the request. */
export function optionalAuth(handler) {
  return async function (req, _res, next) {
    try {
      req.user = await resolve(req);
    } catch {
      req.user = null;
    }
    return handler ? handler(req) : next();
  };
}

/** Route guard: `router.get("/me", requireAuth, controller)` */
export const authRequired = requireAuth();
export const authOptional = optionalAuth();

export function requireRole(...roles) {
  return function (req, _res, next) {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden("You do not have access to this resource."));
    }
    return next();
  };
}

export default requireAuth;
