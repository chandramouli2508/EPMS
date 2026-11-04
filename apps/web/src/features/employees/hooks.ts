import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/shared/permissions';
import {
  employeesApi,
  type CreateEmployeeInput,
  type EmployeeListParams,
  type UpdateEmployeeInput,
} from './api/employeesApi';

export function useEmployees(params: EmployeeListParams) {
  return useQuery({
    queryKey: ['employees', 'list', params],
    queryFn: ({ signal }) => employeesApi.list(params, signal),
  });
}
export function useEmployee(id: string) {
  return useQuery({
    queryKey: ['employees', 'detail', id],
    queryFn: () => employeesApi.get(id),
    enabled: Boolean(id),
  });
}
export function useEmployeeLookups(includeForm = false) {
  const { can, isAdmin } = usePermissions();
  const departments = useQuery({
    queryKey: ['employee-lookups', 'departments'],
    queryFn: employeesApi.departments,
    enabled: can('organization.view'),
  });
  const roles = useQuery({
    queryKey: ['employee-lookups', 'roles'],
    queryFn: employeesApi.roles,
    enabled: isAdmin,
  });
  const designations = useQuery({
    queryKey: ['employee-lookups', 'designations'],
    queryFn: employeesApi.designations,
    enabled: includeForm && can('organization.view'),
  });
  const managers = useQuery({
    queryKey: ['employees', 'managers'],
    queryFn: employeesApi.managers,
    enabled: includeForm && can('employees.view'),
  });
  return { departments, roles, designations, managers, can, isAdmin };
}
export function useCreateEmployee(revealPassword: (password: string) => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateEmployeeInput) => {
      const { employee, tempPassword } = await employeesApi.create(body);
      // Only the employee is returned to TanStack Query. The secret goes straight to component state.
      revealPassword(tempPassword);
      return employee;
    },
    gcTime: 0,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}
export function useUpdateEmployee() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateEmployeeInput }) =>
      employeesApi.update(id, body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}
export function useSetEmployeeActive() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? employeesApi.reactivate(id) : employeesApi.deactivate(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}
