import { PermissionScope } from '@prisma/client';
import { PermissionResolverService } from '../permission-resolver.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('PermissionResolverService', () => {
  let service: PermissionResolverService;
  let prismaMock: { employeeRole: { findMany: jest.Mock } };

  beforeEach(() => {
    prismaMock = {
      employeeRole: {
        findMany: jest.fn(),
      },
    };
    service = new PermissionResolverService(prismaMock as unknown as PrismaService);
  });

  it('should resolve multi-role union with widest scope winning', async () => {
    prismaMock.employeeRole.findMany.mockResolvedValue([
      {
        role: {
          code: 'EMPLOYEE',
          isActive: true,
          permissions: [
            {
              scope: PermissionScope.OWN,
              permission: { key: 'tasks.view' },
            },
            {
              scope: PermissionScope.OWN,
              permission: { key: 'timesheets.submit' },
            },
          ],
        },
      },
      {
        role: {
          code: 'TEAM_LEADER',
          isActive: true,
          permissions: [
            {
              scope: PermissionScope.TEAM,
              permission: { key: 'tasks.view' },
            },
            {
              scope: PermissionScope.TEAM,
              permission: { key: 'timesheets.approve' },
            },
          ],
        },
      },
      {
        role: {
          code: 'PROJECT_MANAGER',
          isActive: true,
          permissions: [
            {
              scope: PermissionScope.ASSIGNED,
              permission: { key: 'tasks.view' },
            },
          ],
        },
      },
    ]);

    const result = await service.resolvePermissionsForEmployee('emp-123');

    expect(result.roles).toEqual(['EMPLOYEE', 'TEAM_LEADER', 'PROJECT_MANAGER']);
    // For tasks.view, PM has ASSIGNED which is wider than TEAM and OWN
    expect(result.permissions['tasks.view']).toBe(PermissionScope.ASSIGNED);
    expect(result.permissions['timesheets.submit']).toBe(PermissionScope.OWN);
    expect(result.permissions['timesheets.approve']).toBe(PermissionScope.TEAM);
  });

  it('should correctly evaluate hasPermission with minimum scope', () => {
    const permissions: Record<string, PermissionScope> = {
      'tasks.view': PermissionScope.DEPARTMENT,
      'employees.view': PermissionScope.OWN,
    };

    // Equal scope
    expect(service.hasPermission(permissions, 'tasks.view', PermissionScope.DEPARTMENT)).toBe(true);
    // User scope (DEPARTMENT) is wider than requested (TEAM)
    expect(service.hasPermission(permissions, 'tasks.view', PermissionScope.TEAM)).toBe(true);
    // User scope (DEPARTMENT) is narrower than requested (ALL)
    expect(service.hasPermission(permissions, 'tasks.view', PermissionScope.ALL)).toBe(false);
    // Non-existent permission
    expect(service.hasPermission(permissions, 'finance.view')).toBe(false);
  });
});
