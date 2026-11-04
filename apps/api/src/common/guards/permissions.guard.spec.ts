import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionScope } from '@prisma/client';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesController } from '../../modules/access-control/roles.controller';
import { EmployeesController } from '../../modules/identity/employees.controller';

describe('Role-based API enforcement', () => {
  it('marks actual role management and assignment endpoints as administrator-only', () => {
    expect(Reflect.getMetadata(ROLES_KEY, RolesController)).toEqual(['SYSTEM_ADMIN']);
    expect(Reflect.getMetadata(ROLES_KEY, EmployeesController.prototype.assignRoles)).toEqual([
      'SYSTEM_ADMIN',
    ]);
  });
  function setup(
    key: string,
    roles: string[],
    permissions: Record<string, PermissionScope>,
    mustChangePassword = false,
  ) {
    const handler = () => undefined;
    Reflect.defineMetadata(PERMISSIONS_KEY, [key], handler);
    const controller = class {};
    const context = {
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { roles, permissions, mustChangePassword },
          baseUrl: '/api/v1',
          path: '/employees',
        }),
      }),
    } as unknown as ExecutionContext;
    return { guard: new PermissionsGuard(new Reflector()), context, controller };
  }

  it('denies direct API requests without the required role grant', () => {
    const { guard, context } = setup('employees.create', ['EMPLOYEE'], {
      'employees.view': PermissionScope.OWN,
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('permits an action granted by the user role', () => {
    const { guard, context } = setup('employees.view', ['EMPLOYEE'], {
      'employees.view': PermissionScope.OWN,
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it.each(['roles.edit', 'users.assign_roles', 'users.reset_password'])(
    'reserves %s for administrators even when a custom role grants it',
    (key) => {
      const { guard, context } = setup(key, ['CUSTOM'], { [key]: PermissionScope.ALL });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    },
  );

  it('enforces administrator-only controller metadata', () => {
    const { guard, context, controller } = setup('roles.view', ['CUSTOM'], {
      'roles.view': PermissionScope.ALL,
    });
    Reflect.defineMetadata(ROLES_KEY, ['SYSTEM_ADMIN'], controller);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows administrators with resolved full access', () => {
    const { guard, context } = setup('roles.edit', ['SYSTEM_ADMIN'], {
      'roles.edit': PermissionScope.ALL,
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('continues enforcing required password changes for administrators', () => {
    const { guard, context } = setup(
      'employees.view',
      ['SYSTEM_ADMIN'],
      { 'employees.view': PermissionScope.ALL },
      true,
    );
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
