/**
 * /api/settings - account settings, email, password, sessions, closure.
 */
import * as settingsService from "../services/settingsService.js";
import asyncHandler from "../utils/asyncHandler.js";

export const getSettings = asyncHandler(async (req, res) => {
  const data = await settingsService.getAccountOverview(req.user);
  res.json({ success: true, data });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.updateSettings(req.user.id, req.body);
  res.json({ success: true, message: "Settings saved.", data: { settings } });
});

export const changeEmail = asyncHandler(async (req, res) => {
  const data = await settingsService.changeEmail(req.user.id, req.body);
  res.json({ success: true, message: data.message, data });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { token, message } = await settingsService.changePassword(req.user.id, req.body);
  res.json({ success: true, message, data: { token } });
});

export const logoutEverywhere = asyncHandler(async (req, res) => {
  const { message } = await settingsService.logoutEverywhere(req.user.id);
  res.json({ success: true, message, data: { signedOutEverywhere: true } });
});

export const closeAccount = asyncHandler(async (req, res) => {
  const result = await settingsService.closeAccount(req.user.id, {
    password: req.body.password,
    mode: req.body.mode || "deactivate",
  });
  res.json({ success: true, message: result.message, data: result });
});

export default {
  getSettings,
  updateSettings,
  changeEmail,
  changePassword,
  logoutEverywhere,
  closeAccount,
};
