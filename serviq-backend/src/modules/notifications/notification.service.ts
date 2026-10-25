import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { notifications } from '../../database/schema/notifications.js';

export class NotificationService {
  async createNotification(
    userId: string,
    title: string,
    message: string,
    type: string,
    bookingId?: string,
    metadata?: string
  ) {
    try {
      const [n] = await db
        .insert(notifications)
        .values({
          userId,
          title,
          message,
          type,
          bookingId: bookingId || null,
          metadata: metadata || null,
          isRead: false,
        })
        .returning();
      return n;
    } catch (err: any) {
      console.warn('[NotificationService] Failed to create notification:', err.message);
      return null;
    }
  }

  async getUserNotifications(userId: string, limit = 30) {
    const list = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    const [unread] = await db
      .select({ count: sql`COUNT(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

    return {
      notifications: list,
      unreadCount: Number(unread?.count || 0),
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning();
    return updated;
  }

  async markAllAsRead(userId: string) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return { success: true };
  }
}

export const notificationService = new NotificationService();
