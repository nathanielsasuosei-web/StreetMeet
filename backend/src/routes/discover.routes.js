import express from "express";
import { getFeed, likeUser, passUser, getLikers, getBudget } from "../controllers/discover.controller.js";

const router = express.Router();

router.get("/feed", getFeed);
router.get("/likes/budget", getBudget);
router.get("/likes/received", getLikers);
router.post("/like/:id", likeUser);
router.post("/pass/:id", passUser);

export default router;
