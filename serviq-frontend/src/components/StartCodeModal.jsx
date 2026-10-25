import React, { useState, useEffect } from 'react';
import { KeyRound, Lock, AlertCircle, X, Check } from 'lucide-react';

export default function StartCodeModal({ job, onClose, onConfirm, isSubmitting, error, lockedUntil }) {
  const [code, setCode] = useState('');
  const [lockSecondsRemaining, setLockSecondsRemaining] = useState(0);

  // Compute lock countdown if lockedUntil timestamp is provided
  useEffect(() => {
    if (!lockedUntil) {
      setLockSecondsRemaining(0);
      return;
    }
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.floor((new Date(lockedUntil).getTime() - Date.now()) / 1000));
      setLockSecondsRemaining(remaining);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (lockSecondsRemaining > 0) return;
    if (code.length !== 4 || !/^\d{4}$/.test(code)) {
      alert('Please enter a valid 4-digit numeric start code.');
      return;
    }
    onConfirm(code);
  };

  const isLocked = lockSecondsRemaining > 0;
  const lockMinutes = Math.floor(lockSecondsRemaining / 60);
  const lockSecs = lockSecondsRemaining % 60;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 17, 21, 0.7)',
        backdropFilter: 'blur(6px)',
        zIndex: 10050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '440px',
          padding: '24px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'none',
            border: 'none',
            color: '#64748B',
            cursor: 'pointer',
            padding: '4px',
          }}
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: isLocked ? '#FEE2E2' : '#FFF7ED',
              color: isLocked ? '#DC2626' : '#EA580C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            {isLocked ? <Lock size={26} /> : <KeyRound size={26} />}
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>
            {isLocked ? 'Start Verification Locked' : 'Enter Customer Start Code'}
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748B', lineHeight: '1.4' }}>
            {isLocked
              ? `Too many failed attempts. Verification is locked for ${lockMinutes}m ${lockSecs < 10 ? '0' : ''}${lockSecs}s.`
              : 'Ask the customer for the 4-digit code displayed on their screen to begin work.'}
          </p>
        </div>

        {error && !isLocked && (
          <div
            style={{
              background: '#FEF2F2',
              border: '1px solid #FEE2E2',
              borderRadius: '10px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#DC2626',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLocked && (
            <div style={{ marginBottom: '20px' }}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="0 0 0 0"
                autoFocus
                style={{
                  width: '100%',
                  textAlign: 'center',
                  fontSize: '32px',
                  fontWeight: 800,
                  letterSpacing: '12px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '2px solid #CBD5E1',
                  color: '#0F172A',
                  fontFamily: 'monospace',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ textAlign: 'center', fontSize: '11px', color: '#94A3B8', marginTop: '6px' }}>
                4-digit code (locks for 10 min after 5 wrong attempts)
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn secondary"
              onClick={onClose}
              style={{ flex: 1, padding: '10px' }}
            >
              Cancel
            </button>
            {!isLocked && (
              <button
                type="submit"
                disabled={code.length !== 4 || isSubmitting}
                className="btn primary"
                style={{
                  flex: 2,
                  padding: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  opacity: code.length !== 4 || isSubmitting ? 0.6 : 1,
                }}
              >
                {isSubmitting ? 'Verifying…' : (
                  <>
                    <Check size={16} /> Verify & Begin Work
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
