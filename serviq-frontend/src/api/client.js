/**
 * Serviq Centralized API HTTP Client
 * Connects directly to backend API (VITE_API_BASE_URL).
 * Provides base fetch handler with authentication tokens, request timeout, 401 handling, and standard error handling.
 */

const BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiClient(endpoint, { method = 'GET', body, params, headers = {}, timeout = 12000 } = {}) {
  let url = `${BASE_URL}${endpoint}`;

  if (params) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, String(val));
      }
    });
    const queryString = query.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const token = localStorage.getItem('serviq_access_token');
  const requestHeaders = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  // Proactive check: If private endpoint and no token, avoid making doomed network requests
  const isAuthRequiredEndpoint =
    endpoint.startsWith('/bookings') ||
    endpoint.startsWith('/notifications') ||
    endpoint.startsWith('/messages') ||
    endpoint.startsWith('/wallet') ||
    endpoint === '/auth/me';

  if (isAuthRequiredEndpoint && !token) {
    clearTimeout(timeoutId);
    if (method === 'GET' && (endpoint.startsWith('/notifications') || endpoint.startsWith('/bookings'))) {
      return { data: [], bookings: [] };
    }
    throw new ApiError('Please sign in to continue.', 401, 'UNAUTHORIZED');
  }

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => null);

    if (response.status === 401) {
      // Clean up stale/expired token immediately to prevent poisoning future requests
      try {
        localStorage.removeItem('serviq_access_token');
        localStorage.removeItem('serviq_session_user');
      } catch {}

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('serviq:unauthorized', { detail: { endpoint } }));
      }
    }

    if (!response.ok) {
      const errorCode = data?.error?.code || data?.code || 'HTTP_ERROR';
      let errorMessage = data?.error?.message || data?.message || `Request failed with status ${response.status}`;
      if (response.status === 401) {
        errorMessage = 'Your session has expired. Please sign in again.';
      }
      const errorDetails = data?.error?.details;
      throw new ApiError(errorMessage, response.status, errorCode, errorDetails);
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new ApiError('Request timed out. Please check your connection.', 408, 'REQUEST_TIMEOUT');
    }
    throw err;
  }
}
