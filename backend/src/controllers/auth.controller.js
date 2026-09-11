import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { hashPassword, comparePassword } from "../utils/hash.js";
import { createToken } from "../utils/jwt.js";
import { asyncHandler, ok, badRequest, conflict, unauthorized, formatZodError } from "../utils/http.js";
import { normalizePhone } from "../utils/phone.js";
import { toPublicUser, refreshLikeWindow } from "../utils/user.js";

const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Tell us your name").max(60),
  email: z.email("Enter a valid email").transform((v) => v.toLowerCase()),
  phone: z.string().trim().optional(),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).default("OTHER"),
  birthDate: z.coerce.date().optional(),
  city: z.string().trim().max(80).optional(),
});

const loginSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  password: z.string().min(1, "Enter your password"),
});

async function buildSession(user) {
  return {
    token: createToken(user.id),
    user: toPublicUser(user),
    likes: await refreshLikeWindow(user.id),
  };
}

export const register = asyncHandler(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Check your details", formatZodError(parsed.error));

  const { fullName, email, phone, password, gender, birthDate, city } = parsed.data;

  if (birthDate) {
    const age = (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000);
    if (age < 18) throw badRequest("natthesisa is for people aged 18 and over");
    if (age > 110) throw badRequest("That birth date looks wrong");
  }

  const normalizedPhone = phone ? normalizePhone(phone) : null;
  if (phone && !normalizedPhone) throw badRequest("Enter a valid Ghanaian number, e.g. 0241234567");

  const [existing] = await db
    .select({ id: users.id, email: users.email, phone: users.phone })
    .from(users)
    .where(or(...[eq(users.email, email), ...(normalizedPhone ? [eq(users.phone, normalizedPhone)] : [])]))
    .limit(1);

  if (existing) {
    throw conflict(existing.email === email ? "That email is already registered" : "That number is already registered");
  }

  const [user] = await db
    .insert(users)
    .values({
      fullName,
      email,
      phone: normalizedPhone,
      passwordHash: await hashPassword(password),
      gender,
      birthDate: birthDate || null,
      city: city || null,
      lookingFor: gender === "MALE" ? ["FEMALE"] : gender === "FEMALE" ? ["MALE"] : [],
    })
    .returning();

  ok(res, await buildSession(user), 201);
});

export const login = asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Check your details", formatZodError(parsed.error));

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (!user) throw unauthorized("No account with that email");

  const valid = await comparePassword(parsed.data.password, user.passwordHash);
  if (!valid) throw unauthorized("Wrong password");

  await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, user.id));
  ok(res, await buildSession(user));
});

export const me = asyncHandler(async (req, res) => {
  const [user] = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
  ok(res, { user: toPublicUser(user), likes: await refreshLikeWindow(user.id) });
});

export const changePassword = asyncHandler(async (req, res) => {
  const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Check your details", formatZodError(parsed.error));

  const [user] = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
  const valid = await comparePassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) throw unauthorized("Current password is incorrect");

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.newPassword), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  ok(res, { message: "Password updated" });
});

export const deleteAccount = asyncHandler(async (req, res) => {
  await db.delete(users).where(eq(users.id, req.user.id));
  ok(res, { message: "Account deleted. We hope to see you again." });
});
