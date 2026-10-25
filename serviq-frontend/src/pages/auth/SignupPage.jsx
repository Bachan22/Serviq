import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  House,
  BriefcaseBusiness,
  UserRound,
  Eye,
  EyeOff,
  ShieldCheck,
  Check,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Wrench,
} from 'lucide-react';
import VoiceInputButton from '../../components/voice/VoiceInputButton.jsx';

const SKILLS = [
  'Plumber',
  'Electrician',
  'Painter',
  'Cleaner',
  'Cook',
  'Carpenter',
  'AC repair',
  'Other',
];

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  // Step 1: Role choice | Step 2: Form
  const [step, setStep] = useState(1);
  const [role, setRole] = useState(null); // 'customer' | 'worker'

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [city, setCity] = useState('Bhayandar, Mumbai');
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Worker-only fields
  const [primarySkill, setPrimarySkill] = useState('Plumber');
  const [experienceYears, setExperienceYears] = useState('3');
  const [serviceArea, setServiceArea] = useState('Bhayandar & Mira Road, Mumbai');
  const [hourlyRate, setHourlyRate] = useState('350');

  // Honeypot field for bot rejection
  const [honeypot, setHoneypot] = useState('');

  // UI States
  const [touched, setTouched] = useState({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password strength evaluation
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

  // Client-side validation errors
  const errors = useMemo(() => {
    const errs = {};
    if (!fullName.trim()) {
      errs.fullName = 'Full name is required';
    } else if (fullName.trim().length < 2) {
      errs.fullName = 'Name must be at least 2 characters';
    }

    if (!email.trim()) {
      errs.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Enter a valid email address';
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (!cleanPhone) {
      errs.phoneNumber = 'Phone number is required';
    } else if (cleanPhone.length !== 10) {
      errs.phoneNumber = 'Enter a valid 10-digit mobile number';
    }

    if (!password) {
      errs.password = 'Password is required';
    } else if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters';
    } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      errs.password = 'Must contain at least one letter and one number';
    }

    if (confirmPassword !== password) {
      errs.confirmPassword = 'Passwords do not match';
    }

    if (!acceptTerms) {
      errs.acceptTerms = 'You must accept the terms of service';
    }

    if (role === 'worker') {
      if (!primarySkill) errs.primarySkill = 'Please select a primary skill';
      if (!experienceYears || Number(experienceYears) < 0) {
        errs.experienceYears = 'Enter valid years of experience';
      }
      if (!serviceArea.trim()) {
        errs.serviceArea = 'Service area is required';
      }
      if (!hourlyRate || Number(hourlyRate) < 50) {
        errs.hourlyRate = 'Minimum hourly rate is ₹50';
      }
    }

    return errs;
  }, [
    fullName,
    email,
    phoneNumber,
    password,
    confirmPassword,
    acceptTerms,
    role,
    primarySkill,
    experienceYears,
    serviceArea,
    hourlyRate,
  ]);

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSelectRole = (chosenRole) => {
    setRole(chosenRole);
    setStep(2);
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({
      fullName: true,
      email: true,
      phoneNumber: true,
      password: true,
      confirmPassword: true,
      acceptTerms: true,
      primarySkill: true,
      experienceYears: true,
      serviceArea: true,
      hourlyRate: true,
    });

    if (Object.keys(errors).length > 0) {
      setFormError('Please resolve the highlighted fields before continuing.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const payload = {
        role,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phoneNumber: `+91${phoneNumber.replace(/\D/g, '').slice(-10)}`,
        password,
        confirmPassword,
        city: city.trim(),
        acceptTerms: true,
        website: honeypot, // Honeypot field
        ...(role === 'worker' && {
          primarySkill,
          experienceYears: Number(experienceYears),
          serviceArea: serviceArea.trim(),
          hourlyRate: Number(hourlyRate),
        }),
      };

      const newUser = await signup(payload);
      if (newUser) {
        navigate(`/${newUser.role}`, { replace: true });
      }
    } catch (err) {
      setFormError(err.message || 'Unable to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // STEP 1: ROLE SELECTION
  if (step === 1) {
    return (
      <div className="auth-step-choice-page">
        <div className="choice-container">
          <Link to="/" className="brand center-brand">
            <span className="brand-mark">
              <House size={19} strokeWidth={2.5} />
            </span>
            <span>
              serviq<span className="brand-dot">.</span>
            </span>
          </Link>

          <div className="choice-header">
            <div className="eyebrow">JOIN SERVIQ</div>
            <h1>How do you want to use Serviq?</h1>
            <p>Select your account type. You’ll receive an experience tailored specifically to your needs.</p>
          </div>

          <div className="role-cards-grid">
            {/* Customer Role Card */}
            <button
              type="button"
              className="role-selection-card customer-card"
              onClick={() => handleSelectRole('customer')}
            >
              <div className="role-card-badge">Customer</div>
              <div className="role-card-icon">
                <UserRound size={32} />
              </div>
              <h2>I need a service</h2>
              <p>
                Find and hire trusted local technicians, plumbers, electricians, and home service specialists.
              </p>
              <div className="role-card-perks">
                <span><Check size={14} /> Clear upfront pricing</span>
                <span><Check size={14} /> Verified local professionals</span>
                <span><Check size={14} /> Direct chat & negotiation</span>
              </div>
              <div className="role-card-cta">
                <span>Continue as Customer</span>
                <ArrowRight size={16} />
              </div>
            </button>

            {/* Worker Role Card */}
            <button
              type="button"
              className="role-selection-card worker-card"
              onClick={() => handleSelectRole('worker')}
            >
              <div className="role-card-badge worker">Professional</div>
              <div className="role-card-icon worker">
                <Wrench size={32} />
              </div>
              <h2>I offer services</h2>
              <p>
                Receive nearby job requests, manage your schedule, set your own rates, and get paid directly.
              </p>
              <div className="role-card-perks">
                <span><Check size={14} /> Real-time nearby job requests</span>
                <span><Check size={14} /> Set your own visiting fees & rates</span>
                <span><Check size={14} /> Counter-offer & direct customer chat</span>
              </div>
              <div className="role-card-cta worker">
                <span>Continue as Service Provider</span>
                <ArrowRight size={16} />
              </div>
            </button>
          </div>

          <div className="auth-footer-prompt center">
            Already have an account?{' '}
            <Link to="/login" className="auth-main-link">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // STEP 2: REGISTRATION FORM
  return (
    <div className="auth-layout">
      {/* Form Column */}
      <div className="auth-form-column">
        <div className="auth-form-inner">
          <div className="form-top-nav">
            <button
              type="button"
              className="change-role-btn"
              onClick={() => {
                setStep(1);
                setFormError('');
              }}
            >
              <ArrowLeft size={14} />
              <span>Change role ({role === 'customer' ? 'Customer' : 'Service Provider'})</span>
            </button>

            <Link to="/" className="brand">
              <span className="brand-mark">
                <House size={18} strokeWidth={2.5} />
              </span>
              <span>
                serviq<span className="brand-dot">.</span>
              </span>
            </Link>
          </div>

          <div className="auth-header">
            <div className="role-pill-indicator">
              {role === 'customer' ? 'Customer Account' : 'Service Provider Account'}
            </div>
            <h1>Create your account</h1>
            <p>
              {role === 'customer'
                ? 'Fill in your details to begin booking trusted local help.'
                : 'Complete your profile to start receiving job requests in your area.'}
            </p>
          </div>

          {formError && (
            <div className="auth-alert error" role="alert">
              <AlertCircle size={18} className="alert-icon" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {/* Hidden honeypot field for automated spam rejection */}
            <input
              type="text"
              name="website"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              style={{ display: 'none', position: 'absolute', left: '-9999px' }}
              aria-hidden="true"
            />

            <div className="form-group">
              <label htmlFor="signup-name">Full name</label>
              <input
                id="signup-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onBlur={() => handleBlur('fullName')}
                placeholder="e.g. Full Name"
                required
                className={touched.fullName && errors.fullName ? 'input-error' : ''}
              />
              {touched.fullName && errors.fullName && (
                <span className="field-error">{errors.fullName}</span>
              )}
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="signup-email">Email address</label>
                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => handleBlur('email')}
                  placeholder="name@example.com"
                  required
                  className={touched.email && errors.email ? 'input-error' : ''}
                />
                {touched.email && errors.email && (
                  <span className="field-error">{errors.email}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="signup-phone">Phone number</label>
                <div className="phone-input-group">
                  <span className="phone-prefix">+91</span>
                  <input
                    id="signup-phone"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    onBlur={() => handleBlur('phoneNumber')}
                    placeholder="9820123456"
                    required
                    className={touched.phoneNumber && errors.phoneNumber ? 'input-error' : ''}
                  />
                </div>
                {touched.phoneNumber && errors.phoneNumber && (
                  <span className="field-error">{errors.phoneNumber}</span>
                )}
              </div>
            </div>

            {/* Worker-Specific Fields */}
            {role === 'worker' && (
              <div className="worker-form-section">
                <div className="worker-section-title">
                  <Wrench size={15} />
                  <span>Professional Trade Details</span>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="worker-skill">Primary skill</label>
                    <select
                      id="worker-skill"
                      value={primarySkill}
                      onChange={(e) => setPrimarySkill(e.target.value)}
                      required
                    >
                      {SKILLS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="worker-exp">Experience (years)</label>
                    <input
                      id="worker-exp"
                      type="number"
                      min="0"
                      max="50"
                      step="0.5"
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                      onBlur={() => handleBlur('experienceYears')}
                      required
                      className={touched.experienceYears && errors.experienceYears ? 'input-error' : ''}
                    />
                    {touched.experienceYears && errors.experienceYears && (
                      <span className="field-error">{errors.experienceYears}</span>
                    )}
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="worker-area">Primary service area</label>
                    <input
                      id="worker-area"
                      type="text"
                      value={serviceArea}
                      onChange={(e) => setServiceArea(e.target.value)}
                      onBlur={() => handleBlur('serviceArea')}
                      placeholder="e.g. Bhayandar & Mira Road"
                      required
                      className={touched.serviceArea && errors.serviceArea ? 'input-error' : ''}
                    />
                    {touched.serviceArea && errors.serviceArea && (
                      <span className="field-error">{errors.serviceArea}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="worker-rate">Base hourly / visiting rate (₹)</label>
                    <div className="phone-input-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="phone-prefix">₹</span>
                      <input
                        id="worker-rate"
                        type="number"
                        min="50"
                        step="50"
                        value={hourlyRate}
                        onChange={(e) => setHourlyRate(e.target.value)}
                        onBlur={() => handleBlur('hourlyRate')}
                        placeholder="350"
                        required
                        className={touched.hourlyRate && errors.hourlyRate ? 'input-error' : ''}
                        style={{ flex: 1 }}
                      />
                      <VoiceInputButton
                        mode="number"
                        onResult={(amount) => {
                          if (amount) {
                            setHourlyRate(String(amount));
                            setErrors((prev) => ({ ...prev, hourlyRate: '' }));
                          }
                        }}
                      />
                    </div>
                    {touched.hourlyRate && errors.hourlyRate && (
                      <span className="field-error">{errors.hourlyRate}</span>
                    )}
                  </div>
                </div>

                <div className="worker-verification-notice">
                  <ShieldCheck size={16} />
                  <span>
                    Worker profiles start with <strong>verification_status = pending</strong>. You can immediately access your dashboard and manage rates while your verification is processed.
                  </span>
                </div>
              </div>
            )}

            {/* Location for Customer */}
            {role === 'customer' && (
              <div className="form-group">
                <label htmlFor="signup-city">
                  Current city / area <span className="optional-tag">Optional</span>
                </label>
                <input
                  id="signup-city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Bhayandar West, Mumbai"
                />
              </div>
            )}

            {/* Password Fields */}
            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="signup-password">Password</label>
                <div className="password-input-wrapper">
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => handleBlur('password')}
                    placeholder="Min. 8 characters"
                    required
                    className={touched.password && errors.password ? 'input-error' : ''}
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
                {touched.password && errors.password && (
                  <span className="field-error">{errors.password}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="signup-confirm-password">Confirm password</label>
                <input
                  id="signup-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={() => handleBlur('confirmPassword')}
                  placeholder="Re-enter password"
                  required
                  className={touched.confirmPassword && errors.confirmPassword ? 'input-error' : ''}
                />
                {touched.confirmPassword && errors.confirmPassword && (
                  <span className="field-error">{errors.confirmPassword}</span>
                )}
              </div>
            </div>

            {/* Password Strength Meter */}
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
              <label className="checkbox-label terms-label">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                />
                <span>
                  I accept the Serviq Terms of Service, Privacy Policy, and Community Guidelines.
                </span>
              </label>
              {touched.acceptTerms && errors.acceptTerms && (
                <span className="field-error">{errors.acceptTerms}</span>
              )}
            </div>

            <button
              type="submit"
              className="btn full-width"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="btn-spinner">Creating account…</span>
              ) : (
                <>
                  <span>Create {role === 'customer' ? 'Customer' : 'Provider'} Account</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>

            <div className="auth-footer-prompt">
              Already have an account?{' '}
              <Link to="/login" className="auth-main-link">
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>

      {/* Brand Column */}
      <div className="auth-brand-column">
        <div className="auth-brand-content">
          <div className="tag dark">
            {role === 'customer' ? 'FOR HOMEOWNERS & RESIDENTS' : 'FOR TRADESPEOPLE & PROFESSIONALS'}
          </div>
          <h2>
            {role === 'customer'
              ? 'Reliable help, made simple.'
              : 'Build your trade, on your terms.'}
          </h2>
          <p>
            {role === 'customer'
              ? 'Join thousands of local households getting repairs, cleaning, and maintenance taken care of with zero guesswork.'
              : 'Keep 100% control of your calendar, accept jobs you want, and negotiate directly with nearby customers.'}
          </p>

          <div className="auth-brand-highlights">
            <div className="auth-highlight-item">
              <div className="highlight-icon">
                <ShieldCheck size={18} />
              </div>
              <div>
                <strong>Role-Protected Accounts</strong>
                <p>Permanent role separation for clean data boundaries</p>
              </div>
            </div>
            <div className="auth-highlight-item">
              <div className="highlight-icon">
                <Check size={18} />
              </div>
              <div>
                <strong>No Hidden Intermediaries</strong>
                <p>Direct communication and fair platform guarantees</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
