import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from '@/shared/api';
import { Can } from './index';

vi.mock('@/app/providers/AuthProvider', () => ({ useAuth: () => ({ status: 'authenticated' }) }));
vi.mock('@/shared/api', () => ({ http: { get: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
describe('Employee permissions', () => {
  it('shows granted actions and hides ungranted actions using the current-user endpoint', async () => {
    vi.mocked(http.get).mockResolvedValue({
      id: 'employee-1',
      permissions: { 'employees.view': 'OWN' },
    });
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <Can permission="employees.view">
          <p>Directory access</p>
        </Can>
        <Can permission="employees.create">
          <p>Create access</p>
        </Can>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Directory access')).toBeInTheDocument();
    expect(screen.queryByText('Create access')).not.toBeInTheDocument();
    expect(http.get).toHaveBeenCalledWith('/auth/me');
  });
});
