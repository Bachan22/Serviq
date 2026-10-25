import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/database/connection.js', () => {
  return {
    db: {
      execute: vi.fn().mockRejectedValue(new Error('Use in-memory fallback for test')),
      query: {
        conversations: { findFirst: vi.fn(), findMany: vi.fn() },
        messages: { findFirst: vi.fn(), findMany: vi.fn() },
        bookings: { findFirst: vi.fn() },
        workerProfiles: { findFirst: vi.fn() },
        customerProfiles: { findFirst: vi.fn() },
        users: { findFirst: vi.fn() },
      },
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(),
        })),
      })),
    },
    client: { end: vi.fn() },
  };
});

import { messagesService, escapeHtml } from '../src/modules/messages/messages.service.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
} from '../src/common/errors/app-error.js';

describe('Messages Module Unit Tests', () => {
  const customerId = 'cust-user-123';
  const workerId = 'worker-user-456';
  const thirdPartyId = 'intruder-user-789';
  const bookingId = 'BK-TEST-MESSAGES-1';

  beforeEach(() => {
    messagesService.resetRateLimit();
    messagesService.resetStore();
  });

  it('escapes HTML tags to prevent XSS injection', () => {
    const raw = '<script>alert("hacked")</script><b>Hello & Welcome!</b>';
    const escaped = escapeHtml(raw);
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
    expect(escaped).toContain('&amp;');
    expect(escaped).toContain('&lt;b&gt;');
  });

  it('creates conversation and allows customer and worker to communicate', async () => {
    const conv = await messagesService.getOrCreateConversation(customerId, bookingId, workerId);
    expect(conv).toBeDefined();
    expect(conv.bookingId).toBe(bookingId);

    // Customer sends message
    const msg1 = await messagesService.sendMessage(customerId, conv.id, 'Hello, are you available today?');
    expect(msg1.senderId).toBe(customerId);
    expect(msg1.body).toBe('Hello, are you available today?');
    expect(msg1.isSystemNotice).toBe(false);

    // Worker reads conversation
    const workerView = await messagesService.getConversation(workerId, conv.id);
    expect(workerView.conversation.id).toBe(conv.id);
    expect(workerView.messages.some((m: any) => m.body === 'Hello, are you available today?')).toBe(true);

    // Worker replies
    const msg2 = await messagesService.sendMessage(workerId, conv.id, 'Yes! I am on my way.');
    expect(msg2.senderId).toBe(workerId);
    expect(msg2.body).toBe('Yes! I am on my way.');
  });

  it('enforces RLS: a third user CANNOT read the conversation', async () => {
    const conv = await messagesService.getOrCreateConversation(customerId, bookingId, workerId);
    await expect(messagesService.getConversation(thirdPartyId, conv.id)).rejects.toThrow(ForbiddenError);
  });

  it('enforces RLS: a third user CANNOT send a message in the conversation', async () => {
    const conv = await messagesService.getOrCreateConversation(customerId, bookingId, workerId);
    await expect(
      messagesService.sendMessage(thirdPartyId, conv.id, 'I should not be allowed here')
    ).rejects.toThrow(ForbiddenError);
  });

  it('validates message content: rejects empty messages and messages exceeding 1000 chars', async () => {
    const conv = await messagesService.getOrCreateConversation(customerId, bookingId, workerId);
    await expect(messagesService.sendMessage(customerId, conv.id, '   ')).rejects.toThrow(BadRequestError);
    const hugeMsg = 'A'.repeat(1001);
    await expect(messagesService.sendMessage(customerId, conv.id, hugeMsg)).rejects.toThrow(BadRequestError);
  });

  it('enforces rate limiting: blocks the 21st message within 1 minute with 429 TooManyRequestsError', async () => {
    const conv = await messagesService.getOrCreateConversation(customerId, bookingId, workerId);
    const testUser = 'rapid-sender-id';
    messagesService.resetRateLimit(testUser);

    // Send 20 allowed messages
    for (let i = 1; i <= 20; i++) {
      await messagesService.sendMessage(customerId, conv.id, `Valid message ${i}`);
    }

    // 21st message should fail
    let threwError = false;
    try {
      for (let i = 1; i <= 21; i++) {
        messagesService.checkRateLimit(testUser);
      }
    } catch (err: any) {
      threwError = true;
      expect(err).toBeInstanceOf(TooManyRequestsError);
      expect(err.statusCode).toBe(429);
      expect(err.message).toBe('You are sending messages too fast');
    }
    expect(threwError).toBe(true);
  });
});
