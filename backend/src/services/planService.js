/**
 * Entitlements: which plan a member is on right now and what it unlocks.
 *
 * Every perk check in the codebase goes through here so the rules live in
 * one place (constants/billing.js holds the matrix itself).
 */
import {
  FREE_LIKE_LIMIT_PER_DAY,
  PLANS,
  perksFor,
} from "../constants/billing.js";
import * as subscriptionRepository from "../repositories/subscriptionRepository.js";
import * as swipeRepository from "../repositories/swipeRepository.js";
import { ApiError } from "../utils/apiError.js";

export async function currentSubscription(userId) {
  return subscriptionRepository.findCurrent(userId);
}

/** `{ plan, perks, subscription }` - plan is FREE when nothing is live. */
export async function currentPlan(userId) {
  const subscription = await subscriptionRepository.findCurrent(userId);
  const plan = subscription?.plan || "FREE";
  return { plan, perks: perksFor(plan), subscription };
}

export function upgradeError(perk) {
  const messages = {
    unlimitedLikes: "You have used today's free likes. Premium unlocks unlimited likes.",
    advancedFilters: "Advanced filters are a Premium feature.",
    readReceipts: "Read receipts are a Premium feature.",
    likesYou: "Seeing who liked you is a VIP feature.",
  };
  return new ApiError(402, messages[perk] || "That needs a paid plan.", {
    code: "PLAN_REQUIRED",
    details: { perk },
  });
}

/** Throws 402 PLAN_REQUIRED unless the member's plan includes `perk`. */
export async function requirePerk(userId, perk) {
  const { perks } = await currentPlan(userId);
  if (!perks[perk]) throw upgradeError(perk);
  return true;
}

/** Free-plan daily like budget; paid plans are unlimited. */
export async function assertLikeAllowed(userId) {
  const { plan, perks } = await currentPlan(userId);
  if (perks.unlimitedLikes) return { allowed: true, plan, remaining: null };

  const used = await swipeRepository.countLikesSince(userId, startOfToday());
  if (used >= FREE_LIKE_LIMIT_PER_DAY) {
    throw new ApiError(402, upgradeError("unlimitedLikes").message, {
      code: "LIKE_LIMIT_REACHED",
      details: { used, limit: FREE_LIKE_LIMIT_PER_DAY },
    });
  }
  return { allowed: true, plan, remaining: FREE_LIKE_LIMIT_PER_DAY - used };
}

function startOfToday(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/** Catalogue payload for the UI: plans, perks and the member's state. */
export async function catalogue(userId = null) {
  const current = userId ? await currentPlan(userId) : { plan: "FREE", perks: perksFor("FREE"), subscription: null };
  return {
    plans: planList(),
    plan: current.plan,
    perks: current.perks,
    subscription: current.subscription
      ? {
          id: current.subscription.id,
          plan: current.subscription.plan,
          status: current.subscription.status,
          startedAt: current.subscription.startedAt,
          expiresAt: current.subscription.expiresAt,
        }
      : null,
    limits: { freeLikesPerDay: FREE_LIKE_LIMIT_PER_DAY },
  };
}

export function planList() {
  return PLANS;
}
