import express from "express";

import {
  catalogue,
  deletePhoto,
  getMe,
  getPreferences,
  getPublic,
  onboard,
  updateMe,
  updatePreferences,
  uploadPhoto,
} from "../controllers/profileController.js";
import { authRequired } from "../middleware/authMiddleware.js";
import { uploadLimiter } from "../middleware/rateLimiters.js";
import { uploadProfilePhoto } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";
import {
  onboardRules,
  preferencesRules,
  updateProfileRules,
} from "../validators/profileRules.js";

const router = express.Router();

// Public: the interest/gender/goal catalogue used to render the pickers.
router.get("/catalogue", catalogue);

// Own profile
router.get("/me", authRequired, getMe);
router.patch("/me", authRequired, updateProfileRules, validate, updateMe);

// Sign-up wizard (one request writes gender, age, location, bio, interests,
// preferences). The photo is a separate multipart POST so it can be re-encoded.
router.post("/onboard", authRequired, onboardRules, validate, onboard);

// Dating preferences
router.get("/preferences", authRequired, getPreferences);
router.patch("/preferences", authRequired, preferencesRules, validate, updatePreferences);

// Profile photo
router.post("/photo", authRequired, uploadLimiter, uploadProfilePhoto, uploadPhoto);
router.delete("/photo", authRequired, deletePhoto);

// Another member's profile (privacy-filtered) - keep last so it never shadows
// the literal paths above.
router.get("/:id", authRequired, getPublic);

export default router;
