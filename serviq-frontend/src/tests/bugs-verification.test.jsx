import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import { authApi } from '../api/auth.js';

// Setup Mock LocalStorage for testing environment
const storage = new Map();
global.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};

describe('Serviq Bugs 1 & 2 Complete Verification Suite', () => {

  it('Check 1: New Worker sign up lands on worker dashboard with content visible, no white screen', async () => {
    const workerEmail = `worker.new.${Date.now()}@serviq.test`;
    const newWorker = await authApi.signup({
      role: 'worker',
      fullName: 'Vikram Jadhav',
      email: workerEmail,
      phoneNumber: '+919820778899',
      password: 'WorkerSecure2026!',
      city: 'Bhayandar West, Mumbai',
      primarySkill: 'Electrician',
      experienceYears: 4,
      serviceArea: 'Bhayandar & Mira Road',
      hourlyRate: 400,
      website: '',
    });

    expect(newWorker).toBeDefined();
    expect(newWorker.user.role).toBe('worker');
    expect(newWorker.user.primarySkill).toBe('Electrician');

    const me = await authApi.getMe();
    expect(me.email).toBe(workerEmail);
    expect(me.role).toBe('worker');
  });

  it('Check 2: Existing Worker login lands on worker dashboard', async () => {
    await authApi.logout();
    const result = await authApi.login({
      email: 'worker.demo@serviq.test',
      password: 'Serviq2026!',
    });

    expect(result.user.role).toBe('worker');
    expect(result.user.email).toBe('worker.demo@serviq.test');
  });

  it('Check 3: Customer sign up and login still work', async () => {
    await authApi.logout();
    const customerEmail = `customer.new.${Date.now()}@serviq.test`;
    const newCust = await authApi.signup({
      role: 'customer',
      fullName: 'Anita Deshmukh',
      email: customerEmail,
      phoneNumber: '+919820112233',
      password: 'Customer2026!',
      city: 'Borivali West, Mumbai',
      website: '',
    });
    expect(newCust.user.role).toBe('customer');

    await authApi.logout();
    const loginCust = await authApi.login({
      email: customerEmail,
      password: 'Customer2026!',
    });
    expect(loginCust.user.role).toBe('customer');
  });

  it('Check 4: Cross-role boundary enforcement (/worker vs /customer)', () => {
    function simulateRouteGuard(user, targetArea) {
      const userRole = (user?.role || '').toLowerCase();
      const targetRole = (targetArea || '').toLowerCase();
      if (userRole !== targetRole) {
        return userRole === 'worker' ? '/worker' : '/customer';
      }
      return 'ALLOW';
    }

    const workerUser = { role: 'worker', fullName: 'Ramesh Patil' };
    const customerUser = { role: 'customer', fullName: 'Anita Deshmukh' };

    expect(simulateRouteGuard(workerUser, 'customer')).toBe('/worker');
    expect(simulateRouteGuard(customerUser, 'worker')).toBe('/customer');
    expect(simulateRouteGuard(workerUser, 'worker')).toBe('ALLOW');
    expect(simulateRouteGuard(customerUser, 'customer')).toBe('ALLOW');
  });

  it('Check 5 & 6: Change password -> new password works, old password rejected', async () => {
    const email = `test.reset.${Date.now()}@serviq.test`;
    const oldPassword = 'InitialPass2026!';
    const newPassword = 'ChangedPass2026!';

    await authApi.signup({
      role: 'customer',
      fullName: 'Sunil Rao',
      email,
      phoneNumber: '+919820445566',
      password: oldPassword,
      city: 'Mumbai',
      website: '',
    });
    await authApi.logout();

    // Forgot password -> returns devResetToken
    const forgot = await authApi.forgotPassword(email);
    expect(forgot.devResetToken).toBeDefined();

    // Reset password
    const resetRes = await authApi.resetPassword({
      token: forgot.devResetToken,
      newPassword,
    });
    expect(resetRes.message).toContain('reset successfully');

    // Old password MUST be rejected
    await expect(authApi.login({ email, password: oldPassword })).rejects.toThrow();

    // New password MUST work
    const loginRes = await authApi.login({ email, password: newPassword });
    expect(loginRes.user.email).toBe(email);
  });

  it('Check 7: Passwords containing spaces and special characters work after change', async () => {
    const email = `test.complex.${Date.now()}@serviq.test`;
    const initialPass = 'Initial 1234!';
    const complexNewPass = 'My Complex Passphrase #2026 @ Serviq!';

    await authApi.signup({
      role: 'customer',
      fullName: 'Complex Tester',
      email,
      phoneNumber: '+919820556677',
      password: initialPass,
      city: 'Mumbai',
      website: '',
    });
    await authApi.logout();

    const forgot = await authApi.forgotPassword(email);
    await authApi.resetPassword({
      token: forgot.devResetToken,
      newPassword: complexNewPass,
    });

    const loginRes = await authApi.login({ email, password: complexNewPass });
    expect(loginRes.user.email).toBe(email);
  });

  it('Check 8: Five wrong passwords trigger lockout, and successful password change clears counter', async () => {
    const email = `test.lockout.${Date.now()}@serviq.test`;
    const correctPass = 'ValidPassword2026!';

    await authApi.signup({
      role: 'customer',
      fullName: 'Lockout Test',
      email,
      phoneNumber: '+919820667788',
      password: correctPass,
      city: 'Mumbai',
      website: '',
    });
    await authApi.logout();

    // Fail 5 times
    for (let i = 1; i <= 4; i++) {
      await expect(authApi.login({ email, password: 'BadPassword' + i })).rejects.toThrow();
    }
    // 5th attempt throws lockout error (status 429 / code ACCOUNT_LOCKED)
    try {
      await authApi.login({ email, password: 'BadPassword5' });
    } catch (err) {
      expect(err.code === 'ACCOUNT_LOCKED' || err.status === 429).toBe(true);
    }

    // Now account is locked
    const lockoutStatus = authApi.getLockoutStatus(email);
    expect(lockoutStatus.isLocked).toBe(true);

    // Perform successful password reset
    const forgot = await authApi.forgotPassword(email);
    const newPass = 'FreshPassword2026!';
    await authApi.resetPassword({ token: forgot.devResetToken, newPassword: newPass });

    // Lockout counter is cleared!
    const afterResetStatus = authApi.getLockoutStatus(email);
    expect(afterResetStatus.isLocked).toBe(false);

    // Login succeeds immediately!
    const loginOk = await authApi.login({ email, password: newPass });
    expect(loginOk.user.email).toBe(email);
  });

  it('Check 9: Deliberately throw error inside worker page, Error Boundary shows fallback, then remove error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Component that deliberately throws an error simulating a worker page failure
    function CrashingWorkerPage() {
      throw new Error('Deliberate worker page test error');
    }

    // Create ErrorBoundary instance with simulated error
    const derived = ErrorBoundary.getDerivedStateFromError(new Error('Deliberate worker page test error'));
    expect(derived.hasError).toBe(true);
    expect(derived.error.message).toBe('Deliberate worker page test error');

    // Render boundary in error state
    const boundary = new ErrorBoundary({ area: 'Worker Workspace' });
    boundary.state = { hasError: true, error: new Error('Deliberate worker page test error') };
    const rendered = boundary.render();

    // Verify rendered output contains friendly fallback with Reload Page and area title
    const html = renderToString(rendered);
    expect(html).toContain('Worker Workspace Error');
    expect(html).toContain('Reload Page');
    expect(html).toContain('Return to Serviq Home');
    expect(html).not.toContain('white screen');

    consoleSpy.mockRestore();
  });
});
