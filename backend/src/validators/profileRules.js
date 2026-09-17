import { body } from "express-validator";

import {
  AGE_LIMITS,
  BIO_MAX_LENGTH,
  GENDER_VALUES,
  INTERESTS_MAX,
  INTERESTS_MIN,
  INTEREST_SLUGS,
  NAME_MAX_LENGTH,
  RELATIONSHIP_GOAL_VALUES,
} from "../constants/profile.js";
import { normaliseBirthDate } from "../utils/age.js";

const optionalNullable = { values: "null" };

export const fullNameRule = body("fullName")
  .optional(optionalNullable)
  .trim()
  .isLength({ min: 2, max: NAME_MAX_LENGTH })
  .withMessage(`Name must be between 2 and ${NAME_MAX_LENGTH} characters.`);

export const genderRule = body("gender")
  .optional(optionalNullable)
  .isIn(GENDER_VALUES)
  .withMessage(`Gender must be one of: ${GENDER_VALUES.join(", ")}.`);

export const birthDateRule = body("birthDate")
  .optional(optionalNullable)
  .custom((value) => {
    if (value === null || value === "") return true;
    const result = normaliseBirthDate(value);
    if (result.error) throw new Error(result.error);
    return true;
  });

export const bioRule = body("bio")
  .optional(optionalNullable)
  .trim()
  .isLength({ max: BIO_MAX_LENGTH })
  .withMessage(`Bio must be ${BIO_MAX_LENGTH} characters or fewer.`);

export const cityRule = body("city")
  .optional(optionalNullable)
  .trim()
  .isLength({ max: 80 })
  .withMessage("City must be 80 characters or fewer.");

export const countryRule = body("country")
  .optional(optionalNullable)
  .trim()
  .isLength({ max: 80 })
  .withMessage("Country must be 80 characters or fewer.");

export const phoneRule = body("phoneNumber")
  .optional(optionalNullable)
  .trim()
  .matches(/^\+?[0-9\s()-]{7,20}$/)
  .withMessage("Enter a valid phone number (digits, spaces, + only).");

export const interestsRule = body("interests")
  .optional(optionalNullable)
  .isArray({ min: INTERESTS_MIN, max: INTERESTS_MAX })
  .withMessage(`Choose between ${INTERESTS_MIN} and ${INTERESTS_MAX} interests.`)
  .bail()
  .custom((value) => {
    const unknown = value.filter((slug) => !INTEREST_SLUGS.includes(String(slug)));
    if (unknown.length) throw new Error(`Unknown interest(s): ${unknown.join(", ")}.`);
    return true;
  });

export const updateProfileRules = [
  fullNameRule,
  genderRule,
  birthDateRule,
  bioRule,
  cityRule,
  countryRule,
  phoneRule,
  interestsRule,
  body("preferences").optional(optionalNullable).isObject().withMessage("Preferences must be an object."),
];

/** The sign-up wizard: everything except the photo (uploaded separately). */
export const onboardRules = [
  genderRule.optional({ values: "undefined" }).notEmpty().withMessage("Select your gender."),
  birthDateRule.optional({ values: "undefined" }).notEmpty().withMessage("Enter your birth date."),
  cityRule.optional({ values: "undefined" }).notEmpty().withMessage("Where are you based?"),
  bioRule,
  countryRule,
  fullNameRule,
  interestsRule.optional({ values: "undefined" })
    .isArray({ min: INTERESTS_MIN })
    .withMessage(`Pick at least ${INTERESTS_MIN} interests.`),
  ...preferenceRules(),
];

export function preferenceRules() {
  return [
    body("preferences").optional(optionalNullable).isObject().withMessage("Preferences must be an object."),

    body("interestedIn")
      .optional(optionalNullable)
      .isArray({ min: 1 })
      .withMessage("Select at least one gender you want to meet.")
      .bail()
      .custom((value) => {
        const unknown = value.filter((item) => !GENDER_VALUES.includes(String(item).toUpperCase()));
        if (unknown.length) throw new Error(`Unknown gender option(s): ${unknown.join(", ")}.`);
        return true;
      }),

    body("minAge")
      .optional(optionalNullable)
      .isInt({ min: AGE_LIMITS.min, max: AGE_LIMITS.max })
      .withMessage(`Minimum age must be between ${AGE_LIMITS.min} and ${AGE_LIMITS.max}.`),

    body("maxAge")
      .optional(optionalNullable)
      .isInt({ min: AGE_LIMITS.min, max: AGE_LIMITS.max })
      .withMessage(`Maximum age must be between ${AGE_LIMITS.min} and ${AGE_LIMITS.max}.`),

    body("maxDistanceKm")
      .optional(optionalNullable)
      .isInt({ min: 1, max: 1000 })
      .withMessage("Distance must be between 1 and 1000 km (or empty for anywhere)."),

    body("relationshipGoal")
      .optional(optionalNullable)
      .isIn(RELATIONSHIP_GOAL_VALUES)
      .withMessage(`Choose one of: ${RELATIONSHIP_GOAL_VALUES.join(", ")}.`),

    body("openToNearby").optional(optionalNullable).isBoolean().withMessage("openToNearby must be true or false."),
  ];
}

export const preferencesRules = preferenceRules();

export default { updateProfileRules, onboardRules, preferencesRules };
