import rateLimit from "express-rate-limit";

const standardHeaders = "draft-7";

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, slow down" },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts, try again in 15 minutes" },
});

export const paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders,
  legacyHeaders: false,
  message: { success: false, message: "Too many payment attempts, try again shortly" },
});

export const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders,
  legacyHeaders: false,
  message: { success: false, message: "You are sending messages too fast" },
});
