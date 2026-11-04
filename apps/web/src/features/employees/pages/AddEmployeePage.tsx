import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '@/shared/api';
import { Modal } from '@/shared/ui/Modal';
import { useCreateEmployee, useEmployeeLookups } from '../hooks';
import { buttonStyle, inputStyle, secondaryStyle } from '../components/formStyles';

export function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function AddEmployeePage() {
  const navigate = useNavigate();
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [roles, setRoles] = useState(['EMPLOYEE']);
  const create = useCreateEmployee(setSecret);
  const lookups = useEmployeeLookups(true);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (create.isPending || secret) return;
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? '').trim();
    const validation: Record<string, string> = {};
    if (!value('firstName')) validation.firstName = 'First name is required.';
    if (!value('lastName')) validation.lastName = 'Last name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value('email')))
      validation.email = 'Enter a valid work email.';
    if (!roles.length) validation.roleCodes = 'Select at least one role.';
    if (value('dateOfJoining') && value('dateOfJoining') > localToday())
      validation.dateOfJoining = 'Date of joining cannot be in the future.';
    setErrors(validation);
    setServerError('');
    if (Object.keys(validation).length) return;
    try {
      await create.mutateAsync({
        fullName: `${value('firstName')} ${value('lastName')}`,
        email: value('email').toLowerCase(),
        ...(lookups.isAdmin ? { roleCodes: roles } : {}),
        ...Object.fromEntries(
          ['employeeCode', 'phone', 'dateOfJoining', 'departmentId', 'designationId', 'managerId']
            .filter((key) => value(key))
            .map((key) => [key, value(key)]),
        ),
      });
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : 'Could not create employee. Please try again.',
      );
      if (error instanceof ApiError && error.fieldErrors)
        setErrors(
          Object.fromEntries(
            Object.entries(error.fieldErrors).map(([key, messages]) => [key, messages.join(' ')]),
          ),
        );
    }
  };
  const closeSecret = () => {
    setSecret(null);
    setCopied(false);
    setCopyError('');
    create.reset();
    navigate('/employees');
  };
  const roleOptions = lookups.roles.data ?? [{ code: 'EMPLOYEE', name: 'Employee / Engineer' }];
  const lookupError = [
    lookups.departments.error,
    lookups.designations.error,
    lookups.roles.error,
    lookups.managers.error,
  ].find(Boolean);
  const fieldError = (field: string) =>
    errors[field] ? (
      <p id={`${field}-error`} role="alert" className="mt-1 text-sm text-red-700">
        {errors[field]}
      </p>
    ) : null;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link to="/employees" className="text-sm text-primary-600">
          Back to employees
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Add employee</h1>
        <p className="mt-1 text-sm text-surface-500">
          Create an employee account and assign their initial roles.
        </p>
      </div>
      {serverError && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {serverError}
        </p>
      )}
      {lookupError && (
        <div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm">
          Some options could not be loaded.{' '}
          {lookupError instanceof Error ? lookupError.message : ''}{' '}
          <button
            type="button"
            className="underline"
            onClick={() => {
              void lookups.departments.refetch();
              void lookups.designations.refetch();
              void lookups.roles.refetch();
              void lookups.managers.refetch();
            }}
          >
            Retry options
          </button>
        </div>
      )}
      <form
        onSubmit={submit}
        noValidate
        className="rounded-xl border border-surface-200 bg-white p-6 shadow-sm"
      >
        <fieldset
          disabled={create.isPending || secret !== null}
          className="grid gap-5 sm:grid-cols-2"
        >
          {(
            ['firstName', 'lastName', 'email', 'employeeCode', 'phone', 'dateOfJoining'] as const
          ).map((field) => {
            const label = {
              firstName: 'First name',
              lastName: 'Last name',
              email: 'Work email',
              employeeCode: 'Employee code (optional)',
              phone: 'Phone (optional)',
              dateOfJoining: 'Date of joining (optional)',
            }[field];
            return (
              <div key={field}>
                <label htmlFor={field} className="mb-1 block text-sm font-semibold">
                  {label}
                </label>
                <input
                  id={field}
                  name={field}
                  type={
                    field === 'email'
                      ? 'email'
                      : field === 'dateOfJoining'
                        ? 'date'
                        : field === 'phone'
                          ? 'tel'
                          : 'text'
                  }
                  max={field === 'dateOfJoining' ? localToday() : undefined}
                  required={['firstName', 'lastName', 'email'].includes(field)}
                  aria-invalid={Boolean(errors[field])}
                  aria-describedby={errors[field] ? `${field}-error` : undefined}
                  className={inputStyle}
                />
                {field === 'employeeCode' && (
                  <p className="mt-1 text-xs text-surface-500">
                    Leave blank to generate a code automatically.
                  </p>
                )}
                {fieldError(field)}
              </div>
            );
          })}
          <div>
            <label htmlFor="departmentId" className="mb-1 block text-sm font-semibold">
              Department (optional)
            </label>
            <select
              id="departmentId"
              name="departmentId"
              className={inputStyle}
              disabled={!lookups.can('organization.view') || lookups.departments.isFetching}
            >
              <option value="">None</option>
              {lookups.departments.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {fieldError('departmentId')}
          </div>
          <div>
            <label htmlFor="designationId" className="mb-1 block text-sm font-semibold">
              Designation (optional)
            </label>
            <select
              id="designationId"
              name="designationId"
              className={inputStyle}
              disabled={!lookups.can('organization.view') || lookups.designations.isFetching}
            >
              <option value="">None</option>
              {lookups.designations.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {fieldError('designationId')}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="managerId" className="mb-1 block text-sm font-semibold">
              Reporting manager (optional)
            </label>
            <select
              id="managerId"
              name="managerId"
              className={inputStyle}
              disabled={!lookups.can('employees.view') || lookups.managers.isFetching}
            >
              <option value="">None</option>
              {lookups.managers.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName} ({d.employeeCode})
                </option>
              ))}
            </select>
            {fieldError('managerId')}
          </div>
          <fieldset
            disabled={!lookups.isAdmin}
            className="sm:col-span-2"
            aria-describedby="role-hint"
          >
            <legend className="mb-2 text-sm font-semibold">Roles</legend>
            <p id="role-hint" className="mb-3 text-xs text-surface-500">
              Select one or more. Managers and leaders also need the EMPLOYEE role for their own
              work.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {roleOptions.map((role) => (
                <label
                  key={role.code}
                  className="flex items-center gap-2 rounded-lg border border-surface-200 p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    name="roleCodes"
                    value={role.code}
                    checked={roles.includes(role.code)}
                    onChange={(e) =>
                      setRoles((previous) =>
                        e.target.checked
                          ? [...previous, role.code]
                          : previous.filter((code) => code !== role.code),
                      )
                    }
                  />
                  {role.name}
                </label>
              ))}
            </div>
            {fieldError('roleCodes')}
            {!lookups.can('roles.view') && (
              <p className="mt-2 text-xs text-surface-500">
                Only the default EMPLOYEE role is available without role-catalog access.
              </p>
            )}
          </fieldset>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button type="submit" className={buttonStyle}>
              {create.isPending ? 'Saving...' : 'Create employee'}
            </button>
            {!create.isPending && (
              <Link to="/employees" className={secondaryStyle}>
                Cancel
              </Link>
            )}
          </div>
        </fieldset>
      </form>
      {secret !== null && (
        <Modal title="Employee created" onClose={closeSecret} busy={create.isPending}>
          <p className="mb-4 text-sm text-surface-600">
            Share this temporary password with the employee through a secure channel. They must
            change it on first login.
          </p>
          <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">
            Shown once. Save it before closing this window; you cannot retrieve it later.
          </p>
          <output
            aria-label="Temporary password"
            className="mb-4 block break-all rounded-lg bg-surface-100 p-4 font-mono text-lg select-all"
          >
            {secret}
          </output>
          {copyError && (
            <p role="alert" className="mb-3 text-sm text-red-700">
              {copyError}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              className={secondaryStyle}
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(secret)
                  .then(() => {
                    setCopied(true);
                    setCopyError('');
                  })
                  .catch(() =>
                    setCopyError('Could not copy. Select the password and copy it manually.'),
                  );
                if (!navigator.clipboard)
                  setCopyError('Clipboard is unavailable. Select and copy the password manually.');
              }}
            >
              {copied ? 'Copied' : 'Copy password'}
            </button>
            <button
              type="button"
              className={buttonStyle}
              disabled={create.isPending}
              onClick={closeSecret}
            >
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
