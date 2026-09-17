/**
 * Admin control panel: member directory, moderation (suspend/ban/verify/
 * feature/role), report review, the subscription & payment ledger, interest
 * catalogue management, announcements and platform statistics.
 */
import { ApiError } from "../utils/apiError.js";
import * as adminRepo from "../repositories/adminRepository.js";
import { createNotification } from "../repositories/notificationRepository.js";
import * as interestService from "./interestService.js";
import { ROLES } from "../constants/profile.js";

const REPORT_RESOLUTIONS = ["DISMISSED", "WARNED", "SUSPENDED", "BANNED"];

function slugify(label) {
  return String(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/* ── overview ────────────────────────────────────────────────────────────── */

export async function stats() {
  return adminRepo.platformStats();
}

/* ── members ─────────────────────────────────────────────────────────────── */

export async function members(query) {
  return adminRepo.listMembers(query);
}

async function requireManageable(id, admin) {
  const member = await adminRepo.findMember(id);
  if (!member) throw ApiError.notFound("Member not found.");
  if (member.role === "ADMIN" && member.id !== admin.id) {
    throw ApiError.forbidden("Another admin's account cannot be moderated.");
  }
  return member;
}

export async function memberDetail(id) {
  const member = await adminRepo.findMember(id);
  if (!member) throw ApiError.notFound("Member not found.");
  const [subscriptions, reports] = await Promise.all([
    adminRepo.listSubscriptions({ q: member.email, limit: 20 }),
    adminRepo.listReports({ userId: id, limit: 20 }),
  ]);
  return { ...member, subscriptions, reports };
}

export async function suspend(admin, id, note) {
  await requireManageable(id, admin);
  await adminRepo.setAccountStatus(id, "SUSPENDED", { note: note ?? null });
  return adminRepo.findMember(id);
}

export async function ban(admin, id, note) {
  await requireManageable(id, admin);
  await adminRepo.setAccountStatus(id, "BANNED", { note: note ?? null });
  return adminRepo.findMember(id);
}

export async function reinstate(admin, id) {
  await requireManageable(id, admin);
  await adminRepo.setAccountStatus(id, "OK", { note: null });
  return adminRepo.findMember(id);
}

export async function setVerified(admin, id, verified) {
  await requireManageable(id, admin);
  await adminRepo.setVerified(id, Boolean(verified));
  return adminRepo.findMember(id);
}

export async function setFeatured(admin, id, featured) {
  await requireManageable(id, admin);
  await adminRepo.setFeatured(id, Boolean(featured));
  return adminRepo.findMember(id);
}

export async function changeRole(admin, id, role) {
  if (id === admin.id) {
    throw ApiError.unprocessable("You cannot change your own role.");
  }
  await requireManageable(id, admin);
  if (!ROLES.includes(role)) throw ApiError.unprocessable("Unknown role.");
  await adminRepo.setRole(id, role);
  return adminRepo.findMember(id);
}

/* ── reports ─────────────────────────────────────────────────────────────── */

export async function reports({ status } = {}) {
  return adminRepo.listReports({ status });
}

export async function resolveReport(admin, id, { resolution, note }) {
  const outcome = String(resolution || "").toUpperCase();
  if (!REPORT_RESOLUTIONS.includes(outcome)) {
    throw ApiError.unprocessable(`Resolution must be one of: ${REPORT_RESOLUTIONS.join(", ")}.`);
  }
  const report = await adminRepo.findReport(id);
  if (!report) throw ApiError.notFound("Report not found.");
  if (report.status === "RESOLVED") throw ApiError.conflict("That report is already resolved.");

  if (outcome === "SUSPENDED" || outcome === "BANNED") {
    const target = await adminRepo.findMember(report.target.id);
    if (target && target.role !== "ADMIN") {
      await adminRepo.setAccountStatus(report.target.id, outcome, {
        note: note ?? `Report ${report.id}: ${report.reason}`,
      });
    }
  }

  await adminRepo.resolveReport(id, { resolution: outcome, note, adminId: admin.id });
  return adminRepo.findReport(id);
}

/* ── subscriptions / payments ────────────────────────────────────────────── */

export async function subscriptions(query) {
  return adminRepo.listSubscriptions(query);
}

export async function terminateSubscription(id) {
  const row = await adminRepo.findSubscription(id);
  if (!row) throw ApiError.notFound("Subscription not found.");
  if (row.status !== "ACTIVE") {
    throw ApiError.conflict("Only an active subscription can be terminated.");
  }
  await adminRepo.terminateSubscription(id);
  return adminRepo.findSubscription(id);
}

/* ── interests ───────────────────────────────────────────────────────────── */

export async function interests() {
  await interestService.ensureMaterialised();
  return adminRepo.listInterests({ includeInactive: true });
}

export async function createInterest({ label, emoji, category, slug }) {
  await interestService.ensureMaterialised();
  const finalSlug = slug ? slugify(slug) : slugify(label);
  if (!finalSlug) throw ApiError.unprocessable("Could not build a slug from that label.");
  if (await adminRepo.findInterest(finalSlug)) {
    throw ApiError.conflict("That interest already exists.");
  }
  const created = await adminRepo.createInterest({ slug: finalSlug, label, emoji, category });
  interestService.invalidate();
  return created;
}

export async function updateInterest(slug, patch) {
  const existing = await adminRepo.findInterest(slug);
  if (!existing) throw ApiError.notFound("Interest not found.");
  const updated = await adminRepo.updateInterest(slug, patch);
  interestService.invalidate();
  return updated;
}

export async function deleteInterest(slug) {
  const existing = await adminRepo.findInterest(slug);
  if (!existing) throw ApiError.notFound("Interest not found.");
  const usage = await adminRepo.interestUsage(slug);
  if (usage > 0) {
    throw ApiError.conflict(
      `"${existing.label}" is on ${usage} profile(s). Deactivate it instead of deleting.`,
    );
  }
  await adminRepo.deleteInterest(slug);
  interestService.invalidate();
  return { deleted: slug };
}

/* ── announcements ───────────────────────────────────────────────────────── */

export async function announcements() {
  return adminRepo.listAnnouncements();
}

export async function announce(admin, { title, body }) {
  const announcement = await adminRepo.createAnnouncement({ title, body, adminId: admin.id });
  const recipients = await adminRepo.broadcastRecipients();
  for (const userId of recipients) {
    await createNotification({
      userId,
      type: "ANNOUNCEMENT",
      actorId: admin.id,
      payload: { title, body: body.length > 140 ? `${body.slice(0, 137)}…` : body },
    });
  }
  return { ...announcement, deliveredTo: recipients.length };
}

export default {
  stats,
  members,
  memberDetail,
  suspend,
  ban,
  reinstate,
  setVerified,
  setFeatured,
  changeRole,
  reports,
  resolveReport,
  subscriptions,
  terminateSubscription,
  interests,
  createInterest,
  updateInterest,
  deleteInterest,
  announcements,
  announce,
};
