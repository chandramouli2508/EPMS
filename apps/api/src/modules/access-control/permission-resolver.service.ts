import { Injectable } from '@nestjs/common';
import { PermissionScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const SCOPE_RANK: Record<PermissionScope, number> = {
  [PermissionScope.OWN]: 1,
  [PermissionScope.TEAM]: 2,
  [PermissionScope.DEPARTMENT]: 3,
  [PermissionScope.ASSIGNED]: 4,
  [PermissionScope.ALL]: 5,
};

@Injectable()
export class PermissionResolverService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves the effective permissions for an employee across all their active roles.
   * Multi-role combination: Union of all permissions; widest scope wins.
   */
  async resolvePermissionsForEmployee(employeeId: string): Promise<{
    roles: string[];
    permissions: Record<string, PermissionScope>;
    permissionScopes: Record<string, PermissionScope[]>;
  }> {
    const employeeRoles = await this.prisma.employeeRole.findMany({
      where: {
        employeeId,
        role: {
          isActive: true,
        },
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const roles: string[] = [];
    const permissionMap: Record<string, PermissionScope> = {};
    const permissionScopes: Record<string, PermissionScope[]> = {};

    for (const er of employeeRoles) {
      roles.push(er.role.code);

      for (const rp of er.role.permissions) {
        const key = rp.permission.key;
        const scopes = permissionScopes[key] ?? [];
        if (!scopes.includes(rp.scope)) scopes.push(rp.scope);
        permissionScopes[key] = scopes;
        const currentScope = permissionMap[key];
        const newScope = rp.scope;

        if (!currentScope) {
          permissionMap[key] = newScope;
        } else {
          // Widest scope wins
          if (SCOPE_RANK[newScope] > SCOPE_RANK[currentScope]) {
            permissionMap[key] = newScope;
          }
        }
      }
    }

    // Administrators always receive the complete registered catalog, including new keys.
    if (roles.includes('SYSTEM_ADMIN')) {
      const catalog = await this.prisma.permission.findMany({ select: { key: true } });
      for (const permission of catalog) {
        permissionMap[permission.key] = PermissionScope.ALL;
        permissionScopes[permission.key] = [PermissionScope.ALL];
      }
    }

    return { roles, permissions: permissionMap, permissionScopes };
  }

  /**
   * Helper to check if a permission map satisfies a required permission and minimum scope.
   */
  hasPermission(
    resolvedPermissions: Record<string, PermissionScope>,
    requiredKey: string,
    minScope?: PermissionScope,
  ): boolean {
    const grantedScope = resolvedPermissions[requiredKey];
    if (!grantedScope) {
      return false;
    }

    if (!minScope) {
      return true;
    }

    return SCOPE_RANK[grantedScope] >= SCOPE_RANK[minScope];
  }
}
