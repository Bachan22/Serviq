import crypto from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { users, userRoles, refreshTokens } from '../../database/schema/index.js';
import { env } from '../../config/env.js';
import { BadRequestError, UnauthorizedError } from '../../common/errors/app-error.js';

// In-memory OTP storage for dev / test mode (backed by Redis in production)
interface OtpEntry {
  otp: string;
  expiresAt: number;
}
const otpStore = new Map<string, OtpEntry>();

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export class AuthService {
  /**
   * Request an OTP for phone authentication
   */
  async requestOtp(phoneNumber: string): Promise<{ message: string; expiresInSeconds: number; devOtp?: string }> {
    // Generate 6-digit numeric OTP
    const otp = env.SMS_DEV_MOCK_MODE ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    const expiresInSeconds = 300; // 5 minutes
    const expiresAt = Date.now() + expiresInSeconds * 1000;

    otpStore.set(phoneNumber, { otp, expiresAt });

    if (env.SMS_DEV_MOCK_MODE) {
      console.log(`[DEV SMS MOCK] OTP for ${phoneNumber}: ${otp}`);
    } else {
      // Production SMS Gateway API integration (e.g., Twilio, Gupshup)
      // await smsGateway.send(phoneNumber, `Your Serviq verification code is ${otp}`);
    }

    return {
      message: 'Verification code sent successfully.',
      expiresInSeconds,
      ...(env.SMS_DEV_MOCK_MODE && { devOtp: otp }),
    };
  }

  /**
   * Verify OTP and return user + tokens
   */
  async verifyOtp(phoneNumber: string, otp: string, requestedRole: 'CUSTOMER' | 'WORKER') {
    const entry = otpStore.get(phoneNumber);

    if (!entry) {
      throw new BadRequestError('No OTP request found for this phone number. Please request a new code.');
    }

    if (Date.now() > entry.expiresAt) {
      otpStore.delete(phoneNumber);
      throw new BadRequestError('Verification code has expired. Please request a new one.');
    }

    if (entry.otp !== otp) {
      throw new BadRequestError('Invalid verification code.');
    }

    // OTP is valid; consume it immediately
    otpStore.delete(phoneNumber);

    // Look up or create user record
    let user = await db.query.users.findFirst({
      where: eq(users.phoneNumber, phoneNumber),
    });

    if (!user) {
      const [newUser] = await db
        .insert(users)
        .values({
          phoneNumber,
          isPhoneVerified: true,
          status: 'ACTIVE',
          lastLoginAt: new Date(),
        })
        .returning();
      user = newUser;

      // Assign initial role
      await db.insert(userRoles).values({
        userId: user.id,
        roleId: requestedRole,
      });
    } else {
      // Update last login
      await db
        .update(users)
        .set({
          lastLoginAt: new Date(),
          isPhoneVerified: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      // Ensure user has the requested role
      const existingRole = await db.query.userRoles.findFirst({
        where: and(eq(userRoles.userId, user.id), eq(userRoles.roleId, requestedRole)),
      });

      if (!existingRole) {
        await db.insert(userRoles).values({
          userId: user.id,
          roleId: requestedRole,
        });
      }
    }

    // Fetch all assigned roles
    const assignedRoles = await db.query.userRoles.findMany({
      where: eq(userRoles.userId, user.id),
    });
    const rolesList = assignedRoles.map((r: { roleId: string }) => r.roleId);

    // Issue rotating refresh token
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = hashToken(rawRefreshToken);
    const familyId = crypto.randomUUID();
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash,
      familyId,
      expiresAt: refreshExpiresAt,
    });

    return {
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        status: user.status,
        roles: rolesList,
      },
      rawRefreshToken,
    };
  }

  /**
   * Rotate refresh token and issue new token pair
   */
  async rotateRefreshToken(rawRefreshToken: string) {
    const tokenHash = hashToken(rawRefreshToken);

    const record = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, tokenHash),
    });

    if (!record) {
      throw new UnauthorizedError('Invalid refresh token.');
    }

    // Reuse detection: If token was already revoked, revoke entire family (token theft defense)
    if (record.isRevoked) {
      await db
        .update(refreshTokens)
        .set({ isRevoked: true })
        .where(eq(refreshTokens.familyId, record.familyId));
      throw new UnauthorizedError('Session revoked due to concurrent reuse detection.');
    }

    if (new Date() > record.expiresAt) {
      throw new UnauthorizedError('Session expired. Please log in again.');
    }

    // Revoke current token
    await db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.id, record.id));

    // Issue new token in same family
    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    const newTokenHash = hashToken(newRawRefreshToken);
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.insert(refreshTokens).values({
      userId: record.userId,
      tokenHash: newTokenHash,
      familyId: record.familyId,
      expiresAt: refreshExpiresAt,
    });

    // Fetch user and roles
    const user = await db.query.users.findFirst({
      where: eq(users.id, record.userId),
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError('User account is inactive or suspended.');
    }

    const assignedRoles = await db.query.userRoles.findMany({
      where: eq(userRoles.userId, user.id),
    });
    const rolesList = assignedRoles.map((r: { roleId: string }) => r.roleId);

    return {
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        status: user.status,
        roles: rolesList,
      },
      newRawRefreshToken,
    };
  }

  /**
   * Revoke refresh token on logout
   */
  async logout(rawRefreshToken?: string) {
    if (!rawRefreshToken) return;
    const tokenHash = hashToken(rawRefreshToken);
    await db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.tokenHash, tokenHash));
  }
}

export const authService = new AuthService();
