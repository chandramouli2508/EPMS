// apps/web/src/shared/api/client.ts
// Axios instance with:
//   - Single-flight token refresh (5 parallel 401s → 1 refresh call)
//   - Retry of original request once after refresh
//   - Session-expired event on refresh failure
//   - All errors normalised into ApiError before rejection

import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { tokenStore } from './token-store';
import { authEvents } from './auth-events';
import { toApiError } from './api-error';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

// Routes where a 401 should NOT trigger a token refresh attempt
const NO_REFRESH_PATHS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
];

// ─── Main Axios instance ──────────────────────────────────────────────────────
export const api = axios.create({
  baseURL,
  withCredentials: true, // Sends HttpOnly refresh cookie on every request
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Refresh-only client (no interceptors to avoid infinite loops) ─────────────
export const refreshClient = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15_000,
});

// ─── Single-flight refresh ────────────────────────────────────────────────────
// Concurrent 401s all await the SAME promise. Only one /auth/refresh call is made.
let refreshPromise: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post<{ accessToken: string }>('/auth/refresh')
      .then((r) => {
        tokenStore.set(r.data.accessToken);
        return r.data.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/**
 * Called once on app mount to restore the session from the HttpOnly cookie.
 * Stub: until Phase 1, this will succeed only if the API has /auth/refresh.
 */
export const restoreSession = (): Promise<string> => refreshAccessToken();

// ─── Request interceptor ─────────────────────────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Attach a unique request ID for correlation with backend logs
  config.headers['X-Request-Id'] = crypto.randomUUID();
  return config;
});

// ─── Response interceptor ────────────────────────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    const original = axios.isAxiosError(error)
      ? (error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined)
      : undefined;

    const shouldSkipRefresh =
      !axios.isAxiosError(error) ||
      error.response?.status !== 401 ||
      !original ||
      original._retry === true ||
      NO_REFRESH_PATHS.some((p) => original?.url?.includes(p));

    if (!shouldSkipRefresh) {
      original!._retry = true;
      try {
        const token = await refreshAccessToken();
        if (original!.headers) {
          original!.headers['Authorization'] = `Bearer ${token}`;
        } else {
          original!.headers = { Authorization: `Bearer ${token}` };
        }
        return api(original!);
      } catch (refreshError) {
        tokenStore.clear();
        authEvents.emitSessionExpired();
        return Promise.reject(toApiError(refreshError));
      }
    }

    return Promise.reject(toApiError(error));
  },
);

// ─── Typed HTTP helpers ───────────────────────────────────────────────────────
// Feature code imports `http`, never `api` or `axios` directly.
// Return types use interfaces from @epms/shared so the compiler enforces the contract.

export const http = {
  get: <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    api.get<T>(url, config).then((r) => r.data),

  post: <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    api.post<T>(url, body, config).then((r) => r.data),

  put: <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    api.put<T>(url, body, config).then((r) => r.data),

  patch: <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    api.patch<T>(url, body, config).then((r) => r.data),

  delete: <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    api.delete<T>(url, config).then((r) => r.data),
};
