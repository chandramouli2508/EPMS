import type { PermissionDto, RoleDto, RolePermissionGrantDto } from '@epms/shared';
import { http } from '@/shared/api';

export const rolesApi = {
  list: () => http.get<RoleDto[]>('/roles', { params: { includeInactive: true } }),
  catalog: () => http.get<PermissionDto[]>('/permissions'),
  get: (id: string) => http.get<RoleDto>(`/roles/${id}`),
  create: (body: { code: string; name: string; description: string }) =>
    http.post<RoleDto>('/roles', body),
  duplicate: (id: string, body: { code: string; name: string; description: string }) =>
    http.post<RoleDto>(`/roles/${id}/duplicate`, body),
  update: (id: string, permissions: RolePermissionGrantDto[]) =>
    http.put<RoleDto>(`/roles/${id}`, { permissions }),
  deactivate: (id: string) => http.post(`/roles/${id}/deactivate`),
  assign: (id: string, roleCodes: string[]) => http.post(`/employees/${id}/roles`, { roleCodes }),
};
