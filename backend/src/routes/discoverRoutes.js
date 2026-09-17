import express from "express";

import { getDeck, likesYou, searchProfiles } from "../controllers/discoverController.js";
import { authRequired } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import { deckQueryRules, searchQueryRules } from "../validators/datingRules.js";

const router = express.Router();

router.get("/deck", authRequired, deckQueryRules, validate, getDeck);
router.get("/search", authRequired, searchQueryRules, validate, searchProfiles);
router.get("/likes-you", authRequired, likesYou);

export default router;
