import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { EmployeeDto } from '@epms/shared';
import { ApiError } from '@/shared/api';
import { employeesApi } from '../api/employeesApi';
import EmployeeListPage from '../pages/EmployeeListPage';
import AddEmployeePage from '../pages/AddEmployeePage';

vi.mock('../api/employeesApi', () => ({
  employeesApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    reactivate: vi.fn(),
    departments: vi.fn(),
    designations: vi.fn(),
    roles: vi.fn(),
    managers: vi.fn(),
  },
}));
const permissionState = vi.hoisted(() => ({ denied: [] as string[] }));
vi.mock('@/shared/permissions', () => ({
  usePermissions: () => ({ can: (key: string) => !permissionState.denied.includes(key) }),
  usePermission: (key: string) => !permissionState.denied.includes(key),
  Can: ({ permission, children }: { permission: string; children: React.ReactNode }) =>
    permissionState.denied.includes(permission) ? null : children,
}));

const employee: EmployeeDto = {
  id: 'employee-1',
  employeeCode: 'EMP-0002',
  fullName: 'Jane Doe',
  email: 'jane@example.com',
  status: 'ACTIVE',
  roles: ['EMPLOYEE'],
  mustChangePassword: true,
  failedLoginAttempts: 0,
  createdAt: '',
  updatedAt: '',
  departmentName: 'Engineering',
};
let client: QueryClient;
function Location() {
  return <output aria-label="URL">{useLocation().search}</output>;
}
function mount(path = '/employees') {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Location />
        <Routes>
          <Route path="/employees" element={<EmployeeListPage />} />
          <Route path="/employees/new" element={<AddEmployeePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  permissionState.denied = [];
  vi.mocked(employeesApi.list).mockResolvedValue({
    data: [employee],
    page: 1,
    limit: 20,
    total: 1,
  });
  vi.mocked(employeesApi.departments).mockResolvedValue([
    {
      id: 'department-1',
      code: 'ENG',
      name: 'Engineering',
      isActive: true,
      createdAt: '',
      updatedAt: '',
    },
  ]);
  vi.mocked(employeesApi.designations).mockResolvedValue([]);
  vi.mocked(employeesApi.managers).mockResolvedValue([]);
  vi.mocked(employeesApi.roles).mockResolvedValue([
    {
      id: 'role-1',
      code: 'EMPLOYEE',
      name: 'Employee',
      isActive: true,
      isSystem: true,
      createdAt: '',
      updatedAt: '',
    },
  ]);
  vi.mocked(employeesApi.get).mockResolvedValue(employee);
  vi.mocked(employeesApi.update).mockResolvedValue(employee);
  vi.mocked(employeesApi.deactivate).mockResolvedValue({ success: true, message: 'Deactivated' });
  vi.mocked(employeesApi.reactivate).mockResolvedValue({ success: true, message: 'Reactivated' });
  vi.mocked(employeesApi.create).mockResolvedValue({ employee, tempPassword: 'OneTimeSecret123!' });
});
afterEach(() => {
  cleanup();
  client?.clear();
  vi.resetAllMocks();
});

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('First name'), 'Jane');
  await user.type(screen.getByLabelText('Last name'), 'Doe');
  await user.type(screen.getByLabelText('Work email'), 'Jane@Example.com');
}

