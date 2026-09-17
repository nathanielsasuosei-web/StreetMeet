import rateLimit from "express-rate-limit";

/** General API budget - generous enough that a SPA never hits it by accident. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please slow down.", code: "RATE_LIMITED" },
});

/** Credential endpoints: brute force protection. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Too many attempts. Please wait a few minutes and try again.",
    code: "RATE_LIMITED",
  },
});

/** Uploads are expensive (image decoding); keep them tighter. */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Photo limit reached for this hour. Try again later.",
    code: "RATE_LIMITED",
  },
});

export default apiLimiter;
