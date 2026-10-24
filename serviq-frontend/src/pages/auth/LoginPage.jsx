import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { authApi } from '../../api/auth.js';
import { House, Eye, EyeOff, ShieldCheck, Star, AlertCircle, Clock, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // If already authenticated, redirect immediately to role home
  useEffect(() => {
    if (isAuthenticated && user?.role) {
      const returnTo = location.state?.returnTo;
      if (returnTo && returnTo.startsWith(`/${user.role}`)) {
        navigate(returnTo, { replace: true });
      } else {
        navigate(`/${user.role}`, { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate, location.state]);

  // Check lockout on email change or mount
  useEffect(() => {
    if (email) {
      const status = authApi.getLockoutStatus(email);
      if (status.isLocked) {
        setLockoutSeconds(status.remainingSeconds);
      } else {
        setLockoutSeconds(0);
      }
    }
  }, [email]);

  // Countdown timer when locked out
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setErrorMessage('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  const formatCountdown = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || lockoutSeconds > 0) return;

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const loggedInUser = await login({ email, password, rememberMe });
      if (loggedInUser) {
        const returnTo = location.state?.returnTo;
        if (returnTo && returnTo.startsWith(`/${loggedInUser.role}`)) {
          navigate(returnTo, { replace: true });
        } else {
          navigate(`/${loggedInUser.role}`, { replace: true });
        }
      }
    } catch (err) {
      if (err.status === 429 || err.code === 'ACCOUNT_LOCKED') {
        const retrySecs = err.details?.retryAfterSeconds || 900;
        setLockoutSeconds(retrySecs);
        setErrorMessage(
          `Account temporarily locked after 5 failed attempts. Please try again in ${formatCountdown(retrySecs)}.`
        );
      } else {
        setErrorMessage('Incorrect email or password.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLocked = lockoutSeconds > 0;

  return (
    <div className="auth-layout">
      {/* Form Column */}
      <div className="auth-form-column">
        <div className="auth-form-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">
              <House size={19} strokeWidth={2.5} />
            </span>
            <span>
              serviq<span className="brand-dot">.</span>
            </span>
          </Link>

          <div className="auth-header">
            <h1>Welcome back</h1>
            <p>Log in to your Serviq account to continue</p>
          </div>

          {/* Lockout Warning Banner */}
          {isLocked && (
            <div className="auth-alert warning" role="alert">
              <Clock size={18} className="alert-icon" />
              <div>
                <strong>Security Lockout Active</strong>
                <p>
                  Too many failed attempts. Try again in{' '}
                  <span className="lockout-timer">{formatCountdown(lockoutSeconds)}</span>
                </p>
              </div>
            </div>
          )}

          {/* Generic Error Banner */}
          {errorMessage && !isLocked && (
            <div className="auth-alert error" role="alert">
              <AlertCircle size={18} className="alert-icon" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="form-group">
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                autoComplete="email"
                disabled={isSubmitting || isLocked}
              />
            </div>

            <div className="form-group">
              <div className="label-row">
                <label htmlFor="login-password">Password</label>
                <Link to="/forgot-password" className="auth-sub-link">
                  Forgot password?
                </Link>
              </div>
              <div className="password-input-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  disabled={isSubmitting || isLocked}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="remember-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isSubmitting || isLocked}
                />
                <span>Remember me for 30 days</span>
              </label>
            </div>

            <button
              type="submit"
              className="btn full-width"
              disabled={isSubmitting || isLocked || !email || !password}
            >
              {isSubmitting ? (
                <span className="btn-spinner">Signing in…</span>
              ) : isLocked ? (
                `Locked (${formatCountdown(lockoutSeconds)})`
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>

            {/* Quick Demo Credentials Box for Evaluation */}
            <div className="demo-credentials-card">
              <div className="demo-cred-title">
                <ShieldCheck size={14} />
                <span>Pre-configured Test Accounts</span>
              </div>
              <div className="demo-cred-row">
                <button
                  type="button"
                  className="demo-pill"
                  onClick={() => {
                    setEmail('customer.demo@serviq.test');
                    setPassword('Serviq2026!');
                  }}
                >
                  Customer Demo
                </button>
                <button
                  type="button"
                  className="demo-pill"
                  onClick={() => {
                    setEmail('worker.demo@serviq.test');
                    setPassword('Serviq2026!');
                  }}
                >
                  Worker Demo
                </button>
              </div>
            </div>

            <div className="auth-footer-prompt">
              Don’t have an account?{' '}
              <Link to="/signup" className="auth-main-link">
                Choose your role and sign up
              </Link>
            </div>
          </form>
        </div>
      </div>

      {/* Branded Brand/Visual Column */}
      <div className="auth-brand-column">
        <div className="auth-brand-content">
          <div className="tag dark">
            <ShieldCheck size={13} /> VERIFIED HYPERLOCAL SERVICES
          </div>
          <h2>
            Good help.
            <br />
            <em>Right around the corner.</em>
          </h2>
          <p>
            Connect with certified local professionals or grow your independent trade business on Serviq.
          </p>

          <div className="auth-brand-highlights">
            <div className="auth-highlight-item">
              <div className="highlight-icon">
                <ShieldCheck size={18} />
              </div>
              <div>
                <strong>Verified Backgrounds</strong>
                <p>Manual review and verified trade qualifications</p>
              </div>
            </div>
            <div className="auth-highlight-item">
              <div className="highlight-icon">
                <Star size={18} />
              </div>
              <div>
                <strong>Transparent Pricing</strong>
                <p>Agree on scope and price before any work begins</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
