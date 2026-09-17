/**
 * Catalogues and enums for the User Accounts module.
 *
 * These live in code (not the database) on purpose: they are part of the
 * product's vocabulary, they are shown in the UI, and they are validated on
 * both ends. Adding one is a one-line change here plus a redeploy.
 */

export const GENDERS = [
  { value: "WOMAN", label: "Woman" },
  { value: "MAN", label: "Man" },
  { value: "NON_BINARY", label: "Non-binary" },
  { value: "OTHER", label: "Other / prefer to say" },
];

export const GENDER_VALUES = GENDERS.map((gender) => gender.value);

export const RELATIONSHIP_GOALS = [
  { value: "CASUAL", label: "Something casual", hint: "Keep it light" },
  { value: "DATING", label: "Dating", hint: "See where it goes" },
  { value: "SERIOUS", label: "A relationship", hint: "Looking for something real" },
  { value: "MARRIAGE", label: "Marriage", hint: "Long term, all the way" },
  { value: "FRIENDSHIP", label: "New friends", hint: "Platonic connections" },
];

export const RELATIONSHIP_GOAL_VALUES = RELATIONSHIP_GOALS.map((goal) => goal.value);

export const PROFILE_VISIBILITY = ["PUBLIC", "MATCHES_ONLY", "PRIVATE"];
export const MESSAGE_POLICY = ["EVERYONE", "MATCHES", "NOBODY"];
export const ROLES = ["USER", "MODERATOR", "ADMIN"];

export const AGE_LIMITS = { min: 18, max: 99, defaultMin: 18, defaultMax: 45 };
export const DISTANCE_STEPS_KM = [5, 10, 25, 50, 100, 250];
export const BIO_MAX_LENGTH = 500;
export const INTERESTS_MIN = 3;
export const INTERESTS_MAX = 10;
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 120;
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Curated interest catalogue. `slug` is what gets stored, `label`/`emoji` are
 * what the UI renders, `category` groups the picker.
 */
export const INTERESTS = [
  { slug: "music", label: "Music", emoji: "🎧", category: "Creative" },
  { slug: "live-music", label: "Live music", emoji: "🎤", category: "Creative" },
  { slug: "dancing", label: "Dancing", emoji: "💃", category: "Active" },
  { slug: "photography", label: "Photography", emoji: "📸", category: "Creative" },
  { slug: "art", label: "Art & design", emoji: "🎨", category: "Creative" },
  { slug: "writing", label: "Writing", emoji: "✍️", category: "Creative" },
  { slug: "cooking", label: "Cooking", emoji: "🍳", category: "Food & drink" },
  { slug: "street-food", label: "Street food", emoji: "🍜", category: "Food & drink" },
  { slug: "coffee", label: "Coffee", emoji: "☕", category: "Food & drink" },
  { slug: "foodie", label: "Trying restaurants", emoji: "🍽️", category: "Food & drink" },
  { slug: "fitness", label: "Fitness", emoji: "💪", category: "Active" },
  { slug: "running", label: "Running", emoji: "🏃", category: "Active" },
  { slug: "football", label: "Football", emoji: "⚽", category: "Active" },
  { slug: "basketball", label: "Basketball", emoji: "🏀", category: "Active" },
  { slug: "swimming", label: "Swimming", emoji: "🏊", category: "Active" },
  { slug: "yoga", label: "Yoga", emoji: "🧘", category: "Active" },
  { slug: "hiking", label: "Hiking", emoji: "🥾", category: "Active" },
  { slug: "travel", label: "Travel", emoji: "✈️", category: "Adventure" },
  { slug: "road-trips", label: "Road trips", emoji: "🚗", category: "Adventure" },
  { slug: "beach", label: "Beach days", emoji: "🏖️", category: "Adventure" },
  { slug: "camping", label: "Camping", emoji: "⛺", category: "Adventure" },
  { slug: "movies", label: "Movies", emoji: "🎬", category: "Culture" },
  { slug: "series", label: "Series", emoji: "📺", category: "Culture" },
  { slug: "anime", label: "Anime", emoji: "🌸", category: "Culture" },
  { slug: "reading", label: "Reading", emoji: "📚", category: "Culture" },
  { slug: "podcasts", label: "Podcasts", emoji: "🎙️", category: "Culture" },
  { slug: "theatre", label: "Theatre", emoji: "🎭", category: "Culture" },
  { slug: "gaming", label: "Gaming", emoji: "🎮", category: "Geek" },
  { slug: "tech", label: "Tech", emoji: "💻", category: "Geek" },
  { slug: "startups", label: "Startups", emoji: "🚀", category: "Geek" },
  { slug: "science", label: "Science", emoji: "🔬", category: "Geek" },
  { slug: "board-games", label: "Board games", emoji: "🎲", category: "Geek" },
  { slug: "nightlife", label: "Nightlife", emoji: "🌃", category: "Social" },
  { slug: "brunch", label: "Brunch", emoji: "🥞", category: "Social" },
  { slug: "parties", label: "Parties", emoji: "🎉", category: "Social" },
  { slug: "volunteering", label: "Volunteering", emoji: "🤝", category: "Social" },
  { slug: "faith", label: "Faith", emoji: "🙏", category: "Social" },
  { slug: "family", label: "Family time", emoji: "👨‍👩‍👧", category: "Social" },
  { slug: "pets", label: "Pets", emoji: "🐕", category: "Chill" },
  { slug: "plants", label: "Plants", emoji: "🪴", category: "Chill" },
  { slug: "meditation", label: "Mindfulness", emoji: "🌿", category: "Chill" },
  { slug: "fashion", label: "Fashion", emoji: "🧥", category: "Creative" },
  { slug: "entrepreneurship", label: "Hustle", emoji: "💼", category: "Geek" },
  { slug: "cars", label: "Cars", emoji: "🏎️", category: "Adventure" },
];

export const INTEREST_SLUGS = INTERESTS.map((interest) => interest.slug);

export const INTEREST_CATEGORIES = [...new Set(INTERESTS.map((interest) => interest.category))];

export function interestLabel(slug) {
  return INTERESTS.find((interest) => interest.slug === slug)?.label ?? slug;
}

/** De-duplicate, validate and keep the catalogue order. */
export function normaliseInterests(input) {
  if (!Array.isArray(input)) return [];
  const clean = [
    ...new Set(
      input
        .map((value) => String(value ?? "").trim().toLowerCase())
        .filter((value) => INTEREST_SLUGS.includes(value))
    ),
  ];
  return INTEREST_SLUGS.filter((slug) => clean.includes(slug));
}

/** Interests shared by two people - used by discovery later on. */
export function sharedInterests(a = [], b = []) {
  const other = new Set(b);
  return a.filter((slug) => other.has(slug));
}

export const COUNTRIES = [
  "Ghana",
  "Nigeria",
  "Kenya",
  "South Africa",
  "United Kingdom",
  "United States",
  "Canada",
  "Germany",
  "France",
  "Other",
];
