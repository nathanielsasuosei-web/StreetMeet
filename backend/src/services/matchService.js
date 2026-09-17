/**
 * Matches and messaging.
 *
 * Every read/write goes through match membership: the thread only exists
 * between the two members of a match. On top of that, messaging respects
 * blocks (either direction) and the receiver's `allowMessagesFrom` policy.
 */
import db, { bool, iso } from "../db/index.js";
import * as matchRepository from "../repositories/matchRepository.js";
import * as moderationRepository from "../repositories/moderationRepository.js";
import * as notificationRepository from "../repositories/notificationRepository.js";
import { listInterestsForMany } from "../repositories/profileRepository.js";
import * as settingsRepository from "../repositories/settingsRepository.js";
import * as planService from "./planService.js";
import { ApiError } from "../utils/apiError.js";
import { toDiscoverCard } from "../utils/serialize.js";

const MESSAGE_MAX = 1000;

async function requireMembership(userId, matchId) {
  const match = await matchRepository.findMatchById(matchId);
  if (!match) throw ApiError.notFound("Match not found.");
  const mine = match.user_one_id === userId || match.user_two_id === userId;
  if (!mine) throw ApiError.notFound("Match not found.");
  return {
    match,
    partnerId: match.user_one_id === userId ? match.user_two_id : match.user_one_id,
  };
}

function toMessage(row, readerId, { readReceipts = false } = {}) {
  return {
    id: row.id,
    matchId: row.match_id,
    mine: row.sender_id === readerId,
    content: row.content,
    // "seen" is a Premium perk: free members send/read without receipts
    seen: readReceipts ? bool(row.seen) : null,
    createdAt: iso(row.created_at),
  };
}

/** My matches, newest first, with partner card, last message and unread count. */
export async function listMatches(userId) {
  const rows = await matchRepository.listMatchesFor(userId);
  if (!rows.length) return { items: [] };

  const matchIds = rows.map((row) => row.id);
  const [lastMessages, unread, interests] = await Promise.all([
    matchRepository.lastMessagesFor(matchIds),
    matchRepository.unreadCountsFor(userId, matchIds),
    listInterestsForMany(rows.map((row) => row.partner_id)),
  ]);

  const items = rows.map((row) => {
    const last = lastMessages.get(row.id);
    return {
      id: row.id,
      createdAt: iso(row.created_at),
      partner: toDiscoverCard({
        row: {
          id: row.partner_id,
          full_name: row.partner_name,
          gender: row.partner_gender,
          birth_date: row.partner_birth_date,
          bio: row.partner_bio,
          city: row.partner_city,
          country: row.partner_country,
          profile_image: row.partner_image,
          show_age: row.partner_show_age,
          show_location: row.partner_show_location,
          relationship_goal: null,
        },
        interests: interests.get(row.partner_id) ?? [],
      }),
      lastMessage: last ? toMessage(last, userId) : null,
      unread: unread.get(row.id) ?? 0,
    };
  });

  return { items };
}

/** One match with its partner card (for the conversation header). */
export async function getMatch(userId, matchId) {
  const { partnerId } = await requireMembership(userId, matchId);
  const row = await matchRepository.partnerRowFor(matchId, userId);
  if (!row) throw ApiError.notFound("Match not found.");
  const interests = await listInterestsForMany([partnerId]);
  return {
    id: matchId,
    partner: toDiscoverCard({ row, interests: interests.get(partnerId) ?? [] }),
  };
}

/** Thread history, oldest -> newest, paginated backwards via `before`. */
export async function getThread(userId, matchId, { before = null, limit = 50 } = {}) {
  await requireMembership(userId, matchId);
  const { perks } = await planService.currentPlan(userId);
  const rows = await matchRepository.listThread(matchId, { before, limit });
  return {
    items: rows.map((row) => toMessage(row, userId, { readReceipts: perks.readReceipts })),
    hasMore: rows.length === limit,
    readReceipts: perks.readReceipts,
  };
}

/** Send a message into a match; notifies the receiver (their settings rule). */
export async function sendMessage(userId, matchId, content) {
  const text = String(content ?? "").trim();
  if (!text) throw ApiError.badRequest("Message is empty.");
  if (text.length > MESSAGE_MAX) {
    throw ApiError.badRequest(`Messages are limited to ${MESSAGE_MAX} characters.`);
  }

  const { partnerId } = await requireMembership(userId, matchId);

  if (await moderationRepository.anyBlockBetween(userId, partnerId)) {
    throw ApiError.forbidden("This conversation is unavailable.", { code: "BLOCKED" });
  }
  const partnerSettings = await settingsRepository.findSettings(partnerId);
  if (partnerSettings?.allowMessagesFrom === "NOBODY") {
    throw ApiError.forbidden("This member is not accepting messages right now.", {
      code: "MESSAGES_DISABLED",
    });
  }

  const { perks } = await planService.currentPlan(userId);
  const message = await db.transaction(async (tx) => {
    const row = await matchRepository.insertMessage(
      { matchId, senderId: userId, receiverId: partnerId, content: text },
      tx,
    );
    if (partnerSettings?.messageNotifications !== false) {
      await notificationRepository.createNotification(
        {
          userId: partnerId,
          type: "MESSAGE",
          actorId: userId,
          matchId,
          payload: { preview: text.slice(0, 80) },
        },
        tx,
      );
    }
    return row;
  });

  return toMessage(
    { ...message, sender_id: message.senderId, match_id: matchId },
    userId,
    { readReceipts: perks.readReceipts },
  );
}

/** Mark everything my partner sent in this thread as read. */
export async function markRead(userId, matchId) {
  await requireMembership(userId, matchId);
  const changed = await matchRepository.markThreadRead(matchId, userId);
  return { markedRead: changed };
}

/** Unmatch: closes the match and cascades the thread for both sides. */
export async function unmatch(userId, matchId) {
  await requireMembership(userId, matchId);
  await matchRepository.deleteMatch(matchId);
  return { unmatched: true };
}
