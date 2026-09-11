import multer from "multer";

export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message:
        err.code === "LIMIT_FILE_SIZE"
          ? "File too large - compress it and try again"
          : `Upload error: ${err.message}`,
    });
  }

  if (process.env.NODE_ENV !== "production") {
    console.error("[natthesisa:error]", err);
  }

  res.status(status >= 500 ? 500 : status).json({
    success: false,
    message: status >= 500 && process.env.NODE_ENV === "production" ? "Something went wrong" : err.message,
    details: err.details || undefined,
  });
}
