/**
 * Blocks and reports.
 *
 * Blocking is immediate and total: the block row goes in, any match between
 * the two (and with it the whole thread) is deleted, and swipes in both
 * directions are dropped - all in one transaction. Neither side sees the
 * other in discovery while the block exists. Reports are stored for
 * moderators; the reported member is never notified.
 */
import db from "../db/index.js";
import * as matchRepository from "../repositories/matchRepository.js";
import * as moderationRepository from "../repositories/moderationRepository.js";
import { listInterestsForMany } from "../repositories/profileRepository.js";
import * as swipeRepository from "../repositories/swipeRepository.js";
import * as userRepository from "../repositories/userRepository.js";
import { ApiError } from "../utils/apiError.js";
import { toDiscoverCard } from "../utils/serialize.js";

async function requireOther(userId, targetId, message = "That member was not found.") {
  if (targetId === userId) throw ApiError.badRequest("You cannot do this to yourself.");
  const target = await userRepository.findById(targetId);
  if (!target) throw ApiError.notFound(message);
  return target;
}

export async function block(userId, targetId) {
  await requireOther(userId, targetId);

  await db.transaction(async (tx) => {
    if (!(await moderationRepository.findBlock(userId, targetId, tx))) {
      await moderationRepository.createBlock(userId, targetId, tx);
    }
    const match = await matchRepository.findMatchBetween(userId, targetId, tx);
    if (match) await matchRepository.deleteMatch(match.id, tx);
    await swipeRepository.deleteLikesBetween(userId, targetId, tx);
  });

  return { blocked: true };
}

export async function unblock(userId, targetId) {
  await requireOther(userId, targetId);
  await moderationRepository.removeBlock(userId, targetId);
  return { blocked: false };
}

/** Everyone I have blocked, newest first. */
export async function listBlocked(userId) {
  const rows = await moderationRepository.listBlocksFor(userId);
  const interests = await listInterestsForMany(rows.map((row) => row.id));
  return {
    items: rows.map((row) => ({
      blockedAt: row.blocked_at,
      profile: toDiscoverCard({ row, interests: interests.get(row.id) ?? [] }),
    })),
  };
}

export async function report(userId, targetId, { reason, details = null }) {
  await requireOther(userId, targetId, "That member was not found.");
  const record = await moderationRepository.createReport({
    reporterId: userId,
    reportedId: targetId,
    reason,
    details: details?.trim() ? details.trim() : null,
  });
  return { id: record.id, status: record.status };
}
