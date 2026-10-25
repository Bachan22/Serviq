import { buildApp } from '../src/app.js';
import { client } from '../src/database/connection.js';

async function testAuthFlow() {
  console.log('Testing Sign up and Login on Supabase...');
  const app = buildApp();
  await app.ready();

  const rand = Math.floor(10000 + Math.random() * 90000);
  const testPhone = `+9198210${rand}`;
  const testEmail = `testuser${rand}@example.com`;
  const testPassword = 'StrongPassword2026!';

  // 1. Health check endpoint test
  const healthRes = await app.inject({
    method: 'GET',
    url: '/health',
  });
  console.log('[Health] /health response:', healthRes.statusCode, healthRes.json());
  if (healthRes.statusCode !== 200 || healthRes.json().database !== 'connected') {
    throw new Error('Health check failed');
  }

  // 2. Signup new Customer
  const signupRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: {
      role: 'customer',
      fullName: 'Real Test Customer',
      email: testEmail,
      phoneNumber: testPhone,
      password: testPassword,
      acceptTerms: true,
    },
  });
  console.log('[Auth] signup status:', signupRes.statusCode, signupRes.json()?.success);
  if (signupRes.statusCode !== 201) {
    throw new Error(`Signup failed: ${signupRes.body}`);
  }

  // 3. Login with email and password
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: {
      email: testEmail,
      password: testPassword,
    },
  });
  console.log('[Auth] login status:', loginRes.statusCode, loginRes.json()?.success);
  const loginData = loginRes.json()?.data;
  if (loginRes.statusCode !== 200 || !loginData?.accessToken) {
    throw new Error(`Login failed: ${loginRes.body}`);
  }

  console.log(`[Auth] User authenticated! User ID: ${loginData.user.id}, Role: ${loginData.user.role}`);
  console.log('\n[PASS] Auth Sign Up, Login, and Database connection verified against Supabase!');
  await app.close();
  await client.end();
}

testAuthFlow().catch((e) => {
  console.error('[FAIL]', e);
  process.exit(1);
});
