import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";

/** 404 for unknown API paths (the SPA handles its own routes). */
export function notFound(req, _res, next) {
  next(ApiError.notFound(`No API route for ${req.method} ${req.originalUrl}`));
}

/** Single place where errors become JSON. */
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
export function errorHandler(error, req, res, _next) {
  let status = error.status || error.statusCode || 500;
  let message = error.message || "Something went wrong.";
  let code = error.code;
  let fields = error.fields;

  // multer rejections
  if (error.name === "MulterError") {
    status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    message =
      error.code === "LIMIT_FILE_SIZE"
        ? `That image is too large. Maximum size is ${Math.round(env.uploads.maxBytes / 1024 / 1024)} MB.`
        : `Upload problem: ${error.message}`;
    code = error.code;
  }

  // malformed JSON body
  if (error.type === "entity.parse.failed" || error instanceof SyntaxError) {
    status = 400;
    message = "That request body is not valid JSON.";
    code = "BAD_JSON";
  }

  // unique constraint violations
  if (/UNIQUE constraint failed/i.test(message) || error.code === "23505") {
    status = 409;
    message = "That value is already in use.";
    code = "CONFLICT";
  }

  if (status >= 500) {
    console.error(`💥 ${req.method} ${req.originalUrl} ->`, error);
    if (env.isProd) message = "Something went wrong on our side. Please try again.";
  } else if (env.logRequests) {
    console.warn(`⚠️  ${req.method} ${req.originalUrl} -> ${status} ${message}`);
  }

  res.status(status).json({
    success: false,
    message,
    code: status >= 500 && env.isProd ? "INTERNAL_ERROR" : code,
    ...(fields ? { fields } : {}),
    ...(status >= 500 && !env.isProd ? { detail: error.stack?.split("\n").slice(0, 3) } : {}),
  });
}

export default errorHandler;
