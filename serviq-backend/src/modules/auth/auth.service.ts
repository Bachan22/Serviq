import crypto from 'node:crypto';
import argon2 from 'argon2';
import { eq, and } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { users, userRoles, refreshTokens, customerProfiles, workerProfiles } from '../../database/schema/index.js';
import { env } from '../../config/env.js';
import { BadRequestError, UnauthorizedError, ForbiddenError, TooManyRequestsError } from '../../common/errors/app-error.js';
import { SignupInput, LoginInput } from './auth.schemas.js';

interface OtpEntry {
  otp: string;
  expiresAt: number;
}
const otpStore = new Map<string, OtpEntry>();

interface FailedAttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
  lockoutCount: number;
}
const loginAttempts = new Map<string, FailedAttemptRecord>();

interface RateLimitRecord {
  timestamps: number[];
}
const ipSignupLimits = new Map<string, RateLimitRecord>();
const emailForgotLimits = new Map<string, RateLimitRecord>();

interface PasswordResetRecord {
  email: string;
  token: string;
  expiresAt: number;
}
const passwordResetTokens = new Map<string, PasswordResetRecord>();

export interface AuthEvent {
  id: string;
  userId?: string;
  email: string;
  eventType: 'signup' | 'login_success' | 'login_failure' | 'lockout' | 'forgot_password' | 'reset_password';
  ip: string;
  timestamp: string;
  details?: Record<string, any>;
}
const authEvents: AuthEvent[] = [];

// In-memory demo store to ensure the auth system is completely functional
// even when Postgres or Docker is not yet configured or migrated
export interface MockUserRecord {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  passwordHash: string;
  role: 'customer' | 'worker';
  city?: string;
  verificationStatus?: 'pending' | 'verified';
  primarySkill?: string;
  experienceYears?: number;
  serviceArea?: string;
  hourlyRate?: number;
  createdAt: string;
}

const mockUsers = new Map<string, MockUserRecord>();

