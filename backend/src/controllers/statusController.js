import prisma from "../config/prisma.js";

export async function createStatus(req, res) {
  try {
    const userId = req.user.id;

    const { text, mediaUrl, mediaType } = req.body;

    const status = await prisma.status.create({
      data: {
        userId,
        text,
        mediaUrl,
        mediaType,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });

    res.json(status);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
}

export async function getStatuses(req, res) {
  try {
    const statuses = await prisma.status.findMany({
      where: {
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: true
      }
    });

    res.json(statuses);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
}