import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CurrentUserDto } from '@epms/shared';
import { useAuth } from '@/app/providers/AuthProvider';
import { http } from '@/shared/api';

export function usePermissions() {
  const { status } = useAuth();
  const query = useQuery({
    queryKey: ['current-user'],
    queryFn: () => http.get<CurrentUserDto>('/auth/me'),
    enabled: status === 'authenticated',
    staleTime: 30_000,
  });
  return {
    ...query,
    can: (key: string) => status === 'authenticated' && Boolean(query.data?.permissions[key]),
  };
}

export function usePermission(permission: string) {
  return usePermissions().can(permission);
}

export function Can({ permission, children }: { permission: string; children: React.ReactNode }) {
  return usePermission(permission) ? <>{children}</> : null;
}
