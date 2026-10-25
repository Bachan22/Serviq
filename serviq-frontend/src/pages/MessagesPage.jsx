import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { messagesApi } from '../api/messages.js';
import {
  MessageSquare,
  Send,
  Phone,
  Clock,
  Check,
  CheckCheck,
  ShieldCheck,
  Inbox,
  AlertCircle,
} from 'lucide-react';
import VoiceInputButton from '../components/voice/VoiceInputButton.jsx';

/**
 * Format timestamp into Indian Standard Time (IST)
 */
function formatIndianTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';

  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatRelativeOrDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) {
    return formatIndianTime(dateStr);
  }

  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
  });
}

export default function MessagesPage({ notify }) {
  const { user } = useAuth();
  const role = user?.role || 'customer';
  const isCustomer = role === 'customer';

  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const messagesEndRef = useRef(null);
  const pollingRef = useRef(null);

  // Role-dependent quick-reply chips
  const quickReplies = isCustomer
    ? ['What is your ETA?', 'Please ring the doorbell']
    : ['On my way', 'I have reached', 'Need 10 more minutes'];

  // Load conversations
  const loadConversations = useCallback(
    async (maintainActive = true) => {
      if (!user?.id) return;
      try {
        const convList = await messagesApi.getConversations(user);
        setConversations(convList);

        if (convList.length > 0) {
          setActiveConvId((prev) => {
            if (maintainActive && prev && convList.some((c) => c.id === prev)) {
              return prev;
            }
            return convList[0].id;
          });
        } else {
          setActiveConvId(null);
          setThreadMessages([]);
        }
      } catch (err) {
        console.error('Failed to load conversations:', err);
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  // Load messages for the active conversation
  const loadActiveMessages = useCallback(async () => {
    if (!activeConvId || !user?.id) return;
    try {
      const data = await messagesApi.getConversation(activeConvId, user);
      if (data && Array.isArray(data.messages)) {
        setThreadMessages(data.messages);
      }
    } catch (err) {
      console.error('Failed to load active messages:', err);
      if (err?.status === 403) {
        setErrorMessage('You do not have access to this conversation.');
      }
    }
  }, [activeConvId, user]);

  // Initial load
  useEffect(() => {
    loadConversations(false);
  }, [loadConversations]);

  // Polling every 3 seconds for realtime sync
  useEffect(() => {
    loadActiveMessages();

    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(() => {
      loadConversations(true);
      loadActiveMessages();
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activeConvId, loadActiveMessages, loadConversations]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages]);

  const activeConv = conversations.find((c) => c.id === activeConvId);

  // Send message handler
  const handleSend = async (textToSend) => {
    const content = (textToSend || draft).trim();
    if (!content || !activeConvId || !user?.id || sending) return;

    setErrorMessage('');
    setSending(true);

    try {
      const newMsg = await messagesApi.sendMessage(activeConvId, user.id, content);
      setThreadMessages((prev) => [...prev, newMsg]);
      setDraft('');

      // Refresh conversations to update last message preview and timestamp
      loadConversations(true);
    } catch (err) {
      const msg =
        err?.status === 429
          ? 'You are sending messages too fast'
          : err?.message || 'Failed to send message. Please try again.';

      setErrorMessage(msg);
      if (notify) {
        notify(msg, 'error');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="messages-layout-container" style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 16px' }}>
      <div className="page-heading" style={{ marginBottom: '20px' }}>
        <div className="eyebrow" style={{ color: '#F59E0B', fontWeight: '700', fontSize: '11px', letterSpacing: '0.08em' }}>
          VERIFIED COORDINATION
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0F1115', margin: '4px 0 6px' }}>
          Messages & Coordination
        </h1>
        <p style={{ color: '#64748B', fontSize: '14px', margin: 0 }}>
          Direct communication with your {isCustomer ? 'service professional' : 'customer'}.
        </p>
      </div>

      {errorMessage && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            color: '#B91C1C',
            padding: '10px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
          }}
        >
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Container */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 340px) 1fr',
          gap: 0,
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          minHeight: '600px',
          height: 'calc(100vh - 220px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Left Sidebar: Conversations List */}
        <div style={{ borderRight: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', background: '#FAFAFA' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', background: '#FFFFFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: '15px', color: '#0F1115', fontWeight: '700' }}>Active Chats</strong>
              <span style={{ fontSize: '12px', color: '#64748B', background: '#F1F5F9', padding: '2px 8px', borderRadius: '12px' }}>
                {conversations.length}
              </span>
            </div>
            <small style={{ display: 'block', color: '#94A3B8', fontSize: '11px', marginTop: '4px' }}>
              Shows verified booking participants
            </small>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversations.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8' }}>
                <Inbox size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                <p style={{ fontSize: '13px', lineHeight: '1.5', margin: 0, color: '#64748B', fontWeight: '500' }}>
                  No messages yet. Messages appear after you book or accept a job.
                </p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = conv.id === activeConvId;
                const other = conv.otherParticipant || {};
                const initials = (other.name || 'U').slice(0, 2).toUpperCase();

                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      setActiveConvId(conv.id);
                      setErrorMessage('');
                    }}
                    style={{
                      padding: '14px 18px',
                      borderBottom: '1px solid #F1F5F9',
                      cursor: 'pointer',
                      background: isActive ? '#FFFBEB' : '#FFFFFF',
                      borderLeft: isActive ? '4px solid #F59E0B' : '4px solid transparent',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          background: isActive ? '#0F1115' : '#F1F5F9',
                          color: isActive ? '#F59E0B' : '#0F1115',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                          fontSize: '14px',
                          flexShrink: 0,
                        }}
                      >
                        {initials}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                          <strong
                            style={{
                              fontSize: '13px',
                              color: '#0F1115',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '140px',
                            }}
                          >
                            {other.name}
                          </strong>
                          {conv.lastMessage && (
                            <span style={{ fontSize: '10px', color: '#94A3B8', flexShrink: 0 }}>
                              {formatRelativeOrDate(conv.lastMessage.createdAt)}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '3px' }}>
                          <span style={{ fontWeight: '600' }}>{other.service || 'Service'}</span> · {conv.bookingId}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              color: conv.unreadCount > 0 ? '#0F1115' : '#94A3B8',
                              fontWeight: conv.unreadCount > 0 ? '600' : '400',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '170px',
                            }}
                          >
                            {conv.lastMessage?.body || 'No messages yet'}
                          </span>

                          {conv.unreadCount > 0 && (
                            <span
                              style={{
                                background: '#F59E0B',
                                color: '#0F1115',
                                borderRadius: '10px',
                                fontSize: '10px',
                                fontWeight: '700',
                                padding: '1px 6px',
                                marginLeft: '6px',
                              }}
                            >
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Chat Thread */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#FFFFFF' }}>
          {conversations.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                textAlign: 'center',
                background: '#FAFAFA',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                  color: '#94A3B8',
                }}
              >
                <MessageSquare size={28} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F1115', marginBottom: '8px' }}>
                No active conversations
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '340px', margin: 0, lineHeight: '1.5' }}>
                No messages yet. Messages appear after you book or accept a job.
              </p>
            </div>
          ) : activeConv ? (
            <>
              {/* Active Conversation Header */}
              <div
                style={{
                  padding: '14px 24px',
                  borderBottom: '1px solid #F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#FFFFFF',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: '#0F1115',
                      color: '#F59E0B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '700',
                      fontSize: '14px',
                    }}
                  >
                    {(activeConv.otherParticipant?.name || 'U').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '15px', color: '#0F1115' }}>
                        {activeConv.otherParticipant?.name}
                      </strong>
                      <span
                        style={{
                          fontSize: '11px',
                          background: '#F1F5F9',
                          color: '#475569',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontWeight: '600',
                        }}
                      >
                        {activeConv.otherParticipant?.role === 'worker'
                          ? activeConv.otherParticipant?.service || 'Service Professional'
                          : 'Customer'}
                      </span>
                    </div>
                    <small style={{ color: '#64748B', fontSize: '11px' }}>
                      Booking: <strong>{activeConv.bookingId}</strong>
                    </small>
                  </div>
                </div>

                {/* Call Button: ONLY shown if real verified phone exists */}
                {activeConv.otherParticipant?.phone && activeConv.otherParticipant.phone.trim().length > 5 ? (
                  <a
                    href={`tel:${activeConv.otherParticipant.phone}`}
                    className="btn secondary small"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      padding: '7px 14px',
                      textDecoration: 'none',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      color: '#0F1115',
                      background: '#FFFFFF',
                      fontWeight: '600',
                    }}
                  >
                    <Phone size={13} /> Call
                  </a>
                ) : null}
              </div>

              {/* Messages Thread Feed */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '20px 24px',
                  background: '#F8FAFC',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {threadMessages.length === 0 ? (
                  <div style={{ margin: 'auto', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                    Send a message to begin coordination for booking {activeConv.bookingId}.
                  </div>
                ) : (
                  threadMessages.map((msg) => {
                    // System notice: Small centered grey text, NEVER as a chat bubble!
                    if (msg.isSystemNotice || msg.is_system_notice) {
                      return (
                        <div key={msg.id} style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              color: '#64748B',
                              backgroundColor: '#E2E8F0',
                              padding: '4px 14px',
                              borderRadius: '16px',
                              fontWeight: '500',
                              maxWidth: '85%',
                              textAlign: 'center',
                            }}
                          >
                            {msg.body}
                          </span>
                        </div>
                      );
                    }

                    // Strict sender alignment check: compare senderId with logged-in user.id
                    const currentUserId = user?.id || '';
                    const senderId = msg.senderId || msg.sender_id;
                    const isMe = String(senderId) === String(currentUserId);

                    const timeFormatted = formatIndianTime(msg.createdAt || msg.created_at);

                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isMe ? 'flex-end' : 'flex-start',
                          maxWidth: '75%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isMe ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            padding: '11px 16px',
                            borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                            backgroundColor: isMe ? '#0F1115' : '#FFFFFF',
                            color: isMe ? '#FFFFFF' : '#0F1115',
                            fontSize: '13.5px',
                            lineHeight: '1.45',
                            boxShadow: isMe ? '0 1px 3px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.05)',
                            border: isMe ? 'none' : '1px solid #E2E8F0',
                            wordBreak: 'break-word',
                          }}
                        >
                          {msg.body}
                        </div>

                        {/* Real timestamp in Indian time + Status ticks */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '10.5px',
                            color: '#94A3B8',
                            marginTop: '4px',
                            padding: '0 4px',
                          }}
                        >
                          <span>{timeFormatted}</span>
                          {isMe && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '2px' }}>
                              {msg.readAt || msg.read_at ? (
                                <CheckCheck size={13} color="#38BDF8" title="Read" />
                              ) : (
                                <Check size={13} color="#94A3B8" title="Sent" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick-reply chips based strictly on role */}
              <div
                style={{
                  padding: '8px 18px',
                  background: '#FFFFFF',
                  borderTop: '1px solid #F1F5F9',
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                }}
              >
                {quickReplies.map((text) => (
                  <button
                    key={text}
                    type="button"
                    disabled={sending}
                    onClick={() => handleSend(text)}
                    style={{
                      fontSize: '11.5px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      padding: '5px 12px',
                      borderRadius: '999px',
                      cursor: sending ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      color: '#334155',
                      fontWeight: '500',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!sending) {
                        e.currentTarget.style.background = '#FFFBEB';
                        e.currentTarget.style.borderColor = '#F59E0B';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#F8FAFC';
                      e.currentTarget.style.borderColor = '#E2E8F0';
                    }}
                  >
                    {text}
                  </button>
                ))}
              </div>

              {/* Message Composer Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                style={{
                  padding: '14px 18px',
                  borderTop: '1px solid #F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: '#FFFFFF',
                }}
              >
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message to coordinate..."
                  maxLength={1000}
                  disabled={sending}
                  style={{
                    flex: 1,
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '11px 16px',
                    fontSize: '13.5px',
                    outline: 'none',
                    background: '#FAFAFA',
                    color: '#0F1115',
                  }}
                  onFocus={(e) => (e.target.style.background = '#FFFFFF')}
                  onBlur={(e) => (e.target.style.background = '#FAFAFA')}
                />
                <VoiceInputButton
                  mode="text"
                  disabled={sending}
                  onResult={(spokenText) => {
                    if (spokenText) {
                      setDraft((prev) => {
                        const trimmed = spokenText.trim();
                        if (!prev) return trimmed.slice(0, 1000);
                        const combined = `${prev} ${trimmed}`;
                        return combined.slice(0, 1000);
                      });
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  className="btn primary"
                  style={{
                    padding: '11px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    borderRadius: '10px',
                    background: '#0F1115',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: draft.trim() && !sending ? 'pointer' : 'default',
                    opacity: draft.trim() && !sending ? 1 : 0.6,
                  }}
                >
                  <Send size={15} /> Send
                </button>
              </form>
            </>
          ) : (
            <div style={{ margin: 'auto', color: '#94A3B8', fontSize: '13px' }}>
              Select a conversation to start chatting
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
