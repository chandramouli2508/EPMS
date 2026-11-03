import { SetMetadata } from '@nestjs/common';
import { PermissionScope } from '@prisma/client';

export interface RequiredPermission {
  key: string;
  scope?: PermissionScope;
}

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to enforce permission requirements on controllers or methods.
 * Accepts strings like 'employees.view' or objects with minimum scope { key: 'employees.view', scope: PermissionScope.ALL }.
 */
export const Permissions = (...permissions: (string | RequiredPermission)[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
