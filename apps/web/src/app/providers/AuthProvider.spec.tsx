import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
// Integration tests intercept transport requests; application code uses the public barrel.
// eslint-disable-next-line no-restricted-imports
import { api, refreshClient } from '@/shared/api/client';
import { tokenStore } from '@/shared/api';
import { AuthProvider } from './AuthProvider';
import { AppLayout } from '../layouts/AppLayout';
import { ProtectedRoute } from '../router';

const requests = new MockAdapter(api);
const refresh = new MockAdapter(refreshClient);

function LoginScreen() {
  const navigate = useNavigate();
  return <><h1>Login screen</h1><button onClick={() => navigate('/dashboard')}>Open dashboard</button></>;
}

function mount() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginScreen />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<h1>Private dashboard</h1>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  requests.reset();
  refresh.reset();
  tokenStore.clear();
  vi.restoreAllMocks();
});

describe('Logout and protected navigation', () => {
  it('calls server logout, clears auth, and rejects dashboard navigation and reload', async () => {
    const user = userEvent.setup();
    refresh.onPost('/auth/refresh').reply(200, { accessToken: 'access-token' });
    requests.onPost('/auth/logout').reply((config) => {
      expect(config.headers?.Authorization).toBe('Bearer access-token');
      return [200, { success: true }];
    });
    const view = mount();
    await screen.findByRole('heading', { name: 'Private dashboard' });
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByRole('heading', { name: 'Login screen' });
    expect(requests.history.post).toHaveLength(1);
    expect(tokenStore.get()).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Open dashboard' }));
    expect(screen.queryByRole('heading', { name: 'Private dashboard' })).not.toBeInTheDocument();

    view.unmount();
    // A new page load can no longer restore the revoked session.
    refresh.onPost('/auth/refresh').reply(401, { message: 'No refresh token provided.' });
    mount();
    await screen.findByRole('heading', { name: 'Login screen' });
    expect(screen.queryByRole('heading', { name: 'Private dashboard' })).not.toBeInTheDocument();
  });

  it('shows a retryable failure instead of pretending a failed logout succeeded', async () => {
    const user = userEvent.setup();
    refresh.onPost('/auth/refresh').reply(200, { accessToken: 'access-token' });
    requests.onPost('/auth/logout').networkError();
    mount();
    await screen.findByRole('heading', { name: 'Private dashboard' });
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('heading', { name: 'Private dashboard' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled());
    requests.onPost('/auth/logout').reply(200, { success: true });
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByRole('heading', { name: 'Login screen' });
  });
});
