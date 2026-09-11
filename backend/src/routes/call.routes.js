import express from "express";
import { getIceConfig, startCall, endCall, callHistory, acceptCall, rejectCall } from "../controllers/calls.controller.js";

const router = express.Router();

router.get("/ice", getIceConfig);
router.get("/history", callHistory);
router.post("/start", startCall);
router.post("/:id/accept", acceptCall);
router.post("/:id/reject", rejectCall);
router.post("/:id/end", endCall);

export default router;
