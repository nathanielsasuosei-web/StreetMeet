import { body } from "express-validator";

import { MESSAGE_POLICY, PROFILE_VISIBILITY } from "../constants/profile.js";
import { passwordProblem } from "../utils/hash.js";

const BOOLEAN_SETTINGS = [
  "showAge",
  "showLocation",
  "showOnlineStatus",
  "discoverable",
  "emailNotifications",
  "pushNotifications",
  "matchNotifications",
  "messageNotifications",
  "productUpdates",
  "twoFactorEnabled",
];

export const updateSettingsRules = [
  body("profileVisibility")
    .optional({ values: "null" })
    .isIn(PROFILE_VISIBILITY)
    .withMessage(`Visibility must be one of: ${PROFILE_VISIBILITY.join(", ")}.`),

  body("allowMessagesFrom")
    .optional({ values: "null" })
    .isIn(MESSAGE_POLICY)
    .withMessage(`Message policy must be one of: ${MESSAGE_POLICY.join(", ")}.`),

  ...BOOLEAN_SETTINGS.map((field) =>
    body(field).optional({ values: "undefined" }).isBoolean().withMessage(`${field} must be true or false.`)
  ),
];

export const changeEmailRules = [
  body("email")
    .exists({ values: "null" })
    .withMessage("Enter the new email address.")
    .bail()
    .trim()
    .isEmail()
    .withMessage("That does not look like a valid email address.")
    .normalizeEmail(),

  body("password")
    .exists({ values: "null" })
    .withMessage("Confirm your password.")
    .bail()
    .isLength({ min: 1, max: 128 })
    .withMessage("Confirm your password."),
];

export const changePasswordRules = [
  body("currentPassword")
    .exists({ values: "null" })
    .withMessage("Enter your current password.")
    .bail()
    .isLength({ min: 1, max: 128 })
    .withMessage("Enter your current password."),

  body("newPassword")
    .exists({ values: "null" })
    .withMessage("Enter a new password.")
    .bail()
    .custom((value) => {
      const problem = passwordProblem(value);
      if (problem) throw new Error(problem);
      return true;
    }),

  body("confirmPassword")
    .optional({ values: "undefined" })
    .custom((value, { req }) => {
      if (value !== undefined && value !== req.body.newPassword) {
        throw new Error("Passwords do not match.");
      }
      return true;
    }),
];

export const closeAccountRules = [
  body("password")
    .exists({ values: "null" })
    .withMessage("Confirm your password to close the account.")
    .bail()
    .isLength({ min: 1, max: 128 })
    .withMessage("Confirm your password."),

  body("mode")
    .optional({ values: "null" })
    .isIn(["deactivate", "delete"])
    .withMessage('mode must be "deactivate" or "delete".'),

  body("confirmText")
    .optional({ values: "undefined" })
    .custom((value, { req }) => {
      if (req.body.mode === "delete" && value !== "DELETE") {
        throw new Error('Type DELETE to confirm permanent removal.');
      }
      return true;
    }),
];

export default { updateSettingsRules, changeEmailRules, changePasswordRules, closeAccountRules };
