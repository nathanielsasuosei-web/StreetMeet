/**
 * /api/admin - the control panel API. Every route sits behind
 * `authRequired + requireRole("ADMIN", "MODERATOR")` in adminRoutes.js.
 */
import * as adminService from "../services/adminService.js";
import asyncHandler from "../utils/asyncHandler.js";

/* ── overview ────────────────────────────────────────────────────────────── */

export const getStats = asyncHandler(async (_req, res) => {
  const data = await adminService.stats();
  res.json({ success: true, data });
});

/* ── members ─────────────────────────────────────────────────────────────── */

export const listMembers = asyncHandler(async (req, res) => {
  const data = await adminService.members({
    q: req.query.q,
    status: req.query.status,
    role: req.query.role,
    verified: req.query.verified,
    page: req.query.page,
    limit: req.query.limit,
  });
  res.json({ success: true, data });
});

export const getMember = asyncHandler(async (req, res) => {
  const data = await adminService.memberDetail(req.params.id);
  res.json({ success: true, data });
});

export const suspendMember = asyncHandler(async (req, res) => {
  const data = await adminService.suspend(req.user, req.params.id, req.body.note);
  res.json({ success: true, message: "Account suspended.", data });
});

export const banMember = asyncHandler(async (req, res) => {
  const data = await adminService.ban(req.user, req.params.id, req.body.note);
  res.json({ success: true, message: "Account banned.", data });
});

export const reinstateMember = asyncHandler(async (req, res) => {
  const data = await adminService.reinstate(req.user, req.params.id);
  res.json({ success: true, message: "Account reinstated.", data });
});

export const verifyMember = asyncHandler(async (req, res) => {
  const data = await adminService.setVerified(req.user, req.params.id, req.body.verified);
  res.json({ success: true, message: data.verified ? "Profile verified." : "Verification removed.", data });
});

export const featureMember = asyncHandler(async (req, res) => {
  const data = await adminService.setFeatured(req.user, req.params.id, req.body.featured);
  res.json({ success: true, message: data.featuredAt ? "Profile featured." : "Feature removed.", data });
});

export const changeMemberRole = asyncHandler(async (req, res) => {
  const data = await adminService.changeRole(req.user, req.params.id, req.body.role);
  res.json({ success: true, message: `Role set to ${data.role}.`, data });
});

/* ── reports ─────────────────────────────────────────────────────────────── */

export const listReports = asyncHandler(async (req, res) => {
  const data = await adminService.reports({ status: req.query.status });
  res.json({ success: true, data: { items: data } });
});

export const resolveReport = asyncHandler(async (req, res) => {
  const data = await adminService.resolveReport(req.user, req.params.id, {
    resolution: req.body.resolution,
    note: req.body.note,
  });
  res.json({ success: true, message: "Report resolved.", data });
});

/* ── subscriptions / payments ────────────────────────────────────────────── */

export const listSubscriptions = asyncHandler(async (req, res) => {
  const data = await adminService.subscriptions({
    status: req.query.status,
    plan: req.query.plan,
    q: req.query.q,
    limit: req.query.limit,
  });
  res.json({ success: true, data: { items: data } });
});

export const terminateSubscription = asyncHandler(async (req, res) => {
  const data = await adminService.terminateSubscription(req.params.id);
  res.json({ success: true, message: "Subscription terminated.", data });
});

/* ── interests ───────────────────────────────────────────────────────────── */

export const listInterests = asyncHandler(async (_req, res) => {
  const data = await adminService.interests();
  res.json({ success: true, data: { items: data } });
});

export const createInterest = asyncHandler(async (req, res) => {
  const data = await adminService.createInterest({
    label: req.body.label,
    emoji: req.body.emoji,
    category: req.body.category,
    slug: req.body.slug,
  });
  res.status(201).json({ success: true, message: "Interest added.", data });
});

export const updateInterest = asyncHandler(async (req, res) => {
  const data = await adminService.updateInterest(req.params.slug, {
    label: req.body.label,
    emoji: req.body.emoji,
    category: req.body.category,
    active: req.body.active,
    sortOrder: req.body.sortOrder,
  });
  res.json({ success: true, message: "Interest updated.", data });
});

export const deleteInterest = asyncHandler(async (req, res) => {
  const data = await adminService.deleteInterest(req.params.slug);
  res.json({ success: true, message: "Interest deleted.", data });
});

/* ── announcements ───────────────────────────────────────────────────────── */

export const listAnnouncements = asyncHandler(async (_req, res) => {
  const data = await adminService.announcements();
  res.json({ success: true, data: { items: data } });
});

export const createAnnouncement = asyncHandler(async (req, res) => {
  const data = await adminService.announce(req.user, {
    title: req.body.title,
    body: req.body.body,
  });
  res.status(201).json({
    success: true,
    message: `Announcement sent to ${data.deliveredTo} member(s).`,
    data,
  });
});

export default {
  getStats,
  listMembers,
  getMember,
  suspendMember,
  banMember,
  reinstateMember,
  verifyMember,
  featureMember,
  changeMemberRole,
  listReports,
  resolveReport,
  listSubscriptions,
  terminateSubscription,
  listInterests,
  createInterest,
  updateInterest,
  deleteInterest,
  listAnnouncements,
  createAnnouncement,
};
