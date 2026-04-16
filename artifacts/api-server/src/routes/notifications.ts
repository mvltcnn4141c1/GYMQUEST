import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { authenticateUser } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/notifications", authenticateUser, async (req, res) => {
  const userId = req.user!.id;
  const { limit } = req.query as { limit?: string };

  const lim = Math.min(parseInt(limit || "50"), 100);

  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(lim);

  const unreadCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, userId), isNull(notificationsTable.readAt)));

  res.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      data: null,
      isRead: !!n.readAt,
      createdAt: n.createdAt,
    })),
    unreadCount: unreadCount[0]?.count || 0,
  });
});

router.post("/notifications/read", authenticateUser, async (req, res) => {
  const userId = req.user!.id;
  const { notificationIds } = req.body;

  if (notificationIds && Array.isArray(notificationIds)) {
    for (const nId of notificationIds) {
      await db.update(notificationsTable)
        .set({ readAt: new Date() })
        .where(and(eq(notificationsTable.id, nId), eq(notificationsTable.userId, userId)));
    }
  } else {
    await db.update(notificationsTable)
      .set({ readAt: new Date() })
      .where(and(eq(notificationsTable.userId, userId), isNull(notificationsTable.readAt)));
  }

  res.json({ success: true });
});

export default router;
