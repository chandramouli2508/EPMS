import { ForbiddenException } from '@nestjs/common';
import { PermissionScope } from '@prisma/client';
import { EmployeesService } from './employees.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

describe('Employee record scope', () => {
  const user = (
    scope: PermissionScope,
    departmentId: string | null = 'department-1',
  ): AuthenticatedUser => ({
    id: 'caller',
    email: 'caller@example.com',
    fullName: 'Caller',
    employeeCode: 'EMP-1',
    mustChangePassword: false,
    roles: ['EMPLOYEE'],
    departmentId,
    permissions: { 'employees.view': scope },
  });
  function setup() {
    const prisma = {
      team: { findMany: jest.fn().mockResolvedValue([{ id: 'team-1', leadId: 'leader' }]) },
      employee: { findFirst: jest.fn() },
    };
    const service = Object.create(EmployeesService.prototype) as EmployeesService;
    Object.assign(service, { prisma });
    return { service, prisma };
  }
  it('restricts OWN and DEPARTMENT access and fails closed without a department', async () => {
    const { service } = setup();
    expect(await service.accessFilter(user(PermissionScope.OWN), 'employees.view')).toEqual({
      id: 'caller',
    });
    expect(await service.accessFilter(user(PermissionScope.DEPARTMENT), 'employees.view')).toEqual({
      departmentId: 'department-1',
    });
    expect(
      await service.accessFilter(user(PermissionScope.DEPARTMENT, null), 'employees.view'),
    ).toEqual({ id: { in: [] } });
  });
  it('limits TEAM access to active teams the caller belongs to or leads', async () => {
    const { service, prisma } = setup();
    const filter = await service.accessFilter(user(PermissionScope.TEAM), 'employees.view');
    expect(prisma.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          OR: [{ leadId: 'caller' }, { members: { some: { employeeId: 'caller' } } }],
        },
      }),
    );
    expect(filter).toEqual({
      OR: [
        { teamMemberships: { some: { teamId: { in: ['team-1'] } } } },
        { id: { in: ['leader'] } },
      ],
    });
  });
  it('blocks direct record access outside the allowed scope', async () => {
    const { service, prisma } = setup();
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(
      service.assertRecordAccess(user(PermissionScope.OWN), 'employees.view', 'other-user'),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.employee.findFirst).toHaveBeenCalledWith({
      where: { AND: [{ id: 'other-user' }, { id: 'caller' }] },
      select: { id: true },
    });
  });
  it('unions team and department predicates without assuming either contains the other', async () => {
    const { service } = setup();
    const caller = {
      ...user(PermissionScope.DEPARTMENT),
      permissionScopes: { 'employees.view': [PermissionScope.OWN, PermissionScope.DEPARTMENT] },
    };
    expect(await service.accessFilter(caller, 'employees.view')).toEqual({
      OR: [{ id: 'caller' }, { departmentId: 'department-1' }],
    });
  });
});

describe('Administrator recovery protections', () => {
  function setup() {
    const tx = {
      $executeRaw: jest.fn(),
      employee: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            id: 'last-admin',
            status: 'ACTIVE',
            roles: [{ role: { code: 'SYSTEM_ADMIN' } }],
          }),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
      },
      employeeRole: { deleteMany: jest.fn(), create: jest.fn() },
      role: { findMany: jest.fn().mockResolvedValue([{ id: 'employee-role', code: 'EMPLOYEE' }]) },
    };
    const auditWriter = { write: jest.fn() };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = Object.create(EmployeesService.prototype) as EmployeesService;
    Object.assign(service, { prisma, auditWriter });
    return { service, tx, auditWriter };
  }
  it('locks before checking and refuses removal of the last administrator role', async () => {
    const { service, tx } = setup();
    await expect(
      service.assignRoles('last-admin', { roleCodes: ['EMPLOYEE'] }, 'actor'),
    ).rejects.toThrow(ForbiddenException);
    expect(tx.$executeRaw.mock.calls[0][0][0]).toContain('pg_advisory_xact_lock(42002)');
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.employee.count.mock.invocationCallOrder[0],
    );
    expect(tx.employeeRole.deleteMany).not.toHaveBeenCalled();
  });
  it('uses the same lock and refuses deactivation of the last administrator', async () => {
    const { service, tx } = setup();
    await expect(service.deactivateEmployee('last-admin', 'actor')).rejects.toThrow(
      ForbiddenException,
    );
    expect(tx.$executeRaw.mock.calls[0][0][0]).toContain('pg_advisory_xact_lock(42002)');
    expect(tx.employee.update).not.toHaveBeenCalled();
  });
  it('changes assignments and writes the audit event in the same transaction when another administrator remains', async () => {
    const { service, tx, auditWriter } = setup();
    tx.employee.count.mockResolvedValue(1);
    expect(await service.assignRoles('last-admin', { roleCodes: ['EMPLOYEE'] }, 'actor')).toEqual({
      success: true,
      roles: ['EMPLOYEE'],
    });
    expect(tx.employeeRole.create).toHaveBeenCalledWith({
      data: { employeeId: 'last-admin', roleId: 'employee-role', assignedById: 'actor' },
    });
    expect(auditWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.roles.assign',
        previousValue: { roles: ['SYSTEM_ADMIN'] },
        newValue: { roles: ['EMPLOYEE'] },
      }),
      tx,
    );
  });
});
