import express from "express";
import {
  getProfile,
  getPublicProfile,
  updateProfile,
  removePhoto,
  blockUser,
  unblockUser,
  listBlocked,
  reportUser,
} from "../controllers/profile.controller.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

router.get("/me", getProfile);
router.patch("/me", upload.array("photos", 6), updateProfile);
router.delete("/me/photo", removePhoto);
router.get("/blocked", listBlocked);
router.post("/block/:id", blockUser);
router.delete("/block/:id", unblockUser);
router.post("/report/:id", reportUser);
router.get("/:id", getPublicProfile);

export default router;
