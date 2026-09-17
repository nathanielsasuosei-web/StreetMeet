/**
 * ApiError - the only error type controllers and services throw.
 *
 * The global error handler turns it into a JSON response; anything else becomes
 * an opaque 500 so internals never leak to the client.
 */
export class ApiError extends Error {
  constructor(status, message, { code, fields, details } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.expose = true;
    this.code = code || defaultCodeFor(status);
    if (fields) this.fields = fields;
    if (details) this.details = details;
  }

  static badRequest(message = "Bad request", options) {
    return new ApiError(400, message, options);
  }

  static unauthorized(message = "Authentication required", options) {
    return new ApiError(401, message, { code: "UNAUTHORIZED", ...options });
  }

  static forbidden(message = "Not allowed", options) {
    return new ApiError(403, message, { code: "FORBIDDEN", ...options });
  }

  static notFound(message = "Not found", options) {
    return new ApiError(404, message, { code: "NOT_FOUND", ...options });
  }

  static conflict(message = "Already exists", options) {
    return new ApiError(409, message, { code: "CONFLICT", ...options });
  }

  static payloadTooLarge(message = "Payload too large", options) {
    return new ApiError(413, message, { code: "PAYLOAD_TOO_LARGE", ...options });
  }

  static unprocessable(message = "Validation failed", options) {
    return new ApiError(422, message, { code: "VALIDATION_ERROR", ...options });
  }
}

function defaultCodeFor(status) {
  return (
    {
      400: "BAD_REQUEST",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      413: "PAYLOAD_TOO_LARGE",
      422: "VALIDATION_ERROR",
      501: "NOT_IMPLEMENTED",
    }[status] || "ERROR"
  );
}

export default ApiError;
