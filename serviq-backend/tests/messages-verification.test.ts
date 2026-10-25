import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/database/connection.js', () => ({
  db: {
    execute: vi.fn().mockRejectedValue(new Error('offline')),
    query: {
      conversations: { findFirst: vi.fn(), findMany: vi.fn() },
      messages: { findFirst: vi.fn(), findMany: vi.fn() },
      bookings: { findFirst: vi.fn() },
      workerProfiles: { findFirst: vi.fn() },
      customerProfiles: { findFirst: vi.fn() },
      users: { findFirst: vi.fn() },
    },
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
  },
  client: { end: vi.fn() },
}));

import { messagesService, escapeHtml } from '../src/modules/messages/messages.service.js';
import {
  ForbiddenError,
  TooManyRequestsError,
} from '../src/common/errors/app-error.js';

describe('Official Verification Suite for Bug A & Bug B', () => {
  const customerId = 'cust-priya-01';
  const workerId = 'worker-ramesh-02';
  const thirdPartyId = 'user-intruder-03';
  const bookingId = 'BK-1050-VERIFY';

  beforeEach(() => {
    messagesService.resetRateLimit();
    messagesService.resetStore();
  });

  it('1. Customer sends a message: appears right for customer, left for worker, NO automatic reply', async () => {
    const conv = await messagesService.getOrCreateConversation(customerId, bookingId, workerId);
    
    // Customer sends message
    const customerMsg = await messagesService.sendMessage(customerId, conv.id, 'Are you on the way?');
    
    // Check customer view
    const customerView = await messagesService.getConversation(customerId, conv.id);
    const msgInCustomerView = customerView.messages.find((m: any) => m.id === customerMsg.id);
    expect(msgInCustomerView).toBeDefined();
    
    // Alignment logic for customer:
    const isMeForCustomer = msgInCustomerView.senderId === customerId;
    expect(isMeForCustomer).toBe(true); // Right side

    // Check worker view
    const workerView = await messagesService.getConversation(workerId, conv.id);
    const msgInWorkerView = workerView.messages.find((m: any) => m.id === customerMsg.id);
    expect(msgInWorkerView).toBeDefined();

    // Alignment logic for worker:
    const isMeForWorker = msgInWorkerView.senderId === workerId;
    expect(isMeForWorker).toBe(false); // Left side

    // Verify NO simulated/automatic reply was generated
    const nonSystemMessages = workerView.messages.filter((m: any) => !m.isSystemNotice);
    expect(nonSystemMessages).toHaveLength(1);
    expect(nonSystemMessages[0].body).toBe('Are you on the way?');
  });

  it('2. Worker replies: right for the worker, left for the customer', async () => {
    const conv = await messagesService.getOrCreateConversation(customerId, bookingId, workerId);
    
    // Worker sends reply
    const workerMsg = await messagesService.sendMessage(workerId, conv.id, 'Yes, on my way. ETA 10 minutes.');
    
    // Check worker view
    const workerView = await messagesService.getConversation(workerId, conv.id);
    const msgInWorkerView = workerView.messages.find((m: any) => m.id === workerMsg.id);
    expect(msgInWorkerView.senderId === workerId).toBe(true); // Right side for worker

    // Check customer view
    const customerView = await messagesService.getConversation(customerId, conv.id);
    const msgInCustomerView = customerView.messages.find((m: any) => m.id === workerMsg.id);
    expect(msgInCustomerView.senderId === customerId).toBe(false); // Left side for customer
  });

  it('3. HTML injection prevention: dangerous characters are sanitized', async () => {
    const conv = await messagesService.getOrCreateConversation(customerId, bookingId, workerId);
    const injected = await messagesService.sendMessage(
      customerId,
      conv.id,
      '<img src=x onerror=alert(1)> Hello!'
    );
    expect(injected.body).not.toContain('<img');
    expect(injected.body).toContain('&lt;img');
  });

  it('4. A third user cannot read the conversation (RLS)', async () => {
    const conv = await messagesService.getOrCreateConversation(customerId, bookingId, workerId);
    await expect(messagesService.getConversation(thirdPartyId, conv.id)).rejects.toThrow(ForbiddenError);
  });

  it('5. Messages persist and are returned on subsequent fetch with timestamps', async () => {
    const conv = await messagesService.getOrCreateConversation(customerId, bookingId, workerId);
    await messagesService.sendMessage(customerId, conv.id, 'Persistent message test');

    const refreshed = await messagesService.getConversation(customerId, conv.id);
    const target = refreshed.messages.find((m: any) => m.body === 'Persistent message test');
    expect(target).toBeDefined();
    expect(target.createdAt).toBeDefined();
    expect(new Date(target.createdAt).getTime()).toBeGreaterThan(0);
  });

  it('6. The 21st message within a minute is blocked (Rate Limit 429)', async () => {
    const conv = await messagesService.getOrCreateConversation(customerId, bookingId, workerId);
    const spammerId = 'spammer-test-id';
    messagesService.resetRateLimit(spammerId);

    // First 20 allowed
    for (let i = 1; i <= 20; i++) {
      messagesService.checkRateLimit(spammerId);
    }

    // 21st blocked
    expect(() => messagesService.checkRateLimit(spammerId)).toThrow(TooManyRequestsError);
    try {
      messagesService.checkRateLimit(spammerId);
    } catch (err: any) {
      expect(err.statusCode).toBe(429);
      expect(err.message).toBe('You are sending messages too fast');
    }
  });
});
