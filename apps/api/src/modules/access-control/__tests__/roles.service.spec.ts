import { ForbiddenException } from '@nestjs/common';
import { PermissionScope } from '@prisma/client';
import { RolesService } from '../roles.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditWriterService } from '../../../infrastructure/audit/audit-writer.service';

describe('RolesService Protections', () => {
  let service: RolesService;
  let prismaMock: {
    role: { findUnique: jest.Mock; update: jest.Mock };
    rolePermission: { deleteMany: jest.Mock; create: jest.Mock };
    permission: { findUnique: jest.Mock };
    $transaction: jest.Mock;
    $executeRaw: jest.Mock;
  };
  let auditWriterMock: { write: jest.Mock };

  beforeEach(() => {
    prismaMock = {
      $executeRaw: jest.fn(),
      role: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      rolePermission: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      permission: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prismaMock)),
    };

    auditWriterMock = {
      write: jest.fn(),
    };

    service = new RolesService(
      prismaMock as unknown as PrismaService,
      auditWriterMock as unknown as AuditWriterService,
    );
  });

  describe('deactivateRole', () => {
    it('should throw ForbiddenException when attempting to deactivate a system role', async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'role-1',
        code: 'SYSTEM_ADMIN',
        name: 'System Administrator',
        isSystem: true,
        _count: { employees: 0 },
      });

      await expect(service.deactivateRole('role-1', 'actor-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when deactivating a custom role assigned to active employees', async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'role-2',
        code: 'CUSTOM_ROLE',
        name: 'Custom Role',
        isSystem: false,
        _count: { employees: 3 }, // Active employees assigned!
      });

      await expect(service.deactivateRole('role-2', 'actor-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateRole SYSTEM_ADMIN requirements', () => {
    it('should throw ForbiddenException if SYSTEM_ADMIN is missing required permissions at scope ALL', async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'role-admin',
        code: 'SYSTEM_ADMIN',
        name: 'System Administrator',
        isSystem: true,
        permissions: [],
        _count: { employees: 1 },
      });

      // Missing roles.edit at scope ALL
      const updateDto = {
        permissions: [
          { permissionKey: 'roles.view', scope: PermissionScope.ALL },
          { permissionKey: 'users.assign_roles', scope: PermissionScope.ALL },
          { permissionKey: 'employees.view', scope: PermissionScope.OWN }, // Narrowed!
        ],
      };

      await expect(service.updateRole('role-admin', updateDto, 'actor-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
