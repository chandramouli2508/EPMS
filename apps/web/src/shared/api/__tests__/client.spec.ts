// apps/web/src/shared/api/__tests__/client.spec.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { api, refreshClient, http } from '../client';
import { tokenStore } from '../token-store';
import { authEvents } from '../auth-events';
import { ApiError, toApiError } from '../api-error';

describe('HTTP Client & Auth Interceptors', () => {
  let mockApi: MockAdapter;
  let mockRefresh: MockAdapter;

  beforeEach(() => {
    mockApi = new MockAdapter(api);
    mockRefresh = new MockAdapter(refreshClient);
    tokenStore.clear();
  });

  afterEach(() => {
    mockApi.restore();
    mockRefresh.restore();
    tokenStore.clear();
    vi.restoreAllMocks();
  });

  it('attaches Bearer token and X-Request-Id to requests when token is present', async () => {
    tokenStore.set('initial-access-token');

    mockApi.onGet('/projects').reply((config) => {
      expect(config.headers?.Authorization).toBe('Bearer initial-access-token');
      expect(config.headers?.['X-Request-Id']).toBeDefined();
      return [200, [{ id: 'PRJ-1', name: 'Project 1' }]];
    });

    const res = await http.get('/projects');
    expect(res).toEqual([{ id: 'PRJ-1', name: 'Project 1' }]);
  });

  it('handles 401 by performing a single refresh and retrying the request', async () => {
    tokenStore.set('expired-token');

    let initialRequestAttempted = false;
    mockApi.onGet('/protected-data').reply((config) => {
      if (!initialRequestAttempted) {
        initialRequestAttempted = true;
        return [401, { error: 'UNAUTHORIZED', message: 'Token expired' }];
      }
      expect(config.headers?.Authorization).toBe('Bearer refreshed-new-token');
      return [200, { success: true }];
    });

    mockRefresh.onPost('/auth/refresh').reply(200, {
      accessToken: 'refreshed-new-token',
    });

    const res = await http.get<{ success: boolean }>('/protected-data');
    expect(res).toEqual({ success: true });
    expect(tokenStore.get()).toBe('refreshed-new-token');
  });

  it('triggers exactly 1 refresh call for 5 parallel 401 requests', async () => {
    tokenStore.set('expired-token');
    let refreshCalls = 0;

    mockRefresh.onPost('/auth/refresh').reply(() => {
      refreshCalls++;
      return [200, { accessToken: 'shared-refreshed-token' }];
    });

    // Each endpoint fails with 401 on first call, succeeds on retry with refreshed token
    const endpoints = ['/req1', '/req2', '/req3', '/req4', '/req5'];
    endpoints.forEach((ep) => {
      let callCount = 0;
      mockApi.onGet(ep).reply((config) => {
        callCount++;
        if (callCount === 1) {
          return [401, { error: 'UNAUTHORIZED', message: 'Token expired' }];
        }
        expect(config.headers?.Authorization).toBe('Bearer shared-refreshed-token');
        return [200, { endpoint: ep, ok: true }];
      });
    });

    const results = await Promise.all(endpoints.map((ep) => http.get(ep)));

    expect(results).toHaveLength(5);
    expect(refreshCalls).toBe(1); // Single-flight refresh guarantee
    expect(tokenStore.get()).toBe('shared-refreshed-token');
  });

  it('clears token and emits session-expired event on refresh failure', async () => {
    tokenStore.set('invalid-token');

    mockApi.onGet('/user-profile').reply(401, { error: 'UNAUTHORIZED', message: 'Unauthorized' });
    mockRefresh.onPost('/auth/refresh').reply(401, { error: 'INVALID_REFRESH_TOKEN', message: 'Session revoked' });

    const sessionExpiredSpy = vi.fn();
    const unsubscribe = authEvents.onSessionExpired(sessionExpiredSpy);

    await expect(http.get('/user-profile')).rejects.toThrow(ApiError);

    expect(sessionExpiredSpy).toHaveBeenCalledTimes(1);
    expect(tokenStore.get()).toBeNull();

    unsubscribe();
  });

  describe('Error normalization (ApiError)', () => {
    it('normalizes validation error envelopes with fieldErrors', async () => {
      mockApi.onPost('/projects').reply(422, {
        statusCode: 422,
        error: 'VALIDATION_ERROR',
        message: 'Invalid project payload',
        fieldErrors: {
          code: ['Project code is required'],
          budget: ['Budget must be a positive number'],
        },
      });

      try {
        await http.post('/projects', {});
        expect.unreachable('Should have thrown ApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.statusCode).toBe(422);
        expect(apiErr.code).toBe('VALIDATION_ERROR');
        expect(apiErr.fieldErrors).toEqual({
          code: ['Project code is required'],
          budget: ['Budget must be a positive number'],
        });
      }
    });

    it('normalizes ECONNABORTED timeout to TIMEOUT ApiError', () => {
      const axiosTimeout = {
        isAxiosError: true,
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded',
      };
      const apiErr = toApiError(axiosTimeout);
      expect(apiErr).toBeInstanceOf(ApiError);
      expect(apiErr.code).toBe('TIMEOUT');
      expect(apiErr.statusCode).toBe(0);
    });

    it('normalizes network failure (no response) to NETWORK_ERROR ApiError', () => {
      const networkError = {
        isAxiosError: true,
        message: 'Network Error',
        response: undefined,
      };
      const apiErr = toApiError(networkError);
      expect(apiErr).toBeInstanceOf(ApiError);
      expect(apiErr.code).toBe('NETWORK_ERROR');
      expect(apiErr.statusCode).toBe(0);
    });

    it('handles unexpected errors gracefully', () => {
      const unexpected = new Error('Random JS crash');
      const apiErr = toApiError(unexpected);
      expect(apiErr).toBeInstanceOf(ApiError);
      expect(apiErr.code).toBe('UNKNOWN_ERROR');
      expect(apiErr.message).toBe('Random JS crash');
    });
  });
});
