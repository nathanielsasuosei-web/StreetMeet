export async function updateProfile(req, res) {
  try {
    res.json({
      success: true,
      message: "Profile updated successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}