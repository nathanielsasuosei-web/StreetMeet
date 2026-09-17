import express from "express";

import {
  changeEmail,
  changePassword,
  closeAccount,
  getSettings,
  logoutEverywhere,
  updateSettings,
} from "../controllers/settingsController.js";
import { authRequired } from "../middleware/authMiddleware.js";
import { authLimiter } from "../middleware/rateLimiters.js";
import { validate } from "../middleware/validate.js";
import {
  changeEmailRules,
  changePasswordRules,
  closeAccountRules,
  updateSettingsRules,
} from "../validators/settingsRules.js";

const router = express.Router();

router.get("/", authRequired, getSettings);
router.patch("/", authRequired, updateSettingsRules, validate, updateSettings);

router.patch("/email", authRequired, authLimiter, changeEmailRules, validate, changeEmail);
router.patch("/password", authRequired, authLimiter, changePasswordRules, validate, changePassword);

router.post("/logout-everywhere", authRequired, logoutEverywhere);
router.delete("/account", authRequired, authLimiter, closeAccountRules, validate, closeAccount);

export default router;
