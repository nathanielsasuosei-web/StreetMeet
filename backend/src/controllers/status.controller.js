import { and, asc, desc, eq, gt, inArray, notInArray, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { blocks, matches, statuses, statusViews, users } from "../db/schema.js";
import { asyncHandler, ok, badRequest, notFound, forbidden, formatZodError } from "../utils/http.js";
import { toPublicUser } from "../utils/user.js";
import { statusExpiry } from "../utils/date.js";
import { fileUrl } from "../middleware/upload.js";

const createSchema = z.object({
  caption: z.string().trim().max(300).optional(),
  // Posting by URL (apps that host media elsewhere) instead of a file upload
  mediaUrl: z.string().url("Enter a valid media URL").max(2000).optional(),
  mediaType: z.enum(["TEXT", "IMAGE", "VIDEO"]).optional(),
  background: z
    .string()
    .regex(/^#([0-9a-fA-F]{6})$/, "Background must be a hex colour")
    .optional(),
});

const shape = (status, { viewerId, viewCount = 0, seenByMe = false } = {}) => ({
  id: status.id,
  caption: status.caption,
  mediaUrl: status.mediaUrl,
  mediaType: status.mediaType,
  background: status.background,
  createdAt: status.createdAt,
  expiresAt: status.expiresAt,
  viewCount,
  seenByMe,
});

export const createStatus = asyncHandler(async (req, res) => {
  const parsed = createSchema.safeParse(req.body || {});
  if (!parsed.success) throw badRequest("Check your status", parsed.error.issues[0]?.message);

  const file = req.file;
  const caption = parsed.data.caption || "";
  if (!file && !caption) throw badRequest("Add a photo, a video or write something");

  const [status] = await db
    .insert(statuses)
    .values({
      userId: req.user.id,
      caption: caption || null,
      mediaUrl: file ? fileUrl(file, req) : parsed.data.mediaUrl || null,
      mediaType: file
        ? file.mimetype.startsWith("image/")
          ? "IMAGE"
          : file.mimetype.startsWith("video/")
            ? "VIDEO"
            : "TEXT"
        : parsed.data.mediaUrl
          ? parsed.data.mediaType || "IMAGE"
          : "TEXT",
      background: parsed.data.background || "#7c3aed",
      expiresAt: statusExpiry(),
    })
    .returning();

  ok(res, { status: shape(status) }, 201);
});

/**
 * WhatsApp-style feed: your own statuses first, then one ring per contact.
 * Only shows statuses younger than 24h from people you are not blocking.
 */
export const getFeed = asyncHandler(async (req, res) => {
  const viewerId = req.user.id;

  const blockRows = await db
    .select({ blocker: blocks.blockerId, blocked: blocks.blockedId })
    .from(blocks)
    .where(or(eq(blocks.blockerId, viewerId), eq(blocks.blockedId, viewerId)));

  const hidden = new Set(blockRows.flatMap((b) => [b.blocker, b.blocked]));
  hidden.delete(viewerId);

  // People you can see statuses from: your matches (and yourself)
  const matchRows = await db
    .select({ a: matches.userAId, b: matches.userBId })
    .from(matches)
    .where(or(eq(matches.userAId, viewerId), eq(matches.userBId, viewerId)));

  const visibleIds = [...new Set([viewerId, ...matchRows.map((m) => (m.a === viewerId ? m.b : m.a))])]
    .filter((id) => !hidden.has(id));

  if (!visibleIds.length) return ok(res, { feed: [] });

  const rows = await db
    .select({ status: statuses, user: users })
    .from(statuses)
    .innerJoin(users, eq(users.id, statuses.userId))
    .where(and(gt(statuses.expiresAt, new Date()), inArray(statuses.userId, visibleIds)))
    .orderBy(asc(statuses.createdAt));

  const ids = rows.map((r) => r.status.id);
  const views = ids.length
    ? await db.select().from(statusViews).where(inArray(statusViews.statusId, ids))
    : [];

  const grouped = new Map();
  for (const { status, user } of rows) {
    const statusViews_ = views.filter((v) => v.statusId === status.id);
    const seenByMe = statusViews_.some((v) => v.viewerId === viewerId);
    const isMine = status.userId === viewerId;

    if (!grouped.has(status.userId)) {
      grouped.set(status.userId, {
        user: toPublicUser(user, { preview: true }),
        isMine,
        unseen: false,
        items: [],
      });
    }
    const entry = grouped.get(status.userId);
    entry.items.push(shape(status, { viewerId, viewCount: statusViews_.length, seenByMe }));
    if (!seenByMe && !isMine) entry.unseen = true;
  }

  const feed = [...grouped.values()].sort((a, b) => {
    if (a.isMine) return -1;
    if (b.isMine) return 1;
    return new Date(b.items.at(-1).createdAt) - new Date(a.items.at(-1).createdAt);
  });

  ok(res, { feed });
});

export const getMyStatuses = asyncHandler(async (req, res) => {
  const rows = await db
    .select({ status: statuses })
    .from(statuses)
    .where(and(eq(statuses.userId, req.user.id), gt(statuses.expiresAt, new Date())))
    .orderBy(asc(statuses.createdAt));

  const ids = rows.map((r) => r.status.id);
  const views = ids.length
    ? await db.select().from(statusViews).where(inArray(statusViews.statusId, ids))
    : [];

  ok(res, {
    statuses: rows.map(({ status }) =>
      shape(status, { viewCount: views.filter((v) => v.statusId === status.id).length })
    ),
  });
});

export const viewStatus = asyncHandler(async (req, res) => {
  const [status] = await db.select().from(statuses).where(eq(statuses.id, req.params.id)).limit(1);
  if (!status) throw notFound("Status not found");
  if (status.expiresAt < new Date()) throw notFound("This status has expired");
  if (status.userId === req.user.id) throw forbidden("You cannot view your own status");

  await db
    .insert(statusViews)
    .values({ statusId: status.id, viewerId: req.user.id })
    .onConflictDoNothing();

  ok(res, { viewed: true });
});

export const getViewers = asyncHandler(async (req, res) => {
  const [status] = await db
    .select()
    .from(statuses)
    .where(and(eq(statuses.id, req.params.id), eq(statuses.userId, req.user.id)))
    .limit(1);
  if (!status) throw notFound("Status not found");

  const rows = await db
    .select({ viewedAt: statusViews.createdAt, viewer: users })
    .from(statusViews)
    .innerJoin(users, eq(users.id, statusViews.viewerId))
    .where(eq(statusViews.statusId, status.id))
    .orderBy(desc(statusViews.createdAt));

  ok(res, { viewers: rows.map((r) => ({ viewedAt: r.viewedAt, user: toPublicUser(r.viewer, { preview: true }) })) });
});

export const deleteStatus = asyncHandler(async (req, res) => {
  const deleted = await db
    .delete(statuses)
    .where(and(eq(statuses.id, req.params.id), eq(statuses.userId, req.user.id)))
    .returning({ id: statuses.id });

  if (!deleted.length) throw notFound("Status not found");
  ok(res, { deleted: true });
});
