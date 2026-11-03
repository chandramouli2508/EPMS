// apps/web/src/app/providers/QueryProvider.tsx
import { QueryCache, QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ApiError } from '@/shared/api';
import { toast } from '@/shared/ui/Toast';

/**
 * TanStack Query configuration:
 * - staleTime 30s: avoids redundant refetches on navigation
 * - refetchOnWindowFocus off: engineering tools don't need auto-refresh on tab switch
 * - retry once, but never on 4xx (client errors are not transient)
 * - Global onError toasts (skip 401 — AuthProvider handles that; skip fieldErrors — forms handle those)
 */
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
            return false; // Don't retry client errors
          }
          return failureCount < 1;
        },
      },
      mutations: {
        retry: false,
      },
    },
    queryCache: new QueryCache({
      onError: (error) => {
        if (!(error instanceof ApiError)) return;
        if (error.statusCode === 401) return; // AuthProvider handles session expiry
        if (error.fieldErrors) return; // Forms handle field-level errors
        toast.error(error.message);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        if (!(error instanceof ApiError)) return;
        if (error.statusCode === 401) return;
        if (error.fieldErrors) return;
        toast.error(error.message);
      },
    }),
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState so the client is stable across re-renders
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
