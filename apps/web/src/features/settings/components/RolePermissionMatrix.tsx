import React, { useState } from 'react';
import type { PermissionDto, RoleDto, RolePermissionGrantDto } from '@epms/shared';
import { rolesApi } from '../api';

type Grants = Record<string, RolePermissionGrantDto>;
type Drafts = Record<string, Grants>;
const scopeNames: Record<string, string> = {
  OWN: 'Own items',
  TEAM: 'Team',
  DEPARTMENT: 'Department',
  ASSIGNED: 'Assigned projects',
  ALL: 'All records',
};
const primaryButton =
  'rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton =
  'rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-sm font-semibold text-surface-700 shadow-sm hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-50';

export function moduleName(module: string) {
  const names: Record<string, string> = {
    masterdata: 'Master data',
    users: 'User accounts',
    roles: 'Role management',
    time: 'Time entries',
    finance: 'Finance & billing',
    organization: 'Organization',
  };
  return (
    names[module] ?? module.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

export function actionName(permission: PermissionDto) {
  const names: Record<string, string> = {
    create: 'Add',
    edit: 'Edit / Update',
    update: 'Update',
    view: 'View',
    delete: 'Delete',
    export: 'Export',
    view_sensitive: 'View sensitive details',
    view_confidential: 'View confidential documents',
  };
  return (
    names[permission.action] ??
    permission.action.replace(/[_.]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function supportedScopes(key: string) {
  if (['employees.view', 'employees.edit', 'employees.deactivate'].includes(key))
    return ['OWN', 'TEAM', 'DEPARTMENT', 'ALL'];
  if (key === 'employees.view_sensitive') return ['OWN', 'ALL'];
  if (
    ['employees', 'users', 'roles', 'organization', 'audit', 'settings'].includes(key.split('.')[0])
  )
    return ['ALL'];
  return ['OWN', 'TEAM', 'DEPARTMENT', 'ASSIGNED', 'ALL'];
}

function reserved(permission: PermissionDto) {
  return ['roles', 'users'].includes(permission.module);
}

function actionCategory(permission: PermissionDto) {
  if (permission.action.startsWith('view') || permission.action.endsWith('.view')) return 'view';
  if (['edit', 'update'].includes(permission.action)) return 'edit';
  if (['create', 'delete', 'export'].includes(permission.action)) return permission.action;
  return 'other';
}

function compareActions(a: PermissionDto, b: PermissionDto) {
  const order = ['view', 'create', 'edit', 'delete', 'export', 'other'];
  return (
    order.indexOf(actionCategory(a)) - order.indexOf(actionCategory(b)) ||
    a.description.localeCompare(b.description)
  );
}
function grantsFor(role: RoleDto): Grants {
  return Object.fromEntries((role.permissions ?? []).map((grant) => [grant.permissionKey, grant]));
}

function effectiveGrant(role: RoleDto, permission: PermissionDto, drafts: Drafts) {
  if (!role.isActive) return undefined;
  if (role.code === 'SYSTEM_ADMIN') return { permissionKey: permission.key, scope: 'ALL' };
  if (reserved(permission)) return undefined;
  return (drafts[role.id] ?? grantsFor(role))[permission.key];
}

// Quoting alone does not prevent spreadsheet formula execution in role names/descriptions.
function csvCell(value: string) {
  const safe = /^\s*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function permissionReport(roles: RoleDto[], catalog: PermissionDto[], drafts: Drafts = {}) {
  const rows = [
    ['Module', 'Action', 'Permission', 'Role', 'Role status', 'Access', 'Scope', 'Changes'],
  ];
  for (const permission of catalog)
    for (const role of roles) {
      const grant = effectiveGrant(role, permission, drafts);
      rows.push([
        moduleName(permission.module),
        actionName(permission),
        permission.description,
        role.name,
        role.isActive ? 'Active' : 'Inactive',
        grant ? 'Allowed' : 'No access',
        grant?.scope ?? '',
        drafts[role.id] ? 'Unsaved draft' : 'Saved',
      ]);
    }
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function RolePermissionMatrix({
  roles,
  catalog,
  refresh,
}: {
  roles: RoleDto[];
  catalog: PermissionDto[];
  refresh: () => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<Drafts>({});
  const [module, setModule] = useState('');
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [severityFirst, setSeverityFirst] = useState(true);
  const moduleOrder = [
    'employees',
    'projects',
    'tasks',
    'timesheets',
    'time',
    'expenses',
    'documents',
    'reports',
    'organization',
    'finance',
  ];
  const modules = [...new Set(catalog.map((permission) => permission.module))].sort((a, b) => {
    const order = (name: string) =>
      moduleOrder.includes(name) ? moduleOrder.indexOf(name) : moduleOrder.length;
    return order(a) - order(b) || a.localeCompare(b);
  });
  const pendingRoles = roles.filter(
    (role) =>
      role.code !== 'SYSTEM_ADMIN' &&
      drafts[role.id] &&
      catalog.some((p) => drafts[role.id][p.key]?.scope !== grantsFor(role)[p.key]?.scope),
  );
  const pendingCount = pendingRoles.reduce(
    (count, role) =>
      count +
      catalog.filter((p) => drafts[role.id][p.key]?.scope !== grantsFor(role)[p.key]?.scope).length,
    0,
  );
  const filtered = catalog.filter((permission) => {
    const matchesAction =
      !action || actionCategory(permission) === (action === 'update' ? 'edit' : action);
    return (
      (!module || permission.module === module) &&
      matchesAction &&
      `${moduleName(permission.module)} ${actionName(permission)} ${permission.description}`
        .toLowerCase()
        .includes(search.trim().toLowerCase())
    );
  });
  const visibleModules = modules.filter((name) =>
    filtered.some((permission) => permission.module === name),
  );
  const nonAdmins = roles.filter((role) => role.isActive && role.code !== 'SYSTEM_ADMIN');
  const exportRoles = nonAdmins.filter((role) =>
    catalog.some((p) => p.action === 'export' && effectiveGrant(role, p, drafts)?.scope === 'ALL'),
  );
  const sensitiveRoles = nonAdmins.filter((role) =>
    catalog.some(
      (p) => (p.isSensitive || p.module === 'finance') && effectiveGrant(role, p, drafts),
    ),
  );
  const missingDescriptions = roles.filter((role) => !role.description?.trim());
  const restrictedGrants = nonAdmins.filter((role) =>
    catalog.some((p) => reserved(p) && (drafts[role.id] ?? grantsFor(role))[p.key]),
  );
  const findings = [
    ...(restrictedGrants.length
      ? [
          {
            title: 'Administration stays protected',
            tag: 'Administration',
            severity: 'Review',
            rank: 0,
            text: `${restrictedGrants.map((role) => role.name).join(', ')} contain account or role grants. Those actions remain available only to System Administrators.`,
          },
        ]
      : []),
    {
      title: 'Export access',
      tag: 'Data',
      severity: exportRoles.length ? 'Review' : 'Limited',
      rank: exportRoles.length ? 1 : 3,
      text: exportRoles.length
        ? `${exportRoles.map((role) => role.name).join(', ')} can export organization-wide data. Check that this matches their responsibilities.`
        : 'No non-admin role has organization-wide export access. Grant export separately for each supported module.',
    },
    {
      title: 'Sensitive information',
      tag: 'Privacy',
      severity: sensitiveRoles.length ? 'Review' : 'Limited',
      rank: sensitiveRoles.length ? 1 : 3,
      text: sensitiveRoles.length
        ? `${sensitiveRoles.map((role) => role.name).join(', ')} can access sensitive or financial information. Review their scope before saving.`
        : 'Sensitive information is restricted to administrators and personal profile access.',
    },
    {
      title: 'Administrator has full access',
      tag: 'Roles',
      severity: 'Protected',
      rank: 3,
      text: 'System Administrators have every available permission. Their column is locked and cannot be changed here.',
    },
    ...(missingDescriptions.length
      ? [
          {
            title: 'Describe each role',
            tag: 'Roles',
            severity: 'Suggested',
            rank: 2,
            text: `${missingDescriptions.length} role${missingDescriptions.length === 1 ? '' : 's'} have no description. Add a clear description when creating new roles.`,
          },
        ]
      : []),
    {
      title: pendingCount ? `${pendingCount} unsaved permission changes` : 'Changes require saving',
      tag: 'Changes',
      severity: pendingCount ? 'Pending' : 'Manual save',
      rank: pendingCount ? 0 : 3,
      text: pendingCount
        ? 'Review the changes below the matrix, then save. Existing user access stays the same until a change is saved.'
        : 'Use Save permissions to apply changes. The next API request uses the new permissions; open screens refresh within 30 seconds.',
    },
  ].sort((a, b) => (severityFirst ? a.rank - b.rank : b.rank - a.rank));

  function setGrant(role: RoleDto, permission: PermissionDto, scope: string | null) {
    setNotice('');
    setError('');
    setDrafts((previous) => {
      const base = grantsFor(role);
      const next = { ...(previous[role.id] ?? base) };
      if (scope)
        next[permission.key] = {
          ...(next[permission.key] ?? base[permission.key]),
          permissionKey: permission.key,
          scope,
        };
      else delete next[permission.key];
      return { ...previous, [role.id]: next };
    });
  }

  async function save() {
    if (busy || !pendingRoles.length) return;
    setBusy(true);
    setError('');
    setNotice('');
    const saved: string[] = [];
    let failed = '';
    for (const role of pendingRoles) {
      try {
        await rolesApi.update(role.id, Object.values(drafts[role.id]));
        saved.push(role.id);
      } catch (e) {
        failed = `${role.name}: ${e instanceof Error ? e.message : 'Could not save permissions.'}`;
        break;
      }
    }
    try {
      if (saved.length) await refresh();
      setDrafts((previous) =>
        Object.fromEntries(Object.entries(previous).filter(([id]) => !saved.includes(id))),
      );
      if (failed)
        setError(
          `${saved.length ? `${saved.length} role(s) saved. ` : ''}${failed} Unsaved changes have been kept.`,
        );
      else setNotice(`Permissions saved for ${saved.length} role${saved.length === 1 ? '' : 's'}.`);
    } catch {
      setError(
        'The changes were saved, but updated access could not be loaded. Reload the screen before making more changes.',
      );
    } finally {
      setBusy(false);
    }
  }

  function exportReport() {
    try {
      const url = URL.createObjectURL(
        new Blob([permissionReport(roles, catalog, drafts)], { type: 'text/csv;charset=utf-8' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'epms-role-permissions.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('The report could not be downloaded. Please try again.');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-600">
            Access management
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-surface-900">
            Roles and permissions
          </h1>
          <p className="mt-2 text-sm text-surface-500">
            Manage access across {roles.length} roles, {modules.length} modules and {catalog.length}{' '}
            permissions.
          </p>
        </div>
        <div className="flex gap-3">
          <button className={secondaryButton} onClick={exportReport}>
            Export report
          </button>
          <button
            className={primaryButton}
            disabled={busy || !pendingCount}
            onClick={() => void save()}
          >
            {busy ? 'Saving...' : 'Save permissions'}
          </button>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-violet-100 bg-violet-50/70 px-4 py-3 text-sm text-violet-900">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 font-bold"
        >
          i
        </span>
        <p>
          Choose access for each role. Available actions depend on the module; Edit / Update
          controls changes to existing records.
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_290px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <section
          aria-label="Permissions matrix"
          className="min-w-0 overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-100 p-5">
            <div>
              <h2 className="text-lg font-semibold text-surface-900">Permissions</h2>
              <p className="mt-1 text-xs text-surface-500">
                Compare roles and set access by module and action.
              </p>
            </div>
            <span className="rounded-full bg-surface-100 px-3 py-1 text-xs text-surface-600">
              {filtered.length} permissions shown
            </span>
          </div>
          <div className="flex flex-wrap gap-3 border-b border-surface-100 px-5 py-4">
            <label className="min-w-[140px] flex-1">
              <span className="sr-only">Search permissions</span>
              <input
                className="w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                placeholder="Search permissions..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label>
              <span className="sr-only">Filter module</span>
              <select
                className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm"
                value={module}
                onChange={(event) => setModule(event.target.value)}
              >
                <option value="">All modules</option>
                {modules.map((name) => (
                  <option key={name} value={name}>
                    {moduleName(name)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter action</span>
              <select
                className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm"
                value={action}
                onChange={(event) => setAction(event.target.value)}
              >
                <option value="">All actions</option>
                {[
                  ['view', 'View'],
                  ['create', 'Add'],
                  ['edit', 'Edit'],
                  ['update', 'Update'],
                  ['delete', 'Delete'],
                  ['export', 'Export'],
                  ['other', 'Other actions'],
                ].map(([value, name]) => (
                  <option key={value} value={value}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="max-h-[650px] overflow-auto">
            <table
              className="w-full border-separate border-spacing-0 text-left text-sm"
              aria-label="Role permissions by module and action"
            >
              <caption className="sr-only">
                Module permissions as rows and roles as columns. Checked means allowed; a minus
                indicates own items only. Administrator access is locked.
              </caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 top-0 z-30 min-w-[210px] border-b border-surface-200 bg-surface-50 px-5 py-4 text-xs font-semibold text-surface-500"
                  >
                    MODULE / ACTION
                  </th>
                  {roles.map((role) => (
                    <th
                      scope="col"
                      key={role.id}
                      className="sticky top-0 z-20 min-w-[145px] max-w-[175px] border-b border-surface-200 bg-surface-50 px-3 py-4 text-center align-top"
                    >
                      <span className="block font-semibold text-surface-800">{role.name}</span>
                      <span className="mt-1 block text-[11px] font-normal text-surface-500">
                        {role.assignedEmployeesCount ?? 0} users
                        {!role.isActive
                          ? ' / Inactive'
                          : role.code === 'SYSTEM_ADMIN'
                            ? ' / Full access'
                            : ''}
                      </span>
                      <span
                        className="mt-1 line-clamp-2 text-[10px] font-normal leading-4 text-surface-400"
                        title={role.description ?? undefined}
                      >
                        {role.description || 'No description'}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              {visibleModules.map((name) => (
                <tbody key={name}>
                  <tr>
                    <th
                      scope="rowgroup"
                      className="sticky left-0 z-10 border-b border-surface-100 bg-[#f7f7fb] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-surface-500"
                    >
                      {moduleName(name)}
                    </th>
                    <td
                      colSpan={roles.length}
                      className="border-b border-surface-100 bg-[#f7f7fb]"
                    />
                  </tr>
                  {filtered
                    .filter((p) => p.module === name)
                    .sort(compareActions)
                    .map((permission) => (
                      <tr key={permission.key} className="group">
                        <th
                          scope="row"
                          className="sticky left-0 z-10 border-b border-surface-100 bg-white px-5 py-3.5 font-normal group-hover:bg-violet-50"
                        >
                          <span className="block font-medium text-surface-800">
                            {actionName(permission)}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-surface-500">
                            {permission.description}
                          </span>
                        </th>
                        {roles.map((role) => {
                          const grant = effectiveGrant(role, permission, drafts);
                          const locked =
                            role.code === 'SYSTEM_ADMIN' || !role.isActive || reserved(permission);
                          const changed =
                            Boolean(drafts[role.id]) &&
                            drafts[role.id][permission.key]?.scope !==
                              grantsFor(role)[permission.key]?.scope;
                          return (
                            <td
                              key={role.id}
                              className={`border-b border-surface-100 px-3 py-3 text-center group-hover:bg-violet-50/40 ${changed ? 'bg-violet-50/70' : ''}`}
                            >
                              <div className="flex flex-col items-center gap-1.5">
                                <label
                                  className={`relative inline-flex ${locked || busy ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                  title={
                                    role.code === 'SYSTEM_ADMIN'
                                      ? 'Administrator full access is locked'
                                      : reserved(permission)
                                        ? 'Only administrators can perform this action'
                                        : undefined
                                  }
                                >
                                  <input
                                    className="peer sr-only"
                                    type="checkbox"
                                    aria-label={`${role.name}: ${permission.description}`}
                                    checked={Boolean(grant)}
                                    disabled={locked || busy}
                                    onChange={(event) =>
                                      setGrant(
                                        role,
                                        permission,
                                        event.target.checked
                                          ? supportedScopes(permission.key)[0]
                                          : null,
                                      )
                                    }
                                  />
                                  <span
                                    aria-hidden="true"
                                    className={`flex h-6 w-6 items-center justify-center rounded-[7px] border text-sm font-semibold shadow-sm transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-violet-400 peer-focus-visible:ring-offset-2 ${grant ? (grant.scope === 'OWN' ? 'border-violet-500 bg-white text-violet-600' : 'border-violet-600 bg-violet-600 text-white') : 'border-surface-300 bg-white text-transparent'} ${!role.isActive ? 'opacity-40' : ''}`}
                                  >
                                    {grant?.scope === 'OWN' ? '−' : '✓'}
                                  </span>
                                </label>
                                {grant && role.code !== 'SYSTEM_ADMIN' ? (
                                  <select
                                    aria-label={`${role.name}: ${permission.description} scope`}
                                    className="max-w-[125px] rounded border-0 bg-transparent px-1 py-0.5 text-[10px] text-surface-500 focus:outline-none focus:ring-1 focus:ring-violet-400"
                                    value={grant.scope}
                                    disabled={locked || busy}
                                    onChange={(event) =>
                                      setGrant(role, permission, event.target.value)
                                    }
                                  >
                                    {supportedScopes(permission.key).map((scope) => (
                                      <option key={scope} value={scope}>
                                        {scopeNames[scope]}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-[10px] text-surface-400">
                                    {role.code === 'SYSTEM_ADMIN' && role.isActive
                                      ? 'Full access'
                                      : reserved(permission)
                                        ? 'Admin only'
                                        : !role.isActive
                                          ? 'Inactive'
                                          : 'No access'}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </tbody>
              ))}
            </table>
            {!filtered.length && (
              <p className="p-10 text-center text-sm text-surface-500">
                No permissions match these filters. Try another module or action.
              </p>
            )}
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-100 px-5 py-4 text-xs text-surface-500">
            <div className="flex flex-wrap gap-4">
              <span>
                <span className="mr-1 inline-block rounded bg-violet-600 px-1 text-white">✓</span>{' '}
                Allowed
              </span>
              <span>
                <span className="mr-1 rounded border border-violet-400 px-1 text-violet-600">
                  −
                </span>{' '}
                Own items only
              </span>
              <span>
                <span className="mr-1 inline-block h-3 w-3 rounded border border-surface-300 align-middle" />{' '}
                No access
              </span>
            </div>
            <span>Changes apply after saving</span>
          </footer>
        </section>
        <aside
          aria-label="Access findings"
          className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm"
        >
          <div className="flex items-center justify-between gap-2 border-b border-surface-100 px-5 py-5">
            <h2 className="text-lg font-semibold">
              Findings{' '}
              <span className="ml-1 rounded-full bg-surface-100 px-2 py-0.5 text-xs text-surface-600">
                {findings.length}
              </span>
            </h2>
            <button
              className="text-xs font-semibold text-violet-600 hover:text-violet-800"
              aria-pressed={severityFirst}
              onClick={() => setSeverityFirst(!severityFirst)}
            >
              Sort by severity
            </button>
          </div>
          {findings.map((finding) => (
            <div key={finding.title} className="border-b border-surface-100 p-5 last:border-b-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold leading-5 text-surface-900">
                  {finding.title}
                </h3>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${finding.severity === 'Review' ? 'border-amber-200 bg-amber-50 text-amber-800' : finding.severity === 'Pending' ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-surface-200 bg-surface-50 text-surface-600'}`}
                >
                  {finding.severity}
                </span>
              </div>
              <span className="mt-2 inline-block rounded-full bg-surface-100 px-2 py-0.5 text-[10px] text-surface-500">
                {finding.tag}
              </span>
              <p className="mt-2 text-xs leading-5 text-surface-500">{finding.text}</p>
            </div>
          ))}
        </aside>
      </div>
      {pendingCount > 0 && (
        <section
          aria-label="Pending permission changes"
          className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-surface-900">Review changes</h2>
              <p className="mt-1 text-xs text-surface-500">
                {pendingCount} permissions changed across {pendingRoles.length} roles.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                className={secondaryButton}
                disabled={busy}
                onClick={() => {
                  setDrafts({});
                  setError('');
                  setNotice('');
                }}
              >
                Discard changes
              </button>
              <button className={primaryButton} disabled={busy} onClick={() => void save()}>
                {busy ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
          <ul className="mt-4 max-h-48 space-y-1 overflow-auto text-xs text-surface-600">
            {pendingRoles.flatMap((role) =>
              catalog
                .filter((p) => drafts[role.id][p.key]?.scope !== grantsFor(role)[p.key]?.scope)
                .map((p) => (
                  <li key={`${role.id}-${p.key}`}>
                    <span className="font-semibold">{role.name}</span> / {moduleName(p.module)} /{' '}
                    {actionName(p)}: {scopeNames[grantsFor(role)[p.key]?.scope] ?? 'No access'} →{' '}
                    {scopeNames[drafts[role.id][p.key]?.scope] ?? 'No access'}
                  </li>
                )),
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
