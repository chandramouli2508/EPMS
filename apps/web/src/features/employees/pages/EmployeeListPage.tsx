import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { EmployeeDto } from '@epms/shared';
import { Can } from '@/shared/permissions';
import { Modal } from '@/shared/ui/Modal';
import { useEmployeeLookups, useEmployees, useSetEmployeeActive } from '../hooks';
import { EmployeeDetail } from '../components/EmployeeDetail';
import { buttonStyle, inputStyle, secondaryStyle } from '../components/formStyles';

export default function EmployeeListPage() {
  const [url, setUrl] = useSearchParams();
  const search = url.get('search') ?? '';
  const [draftSearch, setDraftSearch] = useState(search);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<EmployeeDto | null>(null);
  const requestedPage = Number(url.get('page'));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const params = {
    page: Math.floor(page),
    limit: 20,
    search: search || undefined,
    departmentId: url.get('departmentId') || undefined,
    status: url.get('status') || undefined,
    role: url.get('role') || undefined,
  };
  const employees = useEmployees(params);
  const lookups = useEmployeeLookups();
  const active = useSetEmployeeActive();
  useEffect(() => {
    setDraftSearch(search);
  }, [search]);
  useEffect(() => {
    if (draftSearch.trim() === search) return;
    const timer = window.setTimeout(
      () =>
        setUrl(
          (previous) => {
            const next = new URLSearchParams(previous);
            if (draftSearch.trim()) next.set('search', draftSearch.trim());
            else next.delete('search');
            next.set('page', '1');
            return next;
          },
          { replace: true },
        ),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [draftSearch, search, setUrl]);
  const change = (key: string, value: string) =>
    setUrl((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.set('page', '1');
      return next;
    });
  const totalPages = Math.max(
    1,
    Math.ceil((employees.data?.total ?? 0) / (employees.data?.limit ?? 20)),
  );
  const closeConfirmation = () => {
    setConfirmation(null);
    active.reset();
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Employees</h1>
          <p className="mt-1 text-sm text-surface-500">People, roles, and account status.</p>
        </div>
        <Can permission="employees.create">
          <Link to="/employees/new" className={buttonStyle}>
            Add employee
          </Link>
        </Can>
      </div>
      <div className="grid gap-4 rounded-xl border border-surface-200 bg-white p-5 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <label htmlFor="employee-search" className="mb-1 block text-sm font-semibold">
            Search employees
          </label>
          <input
            id="employee-search"
            type="search"
            className={inputStyle}
            placeholder="Name, email, or code"
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="department-filter" className="mb-1 block text-sm font-semibold">
            Department
          </label>
          <select
            id="department-filter"
            className={inputStyle}
            value={params.departmentId ?? ''}
            onChange={(e) => change('departmentId', e.target.value)}
            disabled={!lookups.can('organization.view') || lookups.departments.isFetching}
          >
            <option value="">All departments</option>
            {params.departmentId &&
              !lookups.departments.data?.some((d) => d.id === params.departmentId) && (
                <option value={params.departmentId}>Selected department</option>
              )}
            {lookups.departments.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status-filter" className="mb-1 block text-sm font-semibold">
            Status
          </label>
          <select
            id="status-filter"
            className={inputStyle}
            value={params.status ?? ''}
            onChange={(e) => change('status', e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
        <div>
          <label htmlFor="role-filter" className="mb-1 block text-sm font-semibold">
            Role
          </label>
          <select
            id="role-filter"
            className={inputStyle}
            value={params.role ?? ''}
            onChange={(e) => change('role', e.target.value)}
            disabled={!lookups.can('roles.view') || lookups.roles.isFetching}
          >
            <option value="">All roles</option>
            {params.role && !lookups.roles.data?.some((r) => r.code === params.role) && (
              <option value={params.role}>{params.role}</option>
            )}
            {lookups.roles.data?.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        {(lookups.departments.error || lookups.roles.error) && (
          <p role="alert" className="text-sm text-red-700 sm:col-span-2 xl:col-span-4">
            Could not load some filter options.{' '}
            <button
              className="underline"
              onClick={() => {
                if (lookups.can('organization.view')) void lookups.departments.refetch();
                if (lookups.can('roles.view')) void lookups.roles.refetch();
              }}
            >
              Retry options
            </button>
          </p>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-sm">
        {employees.isPending ? (
          <p role="status" className="p-8 text-center text-sm">
            Loading employees...
          </p>
        ) : employees.error ? (
          <div role="alert" className="p-6 text-sm text-red-700">
            {employees.error.message}{' '}
            <button className="underline" onClick={() => void employees.refetch()}>
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Employee directory</caption>
                <thead className="border-b bg-surface-50 text-xs uppercase text-surface-500">
                  <tr>
                    {['Code', 'Name', 'Email', 'Department', 'Roles', 'Status', 'Actions'].map(
                      (label) => (
                        <th key={label} scope="col" className="px-5 py-3">
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {employees.data?.data.map((employee) => (
                    <tr key={employee.id}>
                      <td className="px-5 py-4 font-mono text-xs">
                        {employee.employeeCode || '—'}
                      </td>
                      <td className="px-5 py-4 font-medium">{employee.fullName || '—'}</td>
                      <td className="px-5 py-4">{employee.email || '—'}</td>
                      <td className="px-5 py-4">{employee.departmentName || '—'}</td>
                      <td className="px-5 py-4">{employee.roles.join(', ') || '—'}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${employee.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-surface-100 text-surface-600'}`}
                        >
                          {employee.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-3">
                          <button
                            type="button"
                            className="whitespace-nowrap text-primary-700 hover:underline"
                            onClick={() => setDetailId(employee.id)}
                          >
                            {lookups.can('employees.edit') ? 'View / Edit' : 'View'}
                          </button>
                          <Can permission="employees.deactivate">
                            <button
                              type="button"
                              className="text-red-700 hover:underline"
                              onClick={() => {
                                active.reset();
                                setConfirmation(employee);
                              }}
                            >
                              {employee.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
                            </button>
                          </Can>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!employees.data?.data.length && (
              <p className="p-8 text-center text-sm text-surface-500">
                No employees found. Try changing your search or filters.
              </p>
            )}
            <nav
              aria-label="Employee pagination"
              className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-200 px-5 py-4"
            >
              <p className="text-sm text-surface-500">
                {employees.data?.total ?? 0} employees · Page {params.page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  className={secondaryStyle}
                  disabled={page <= 1 || employees.isFetching}
                  onClick={() => change('page', String(page - 1))}
                >
                  Previous
                </button>
                <button
                  className={secondaryStyle}
                  disabled={page >= totalPages || employees.isFetching}
                  onClick={() => change('page', String(page + 1))}
                >
                  Next
                </button>
              </div>
            </nav>
          </>
        )}
      </div>
      {detailId && <EmployeeDetail id={detailId} onClose={() => setDetailId(null)} />}
      {confirmation && (
        <Modal
          title={`${confirmation.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'} employee?`}
          onClose={closeConfirmation}
          busy={active.isPending}
        >
          <p className="mb-4 text-sm">
            {confirmation.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'} {confirmation.fullName}
            ?{' '}
            {confirmation.status === 'ACTIVE'
              ? 'Their active sessions will be revoked and they will no longer be able to sign in.'
              : 'They will be able to sign in again.'}
          </p>
          {active.error && (
            <p role="alert" className="mb-4 text-sm text-red-700">
              {active.error.message}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              className={secondaryStyle}
              disabled={active.isPending}
              onClick={closeConfirmation}
            >
              Cancel
            </button>
            <button
              type="button"
              className={buttonStyle}
              disabled={active.isPending}
              onClick={() => {
                void active
                  .mutateAsync({ id: confirmation.id, active: confirmation.status !== 'ACTIVE' })
                  .then(closeConfirmation)
                  .catch(() => {});
              }}
            >
              {active.isPending ? 'Saving...' : 'Confirm'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
