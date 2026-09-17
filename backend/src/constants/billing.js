/**
 * Plan catalogue and perk matrix for module 3 (subscriptions).
 *
 * Prices are in Ghana cedis (display) and pesewas (Paystack's subunit).
 * The catalogue lives in code on purpose: plans are product decisions, not
 * per-deployment data, and keeping them here means the perk checks and the
 * API catalogue endpoint can never disagree.
 */

export const PLANS = [
  {
    value: "FREE",
    label: "Free",
    tagline: "Basic matching, forever.",
    priceGhs: 0,
    periodDays: 0,
    features: [
      "Swipe deck and matches",
      "20 likes per day",
      "Basic search (gender, age, location)",
      "Messaging with your matches",
    ],
  },
  {
    value: "PREMIUM",
    label: "Premium",
    tagline: "Serious about meeting someone.",
    priceGhs: 49,
    periodDays: 30,
    features: [
      "Unlimited likes",
      "Advanced filters (interests, goal, keywords)",
      "Read receipts on your messages",
      "Everything in Free",
    ],
  },
  {
    value: "VIP",
    label: "VIP",
    tagline: "Skip the queue, see everything.",
    priceGhs: 99,
    periodDays: 30,
    features: [
      "See who already liked you",
      "Priority placement in the deck",
      "VIP badge on your card",
      "Everything in Premium",
    ],
  },
];

export const PLAN_VALUES = PLANS.map((plan) => plan.value);
export const PAID_PLAN_VALUES = PLANS.filter((plan) => plan.priceGhs > 0).map(
  (plan) => plan.value,
);

export function planByValue(value) {
  return PLANS.find((plan) => plan.value === value) || null;
}

/** Perk matrix - the single source of truth for entitlement checks. */
export const PLAN_PERKS = {
  FREE: {
    unlimitedLikes: false,
    advancedFilters: false,
    readReceipts: false,
    likesYou: false,
    priorityDeck: false,
    badge: false,
  },
  PREMIUM: {
    unlimitedLikes: true,
    advancedFilters: true,
    readReceipts: true,
    likesYou: false,
    priorityDeck: false,
    badge: false,
  },
  VIP: {
    unlimitedLikes: true,
    advancedFilters: true,
    readReceipts: true,
    likesYou: true,
    priorityDeck: true,
    badge: true,
  },
};

export function perksFor(plan) {
  return PLAN_PERKS[plan] || PLAN_PERKS.FREE;
}

/** Free members get this many likes per rolling day (env-overridable). */
export const FREE_LIKE_LIMIT_PER_DAY = Math.max(
  1,
  Number.parseInt(process.env.BILLING_FREE_LIKE_LIMIT || "20", 10) || 20,
);

export const PAYMENT_CHANNELS = ["card", "mobile_money"];

export const MOMO_PROVIDERS = [
  { value: "mtn", label: "MTN Mobile Money" },
  { value: "telecel", label: "Telecel Cash" },
  { value: "at", label: "AT Money" },
];

export const SUBSCRIPTION_STATUSES = [
  "PENDING",
  "ACTIVE",
  "EXPIRED",
  "CANCELLED",
  "FAILED",
];
