import React, { useState, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { House, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: 'none' };
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', color: '#e53e3e' };
    if (score <= 2) return { score: 2, label: 'Fair', color: '#dd6b20' };
    if (score === 3) return { score: 3, label: 'Good', color: '#3182ce' };
    return { score: 4, label: 'Strong', color: '#38a169' };
  }, [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long');
      return;
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setErrorMessage('Password must contain at least one letter and one number');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await resetPassword({ token: token || 'demo-token', newPassword: password });
      setSuccess(true);
    } catch (err) {
      setErrorMessage(err.message || 'Invalid or expired reset link. Please request a new one.');
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
            <h1>Create new password</h1>
            <p>Your new password must be at least 8 characters with letters and numbers.</p>
          </div>

          {errorMessage && (
            <div className="auth-alert error" role="alert">
              <AlertCircle size={18} className="alert-icon" />
              <span>{errorMessage}</span>
            </div>
          )}

          {success ? (
            <div className="reset-success-card">
              <div className="reset-icon-wrap">
                <CheckCircle2 size={32} color="#188355" />
              </div>
              <h3>Password updated!</h3>
              <p>Your password has been changed successfully. You can now log in with your new credentials.</p>
              <button
                type="button"
                className="btn full-width"
                style={{ marginTop: '20px' }}
                onClick={() => navigate('/login', { replace: true })}
              >
                <span>Proceed to login</span>
                <ArrowRight size={15} />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              <div className="form-group">
                <label htmlFor="new-password">New password</label>
                <div className="password-input-wrapper">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {password && (
                <div className="password-meter-wrap">
                  <div className="password-meter-bars">
                    {[1, 2, 3, 4].map((bar) => (
                      <div
                        key={bar}
                        className="meter-bar"
                        style={{
                          backgroundColor:
                            bar <= passwordStrength.score ? passwordStrength.color : '#e2e8f0',
                        }}
                      />
                    ))}
                  </div>
                  <div className="password-meter-label">
                    Strength: <strong>{passwordStrength.label}</strong>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="confirm-new-password">Confirm new password</label>
                <input
                  id="confirm-new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <button
                type="submit"
                className="btn full-width"
                disabled={isSubmitting || !password || !confirmPassword}
              >
                {isSubmitting ? (
                  <span className="btn-spinner">Saving new password…</span>
                ) : (
                  <>
                    <span>Reset password</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>

              <div className="auth-footer-prompt center">
                <Link to="/login" className="auth-sub-link">
                  Cancel and return to login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
