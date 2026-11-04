import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { RoleDto } from '@epms/shared';
import { employeesApi } from '@/features/employees/api/employeesApi';
import { inputStyle } from '@/features/employees/components/formStyles';
import { rolesApi } from '../api';

const buttonStyle =
  'rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50';

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'The change could not be saved. Please try again.';
}

export function Assignments({
  roles,
  refresh,
}: {
  roles: RoleDto[];
  refresh: () => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [id, setId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const employees = useQuery({
    queryKey: ['employees', 'role-assignment', search],
    queryFn: () => employeesApi.list({ search, limit: 100 }),
  });
  const activeRoles = roles.filter((role) => role.isActive);
  const details = useQuery({
    queryKey: ['role-admin', 'assignment-preview', selected],
    queryFn: () =>
      Promise.all(
        activeRoles
          .filter((role) => selected.includes(role.code))
          .map((role) => rolesApi.get(role.id)),
      ),
    enabled: Boolean(id),
  });
  return (
    <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm space-y-4">
      <h2 className="text-lg font-semibold">Assign user roles</h2>
      <label className="block">
        Search employees
        <input
          className={inputStyle}
          value={search}
          disabled={busy}
          onChange={(event) => {
            setSearch(event.target.value);
            setId('');
            setSelected([]);
            setNotice('');
          }}
        />
      </label>
      {employees.error && (
        <div role="alert">
          {message(employees.error)} <button onClick={() => void employees.refetch()}>Retry</button>
        </div>
      )}
      <label className="block">
        Employee
        <select
          className={inputStyle}
          value={id}
          disabled={busy || employees.isFetching}
          onChange={(event) => {
            const employee = employees.data?.data.find((item) => item.id === event.target.value);
            setId(employee?.id ?? '');
            setSelected(
              employee?.roles.filter((code) => activeRoles.some((role) => role.code === code)) ??
                [],
            );
            setError('');
            setNotice('');
          }}
        >
          <option value="">Select an employee</option>
          {employees.data?.data.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.fullName} ({employee.employeeCode})
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-surface-500">
        Showing up to 100 matching employees. Search by name, email, or employee code to narrow
        results.
      </p>
      {id && (
        <>
          <fieldset disabled={busy} className="grid gap-2 sm:grid-cols-2">
            <legend className="mb-2 font-semibold">Assigned roles</legend>
            {activeRoles.map((role) => (
              <label key={role.id} className="flex gap-2 rounded-lg border p-3">
                <input
                  type="checkbox"
                  checked={selected.includes(role.code)}
                  onChange={(event) =>
                    setSelected((previous) =>
                      event.target.checked
                        ? [...previous, role.code]
                        : previous.filter((code) => code !== role.code),
                    )
                  }
                />
                {role.name}
              </label>
            ))}
          </fieldset>
          <div className="rounded-lg bg-surface-50 p-3 text-sm">
            <h3 className="font-semibold">Access preview by selected role</h3>
            {selected.includes('SYSTEM_ADMIN') ? (
              <p>Full administrator access to all modules and actions.</p>
            ) : details.isPending ? (
              <p>Loading permissions...</p>
            ) : details.error ? (
              <p role="alert">Could not load access preview.</p>
            ) : (
              <ul className="max-h-48 overflow-auto">
                {details.data?.flatMap((role) =>
                  (role.permissions ?? []).map((grant) => (
                    <li key={`${role.id}-${grant.permissionKey}`}>
                      {role.name}: {grant.permissionKey} ({grant.scope})
                    </li>
                  )),
                )}
              </ul>
            )}
            {!selected.length && <p>No roles selected: business-module access will be denied.</p>}
          </div>
          <button
            className={buttonStyle}
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError('');
              setNotice('');
              void rolesApi
                .assign(id, selected)
                .then(async () => {
                  await refresh();
                  setNotice('User roles saved.');
                })
                .catch((e: unknown) => setError(message(e)))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? 'Saving...' : 'Save user roles'}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