describe('Employee directory', () => {
  it('renders server rows and masked values', async () => {
    mount();
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('EMP-0002')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add employee' })).toBeInTheDocument();
  });
  it('renders an empty state', async () => {
    vi.mocked(employeesApi.list).mockResolvedValue({ data: [], page: 1, limit: 20, total: 0 });
    mount();
    expect(await screen.findByText(/No employees found/)).toBeInTheDocument();
  });
  it('keeps filters and debounced search in the URL and sends server parameters', async () => {
    const user = userEvent.setup();
    mount('/employees?page=3');
    await screen.findByText('Jane Doe');
    await user.selectOptions(screen.getByLabelText('Status'), 'INACTIVE');
    await waitFor(() =>
      expect(employeesApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'INACTIVE', page: 1 }),
        expect.any(AbortSignal),
      ),
    );
    await user.selectOptions(screen.getByLabelText('Department'), 'department-1');
    await user.selectOptions(screen.getByLabelText('Role'), 'EMPLOYEE');
    await user.type(screen.getByLabelText('Search employees'), 'Jane');
    expect(employeesApi.list).not.toHaveBeenCalledWith(
      expect.objectContaining({ search: 'Jane' }),
      expect.anything(),
    );
    await waitFor(() =>
      expect(employeesApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: 'Jane',
          role: 'EMPLOYEE',
          departmentId: 'department-1',
          status: 'INACTIVE',
          page: 1,
        }),
        expect.any(AbortSignal),
      ),
    );
    expect(screen.getByLabelText('URL')).toHaveTextContent('search=Jane');
  });
  it('requests the next page from the server', async () => {
    vi.mocked(employeesApi.list).mockResolvedValue({
      data: [employee],
      page: 1,
      limit: 20,
      total: 25,
    });
    const user = userEvent.setup();
    mount();
    await screen.findByText('Jane Doe');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(employeesApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
        expect.any(AbortSignal),
      ),
    );
  });
  it('shows retryable errors', async () => {
    vi.mocked(employeesApi.list).mockRejectedValue(
      new ApiError(500, 'HTTP_ERROR', 'Directory unavailable'),
    );
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Directory unavailable');
  });
  it('hides actions when their permissions are absent', async () => {
    permissionState.denied = ['employees.create', 'employees.edit', 'employees.deactivate'];
    mount();
    await screen.findByText('Jane Doe');
    expect(screen.queryByRole('link', { name: 'Add employee' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument();
  });
  it('requires confirmation to deactivate and invalidates the list', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText('Jane Doe');
    await user.click(screen.getByRole('button', { name: 'Deactivate' }));
    expect(employeesApi.deactivate).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(employeesApi.deactivate).toHaveBeenCalledWith('employee-1'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(vi.mocked(employeesApi.list).mock.calls.length).toBeGreaterThan(1);
  });
  it('loads details and saves the update DTO', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText('Jane Doe');
    await user.click(screen.getByRole('button', { name: 'View / Edit' }));
    const name = await screen.findByLabelText('Full name');
    await user.clear(name);
    await user.type(name, 'Jane Updated');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(employeesApi.update).toHaveBeenCalledWith(
        'employee-1',
        expect.objectContaining({ fullName: 'Jane Updated' }),
      ),
    );
  });
});

describe('Add employee', () => {
  it('validates required fields and rejects a future joining date', async () => {
    const user = userEvent.setup();
    mount('/employees/new');
    await user.click(screen.getByRole('button', { name: 'Create employee' }));
    expect(screen.getByText('First name is required.')).toBeInTheDocument();
    expect(screen.getByText('Last name is required.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid work email.')).toBeInTheDocument();
    await fillForm(user);
    await user.type(screen.getByLabelText('Date of joining (optional)'), '2999-01-01');
    await user.click(screen.getByRole('button', { name: 'Create employee' }));
    expect(screen.getByText('Date of joining cannot be in the future.')).toBeInTheDocument();
    expect(employeesApi.create).not.toHaveBeenCalled();
  });
  it('shows a one-time password, traps focus, copies, and clears on close without caching it', async () => {
    const user = userEvent.setup();
    mount('/employees/new');
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create employee' }));
    const dialog = await screen.findByRole('dialog');
    expect(employeesApi.create).toHaveBeenCalledWith({
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      roleCodes: ['EMPLOYEE'],
    });
    expect(within(dialog).getByLabelText('Temporary password')).toHaveTextContent(
      'OneTimeSecret123!',
    );
    expect(
      JSON.stringify(
        client
          .getMutationCache()
          .getAll()
          .map((mutation) => mutation.state),
      ),
    ).not.toContain('OneTimeSecret123!');
    await user.click(dialog.parentElement!);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const close = within(dialog).getByRole('button', { name: 'Close' });
    close.focus();
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Copy password' })).toHaveFocus();
    const clipboard = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await user.click(within(dialog).getByRole('button', { name: 'Copy password' }));
    expect(clipboard).toHaveBeenCalledWith('OneTimeSecret123!');
    await user.click(close);
    expect(screen.queryByText('OneTimeSecret123!')).not.toBeInTheDocument();
    await screen.findByRole('heading', { name: 'Employees' });
    await user.click(screen.getByRole('link', { name: 'Add employee' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('shows server validation errors without opening the password modal', async () => {
    vi.mocked(employeesApi.create).mockRejectedValue(
      new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'An employee with this email already exists.'),
    );
    const user = userEvent.setup();
    mount('/employees/new');
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create employee' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An employee with this email already exists.',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
