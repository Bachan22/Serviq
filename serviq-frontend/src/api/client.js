/**
 * Serviq Centralized API HTTP Client
 * Provides base fetch handler with authentication tokens, standard error handling, and JSON envelopes.
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

export async function apiClient(endpoint, { method = 'GET', body, params, headers = {} } = {}) {
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
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorCode = data?.error?.code || 'HTTP_ERROR';
    const errorMessage = data?.error?.message || `Request failed with status ${response.status}`;
    const errorDetails = data?.error?.details;
    throw new ApiError(errorMessage, response.status, errorCode, errorDetails);
  }

  return data;
}
