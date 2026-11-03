import type { DepartmentDto, DesignationDto, EmployeeDto, RoleDto } from '@epms/shared';
import { http } from '@/shared/api';

export interface EmployeeListParams {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  status?: string;
  role?: string;
}
// The actual employee endpoint uses a flat envelope, not PaginatedResponse<T>.
export interface EmployeeListResponse {
  data: EmployeeDto[];
  total: number;
  page: number;
  limit: number;
}
export interface CreateEmployeeInput {
  fullName: string;
  email: string;
  employeeCode?: string;
  phone?: string;
  dateOfJoining?: string;
  departmentId?: string;
  designationId?: string;
  managerId?: string;
  roleCodes?: string[];
}
export interface UpdateEmployeeInput {
  fullName?: string;
  phone?: string;
  dateOfJoining?: string;
  departmentId?: string | null;
  designationId?: string | null;
  managerId?: string | null;
}
export const employeesApi = {
  list: (params: EmployeeListParams, signal?: AbortSignal) =>
    http.get<EmployeeListResponse>('/employees', { params, signal }),
  get: (id: string) => http.get<EmployeeDto>(`/employees/${id}`),
  create: (body: CreateEmployeeInput) =>
    http.post<{ employee: EmployeeDto; tempPassword: string }>('/employees', body),
  update: (id: string, body: UpdateEmployeeInput) =>
    http.patch<EmployeeDto>(`/employees/${id}`, body),
  deactivate: (id: string) =>
    http.post<{ success: boolean; message: string }>(`/employees/${id}/deactivate`),
  reactivate: (id: string) =>
    http.post<{ success: boolean; message: string }>(`/employees/${id}/reactivate`),
  departments: () => http.get<DepartmentDto[]>('/organization/departments'),
  designations: () => http.get<DesignationDto[]>('/organization/designations'),
  roles: () => http.get<RoleDto[]>('/roles'),
  managers: async () => {
    const all: EmployeeDto[] = [];
    let page = 1;
    while (true) {
      const result = await employeesApi.list({ status: 'ACTIVE', page, limit: 100 });
      all.push(...result.data);
      if (all.length >= result.total || result.data.length === 0) return all;
      page++;
    }
  },
};
