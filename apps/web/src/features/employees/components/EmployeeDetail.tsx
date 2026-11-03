import React, { useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { usePermission, usePermissions } from '@/shared/permissions';
import { useEmployee, useEmployeeLookups, useUpdateEmployee } from '../hooks';
import { buttonStyle, inputStyle, secondaryStyle } from './formStyles';

export function EmployeeDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useEmployee(id);
  const update = useUpdateEmployee();
  const lookups = useEmployeeLookups(true);
  const canEdit = usePermission('employees.edit');
  const { data: viewer, can } = usePermissions();
  const [error, setError] = useState('');
  const employee = detail.data;
  const canEditSensitive = can('employees.view_sensitive') || viewer?.id === id;
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const fullName = String(fields.get('fullName') ?? '').trim();
    if (!fullName) {
      setError('Full name is required.');
      return;
    }
    const joining = String(fields.get('dateOfJoining') ?? '');
    const today = new Date();
    const currentDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (joining && joining > currentDate) {
      setError('Date of joining cannot be in the future.');
      return;
    }
    try {
      await update.mutateAsync({
        id,
        body: {
          fullName,
          // Omitted masked values must never overwrite data the viewer cannot see.
          ...(fields.has('phone') ? { phone: String(fields.get('phone') ?? '') } : {}),
          ...(fields.get('dateOfJoining')
            ? { dateOfJoining: String(fields.get('dateOfJoining')) }
            : {}),
          ...(fields.has('departmentId')
            ? { departmentId: String(fields.get('departmentId') ?? '') || null }
            : {}),
          ...(fields.has('designationId')
            ? { designationId: String(fields.get('designationId') ?? '') || null }
            : {}),
          ...(fields.has('managerId')
            ? { managerId: String(fields.get('managerId') ?? '') || null }
            : {}),
        },
      });
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not update employee.');
    }
  };
  return (
    <Modal
      title={canEdit ? 'View / edit employee' : 'Employee details'}
      onClose={onClose}
      busy={update.isPending}
    >
      {detail.isPending && <p role="status">Loading employee...</p>}
      {detail.error && (
        <p role="alert">
          {detail.error.message} <button onClick={() => void detail.refetch()}>Retry</button>
        </p>
      )}
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {employee && (
        <form onSubmit={submit} className="space-y-4">
          <dl className="text-sm">
            <dt className="font-semibold">Code</dt>
            <dd>{employee.employeeCode || '—'}</dd>
            <dt className="mt-2 font-semibold">Email</dt>
            <dd>{employee.email || '—'}</dd>
            <dt className="mt-2 font-semibold">Roles</dt>
            <dd>{employee.roles.join(', ') || '—'}</dd>
          </dl>
          <fieldset disabled={!canEdit || update.isPending} className="space-y-4">
            <div>
              <label htmlFor="edit-fullName" className="block text-sm font-semibold">
                Full name
              </label>
              <input
                id="edit-fullName"
                name="fullName"
                defaultValue={employee.fullName}
                className={inputStyle}
              />
            </div>
            {canEditSensitive ? (
              <>
                <div>
                  <label htmlFor="edit-phone" className="block text-sm font-semibold">
                    Phone
                  </label>
                  <input
                    id="edit-phone"
                    name="phone"
                    defaultValue={employee.phone ?? ''}
                    className={inputStyle}
                  />
                </div>
                <div>
                  <label htmlFor="edit-joining" className="block text-sm font-semibold">
                    Date of joining
                  </label>
                  <input
                    id="edit-joining"
                    name="dateOfJoining"
                    type="date"
                    defaultValue={employee.dateOfJoining ?? ''}
                    className={inputStyle}
                  />
                </div>
              </>
            ) : (
              <>
                <p className="text-sm">Phone: {employee.phone || '—'}</p>
                <p className="text-sm">Date of joining: {employee.dateOfJoining || '—'}</p>
              </>
            )}
            {lookups.can('organization.view') && (
              <>
                <div>
                  <label htmlFor="edit-department" className="block text-sm font-semibold">
                    Department
                  </label>
                  <select
                    id="edit-department"
                    name="departmentId"
                    defaultValue={employee.departmentId ?? ''}
                    className={inputStyle}
                    disabled={!lookups.departments.data}
                  >
                    <option value="">None</option>
                    {employee.departmentId &&
                      !lookups.departments.data?.some((d) => d.id === employee.departmentId) && (
                        <option value={employee.departmentId}>
                          {employee.departmentName ?? 'Current department'}
                        </option>
                      )}
                    {lookups.departments.data?.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-designation" className="block text-sm font-semibold">
                    Designation
                  </label>
                  <select
                    id="edit-designation"
                    name="designationId"
                    defaultValue={employee.designationId ?? ''}
                    className={inputStyle}
                    disabled={!lookups.designations.data}
                  >
                    <option value="">None</option>
                    {employee.designationId &&
                      !lookups.designations.data?.some((d) => d.id === employee.designationId) && (
                        <option value={employee.designationId}>
                          {employee.designationName ?? 'Current designation'}
                        </option>
                      )}
                    {lookups.designations.data?.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div>
              <label htmlFor="edit-manager" className="block text-sm font-semibold">
                Reporting manager
              </label>
              <select
                id="edit-manager"
                name="managerId"
                defaultValue={employee.managerId ?? ''}
                className={inputStyle}
                disabled={!lookups.managers.data}
              >
                <option value="">None</option>
                {employee.managerId &&
                  !lookups.managers.data?.some((d) => d.id === employee.managerId) && (
                    <option value={employee.managerId}>
                      {employee.managerName ?? 'Current manager'}
                    </option>
                  )}
                {lookups.managers.data
                  ?.filter((d) => d.id !== id)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName}
                    </option>
                  ))}
              </select>
            </div>
          </fieldset>
          <div className="flex gap-3">
            {canEdit && (
              <button type="submit" className={buttonStyle} disabled={update.isPending}>
                {update.isPending ? 'Saving...' : 'Save changes'}
              </button>
            )}
            <button
              type="button"
              className={secondaryStyle}
              disabled={update.isPending}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </form>
      )}
      {!employee && (
        <button className={secondaryStyle} onClick={onClose}>
          Close
        </button>
      )}
    </Modal>
  );
}
