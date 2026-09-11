import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { blocks, matches, reports, users } from "../db/schema.js";
import { asyncHandler, ok, badRequest, notFound, formatZodError } from "../utils/http.js";
import { normalizePhone } from "../utils/phone.js";
import { toPublicUser } from "../utils/user.js";
import { fileUrl } from "../middleware/upload.js";

const updateSchema = z.object({
  fullName: z.string().trim().min(2).max(60).optional(),
  bio: z.string().trim().max(500).optional(),
  city: z.string().trim().max(80).optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  birthDate: z.coerce.date().optional(),
  phone: z.string().trim().optional(),
  interests: z.array(z.string().trim().min(1).max(30)).max(15).optional(),
  lookingFor: z.array(z.enum(["MALE", "FEMALE", "OTHER"])).max(3).optional(),
  minAge: z.coerce.number().int().min(18).max(100).optional(),
  maxAge: z.coerce.number().int().min(18).max(100).optional(),
  maxDistanceKm: z.coerce.number().int().min(1).max(20000).optional(),
  showMe: z.coerce.boolean().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  removePhotos: z.array(z.string()).optional(),
  // Setting photo URLs directly (the apps also support real uploads - see upload.array("photos"))
  photos: z.array(z.string().min(4).max(2000)).max(6).optional(),
  avatarUrl: z.string().min(4).max(2000).optional(),
});

export const getProfile = asyncHandler(async (req, res) => {
  const [user] = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
  if (!user) throw notFound("Profile not found");
  ok(res, { user: toPublicUser(user) });
});

export const getPublicProfile = asyncHandler(async (req, res) => {
  const [user] = await db.select().from(users).where(eq(users.id, req.params.id)).limit(1);
  if (!user || !user.showMe) throw notFound("Profile not found");
  ok(res, { user: toPublicUser(user, { preview: true }) });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Check your details", formatZodError(parsed.error));

  const data = { ...parsed.data, onboarded: true, updatedAt: new Date() };

  if (data.phone) {
    const phone = normalizePhone(data.phone);
    if (!phone) throw badRequest("Enter a valid Ghanaian number, e.g. 0241234567");
    data.phone = phone;
  }

  if (req.files?.length) {
    const uploaded = req.files.map((file) => fileUrl(file, req));
    const [current] = await db
      .select({ photos: users.photos, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    const removed = new Set(data.removePhotos || []);
    const kept = (current?.photos || []).filter((url) => !removed.has(url));
    data.photos = [...kept, ...uploaded].slice(0, 6);
    if (!current?.avatarUrl) data.avatarUrl = data.photos[0];
  } else if (data.photos?.length) {
    // URLs sent straight from the client (e.g. an image picked from the phone)
    data.photos = data.photos.slice(0, 6);
    if (!data.avatarUrl) data.avatarUrl = data.photos[0];
  }

  delete data.removePhotos;

  const [user] = await db.update(users).set(data).where(eq(users.id, req.user.id)).returning();
  ok(res, { user: toPublicUser(user) });
});

export const removePhoto = asyncHandler(async (req, res) => {
  const { url } = z.object({ url: z.string().url() }).parse(req.body);
  const [user] = await db
    .select({ photos: users.photos, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, req.user.id))
    .limit(1);

  const photos = (user?.photos || []).filter((p) => p !== url);
  const [updated] = await db
    .update(users)
    .set({
      photos,
      avatarUrl: user?.avatarUrl === url ? photos[0] ?? null : user?.avatarUrl,
      updatedAt: new Date(),
    })
    .where(eq(users.id, req.user.id))
    .returning();

  ok(res, { user: toPublicUser(updated) });
});

export const blockUser = asyncHandler(async (req, res) => {
  const targetId = req.params.id;
  if (targetId === req.user.id) throw badRequest("You cannot block yourself");

  await db.insert(blocks).values({ blockerId: req.user.id, blockedId: targetId }).onConflictDoNothing();
  await db
    .delete(matches)
    .where(
      or(
        and(eq(matches.userAId, req.user.id), eq(matches.userBId, targetId)),
        and(eq(matches.userAId, targetId), eq(matches.userBId, req.user.id))
      )
    );

  ok(res, { message: "User blocked" });
});

export const unblockUser = asyncHandler(async (req, res) => {
  await db.delete(blocks).where(and(eq(blocks.blockerId, req.user.id), eq(blocks.blockedId, req.params.id)));
  ok(res, { message: "User unblocked" });
});

export const listBlocked = asyncHandler(async (req, res) => {
  const rows = await db
    .select({ user: users })
    .from(blocks)
    .innerJoin(users, eq(users.id, blocks.blockedId))
    .where(eq(blocks.blockerId, req.user.id));

  ok(res, { blocked: rows.map((r) => toPublicUser(r.user, { preview: true })) });
});

export const reportUser = asyncHandler(async (req, res) => {
  const schema = z.object({
    reason: z.enum(["SPAM", "FAKE_PROFILE", "HARASSMENT", "INAPPROPRIATE", "UNDERAGE", "OTHER"]),
    details: z.string().trim().max(500).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Pick a reason", formatZodError(parsed.error));

  await db
    .insert(reports)
    .values({ reporterId: req.user.id, reportedId: req.params.id, ...parsed.data })
    .onConflictDoUpdate({
      target: [reports.reporterId, reports.reportedId],
      set: { ...parsed.data, status: "OPEN" },
    });

  ok(res, { message: "Thanks - our moderation team will review this report" }, 201);
});
