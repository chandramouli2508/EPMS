import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/shared/permissions';
import { inputStyle, secondaryStyle } from '@/features/employees/components/formStyles';
import { rolesApi } from '../api';
import { RolePermissionMatrix } from '../components/RolePermissionMatrix';
import { Assignments } from '../components/Assignments';

export default function SettingsPage() {
  const { isAdmin } = usePermissions();
  return isAdmin ? (
    <PermissionsScreen />
  ) : (
    <p role="alert">Only administrators can manage roles and permissions.</p>
  );
}

function PermissionsScreen() {
  const client = useQueryClient();
  const roles = useQuery({ queryKey: ['roles-admin'], queryFn: rolesApi.list });
  const catalog = useQuery({ queryKey: ['permission-catalog'], queryFn: rolesApi.catalog });
  const details = useQuery({
    queryKey: ['role-matrix', roles.data?.map((role) => [role.id, role.updatedAt])],
    queryFn: () => Promise.all((roles.data ?? []).map((role) => rolesApi.get(role.id))),
    enabled: Boolean(roles.data),
    placeholderData: (previous) => previous,
  });
  const [selected, setSelected] = useState('');
  const [mode, setMode] = useState<'create' | 'duplicate' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = async () => {
    await Promise.all(
      [
        'roles-admin',
        'role-matrix',
        'role-admin',
        'employee-lookups',
        'employees',
        'current-user',
      ].map((key) => client.invalidateQueries({ queryKey: [key] }, { throwOnError: true })),
    );
  };
  if (
    (roles.error && !roles.data) ||
    (catalog.error && !catalog.data) ||
    (details.error && !details.data)
  )
    return (
      <div role="alert">
        Could not load permissions.{' '}
        <button
          onClick={() => {
            void roles.refetch();
            void catalog.refetch();
            void details.refetch();
          }}
        >
          Retry
        </button>
      </div>
    );
  if (roles.isPending || catalog.isPending || details.isPending)
    return <p role="status">Loading roles and permissions...</p>;
  const selectedRole = roles.data?.find((role) => role.id === selected);
  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await operation();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The change could not be saved. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="min-w-0 space-y-6">
      {(roles.error || catalog.error || details.error) && (
        <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          Some access information could not be refreshed. Reload before making further changes.
        </p>
      )}
      <RolePermissionMatrix
        roles={[...(details.data ?? [])].sort(
          (a, b) =>
            Number(b.code === 'SYSTEM_ADMIN') - Number(a.code === 'SYSTEM_ADMIN') ||
            Number(b.isActive) - Number(a.isActive) ||
            a.name.localeCompare(b.name),
        )}
        catalog={catalog.data ?? []}
        refresh={refresh}
      />
      <section
        aria-label="Role management"
        className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Manage roles</h2>
            <p className="mt-1 text-xs text-surface-500">
              Create a role, duplicate an existing role, or deactivate an unassigned custom role.
            </p>
          </div>
          <button
            className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            disabled={busy}
            onClick={() => setMode('create')}
          >
            Create role
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1 text-sm">
            Select role
            <select
              className={inputStyle}
              value={selected}
              disabled={busy}
              onChange={(event) => {
                setSelected(event.target.value);
                setMode(null);
                setError('');
              }}
            >
              <option value="">Choose a role</option>
              {roles.data?.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                  {!role.isActive ? ' (Inactive)' : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            className={secondaryStyle}
            disabled={busy || !selected}
            onClick={() => setMode('duplicate')}
          >
            Duplicate role
          </button>
          <button
            className={secondaryStyle}
            disabled={
              busy ||
              !selectedRole ||
              selectedRole.isSystem ||
              !selectedRole.isActive ||
              Boolean(selectedRole.assignedEmployeesCount)
            }
            onClick={() => void run(() => rolesApi.deactivate(selected))}
          >
            Deactivate role
          </button>
        </div>
        {mode && (
          <form
            className="mt-5 rounded-xl border border-violet-100 bg-violet-50/40 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const body = {
                code: String(data.get('code')).trim(),
                name: String(data.get('name')).trim(),
                description: String(data.get('description')).trim(),
              };
              void run(async () => {
                const role = await (mode === 'duplicate'
                  ? rolesApi.duplicate(selected, body)
                  : rolesApi.create(body));
                setSelected(role.id);
                setMode(null);
              });
            }}
          >
            <h3 className="mb-4 font-semibold">
              {mode === 'create' ? 'Create role' : 'Duplicate role'}
            </h3>
            <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                Role code
                <input
                  className={inputStyle}
                  name="code"
                  required
                  pattern="[A-Za-z][A-Za-z0-9_]*"
                />
              </label>
              <label className="text-sm">
                Role name
                <input className={inputStyle} name="name" required />
              </label>
              <label className="text-sm sm:col-span-2">
                Description
                <input
                  className={inputStyle}
                  name="description"
                  placeholder="Describe who this role is for"
                />
              </label>
              <div className="flex gap-3 sm:col-span-2">
                <button
                  className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                  type="submit"
                >
                  {busy ? 'Creating...' : 'Create'}
                </button>
                <button className={secondaryStyle} type="button" onClick={() => setMode(null)}>
                  Cancel
                </button>
              </div>
            </fieldset>
          </form>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}
      </section>
      <Assignments roles={roles.data ?? []} refresh={refresh} />
    </div>
  );
}
