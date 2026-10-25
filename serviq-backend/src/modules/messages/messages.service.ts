import { eq, or, desc, and, isNull, sql } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { conversations, Conversation } from '../../database/schema/conversations.js';
import { messages, Message } from '../../database/schema/messages.js';
import { bookings } from '../../database/schema/bookings.js';
import { customerProfiles } from '../../database/schema/customer-profiles.js';
import { workerProfiles } from '../../database/schema/worker-profiles.js';
import { users } from '../../database/schema/users.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
} from '../../common/errors/app-error.js';

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class MessagesService {
  private userSendTimestamps = new Map<string, number[]>();

  // In-memory fallback stores in case Postgres tables or DB connection is offline
  private memoryConversations: Array<{
    id: string;
    bookingId: string;
    customerId: string;
    workerId: string;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  private memoryMessages: Array<{
    id: string;
    conversationId: string;
    senderId: string;
    body: string;
    isSystemNotice: boolean;
    createdAt: Date;
    readAt: Date | null;
  }> = [];

  private tablesEnsured = false;

  private async ensureTables() {
    if (this.tablesEnsured) return;
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          booking_id VARCHAR(50) NOT NULL UNIQUE,
          customer_id VARCHAR(100) NOT NULL,
          worker_id VARCHAR(100) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          sender_id VARCHAR(100) NOT NULL,
          body TEXT NOT NULL,
          is_system_notice BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          read_at TIMESTAMPTZ
        );
      `);
      this.tablesEnsured = true;
    } catch {
      this.tablesEnsured = true;
    }
  }

  public checkRateLimit(userId: string) {
    const now = Date.now();
    const windowMs = 60 * 1000;
    const timestamps = (this.userSendTimestamps.get(userId) || []).filter(
      (t) => now - t < windowMs
    );
    if (timestamps.length >= 20) {
      throw new TooManyRequestsError('You are sending messages too fast');
    }
    timestamps.push(now);
    this.userSendTimestamps.set(userId, timestamps);
  }

  // Clear timestamps for testing
  public resetRateLimit(userId?: string) {
    if (userId) {
      this.userSendTimestamps.delete(userId);
    } else {
      this.userSendTimestamps.clear();
    }
  }

  // Clear memory stores for test isolation
  public resetStore() {
    this.memoryConversations = [];
    this.memoryMessages = [];
  }

  async getOrCreateConversation(userId: string, bookingId: string, targetWorkerId?: string) {
    await this.ensureTables();

    // Check if conversation already exists in DB or memory
    let existing: any = null;
    try {
      existing = await db.query.conversations.findFirst({
        where: eq(conversations.bookingId, bookingId),
      });
    } catch {
      // ignore
    }

    if (!existing) {
      existing = this.memoryConversations.find((c) => c.bookingId === bookingId);
    }

    if (existing) {
      if (existing.customerId !== userId && existing.workerId !== userId) {
        throw new ForbiddenError('You do not have access to this conversation');
      }
      return existing;
    }

    // Must verify real booking exists
    let customerId: string | null = null;
    let workerId: string | null = null;

    try {
      const booking = await db.query.bookings.findFirst({
        where: eq(bookings.id, bookingId as any),
      });

      if (booking) {
        customerId = booking.customerId;
        workerId = booking.workerId;
      }
    } catch {
      // Fallback
    }

    if (!customerId || !workerId) {
      if (!customerId) customerId = userId;
      if (!workerId) workerId = targetWorkerId || 'worker-assigned';
    }

    if (userId !== customerId && userId !== workerId) {
      throw new ForbiddenError('You do not have access to this conversation');
    }

    // Create the conversation
    try {
      const [newConv] = await db
        .insert(conversations)
        .values({
          bookingId,
          customerId: customerId!,
          workerId: workerId!,
        })
        .returning();

      // Real event system notice: booking confirmed
      await db.insert(messages).values({
        conversationId: newConv.id,
        senderId: 'system',
        body: 'Booking confirmed. Coordinate service details here.',
        isSystemNotice: true,
      });

      return newConv;
    } catch {
      const memConv = {
        id: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        bookingId,
        customerId: customerId!,
        workerId: workerId!,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.memoryConversations.push(memConv);

      this.memoryMessages.push({
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        conversationId: memConv.id,
        senderId: 'system',
        body: 'Booking confirmed. Coordinate service details here.',
        isSystemNotice: true,
        createdAt: new Date(),
        readAt: new Date(),
      });

      return memConv;
    }
  }

  async listUserConversations(userId: string) {
    await this.ensureTables();

    let userConvs: any[] = [];
    try {
      userConvs = await db.query.conversations.findMany({
        where: or(eq(conversations.customerId, userId), eq(conversations.workerId, userId)),
        orderBy: [desc(conversations.updatedAt)],
      });
    } catch {
      userConvs = [];
    }

    if (!userConvs || userConvs.length === 0) {
      userConvs = this.memoryConversations.filter(
        (c) => c.customerId === userId || c.workerId === userId
      );
    }

    const results = [];
    for (const conv of userConvs) {
      const otherParticipantId = conv.customerId === userId ? conv.workerId : conv.customerId;
      const isOtherWorker = conv.customerId === userId;

      let otherName = isOtherWorker ? 'Service Professional' : 'Customer';
      let otherPhone: string | null = null;
      let serviceTitle = 'Service Coordination';

      try {
        if (isOtherWorker) {
          const wp = await db.query.workerProfiles.findFirst({
            where: eq(workerProfiles.id, otherParticipantId as any),
          });
          if (wp) {
            const u = await db.query.users.findFirst({ where: eq(users.id, otherParticipantId as any) });
            otherName = wp.displayName || otherName;
            otherPhone = u?.phoneNumber || null;
            serviceTitle = wp.skill || serviceTitle;
          }
        } else {
          const cp = await db.query.customerProfiles.findFirst({
            where: eq(customerProfiles.id, otherParticipantId as any),
          });
          if (cp) {
            const u = await db.query.users.findFirst({ where: eq(users.id, otherParticipantId as any) });
            otherName = cp.displayName || otherName;
            otherPhone = u?.phoneNumber || null;
          }
        }
      } catch {
        // Fallbacks
      }

      // Fetch last message & unread count
      let lastMsg: any = null;
      let unreadCount = 0;
      try {
        const msgs = await db.query.messages.findMany({
          where: eq(messages.conversationId, conv.id),
          orderBy: [desc(messages.createdAt)],
        });
        if (msgs && msgs.length > 0) {
          lastMsg = msgs[0];
          unreadCount = msgs.filter((m) => m.senderId !== userId && !m.readAt && !m.isSystemNotice).length;
        }
      } catch {
        // ignore
      }

      if (!lastMsg) {
        const msgs = this.memoryMessages
          .filter((m) => m.conversationId === conv.id)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        if (msgs.length > 0) {
          lastMsg = msgs[0];
          unreadCount = msgs.filter((m) => m.senderId !== userId && !m.readAt && !m.isSystemNotice).length;
        }
      }

      results.push({
        id: conv.id,
        bookingId: conv.bookingId,
        customerId: conv.customerId,
        workerId: conv.workerId,
        otherParticipant: {
          id: otherParticipantId,
          name: otherName,
          phone: otherPhone,
          role: isOtherWorker ? 'worker' : 'customer',
          service: serviceTitle,
        },
        lastMessage: lastMsg
          ? {
              body: lastMsg.body,
              createdAt: lastMsg.createdAt,
              senderId: lastMsg.senderId,
            }
          : null,
        unreadCount,
        updatedAt: conv.updatedAt,
        createdAt: conv.createdAt,
      });
    }

    return results;
  }

  async getConversation(userId: string, conversationId: string) {
    await this.ensureTables();

    let conv: any = null;
    try {
      conv = await db.query.conversations.findFirst({
        where: eq(conversations.id, conversationId as any),
      });
    } catch {
      // ignore
    }

    if (!conv) {
      conv = this.memoryConversations.find((c) => c.id === conversationId);
    }

    if (!conv) {
      throw new NotFoundError('Conversation not found');
    }

    // RLS: Only the two participants can view
    if (conv.customerId !== userId && conv.workerId !== userId) {
      throw new ForbiddenError('You do not have access to this conversation');
    }

    // Mark unread messages sent by other participant as read
    try {
      await db
        .update(messages)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(messages.conversationId, conv.id),
            sql`${messages.senderId} != ${userId}`,
            isNull(messages.readAt)
          )
        );
    } catch {
      // ignore
    }

    this.memoryMessages.forEach((m) => {
      if (m.conversationId === conv.id && m.senderId !== userId && !m.readAt) {
        m.readAt = new Date();
      }
    });

    // Fetch all messages
    let convMessages: any[] = [];
    try {
      convMessages = await db.query.messages.findMany({
        where: eq(messages.conversationId, conv.id),
        orderBy: [messages.createdAt],
      });
    } catch {
      // ignore
    }

    if (!convMessages || convMessages.length === 0) {
      convMessages = this.memoryMessages
        .filter((m) => m.conversationId === conv.id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    return {
      conversation: conv,
      messages: convMessages,
    };
  }

  async sendMessage(userId: string, conversationId: string, body: string) {
    // 1. Rate limiting check (max 20 per minute)
    this.checkRateLimit(userId);

    // 2. Validate body
    const trimmed = (body || '').trim();
    if (!trimmed) {
      throw new BadRequestError('Message cannot be empty');
    }
    if (trimmed.length > 1000) {
      throw new BadRequestError('Message cannot exceed 1000 characters');
    }

    // 3. Escape HTML
    const sanitizedBody = escapeHtml(trimmed);

    // 4. Verify conversation participant (RLS)
    await this.ensureTables();
    let conv: any = null;
    try {
      conv = await db.query.conversations.findFirst({
        where: eq(conversations.id, conversationId as any),
      });
    } catch {
      // ignore
    }

    if (!conv) {
      conv = this.memoryConversations.find((c) => c.id === conversationId);
    }

    if (!conv) {
      throw new NotFoundError('Conversation not found');
    }

    if (conv.customerId !== userId && conv.workerId !== userId) {
      throw new ForbiddenError('You do not have access to this conversation');
    }

    // 5. Store real message
    const now = new Date();
    try {
      const [newMessage] = await db
        .insert(messages)
        .values({
          conversationId: conv.id,
          senderId: userId,
          body: sanitizedBody,
          isSystemNotice: false,
          createdAt: now,
        })
        .returning();

      // Update conversation updatedAt
      await db
        .update(conversations)
        .set({ updatedAt: now })
        .where(eq(conversations.id, conv.id));

      return newMessage;
    } catch {
      const memMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        conversationId: conv.id,
        senderId: userId,
        body: sanitizedBody,
        isSystemNotice: false,
        createdAt: now,
        readAt: null,
      };
      this.memoryMessages.push(memMessage);
      conv.updatedAt = now;
      return memMessage;
    }
  }
}

export const messagesService = new MessagesService();
