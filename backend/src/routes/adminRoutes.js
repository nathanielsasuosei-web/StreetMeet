/**
 * /api/admin - admin control panel routes (module 4).
 * Replaces the legacy stub that imported a controller which no longer existed.
 */
import express from "express";

import {
  banMember,
  changeMemberRole,
  createAnnouncement,
  createInterest,
  deleteInterest,
  featureMember,
  getMember,
  getStats,
  listAnnouncements,
  listInterests,
  listMembers,
  listReports,
  listSubscriptions,
  reinstateMember,
  resolveReport,
  suspendMember,
  terminateSubscription,
  updateInterest,
  verifyMember,
} from "../controllers/adminController.js";
import { authRequired, requireRole } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  announcementRules,
  featuredRules,
  idParamRules,
  interestCreateRules,
  interestUpdateRules,
  ledgerQueryRules,
  memberQueryRules,
  moderationNoteRules,
  reportQueryRules,
  resolveReportRules,
  roleRules,
  slugParamRules,
  verifiedRules,
} from "../validators/adminRules.js";

const router = express.Router();

router.use(authRequired, requireRole("ADMIN", "MODERATOR"));

/* overview */
router.get("/stats", getStats);

/* members */
router.get("/users", memberQueryRules, validate, listMembers);
router.get("/users/:id", idParamRules, validate, getMember);
router.post("/users/:id/suspend", idParamRules, moderationNoteRules, validate, suspendMember);
router.post("/users/:id/ban", idParamRules, moderationNoteRules, validate, banMember);
router.post("/users/:id/reinstate", idParamRules, validate, reinstateMember);
router.post("/users/:id/verify", idParamRules, verifiedRules, validate, verifyMember);
router.post("/users/:id/feature", idParamRules, featuredRules, validate, featureMember);
router.post("/users/:id/role", idParamRules, roleRules, validate, changeMemberRole);

/* reports */
router.get("/reports", reportQueryRules, validate, listReports);
router.post("/reports/:id/resolve", idParamRules, resolveReportRules, validate, resolveReport);

/* subscriptions / payments */
router.get("/subscriptions", ledgerQueryRules, validate, listSubscriptions);
router.post("/subscriptions/:id/terminate", idParamRules, validate, terminateSubscription);

/* interest catalogue */
router.get("/interests", listInterests);
router.post("/interests", interestCreateRules, validate, createInterest);
router.patch("/interests/:slug", slugParamRules, interestUpdateRules, validate, updateInterest);
router.delete("/interests/:slug", slugParamRules, validate, deleteInterest);

/* announcements */
router.get("/announcements", listAnnouncements);
router.post("/announcements", announcementRules, validate, createAnnouncement);

export default router;
