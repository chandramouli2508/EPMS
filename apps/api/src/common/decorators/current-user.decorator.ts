import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PermissionScope } from '@prisma/client';
import { Request } from 'express';

export interface AuthenticatedUser {
  id: string; // employee ID
  email: string;
  fullName: string;
  employeeCode: string;
  mustChangePassword: boolean;
  departmentId?: string | null;
  designationId?: string | null;
  roles: string[];
  permissions: Record<string, PermissionScope>;
  familyId?: string;
}

/**
 * Extracts the authenticated user from the request context.
 * Usage: @CurrentUser() user: AuthenticatedUser
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    return request.user;
  },
);
