/**
 * /api/auth - sign up, sign in, current session, reactivation.
 */
import * as authService from "../services/authService.js";
import asyncHandler from "../utils/asyncHandler.js";

export const register = asyncHandler(async (req, res) => {
  const { token, user, message } = await authService.register(req.body);
  res.status(201).json({ success: true, message, data: { token, user } });
});

export const login = asyncHandler(async (req, res) => {
  const { token, user, message } = await authService.login(req.body);
  res.json({ success: true, message, data: { token, user } });
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.currentUser(req.user);
  res.json({ success: true, data: { user } });
});

/**
 * JWTs are stateless: signing out is the client dropping its token. The
 * endpoint exists so the UI has one obvious call, and so an audit log can be
 * added later without changing the client.
 */
export const logout = asyncHandler(async (_req, res) => {
  res.json({ success: true, message: "Signed out." });
});

export const reactivate = asyncHandler(async (req, res) => {
  const { token, user, message } = await authService.reactivate(req.body);
  res.json({ success: true, message, data: { token, user } });
});

export default { register, login, me, logout, reactivate };
