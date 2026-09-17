import { body } from "express-validator";

import { NAME_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "../constants/profile.js";
import { passwordProblem } from "../utils/hash.js";

export const registerRules = [
  body("fullName")
    .exists({ values: "null" })
    .withMessage("Enter your full name.")
    .bail()
    .trim()
    .isLength({ min: 2, max: NAME_MAX_LENGTH })
    .withMessage(`Your name must be between 2 and ${NAME_MAX_LENGTH} characters.`)
    .matches(/^[\p{L}][\p{L}\s'’.-]*$/u)
    .withMessage("Names can only contain letters, spaces, hyphens and apostrophes."),

  body("email")
    .exists({ values: "null" })
    .withMessage("Enter your email address.")
    .bail()
    .trim()
    .isEmail()
    .withMessage("That does not look like a valid email address.")
    .bail()
    .isLength({ max: 320 })
    .withMessage("That email address is too long.")
    .normalizeEmail(),

  body("password")
    .exists({ values: "null" })
    .withMessage("Choose a password.")
    .bail()
    .isLength({ min: PASSWORD_MIN_LENGTH, max: 128 })
    .withMessage(`Use at least ${PASSWORD_MIN_LENGTH} characters.`)
    .bail()
    .custom((value) => {
      const problem = passwordProblem(value);
      if (problem) throw new Error(problem);
      return true;
    }),

  body("confirmPassword")
    .optional({ values: "undefined" })
    .custom((value, { req }) => {
      if (value !== undefined && value !== req.body.password) {
        throw new Error("Passwords do not match.");
      }
      return true;
    }),

  body("acceptTerms")
    .optional({ values: "undefined" })
    .custom((value) => {
      if (value === false || value === "false") {
        throw new Error("You must accept the Terms and Privacy Policy.");
      }
      return true;
    }),
];

export const loginRules = [
  body("email")
    .exists({ values: "null" })
    .withMessage("Enter your email address.")
    .bail()
    .trim()
    .isLength({ min: 3, max: 320 })
    .withMessage("Enter your email address."),

  body("password")
    .exists({ values: "null" })
    .withMessage("Enter your password.")
    .bail()
    .isLength({ min: 1, max: 128 })
    .withMessage("Enter your password."),
];

export const reactivateRules = loginRules;

export default { registerRules, loginRules, reactivateRules };
