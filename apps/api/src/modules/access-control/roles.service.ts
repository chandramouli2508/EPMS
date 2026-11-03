import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PermissionScope } from '@prisma/client';
import { AppErrorCode, PermissionDto, RoleDto } from '@epms/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../infrastructure/audit/audit-writer.service';
import { CreateRoleDto, DuplicateRoleDto, UpdateRoleDto } from './dto/role.dto';

const SYSTEM_ADMIN_REQUIRED_GRANTS: Record<string, PermissionScope> = {
  'roles.view': PermissionScope.ALL,
  'roles.edit': PermissionScope.ALL,
  'users.assign_roles': PermissionScope.ALL,
  'employees.view': PermissionScope.ALL,
};

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  /**
   * Lists all available permissions grouped by module.
   */
  async listPermissions(): Promise<PermissionDto[]> {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });

    return permissions.map((p) => ({
      id: p.id,
      key: p.key,
      module: p.module,
      action: p.action,
      description: p.description,
      isSensitive: p.isSensitive,
    }));
  }

  /**
   * Lists all roles with assigned active employee count.
   */
  async listRoles(includeInactive = false): Promise<RoleDto[]> {
    const roles = await this.prisma.role.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: {
        _count: {
          select: {
            employees: {
              where: {
                employee: { status: 'ACTIVE' },
              },
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    return roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      isActive: r.isActive,
      assignedEmployeesCount: r._count.employees,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  /**
   * Gets role details by ID including its permission matrix.
   */
  async getRole(id: string): Promise<RoleDto> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: { permission: true },
        },
        _count: {
          select: {
            employees: {
              where: {
                employee: { status: 'ACTIVE' },
              },
            },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      assignedEmployeesCount: role._count.employees,
      permissions: role.permissions.map((rp) => ({
        permissionKey: rp.permission.key,
        scope: rp.scope,
        approvalLimit: rp.approvalLimit ? Number(rp.approvalLimit) : null,
      })),
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    };
  }

  /**
   * Creates a custom role.
   */
  async createRole(
    dto: CreateRoleDto,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<RoleDto> {
    const code = dto.code.trim().toUpperCase();

    const existing = await this.prisma.role.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException(`Role with code ${code} already exists.`);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          code,
          name: dto.name.trim(),
          description: dto.description ?? null,
          isSystem: false,
          isActive: true,
        },
      });

      if (dto.permissions && dto.permissions.length > 0) {
        for (const p of dto.permissions) {
          const perm = await tx.permission.findUnique({
            where: { key: p.permissionKey },
          });
          if (!perm) {
            throw new BadRequestException(`Unknown permission key: ${p.permissionKey}`);
          }

          await tx.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: perm.id,
              scope: p.scope,
              approvalLimit: p.approvalLimit ?? null,
            },
          });
        }
      }

      await this.auditWriter.write(
        {
          actorId,
          action: 'roles.create',
          entityType: 'Role',
          entityId: role.id,
          newValue: { code: role.code, name: role.name },
          outcome: 'SUCCESS',
          ipAddress,
          userAgent,
        },
        tx,
      );

      return role;
    });

    return this.getRole(created.id);
  }

  /**
   * Duplicates an existing role with all its permission mappings.
   */
  async duplicateRole(
    sourceRoleId: string,
    dto: DuplicateRoleDto,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<RoleDto> {
    const sourceRole = await this.prisma.role.findUnique({
      where: { id: sourceRoleId },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    if (!sourceRole) {
      throw new NotFoundException('Source role not found.');
    }

    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.role.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException(`Role with code ${code} already exists.`);
    }

    const duplicated = await this.prisma.$transaction(async (tx) => {
      const newRole = await tx.role.create({
        data: {
          code,
          name: dto.name.trim(),
          description: dto.description ?? `Copy of ${sourceRole.name}`,
          isSystem: false,
          isActive: true,
        },
      });

      for (const rp of sourceRole.permissions) {
        await tx.rolePermission.create({
          data: {
            roleId: newRole.id,
            permissionId: rp.permissionId,
            scope: rp.scope,
            approvalLimit: rp.approvalLimit,
          },
        });
      }

      await this.auditWriter.write(
        {
          actorId,
          action: 'roles.duplicate',
          entityType: 'Role',
          entityId: newRole.id,
          reason: `Duplicated from ${sourceRole.code}`,
          newValue: { code: newRole.code, name: newRole.name },
          outcome: 'SUCCESS',
          ipAddress,
          userAgent,
        },
        tx,
      );

      return newRole;
    });

    return this.getRole(duplicated.id);
  }

  /**
   * Updates role permissions matrix.
   * Enforces rules:
   * 1. System role codes cannot be modified.
   * 2. SYSTEM_ADMIN must always retain roles.view, roles.edit, users.assign_roles, and employees.view at scope ALL.
   * 3. Custom roles can only be renamed when no active employee holds them.
   */
  async updateRole(
    id: string,
    dto: UpdateRoleDto,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<RoleDto> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        _count: {
          select: {
            employees: { where: { employee: { status: 'ACTIVE' } } },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    // Custom role rename rule: can only be renamed when no active employee holds them
    if (dto.name && dto.name.trim() !== role.name) {
      if (role.isSystem) {
        throw new ForbiddenException('System role names and codes are immutable.');
      }
      if (role._count.employees > 0) {
        throw new ForbiddenException({
          code: AppErrorCode.ROLE_CANNOT_DEACTIVATE_ASSIGNED,
          message: 'Cannot rename a custom role while active employees are assigned to it.',
        });
      }
    }

    // SYSTEM_ADMIN core permissions enforcement
    if (role.code === 'SYSTEM_ADMIN' && dto.permissions) {
      for (const [reqKey, reqScope] of Object.entries(SYSTEM_ADMIN_REQUIRED_GRANTS)) {
        const found = dto.permissions.find((p) => p.permissionKey === reqKey);
        if (!found || found.scope !== reqScope) {
          throw new ForbiddenException({
            code: AppErrorCode.ROLE_PROTECTED_CANNOT_DELETE,
            message: `SYSTEM_ADMIN must always keep ${reqKey} at scope ${reqScope}.`,
          });
        }
      }
    }

    const previousGrants = role.permissions.map((rp) => ({
      key: rp.permission.key,
      scope: rp.scope,
    }));

    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: {
          name: dto.name ? dto.name.trim() : undefined,
          description: dto.description,
        },
      });

      if (dto.permissions !== undefined) {
        // Replace permission grants
        await tx.rolePermission.deleteMany({ where: { roleId: id } });

        for (const p of dto.permissions) {
          const perm = await tx.permission.findUnique({
            where: { key: p.permissionKey },
          });
          if (!perm) {
            throw new BadRequestException(`Unknown permission key: ${p.permissionKey}`);
          }

          await tx.rolePermission.create({
            data: {
              roleId: id,
              permissionId: perm.id,
              scope: p.scope,
              approvalLimit: p.approvalLimit ?? null,
            },
          });
        }
      }

      await this.auditWriter.write(
        {
          actorId,
          action: 'roles.update',
          entityType: 'Role',
          entityId: id,
          previousValue: { permissions: previousGrants },
          newValue: { permissions: dto.permissions },
          outcome: 'SUCCESS',
          ipAddress,
          userAgent,
        },
        tx,
      );
    });

    return this.getRole(id);
  }

  /**
   * Deactivates a custom role.
   * Enforces rules:
   * 1. System roles can NEVER be deactivated.
   * 2. Custom roles can only be deactivated when no active employee holds them.
   */
  async deactivateRole(
    id: string,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; message: string }> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            employees: { where: { employee: { status: 'ACTIVE' } } },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    if (role.isSystem) {
      throw new ForbiddenException({
        code: AppErrorCode.ROLE_PROTECTED_CANNOT_DELETE,
        message: 'System roles cannot be deactivated or deleted.',
      });
    }

    if (role._count.employees > 0) {
      throw new ForbiddenException({
        code: AppErrorCode.ROLE_CANNOT_DEACTIVATE_ASSIGNED,
        message: `Cannot deactivate role '${role.name}' because ${role._count.employees} active employee(s) hold this role. Reassign their roles first.`,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: { isActive: false },
      });

      await this.auditWriter.write(
        {
          actorId,
          action: 'roles.deactivate',
          entityType: 'Role',
          entityId: id,
          previousValue: { isActive: true },
          newValue: { isActive: false },
          outcome: 'SUCCESS',
          ipAddress,
          userAgent,
        },
        tx,
      );
    });

    return { success: true, message: 'Role deactivated successfully.' };
  }
}
