import React from 'react';
import { Check, Circle } from 'lucide-react';

const STEPS = [
  { key: 'posted', label: 'Posted' },
  { key: 'offers', label: 'Offers' },
  { key: 'booked', label: 'Booked' },
  { key: 'on_the_way', label: 'On the way' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
];

export default function CustomerJobStepper({ status, rawStatus }) {
  const norm = (status || rawStatus || 'open').toLowerCase();

  // Determine current active step index (0-5)
  let currentIndex = 0;
  if (norm === 'open' || norm === 'pending_acceptance') {
    currentIndex = 1; // Posted & waiting for offers
  } else if (norm === 'bidding' || norm === 'negotiating') {
    currentIndex = 1; // Under negotiation / reviewing offers
  } else if (norm === 'accepted') {
    currentIndex = 2; // Booked!
  } else if (norm === 'on_the_way' || norm === 'arrived') {
    currentIndex = 3; // Technician en route / arrived
  } else if (norm === 'in_progress' || norm === 'payment_pending') {
    currentIndex = 4; // Service underway
  } else if (norm === 'completed') {
    currentIndex = 5; // Completed!
  }

  return (
    <div style={{ padding: '14px 0', width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
        }}
      >
        {/* Background track line */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '20px',
            right: '20px',
            height: '2px',
            backgroundColor: '#E2E8F0',
            zIndex: 0,
          }}
        />

        {/* Progress track line */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '20px',
            width: `${Math.min(100, Math.max(0, (currentIndex / (STEPS.length - 1)) * 100))}%`,
            height: '2px',
            backgroundColor: '#FF9900',
            zIndex: 0,
            transition: 'width 0.3s ease',
          }}
        />

        {STEPS.map((step, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <div
              key={step.key}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                zIndex: 1,
                minWidth: '50px',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700,
                  transition: 'all 0.2s ease',
                  backgroundColor: isDone ? '#16A34A' : isCurrent ? '#FF9900' : '#FFFFFF',
                  color: isDone || isCurrent ? '#FFFFFF' : '#94A3B8',
                  border: isDone ? '2px solid #16A34A' : isCurrent ? '2px solid #FF9900' : '2px solid #CBD5E1',
                  boxShadow: isCurrent ? '0 0 0 3px rgba(255, 153, 0, 0.2)' : 'none',
                }}
              >
                {isDone ? <Check size={12} strokeWidth={3} /> : idx + 1}
              </div>
              <span
                style={{
                  fontSize: '11px',
                  marginTop: '6px',
                  fontWeight: isCurrent ? 700 : isDone ? 600 : 500,
                  color: isCurrent ? '#EA580C' : isDone ? '#1E293B' : '#94A3B8',
                  whiteSpace: 'nowrap',
                }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
