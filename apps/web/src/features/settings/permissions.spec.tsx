import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RoleDto } from '@epms/shared';
import SettingsPage from './pages/SettingsPage';
import { rolesApi } from './api';
import { employeesApi } from '@/features/employees/api/employeesApi';
import { permissionReport, RolePermissionMatrix } from './components/RolePermissionMatrix';

const state = vi.hoisted(() => ({ isAdmin: true }));
vi.mock('@/shared/permissions', () => ({ usePermissions: () => state }));
vi.mock('./api', () => ({
  rolesApi: {
    list: vi.fn(),
    catalog: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    duplicate: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    assign: vi.fn(),
  },
}));
vi.mock('@/features/employees/api/employeesApi', () => ({ employeesApi: { list: vi.fn() } }));

const employeeRole: RoleDto = {
  id: 'employee-role',
  code: 'EMPLOYEE',
  name: 'Employee',
  isSystem: true,
  isActive: true,
  createdAt: '',
  updatedAt: '1',
  permissions: [{ permissionKey: 'employees.view', scope: 'OWN', approvalLimit: 123 }],
};
const adminRole: RoleDto = {
  ...employeeRole,
  id: 'admin-role',
  code: 'SYSTEM_ADMIN',
  name: 'System Administrator',
  permissions: [],
};
let client: QueryClient;
function mount() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SettingsPage />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  state.isAdmin = true;
  vi.mocked(rolesApi.list).mockResolvedValue([adminRole, employeeRole]);
  vi.mocked(rolesApi.catalog).mockResolvedValue([
    {
      id: 'view',
      key: 'employees.view',
      module: 'employees',
      action: 'view',
      description: 'View employees',
      isSensitive: false,
    },
    {
      id: 'create',
      key: 'employees.create',
      module: 'employees',
      action: 'create',
      description: 'Create employees',
      isSensitive: false,
    },
    {
      id: 'edit',
      key: 'employees.edit',
      module: 'employees',
      action: 'edit',
      description: 'Edit employees',
      isSensitive: false,
    },
    {
      id: 'delete',
      key: 'projects.delete',
      module: 'projects',
      action: 'delete',
      description: 'Delete draft projects',
      isSensitive: false,
    },
    {
      id: 'export',
      key: 'reports.export',
      module: 'reports',
      action: 'export',
      description: 'Export reports',
      isSensitive: false,
    },
  ]);
  vi.mocked(rolesApi.get).mockImplementation(async (id) =>
    id === adminRole.id ? adminRole : employeeRole,
  );
  vi.mocked(employeesApi.list).mockResolvedValue({
    data: [
      {
        id: 'user-1',
        fullName: 'Jane Doe',
        employeeCode: 'EMP-0002',
        roles: ['EMPLOYEE'],
      } as never,
    ],
    total: 1,
    page: 1,
    limit: 100,
  });
  vi.mocked(rolesApi.update).mockResolvedValue(employeeRole);
  vi.mocked(rolesApi.assign).mockResolvedValue({ success: true });
});
afterEach(() => {
  cleanup();
  client?.clear();
});

