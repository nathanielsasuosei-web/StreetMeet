import { validationResult } from "express-validator";

import { ApiError } from "../utils/apiError.js";

/**
 * Runs after a list of express-validator chains and turns the result into a
 * single 422 with a `{ field: message }` map the UI can render inline.
 */
export function validate(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const fields = {};
  for (const error of result.array({ onlyFirstError: true })) {
    const field = error.path || error.param || "form";
    fields[field] = error.msg;
  }

  return next(
    ApiError.unprocessable(result.array()[0]?.msg || "Please check the highlighted fields.", {
      fields,
    })
  );
}

export default validate;
