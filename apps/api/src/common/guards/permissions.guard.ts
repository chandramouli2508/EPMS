import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionScope } from '@prisma/client';
import { AppErrorCode } from '@epms/shared';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSIONS_KEY, RequiredPermission } from '../decorators/permissions.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

const SCOPE_RANK: Record<PermissionScope, number> = {
  [PermissionScope.OWN]: 1,
  [PermissionScope.TEAM]: 2,
  [PermissionScope.DEPARTMENT]: 3,
  [PermissionScope.ASSIGNED]: 4,
  [PermissionScope.ALL]: 5,
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user) {
      return false;
    }

    // ─── Enforce Must-Change-Password ─────────────────────────────────────────
    // When mustChangePassword is true, everything is blocked except change-password, me, and logout.
    if (user.mustChangePassword) {
      const path = (request.baseUrl + request.path).toLowerCase();
      const isAllowedEndpoint =
        path.includes('/auth/change-password') ||
        path.includes('/auth/me') ||
        path.includes('/auth/logout');

      if (!isAllowedEndpoint) {
        throw new ForbiddenException({
          code: AppErrorCode.AUTH_MUST_CHANGE_PASSWORD,
          message: 'Password change required before accessing other endpoints.',
        });
      }
    }

    // ─── Role Check (if specified) ───────────────────────────────────────────
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.some((role) => user.roles.includes(role));
      if (!hasRole) {
        throw new ForbiddenException({
          code: AppErrorCode.PERMISSION_DENIED,
          message: `Access denied. Requires one of roles: ${requiredRoles.join(', ')}`,
        });
      }
    }

    // ─── Permission Check (if specified) ─────────────────────────────────────
    const requiredPermissions = this.reflector.getAllAndOverride<(string | RequiredPermission)[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    for (const req of requiredPermissions) {
      const key = typeof req === 'string' ? req : req.key;
      const minScope = typeof req === 'string' ? undefined : req.scope;

      if (
        (key.startsWith('roles.') || key.startsWith('users.')) &&
        !user.roles.includes('SYSTEM_ADMIN')
      ) {
        throw new ForbiddenException(
          'Account and role administration requires a System Administrator.',
        );
      }

      const userScope = user.permissions[key];
      if (!userScope) {
        throw new ForbiddenException({
          code: AppErrorCode.PERMISSION_DENIED,
          message: `Access denied. Missing required permission: ${key}`,
        });
      }

      if (
        ['organization', 'audit', 'settings', 'roles', 'users'].includes(key.split('.')[0]) &&
        userScope !== PermissionScope.ALL
      ) {
        throw new ForbiddenException('This action requires organization-wide scope.');
      }

      if (minScope && SCOPE_RANK[userScope] < SCOPE_RANK[minScope]) {
        throw new ForbiddenException({
          code: AppErrorCode.PERMISSION_DENIED,
          message: `Access denied. Scope for ${key} (${userScope}) is less than required (${minScope})`,
        });
      }
    }

    return true;
  }
}
