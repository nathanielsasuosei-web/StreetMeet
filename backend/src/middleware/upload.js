import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import crypto from "node:crypto";
import { env } from "../config/env.js";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(env.uploadDir, { recursive: true });
    cb(null, env.uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".bin";
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
  },
});

const allowed = /^(image|video|audio)\//;

export const upload = multer({
  storage,
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => {
    if (!allowed.test(file.mimetype)) {
      return cb(new Error("Only images, video and audio files are allowed"));
    }
    cb(null, true);
  },
});

/** Public URL for a file saved by multer. */
export const fileUrl = (file, req) => {
  if (!file) return null;
  const rel = path.relative(env.uploadDir, file.path).split(path.sep).join("/");
  const base = `${req.protocol}://${req.get("host")}`;
  return `${base}/uploads/${rel}`;
};

/**
 * Swap `upload` for an S3/Cloudinary helper in production:
 *   import { v2 as cloudinary } from "cloudinary"; ...
 * See docs/STEP-BY-STEP.md -> Step 12.
 */
export const uploadSingle = (field) => upload.single(field);
export const uploadMany = (field, max = 6) => upload.array(field, max);
