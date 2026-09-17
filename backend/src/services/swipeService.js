/**
 * Swipes: like / pass, and the mutual-like match.
 *
 * One transaction per swipe: store the decision, and when it is a LIKE that
 * answers an existing LIKE from the other side, create the match and notify
 * both members in the same commit - a match can never exist without both
 * likes, and neither can a match without its notifications.
 */
import db from "../db/index.js";
import * as matchRepository from "../repositories/matchRepository.js";
import * as moderationRepository from "../repositories/moderationRepository.js";
import * as notificationRepository from "../repositories/notificationRepository.js";
import * as settingsRepository from "../repositories/settingsRepository.js";
import * as swipeRepository from "../repositories/swipeRepository.js";
import * as userRepository from "../repositories/userRepository.js";
import * as planService from "./planService.js";
import { ApiError } from "../utils/apiError.js";

async function loadTarget(userId, targetId) {
  if (targetId === userId) {
    throw ApiError.badRequest("You cannot swipe on yourself.");
  }
  const target = await userRepository.findById(targetId);
  if (!target || target.deactivatedAt || !target.gender || !target.birthDate) {
    throw ApiError.notFound("That profile is not available.");
  }
  return target;
}

export async function swipe(userId, { targetId, decision }) {
  if (decision === "LIKE") {
    await planService.assertLikeAllowed(userId);
  }

  await loadTarget(userId, targetId);

  if (await swipeRepository.findSwipe(userId, targetId)) {
    throw ApiError.conflict("You already decided on this profile.");
  }
  if (await moderationRepository.anyBlockBetween(userId, targetId)) {
    throw ApiError.notFound("That profile is not available.");
  }
  if (await matchRepository.findMatchBetween(userId, targetId)) {
    throw ApiError.conflict("You are already matched with this member.");
  }

  const result = await db.transaction(async (tx) => {
    const record = await swipeRepository.recordSwipe(userId, targetId, decision, tx);

    if (decision === "PASS") {
      return { swipe: record, matched: false, match: null };
    }

    const reciprocal = await swipeRepository.findLikeFrom(targetId, userId, tx);
    if (!reciprocal) {
      // a quiet like: the other side gets a notification, no match yet
      await notificationRepository.createNotification(
        { userId: targetId, type: "LIKE", actorId: userId },
        tx,
      );
      return { swipe: record, matched: false, match: null };
    }

    const match = await matchRepository.createMatch(userId, targetId, tx);
    const [mySettings, theirSettings] = await Promise.all([
      settingsRepository.findSettings(userId, tx),
      settingsRepository.findSettings(targetId, tx),
    ]);
    if (mySettings?.matchNotifications !== false) {
      await notificationRepository.createNotification(
        { userId, type: "MATCH", actorId: targetId, matchId: match.id },
        tx,
      );
    }
    if (theirSettings?.matchNotifications !== false) {
      await notificationRepository.createNotification(
        { userId: targetId, type: "MATCH", actorId: userId, matchId: match.id },
        tx,
      );
    }
    return { swipe: record, matched: true, match };
  });

  return {
    decision: result.swipe.decision,
    createdAt: result.swipe.createdAt,
    matched: result.matched,
    match: result.match ? { id: result.match.id, createdAt: result.match.createdAt } : null,
  };
}
