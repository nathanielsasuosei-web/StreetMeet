import { ApiError } from "./apiError.js";

/**
 * Wraps an async route handler so rejected promises reach the Express 5 error
 * handler instead of hanging the request.
 */
export function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch((error) => {
      next(error instanceof ApiError ? error : error);
    });
  };
}

export default asyncHandler;