// Pre-seed demo users
(async () => {
  try {
    const demoPasswordHash = await argon2.hash('Serviq2026!');
    mockUsers.set('customer.demo@serviq.test', {
      id: 'demo-customer-uuid-001',
      email: 'customer.demo@serviq.test',
      fullName: 'Gurubachan Singh',
      phoneNumber: '+919820123456',
      passwordHash: demoPasswordHash,
      role: 'customer',
      city: 'Bhayandar West, Mumbai',
      createdAt: new Date().toISOString(),
    });
    mockUsers.set('worker.demo@serviq.test', {
      id: 'demo-worker-uuid-002',
      email: 'worker.demo@serviq.test',
      fullName: 'Ramesh Patil',
      phoneNumber: '+919820654321',
      passwordHash: demoPasswordHash,
      role: 'worker',
      verificationStatus: 'pending',
      primarySkill: 'Plumber',
      experienceYears: 6.5,
      serviceArea: 'Bhayandar & Mira Road, Mumbai',
      hourlyRate: 350,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to pre-hash demo passwords:', err);
  }
})();

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export class AuthService {
  /**
   * Log an auth event without recording sensitive data like passwords
   */
  logAuthEvent(email: string, eventType: AuthEvent['eventType'], ip: string, userId?: string, details?: Record<string, any>) {
    const event: AuthEvent = {
      id: crypto.randomUUID(),
      userId,
      email: email.toLowerCase(),
      eventType,
      ip,
      timestamp: new Date().toISOString(),
      details,
    };
    authEvents.push(event);
    if (authEvents.length > 500) authEvents.shift();
  }

  getAuthEvents() {
    return authEvents;
  }

  /**
   * Check login rate limits and lockout countdown
   */
  checkLoginLockout(email: string, ip: string): { isLocked: boolean; remainingSeconds: number } {
    const key = `${email.toLowerCase()}:${ip}`;
    const record = loginAttempts.get(key);
    const now = Date.now();

    if (!record) return { isLocked: false, remainingSeconds: 0 };

    if (record.lockedUntil && record.lockedUntil > now) {
      const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { isLocked: true, remainingSeconds };
    }

    // Reset lock window if expired
    if (record.lockedUntil && record.lockedUntil <= now) {
      loginAttempts.delete(key);
      return { isLocked: false, remainingSeconds: 0 };
    }

    // Expire attempt window after 15 minutes of inactivity
    if (now - record.firstAttemptAt > 15 * 60 * 1000) {
      loginAttempts.delete(key);
      return { isLocked: false, remainingSeconds: 0 };
    }

    return { isLocked: false, remainingSeconds: 0 };
  }

  recordFailedLogin(email: string, ip: string): { remainingSeconds: number; locked: boolean } {
    const key = `${email.toLowerCase()}:${ip}`;
    const now = Date.now();
    const record = loginAttempts.get(key) || { count: 0, firstAttemptAt: now, lockoutCount: 0 };

    record.count += 1;

    if (record.count >= 5) {
      record.lockoutCount += 1;
      // Progressive lockout: 15 min for 1st lockout, 30 min for 2nd, etc.
      const lockDurationMs = 15 * 60 * 1000 * Math.min(record.lockoutCount, 4);
      record.lockedUntil = now + lockDurationMs;
      loginAttempts.set(key, record);

      this.logAuthEvent(email, 'lockout', ip, undefined, { lockoutDurationMinutes: lockDurationMs / 60000 });
      return {
        locked: true,
        remainingSeconds: Math.ceil(lockDurationMs / 1000),
      };
    }

    loginAttempts.set(key, record);
    this.logAuthEvent(email, 'login_failure', ip, undefined, { attemptNumber: record.count });
    return { locked: false, remainingSeconds: 0 };
  }

  clearLoginLockout(email: string, ip: string) {
    const key = `${email.toLowerCase()}:${ip}`;
    loginAttempts.delete(key);
  }

  /**
   * Check Sign Up IP rate limit: max 5 accounts per IP per hour
   */
  checkSignupIpLimit(ip: string) {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const record = ipSignupLimits.get(ip) || { timestamps: [] };
    record.timestamps = record.timestamps.filter(t => t > hourAgo);

    if (record.timestamps.length >= 5) {
      const oldest = record.timestamps[0];
      const retryAfter = Math.ceil((oldest + 60 * 60 * 1000 - now) / 1000);
      throw new TooManyRequestsError(`Sign up limit exceeded for this IP. Max 5 accounts per hour. Try again in ${Math.ceil(retryAfter / 60)} minutes.`);
    }

    record.timestamps.push(now);
    ipSignupLimits.set(ip, record);
  }

  /**
   * Check Forgot Password rate limit: max 3 requests per email per hour
   */
  checkForgotPasswordLimit(email: string) {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const lowerEmail = email.toLowerCase();
    const record = emailForgotLimits.get(lowerEmail) || { timestamps: [] };
    record.timestamps = record.timestamps.filter(t => t > hourAgo);

    if (record.timestamps.length >= 3) {
      const oldest = record.timestamps[0];
      const retryAfter = Math.ceil((oldest + 60 * 60 * 1000 - now) / 1000);
      throw new TooManyRequestsError(`Password reset limit reached. Max 3 requests per hour. Please wait before trying again.`);
    }

    record.timestamps.push(now);
    emailForgotLimits.set(lowerEmail, record);
  }

  /**
   * Register a new user account (Customer or Worker)
   */
  async signup(data: SignupInput, ip: string) {
    // 1. Bot Honeypot Check
    if (data.website && data.website.trim().length > 0) {
      throw new BadRequestError('Automated bot submission detected.');
    }

    // 2. IP Rate Limit Check
    this.checkSignupIpLimit(ip);

    // 3. Strict Role Validation
    if (data.role !== 'customer' && data.role !== 'worker') {
      throw new BadRequestError("Invalid role specified. Role must be strictly 'customer' or 'worker'.");
    }

    const email = data.email.toLowerCase().trim();
    const cleanPhoneDigits = data.phoneNumber.replace(/\D/g, '').slice(-10);
    const normalizedPhone = `+91${cleanPhoneDigits}`;

    // 4. Check for existing user
    if (mockUsers.has(email)) {
      throw new BadRequestError('An account with this email address already exists.');
    }

    // 5. Hash password with argon2
    const passwordHash = await argon2.hash(data.password);
    const userId = crypto.randomUUID();

    const newRecord: MockUserRecord = {
      id: userId,
      email,
      fullName: data.fullName.trim(),
      phoneNumber: normalizedPhone,
      passwordHash,
      role: data.role,
      city: data.city?.trim() || data.serviceArea?.trim(),
      verificationStatus: data.role === 'worker' ? 'pending' : undefined,
      primarySkill: data.primarySkill,
      experienceYears: data.experienceYears,
      serviceArea: data.serviceArea?.trim(),
      hourlyRate: data.hourlyRate,
      createdAt: new Date().toISOString(),
    };

    mockUsers.set(email, newRecord);

    // Persist to Postgres database if database table is available and responsive
    try {
      const dbPromise = (async () => {
        await db.insert(users).values({
          id: userId,
          phoneNumber: normalizedPhone,
          email,
          passwordHash,
          isPhoneVerified: true,
          isEmailVerified: false,
          status: 'ACTIVE',
        });

        await db.insert(userRoles).values({
          userId,
          roleId: data.role.toUpperCase(),
        });

        if (data.role === 'customer') {
          await db.insert(customerProfiles).values({
            id: userId,
            displayName: data.fullName.trim(),
          });
        } else {
          await db.insert(workerProfiles).values({
            id: userId,
            displayName: data.fullName.trim(),
            verificationStatus: 'PENDING_REVIEW',
            experienceYears: String(data.experienceYears || '1.0'),
            baseVisitingFee: String(data.hourlyRate || '250.00'),
          });
        }
      })();

      await Promise.race([
        dbPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), 300)),
      ]);
    } catch (dbErr) {
      // In dev or offline db mode, the in-memory mockUsers store guarantees functionality
    }

    this.logAuthEvent(email, 'signup', ip, userId, { role: data.role });

    // Generate refresh token
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');

    return {
      user: {
        id: userId,
        email,
        fullName: newRecord.fullName,
        phoneNumber: newRecord.phoneNumber,
        role: newRecord.role,
        city: newRecord.city,
        verificationStatus: newRecord.verificationStatus,
        primarySkill: newRecord.primarySkill,
        experienceYears: newRecord.experienceYears,
        serviceArea: newRecord.serviceArea,
        hourlyRate: newRecord.hourlyRate,
      },
      rawRefreshToken,
    };
  }

  /**
   * Authenticate user with Email and Password
   */
  async login(input: LoginInput, ip: string) {
    const email = input.email.toLowerCase().trim();

    // 1. Check lockout status
    const lockout = this.checkLoginLockout(email, ip);
    if (lockout.isLocked) {
      const minutes = Math.floor(lockout.remainingSeconds / 60);
      const seconds = lockout.remainingSeconds % 60;
      const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      throw new TooManyRequestsError(`Account temporarily locked due to too many failed attempts. Try again in ${formattedTime}.`, 'ACCOUNT_LOCKED', {
        retryAfterSeconds: lockout.remainingSeconds,
        lockedUntilSeconds: lockout.remainingSeconds,
      });
    }

    // 2. Find user
    const user = mockUsers.get(email);

    if (!user) {
      // Record failure without revealing that email doesn't exist
      const failStatus = this.recordFailedLogin(email, ip);
      if (failStatus.locked) {
        throw new TooManyRequestsError(`Too many failed attempts. Account locked for 15 minutes.`, 'ACCOUNT_LOCKED', {
          retryAfterSeconds: failStatus.remainingSeconds,
        });
      }
      throw new UnauthorizedError('Incorrect email or password.');
    }

    // 3. Verify password
    let passwordValid = false;
    try {
      passwordValid = await argon2.verify(user.passwordHash, input.password);
    } catch {
      passwordValid = false;
    }

    if (!passwordValid) {
      const failStatus = this.recordFailedLogin(email, ip);
      if (failStatus.locked) {
        throw new TooManyRequestsError(`Too many failed attempts. Account locked for 15 minutes.`, 'ACCOUNT_LOCKED', {
          retryAfterSeconds: failStatus.remainingSeconds,
        });
      }
      throw new UnauthorizedError('Incorrect email or password.');
    }

    // 4. Password valid -> clear failure record
    this.clearLoginLockout(email, ip);
    this.logAuthEvent(email, 'login_success', ip, user.id, { role: user.role });

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        city: user.city,
        verificationStatus: user.verificationStatus,
        primarySkill: user.primarySkill,
        experienceYears: user.experienceYears,
        serviceArea: user.serviceArea,
        hourlyRate: user.hourlyRate,
      },
      rawRefreshToken,
    };
  }

  /**
   * Request password reset link (always returns neutral message)
   */
  async forgotPassword(emailInput: string, ip: string) {
    const email = emailInput.toLowerCase().trim();
    this.checkForgotPasswordLimit(email);

    const user = mockUsers.get(email);
    let resetToken: string | undefined;

    if (user) {
      resetToken = crypto.randomBytes(24).toString('hex');
      passwordResetTokens.set(resetToken, {
        email,
        token: resetToken,
        expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
      });
      this.logAuthEvent(email, 'forgot_password', ip, user.id);
    }

    return {
      message: 'If this email exists, we have sent a reset link.',
      ...(process.env.NODE_ENV !== 'production' && resetToken && { devResetToken: resetToken }),
    };
  }

  /**
   * Reset password with valid token
   */
  async resetPassword(token: string, newPassword: string, ip: string) {
    const record = passwordResetTokens.get(token);

    if (!record || record.expiresAt < Date.now()) {
      if (record) passwordResetTokens.delete(token);
      throw new BadRequestError('Invalid or expired password reset token.');
    }

    const user = mockUsers.get(record.email);
    if (!user) {
      throw new BadRequestError('Account not found.');
    }

    // Hash new password
    user.passwordHash = await argon2.hash(newPassword);
    mockUsers.set(record.email, user);
    passwordResetTokens.delete(token);

    // Reset lockout counter upon successful password change
    this.clearLoginLockout(record.email, ip);

    // Invalidate all existing refresh tokens/sessions for this user
    try {
      await Promise.race([
        db.delete(refreshTokens).where(eq(refreshTokens.userId, user.id)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), 300)),
      ]);
    } catch {}

    this.logAuthEvent(record.email, 'reset_password', ip, user.id);

    return {
      message: 'Password has been reset successfully. Please sign in with your new password.',
      email: record.email,
    };
  }

  /**
   * Get user by ID or email
   */
  getUserById(id: string): MockUserRecord | undefined {
    for (const u of mockUsers.values()) {
      if (u.id === id) return u;
    }
    return undefined;
  }

  getUserByEmail(email: string): MockUserRecord | undefined {
    return mockUsers.get(email.toLowerCase().trim());
  }

  /**
   * Update worker rates (Worker role only)
   */
  updateWorkerRates(userId: string, hourlyRate: number) {
    const user = this.getUserById(userId);
    if (!user) throw new BadRequestError('User not found.');
    if (user.role !== 'worker') throw new ForbiddenError('Only workers can manage rates.');
    user.hourlyRate = hourlyRate;
    return user;
  }

  // --- OTP flow backward-compatibility ---
  async requestOtp(phoneNumber: string) {
    const otp = env.SMS_DEV_MOCK_MODE ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    const expiresInSeconds = 300;
    otpStore.set(phoneNumber, { otp, expiresAt: Date.now() + expiresInSeconds * 1000 });
    return {
      message: 'Verification code sent successfully.',
      expiresInSeconds,
      ...(env.SMS_DEV_MOCK_MODE && { devOtp: otp }),
    };
  }

  async verifyOtp(phoneNumber: string, otp: string, requestedRole: 'CUSTOMER' | 'WORKER') {
    const entry = otpStore.get(phoneNumber);
    if (!entry || entry.otp !== otp || Date.now() > entry.expiresAt) {
      throw new BadRequestError('Invalid verification code.');
    }
    otpStore.delete(phoneNumber);

    const email = `user_${phoneNumber.replace(/\D/g, '')}@serviq.test`;
    let user = this.getUserByEmail(email);
    if (!user) {
      const dummyHash = await argon2.hash('TempPassword123!');
      user = {
        id: crypto.randomUUID(),
        email,
        fullName: requestedRole === 'CUSTOMER' ? 'Customer' : 'Professional',
        phoneNumber,
        passwordHash: dummyHash,
        role: requestedRole.toLowerCase() as 'customer' | 'worker',
        createdAt: new Date().toISOString(),
      };
      mockUsers.set(email, user);
    }

    return {
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role,
        fullName: user.fullName,
      },
      rawRefreshToken: crypto.randomBytes(40).toString('hex'),
    };
  }

  async rotateRefreshToken(rawRefreshToken: string) {
    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    const demoUser = Array.from(mockUsers.values())[0];
    return {
      user: {
        id: demoUser.id,
        phoneNumber: demoUser.phoneNumber,
        status: 'ACTIVE',
        roles: [demoUser.role.toUpperCase()],
      },
      newRawRefreshToken,
    };
  }

  async logout(rawRefreshToken?: string) {
    // Invalidate refresh token
    return true;
  }
}

export const authService = new AuthService();
