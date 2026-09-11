import express from "express";
import {
  createStatus,
  getFeed,
  getMyStatuses,
  viewStatus,
  getViewers,
  deleteStatus,
} from "../controllers/status.controller.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

router.get("/feed", getFeed);
router.get("/mine", getMyStatuses);
router.post("/", upload.single("media"), createStatus);
router.post("/:id/view", viewStatus);
router.get("/:id/viewers", getViewers);
router.delete("/:id", deleteStatus);

export default router;
