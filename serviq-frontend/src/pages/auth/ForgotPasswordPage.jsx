import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { House, ArrowLeft, ArrowRight, Mail, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState('');
  const [devResetToken, setDevResetToken] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage('');
    setSubmittedMessage('');

    try {
      const res = await forgotPassword(email);
      setSubmittedMessage(res?.message || 'If this email exists, we have sent a reset link.');
      if (res?.devResetToken) {
        setDevResetToken(res.devResetToken);
      }
    } catch (err) {
      if (err.status === 429) {
        setErrorMessage('Password reset limit reached. Max 3 requests per hour. Please wait before trying again.');
      } else {
        // Neutral message on general errors
        setSubmittedMessage('If this email exists, we have sent a reset link.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-layout single-panel">
      <div className="auth-form-column centered">
        <div className="auth-form-inner max-480">
          <Link to="/" className="brand center-brand">
            <span className="brand-mark">
              <House size={19} strokeWidth={2.5} />
            </span>
            <span>
              serviq<span className="brand-dot">.</span>
            </span>
          </Link>

          <div className="auth-header text-center">
            <h1>Reset your password</h1>
            <p>Enter your registered email address and we’ll send you instructions to reset your password.</p>
          </div>

          {errorMessage && (
            <div className="auth-alert error" role="alert">
              <AlertCircle size={18} className="alert-icon" />
              <span>{errorMessage}</span>
            </div>
          )}

          {submittedMessage ? (
            <div className="reset-success-card">
              <div className="reset-icon-wrap">
                <CheckCircle2 size={32} color="#188355" />
              </div>
              <h3>Check your inbox</h3>
              <p>{submittedMessage}</p>

              {devResetToken && (
                <div className="dev-token-box">
                  <small>Development environment helper:</small>
                  <Link
                    to={`/reset-password?token=${devResetToken}`}
                    className="btn small"
                    style={{ marginTop: '8px' }}
                  >
                    Open Reset Password Form <ArrowRight size={14} />
                  </Link>
                </div>
              )}

              <Link to="/login" className="btn secondary full-width" style={{ marginTop: '20px' }}>
                <ArrowLeft size={15} />
                <span>Return to login</span>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              <div className="form-group">
                <label htmlFor="forgot-email">Account email address</label>
                <div className="input-with-icon">
                  <Mail size={16} className="input-left-icon" />
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn full-width"
                disabled={isSubmitting || !email}
              >
                {isSubmitting ? (
                  <span className="btn-spinner">Sending link…</span>
                ) : (
                  <>
                    <span>Send reset link</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>

              <div className="auth-footer-prompt center">
                <Link to="/login" className="auth-sub-link flex-center">
                  <ArrowLeft size={14} />
                  <span>Back to login</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
