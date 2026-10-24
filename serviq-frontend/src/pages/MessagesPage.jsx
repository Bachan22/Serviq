import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { dbService } from '../api/database.js';
import {
  MessageCircle,
  Send,
  Phone,
  Clock,
  Check,
  ShieldCheck,
  User,
  Wrench,
  Sparkles,
} from 'lucide-react';

const STORAGE_CHAT_KEY = 'serviq_chat_messages';

export default function MessagesPage({ notify }) {
  const { user } = useAuth();
  const role = user?.role || 'customer';
  const isCustomer = role === 'customer';

  // Load bookings to populate conversations
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState({});
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef(null);

  // Initialize conversations from bookings & saved chats
  useEffect(() => {
    const jobs = JSON.parse(localStorage.getItem('serviq_db_jobs') || '[]');
    const workers = JSON.parse(localStorage.getItem('serviq_db_workers') || '[]');
    const savedChats = JSON.parse(localStorage.getItem(STORAGE_CHAT_KEY) || '{}');

    // Build conversation list
    const convList = [];

    if (isCustomer) {
      // Find jobs belonging to this customer
      const myJobs = jobs.filter((j) => j.customerId === user?.id || !user?.id);
      myJobs.forEach((job) => {
        const worker = workers.find((w) => w.id === job.acceptedWorkerId) || {
          id: 'demo-w-1',
          name: 'Ramesh Patil',
          skill: 'Plumbing',
          phoneNumber: '+91 98200 12345',
        };

        convList.push({
          id: `conv-${job.id}`,
          bookingId: job.id,
          title: job.title || `${job.service} service`,
          participantName: worker.name,
          participantSkill: worker.skill,
          participantPhone: worker.phoneNumber || '+91 98200 12345',
          participantRole: 'Service Professional',
          lastActive: 'Just now',
        });
      });
    } else {
      // Worker side: find jobs accepted by this worker
      const myActiveJobs = jobs.filter(
        (j) => j.acceptedWorkerId === user?.id || ['accepted', 'on_the_way', 'in_progress'].includes(j.status)
      );

      myActiveJobs.forEach((job) => {
        convList.push({
          id: `conv-${job.id}`,
          bookingId: job.id,
          title: job.title || `${job.service} service`,
          participantName: job.customerName || 'Customer',
          participantAddress: job.location || 'Local address',
          participantRole: 'Customer',
          lastActive: 'Just now',
        });
      });
    }

    // Default sample conversation if no jobs found
    if (convList.length === 0) {
      convList.push({
        id: 'conv-sample',
        bookingId: 'SQ-1050',
        title: 'Plumbing repair inquiry',
        participantName: isCustomer ? 'Ramesh Patil' : 'Suraj Yadav',
        participantSkill: isCustomer ? 'Plumbing Specialist' : 'Customer',
        participantPhone: '+91 98200 12345',
        participantRole: isCustomer ? 'Service Professional' : 'Customer',
        lastActive: 'Active now',
      });
    }

    setConversations(convList);
    setActiveConvId(convList[0]?.id || null);

    // Initial messages if none saved
    if (Object.keys(savedChats).length === 0) {
      const initial = {
        'conv-sample': [
          {
            id: 'm1',
            sender: 'other',
            text: isCustomer
              ? 'Hello! I have accepted your request and am reviewing the location.'
              : 'Hi! Looking forward to your visit. What time can I expect you?',
            timestamp: '10:30 AM',
          },
          {
            id: 'm2',
            sender: 'me',
            text: isCustomer
              ? 'Sounds great. Let me know when you start travelling.'
              : 'I will depart shortly and share my live route!',
            timestamp: '10:32 AM',
          },
        ],
      };
      setMessages(initial);
      localStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(initial));
    } else {
      setMessages(savedChats);
    }
  }, [user?.id, isCustomer]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeConvId]);

  const activeConv = conversations.find((c) => c.id === activeConvId);
  const currentThread = messages[activeConvId] || [
    {
      id: 'm-default',
      sender: 'other',
      text: `Hello! Coordinate directly here for booking ${activeConv?.bookingId || ''}.`,
      timestamp: 'Just now',
    },
  ];

  const handleSend = (textToSend) => {
    const content = (textToSend || draft).trim();
    if (!content || !activeConvId) return;

    const newMsg = {
      id: `m-${Date.now()}`,
      sender: 'me',
      text: content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedThread = [...currentThread, newMsg];
    const updatedAll = { ...messages, [activeConvId]: updatedThread };
    setMessages(updatedAll);
    localStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(updatedAll));
    setDraft('');

    // Automated professional reply after 1.5 seconds if simulating
    setTimeout(() => {
      const replies = [
        "Got it! I'm on it right now.",
        'Thank you for confirming, see you shortly.',
        'Noted! Live location is active on your booking map.',
        'Perfect, will reach in about 10 minutes.',
      ];
      const replyText = replies[Math.floor(Math.random() * replies.length)];

      const autoReply = {
        id: `m-reply-${Date.now()}`,
        sender: 'other',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const withReply = [...updatedThread, autoReply];
      const finalAll = { ...messages, [activeConvId]: withReply };
      setMessages(finalAll);
      localStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(finalAll));
    }, 1200);
  };

  const quickReplies = isCustomer
    ? ['What is your ETA?', 'Are you on the way?', 'Please ring the doorbell', 'Near Main Gate']
    : ['I am on my way now', 'Arrived at your building', 'Traffic is light, reaching soon', 'Please share flat number'];

  return (
    <div className="messages-layout-container" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div className="page-heading">
        <div className="eyebrow">DIRECT COMMUNICATION</div>
        <h1>Messages & Coordination</h1>
        <p>Coordinate service details directly with your technician or customer.</p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 320px) 1fr',
        gap: '20px',
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        minHeight: '560px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
        overflow: 'hidden',
      }}>
        {/* Left: Conversations List */}
        <div style={{ borderRight: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
            <strong style={{ fontSize: '14px', color: '#0F1115' }}>Active Conversations</strong>
            <small style={{ display: 'block', color: '#64748B', fontSize: '11px', marginTop: '2px' }}>
              Linked to your verified bookings
            </small>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversations.map((conv) => {
              const isActive = conv.id === activeConvId;
              const initials = conv.participantName.slice(0, 2).toUpperCase();
              return (
                <div
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid #F8FAFC',
                    cursor: 'pointer',
                    background: isActive ? '#FFFBEB' : '#FFFFFF',
                    borderLeft: isActive ? '4px solid #FF9900' : '4px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: '#0F1115',
                      color: '#FF9900',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '700',
                      fontSize: '13px',
                    }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '13px', color: '#0F1115' }}>
                          {conv.participantName}
                        </strong>
                        <small style={{ fontSize: '10px', color: '#94A3B8' }}>{conv.lastActive}</small>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {conv.title} · {conv.bookingId}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Active Chat Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          {activeConv ? (
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid #F1F5F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#FFFFFF',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#F1F5F9',
                  color: '#0F1115',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '13px',
                }}>
                  {activeConv.participantName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ fontSize: '14px', color: '#0F1115' }}>{activeConv.participantName}</strong>
                    <ShieldCheck size={14} color="#10B981" />
                    <span style={{ fontSize: '11px', background: '#F1F5F9', padding: '1px 6px', borderRadius: '4px', color: '#64748B' }}>
                      {activeConv.participantRole}
                    </span>
                  </div>
                  <small style={{ color: '#64748B', fontSize: '11px' }}>
                    {activeConv.title} ({activeConv.bookingId})
                  </small>
                </div>
              </div>

              {activeConv.participantPhone && (
                <a
                  href={`tel:${activeConv.participantPhone}`}
                  className="btn secondary small"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px', textDecoration: 'none' }}
                >
                  <Phone size={13} /> Call
                </a>
              )}
            </div>
          ) : (
            <div style={{ padding: '20px', color: '#64748B' }}>Select a conversation</div>
          )}

          {/* Messages Feed */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            background: '#F8FAFC',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            {currentThread.map((msg) => {
              const isMe = msg.sender === 'me';
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
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                    backgroundColor: isMe ? '#0F1115' : '#FFFFFF',
                    color: isMe ? '#FFFFFF' : '#0F1115',
                    fontSize: '13px',
                    lineHeight: '1.45',
                    boxShadow: isMe ? 'none' : '0 2px 6px rgba(0,0,0,0.05)',
                    border: isMe ? 'none' : '1px solid #E2E8F0',
                  }}>
                    {msg.text}
                  </div>
                  <small style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px', padding: '0 4px' }}>
                    {msg.timestamp} {isMe && '· Delivered'}
                  </small>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Reply Chips */}
          <div style={{
            padding: '8px 16px',
            background: '#FFFFFF',
            borderTop: '1px solid #F1F5F9',
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
          }}>
            {quickReplies.map((qr) => (
              <button
                key={qr}
                type="button"
                onClick={() => handleSend(qr)}
                style={{
                  fontSize: '11px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  color: '#475569',
                  transition: 'background 0.15s ease',
                }}
              >
                {qr}
              </button>
            ))}
          </div>

          {/* Input Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: '12px 16px',
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
              placeholder="Type your message to coordinate..."
              style={{
                flex: 1,
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="btn primary"
              style={{
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                cursor: draft.trim() ? 'pointer' : 'default',
                opacity: draft.trim() ? 1 : 0.6,
              }}
            >
              <Send size={15} /> Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