describe('Roles & Permissions screen', () => {
  it('does not load administration data for a non-admin', () => {
    state.isAdmin = false;
    mount();
    expect(screen.getByRole('alert')).toHaveTextContent('Only administrators');
    expect(rolesApi.list).not.toHaveBeenCalled();
  });
  it('shows administrator full access as read-only even without stored grants', async () => {
    mount();
    const input = await screen.findByRole('checkbox', {
      name: 'System Administrator: View employees',
    });
    expect(input).toBeChecked();
    expect(input).toBeDisabled();
    expect(
      screen.getByRole('checkbox', { name: 'System Administrator: Delete draft projects' }),
    ).toBeChecked();
    expect(screen.getByRole('button', { name: 'Save permissions' })).toBeDisabled();
  });
  it('saves a role permission matrix and preserves existing approval limits', async () => {
    const user = userEvent.setup();
    mount();
    await user.selectOptions(
      await screen.findByLabelText('Employee: View employees scope'),
      'DEPARTMENT',
    );
    await user.click(screen.getByRole('checkbox', { name: 'Employee: Create employees' }));
    await user.click(screen.getByRole('button', { name: 'Save permissions' }));
    await waitFor(() =>
      expect(rolesApi.update).toHaveBeenCalledWith('employee-role', [
        { permissionKey: 'employees.view', scope: 'DEPARTMENT', approvalLimit: 123 },
        { permissionKey: 'employees.create', scope: 'ALL' },
      ]),
    );
  });
  it('filters available module actions and maps Add and Edit / Update to actual permissions', async () => {
    const user = userEvent.setup();
    mount();
    const matrix = await screen.findByRole('table', {
      name: 'Role permissions by module and action',
    });
    expect(within(matrix).getByText('Add')).toBeInTheDocument();
    expect(within(matrix).getByText('Edit / Update')).toBeInTheDocument();
    expect(within(matrix).getByText('Delete')).toBeInTheDocument();
    expect(within(matrix).getByText('Export')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Filter module'), 'employees');
    expect(
      screen.queryByRole('checkbox', { name: 'Employee: Delete draft projects' }),
    ).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Filter action'), 'update');
    expect(screen.getByRole('checkbox', { name: 'Employee: Edit employees' })).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: 'Employee: View employees' }),
    ).not.toBeInTheDocument();
  });
  it('discards drafts without sending permission mutations', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('checkbox', { name: 'Employee: Create employees' }));
    expect(screen.getByRole('region', { name: 'Pending permission changes' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.getByRole('checkbox', { name: 'Employee: Create employees' })).not.toBeChecked();
    expect(rolesApi.update).not.toHaveBeenCalled();
  });
  it('keeps draft changes available when saving fails', async () => {
    vi.mocked(rolesApi.update).mockRejectedValue(new Error('Permission update failed'));
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('checkbox', { name: 'Employee: Create employees' }));
    await user.click(screen.getByRole('button', { name: 'Save permissions' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unsaved changes have been kept');
    expect(screen.getByRole('checkbox', { name: 'Employee: Create employees' })).toBeChecked();
  });
  it('assigns selected active roles to a user', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('option', { name: 'Jane Doe (EMP-0002)' });
    await user.selectOptions(await screen.findByLabelText('Employee'), 'user-1');
    await user.click(screen.getByRole('checkbox', { name: 'System Administrator' }));
    await user.click(screen.getByRole('button', { name: 'Save user roles' }));
    await waitFor(() =>
      expect(rolesApi.assign).toHaveBeenCalledWith('user-1', ['EMPLOYEE', 'SYSTEM_ADMIN']),
    );
  });
  it('clears the selected employee when searching to prevent saving roles to a hidden user', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('option', { name: 'Jane Doe (EMP-0002)' });
    await user.selectOptions(screen.getByLabelText('Employee'), 'user-1');
    expect(screen.getByRole('button', { name: 'Save user roles' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Search employees'), 'another');
    expect(screen.queryByRole('button', { name: 'Save user roles' })).not.toBeInTheDocument();
    expect(rolesApi.assign).not.toHaveBeenCalled();
  });
});

describe('Matrix report and partial saves', () => {
  const permission = {
    id: 'view',
    key: 'employees.view',
    module: 'employees',
    action: 'view',
    description: 'View employees',
    isSensitive: false,
  };
  it('exports effective administrator access and escapes spreadsheet formulas in role names', () => {
    const csv = permissionReport([{ ...adminRole, name: '=HYPERLINK("example")' }], [permission]);
    expect(csv).toContain('"Allowed","ALL","Saved"');
    expect(csv).toContain('"\'=HYPERLINK(""example"")"');
  });
  it('marks exported drafts and denies reserved administration grants for ordinary roles', () => {
    const reserved = {
      ...permission,
      key: 'users.assign_roles',
      module: 'users',
      action: 'assign_roles',
      description: 'Assign roles',
    };
    const csv = permissionReport([employeeRole], [permission, reserved], {
      [employeeRole.id]: {
        'employees.view': { permissionKey: 'employees.view', scope: 'DEPARTMENT' },
        'users.assign_roles': { permissionKey: 'users.assign_roles', scope: 'ALL' },
      },
    });
    expect(csv).toContain('"Allowed","DEPARTMENT","Unsaved draft"');
    expect(csv).toContain('"No access","","Unsaved draft"');
  });
  it('reports partial success and keeps only unsaved roles in the review', async () => {
    const other = { ...employeeRole, id: 'other-role', code: 'OTHER', name: 'Other' };
    vi.mocked(rolesApi.update)
      .mockResolvedValueOnce(employeeRole)
      .mockRejectedValueOnce(new Error('Role changed'));
    const user = userEvent.setup();
    const refresh = vi.fn().mockResolvedValue(undefined);
    render(
      <RolePermissionMatrix
        roles={[employeeRole, other]}
        catalog={[permission]}
        refresh={refresh}
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Employee: View employees' }));
    await user.click(screen.getByRole('checkbox', { name: 'Other: View employees' }));
    await user.click(screen.getByRole('button', { name: 'Save permissions' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('1 role(s) saved');
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole('region', { name: 'Pending permission changes' })).toHaveTextContent(
      '1 permissions changed across 1 roles',
    );
  });
});
