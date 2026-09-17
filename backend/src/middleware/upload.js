import fs from "node:fs";
import path from "node:path";

import multer from "multer";
import sharp from "sharp";

import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";
import { newId } from "../utils/id.js";

/**
 * Profile photo upload.
 *
 * Files are held in memory (limited to UPLOAD_MAX_MB), re-encoded with sharp to
 * a plain JPEG/WebP at a capped size, and written to disk under a random name.
 * Re-encoding strips EXIF (including GPS) and kills any payload hidden in the
 * original bytes; SVG is rejected outright because it can execute script.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.uploads.maxBytes,
    files: 1,
    fields: 4,
  },
  fileFilter(_req, file, cb) {
    if (!env.uploads.allowedMimeTypes.includes(file.mimetype)) {
      cb(
        ApiError.badRequest(
          `Only ${env.uploads.allowedMimeTypes.map((t) => t.replace("image/", "")).join(", ")} images are allowed.`
        )
      );
      return;
    }
    cb(null, true);
  },
});

export const uploadProfilePhoto = upload.single("photo");

export async function storeProfileImage(buffer, { previous } = {}) {
  fs.mkdirSync(env.uploads.profilesDir, { recursive: true });

  const filename = `${newId()}.jpg`;
  const target = path.join(env.uploads.profilesDir, filename);

  await sharp(buffer)
    .rotate() // honour EXIF orientation before stripping metadata
    .resize(env.uploads.maxDimension, env.uploads.maxDimension, {
      fit: "cover",
      position: sharp.strategy.attention,
    })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(target);

  const publicPath = `${env.uploads.publicUrl}/profiles/${filename}`;

  // best-effort cleanup of the replaced photo
  if (previous) removeStoredImage(previous);

  return publicPath;
}

export function removeStoredImage(publicPath) {
  if (!publicPath || !publicPath.includes("/profiles/")) return false;

  const filename = path.basename(publicPath.split("/profiles/")[1] || "");
  if (!filename || filename.includes("..")) return false;

  const target = path.join(env.uploads.profilesDir, filename);
  try {
    if (fs.existsSync(target)) fs.rmSync(target);
    return true;
  } catch {
    return false;
  }
}

export default uploadProfilePhoto;
