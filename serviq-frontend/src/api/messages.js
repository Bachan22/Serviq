/**
 * Serviq Messages & Conversations API
 * Handles real-time messaging, conversation management, RLS verification,
 * rate limiting (20 msg/min), and persistence.
 */

import { apiClient, ApiError } from './client.js';

const STORAGE_KEYS = {
  CONVERSATIONS: 'serviq_db_conversations',
  MESSAGES: 'serviq_db_messages',
  JOBS: 'serviq_db_jobs',
  WORKERS: 'serviq_db_workers',
  CUSTOMERS: 'serviq_db_customers',
};

// Client-side sliding window rate limiter: 20 messages per 60 seconds
const userSendTimestamps = new Map();

export function checkClientRateLimit(userId) {
  const uid = userId || 'anonymous';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const timestamps = (userSendTimestamps.get(uid) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= 20) {
    throw new ApiError('You are sending messages too fast', 429, 'TOO_MANY_REQUESTS');
  }
  timestamps.push(now);
  userSendTimestamps.set(uid, timestamps);
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getLocalStore(key, defaultVal = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function saveLocalStore(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Error saving store ${key}:`, err);
  }
}

/**
 * Sync real bookings/jobs into local conversations
 * Rule: A conversation is created ONLY when a real booking or accepted offer exists.
 */
function syncConversationsFromJobs(currentUser) {
  if (!currentUser || !currentUser.id) return [];
  const jobs = getLocalStore(STORAGE_KEYS.JOBS, []);
  const workers = getLocalStore(STORAGE_KEYS.WORKERS, []);
  const customers = getLocalStore(STORAGE_KEYS.CUSTOMERS, []);
  let convs = getLocalStore(STORAGE_KEYS.CONVERSATIONS, []);
  let allMessages = getLocalStore(STORAGE_KEYS.MESSAGES, []);

  const isCustomer = currentUser.role === 'customer';
  const relevantJobs = jobs.filter((job) => {
    // Only jobs with a real booking/assigned or accepted worker
    const hasWorker = Boolean(job.acceptedWorkerId || job.workerId);
    if (!hasWorker) return false;

    if (isCustomer) {
      return job.customerId === currentUser.id;
    } else {
      return (
        job.acceptedWorkerId === currentUser.id ||
        job.workerId === currentUser.id
      );
    }
  });

  relevantJobs.forEach((job) => {
    const workerId = job.acceptedWorkerId || job.workerId;
    const existingIndex = convs.findIndex(
      (c) => c.bookingId === job.id || c.bookingNumber === job.bookingNumber
    );

    if (existingIndex === -1 && workerId && job.customerId) {
      const convId = `conv-${job.id}`;
      const newConv = {
        id: convId,
        bookingId: job.id,
        bookingNumber: job.bookingNumber || job.id,
        customerId: job.customerId,
        workerId: workerId,
        serviceTitle: job.title || `${job.service || 'Service'} Booking`,
        createdAt: job.createdAt || new Date().toISOString(),
        updatedAt: job.updatedAt || new Date().toISOString(),
      };
      convs.push(newConv);

      // System notice for REAL event: Booking confirmed
      const hasNotice = allMessages.some(
        (m) => m.conversationId === convId && m.isSystemNotice
      );
      if (!hasNotice) {
        allMessages.push({
          id: `msg-sys-${job.id}`,
          conversationId: convId,
          senderId: 'system',
          body: `Booking ${job.bookingNumber || job.id} confirmed. Coordinate details directly here.`,
          isSystemNotice: true,
          createdAt: job.createdAt || new Date().toISOString(),
          readAt: new Date().toISOString(),
        });
      }
    }
  });

  saveLocalStore(STORAGE_KEYS.CONVERSATIONS, convs);
  saveLocalStore(STORAGE_KEYS.MESSAGES, allMessages);

  // Return formatted conversations for current user
  return formatConversationsForUser(convs, currentUser, workers, customers, allMessages);
}

function formatConversationsForUser(convs, currentUser, workers, customers, allMessages) {
  const isCustomer = currentUser.role === 'customer';
  const userConvs = convs.filter(
    (c) => c.customerId === currentUser.id || c.workerId === currentUser.id
  );

  return userConvs.map((c) => {
    const otherParticipantId = isCustomer ? c.workerId : c.customerId;
    let otherName = isCustomer ? 'Service Professional' : 'Customer';
    let otherService = c.serviceTitle || 'Home Service';
    let otherPhone = null;

    if (isCustomer) {
      const w = workers.find((item) => item.id === c.workerId);
      if (w) {
        otherName = w.name || w.fullName || otherName;
        otherService = w.skill || w.primarySkill || otherService;
        // Phone sharing: only if valid phone number is present
        if (w.phoneNumber && w.phoneNumber.trim().length > 5) {
          otherPhone = w.phoneNumber;
        }
      }
    } else {
      const cust = customers.find((item) => item.id === c.customerId);
      if (cust) {
        otherName = cust.fullName || cust.name || otherName;
        if (cust.phoneNumber && cust.phoneNumber.trim().length > 5) {
          otherPhone = cust.phoneNumber;
        }
      }
    }

    // Get messages for this conversation
    const msgs = allMessages
      .filter((m) => m.conversationId === c.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const lastMsg = msgs.length > 0 ? msgs[0] : null;
    const unreadCount = msgs.filter(
      (m) =>
        m.senderId !== currentUser.id &&
        !m.isSystemNotice &&
        !m.readAt
    ).length;

    return {
      id: c.id,
      bookingId: c.bookingNumber || c.bookingId,
      rawBookingId: c.bookingId,
      customerId: c.customerId,
      workerId: c.workerId,
      otherParticipant: {
        id: otherParticipantId,
        name: otherName,
        service: otherService,
        phone: otherPhone,
        role: isCustomer ? 'worker' : 'customer',
      },
      lastMessage: lastMsg
        ? {
            body: lastMsg.body,
            createdAt: lastMsg.createdAt,
            senderId: lastMsg.senderId,
          }
        : null,
      unreadCount,
      updatedAt: c.updatedAt || c.createdAt,
      createdAt: c.createdAt,
    };
  });
}

export const messagesApi = {
  /**
   * Fetch all conversations for the logged in user
   */
  async getConversations(currentUser) {
    if (!currentUser || !currentUser.id) return [];

    try {
      const res = await apiClient('/messages/conversations');
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch {
      // Backend offline or fallback to local dynamic store
    }

    return syncConversationsFromJobs(currentUser);
  },

  /**
   * Get a conversation and mark messages as read
   */
  async getConversation(conversationId, currentUser) {
    if (!conversationId || !currentUser || !currentUser.id) return null;

    try {
      const res = await apiClient(`/messages/conversations/${conversationId}`);
      if (res && res.data) {
        return res.data;
      }
    } catch {
      // Fallback
    }

    const convs = getLocalStore(STORAGE_KEYS.CONVERSATIONS, []);
    const conv = convs.find((c) => c.id === conversationId);
    if (!conv) return null;

    // RLS: Only participants can read
    if (conv.customerId !== currentUser.id && conv.workerId !== currentUser.id) {
      throw new ApiError('You do not have access to this conversation', 403, 'FORBIDDEN');
    }

    let allMessages = getLocalStore(STORAGE_KEYS.MESSAGES, []);
    let modified = false;

    // Mark messages from other participant as read
    allMessages = allMessages.map((m) => {
      if (m.conversationId === conversationId && m.senderId !== currentUser.id && !m.readAt) {
        modified = true;
        return { ...m, readAt: new Date().toISOString() };
      }
      return m;
    });

    if (modified) {
      saveLocalStore(STORAGE_KEYS.MESSAGES, allMessages);
    }

    const conversationMessages = allMessages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    return {
      conversation: conv,
      messages: conversationMessages,
    };
  },

  /**
   * Send a real message
   */
  async sendMessage(conversationId, senderId, body) {
    const trimmed = (body || '').trim();
    if (!trimmed) {
      throw new ApiError('Message cannot be empty', 400, 'BAD_REQUEST');
    }
    if (trimmed.length > 1000) {
      throw new ApiError('Message cannot exceed 1000 characters', 400, 'BAD_REQUEST');
    }

    // Rate limiting: max 20 messages per minute
    checkClientRateLimit(senderId);

    const sanitizedBody = escapeHtml(trimmed);

    // Try sending to backend API
    try {
      const res = await apiClient(`/messages/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: { body: sanitizedBody },
      });
      if (res && res.data) {
        return res.data;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        throw err;
      }
      // If network / offline fallback
    }

    // Local storage fallback
    const convs = getLocalStore(STORAGE_KEYS.CONVERSATIONS, []);
    const conv = convs.find((c) => c.id === conversationId);
    if (!conv) {
      throw new ApiError('Conversation not found', 404, 'NOT_FOUND');
    }

    if (conv.customerId !== senderId && conv.workerId !== senderId) {
      throw new ApiError('You do not have access to this conversation', 403, 'FORBIDDEN');
    }

    const nowIso = new Date().toISOString();
    const newMsg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      conversationId,
      senderId,
      body: sanitizedBody,
      isSystemNotice: false,
      createdAt: nowIso,
      readAt: null,
    };

    const allMessages = getLocalStore(STORAGE_KEYS.MESSAGES, []);
    allMessages.push(newMsg);
    saveLocalStore(STORAGE_KEYS.MESSAGES, allMessages);

    // Update conversation updatedAt
    conv.updatedAt = nowIso;
    saveLocalStore(STORAGE_KEYS.CONVERSATIONS, convs);

    return newMsg;
  },
};
