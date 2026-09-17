/**
 * /api/profile - the member's own profile, the sign-up wizard, dating
 * preferences and the profile photo.
 */
import * as profileService from "../services/profileService.js";
import asyncHandler from "../utils/asyncHandler.js";

export const catalogue = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await profileService.catalogue() });
});

export const getMe = asyncHandler(async (req, res) => {
  const profile = await profileService.getOwnProfile(req.user.id);
  res.json({ success: true, data: { profile } });
});

export const updateMe = asyncHandler(async (req, res) => {
  const profile = await profileService.updateProfile(req.user.id, req.body);
  res.json({ success: true, message: "Profile saved.", data: { profile } });
});

export const onboard = asyncHandler(async (req, res) => {
  const profile = await profileService.completeOnboarding(req.user.id, req.body);
  res.json({
    success: true,
    message: "Profile created. You are ready to meet people.",
    data: { profile },
  });
});

export const getPreferences = asyncHandler(async (req, res) => {
  const preferences = await profileService.getPreferences(req.user.id);
  res.json({ success: true, data: { preferences } });
});

export const updatePreferences = asyncHandler(async (req, res) => {
  const preferences = await profileService.updatePreferences(req.user.id, req.body);
  res.json({ success: true, message: "Preferences saved.", data: { preferences } });
});

export const uploadPhoto = asyncHandler(async (req, res) => {
  const profile = await profileService.uploadPhoto(req.user.id, req.file);
  res.json({ success: true, message: "Photo updated.", data: { profile } });
});

export const deletePhoto = asyncHandler(async (req, res) => {
  const profile = await profileService.removePhoto(req.user.id);
  res.json({ success: true, message: "Photo removed.", data: { profile } });
});

/** Public view of another member, filtered by their privacy settings. */
export const getPublic = asyncHandler(async (req, res) => {
  const profile = await profileService.getPublicProfile(req.params.id, req.user);
  res.json({ success: true, data: { profile } });
});

export default {
  catalogue,
  getMe,
  updateMe,
  onboard,
  getPreferences,
  updatePreferences,
  uploadPhoto,
  deletePhoto,
  getPublic,
};
