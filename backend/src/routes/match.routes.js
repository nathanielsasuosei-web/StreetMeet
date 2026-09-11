import express from "express";
import { listMatches, getMatch, unmatch } from "../controllers/matches.controller.js";

const router = express.Router();

router.get("/", listMatches);
router.get("/:id", getMatch);
router.delete("/:id", unmatch);

export default router;
