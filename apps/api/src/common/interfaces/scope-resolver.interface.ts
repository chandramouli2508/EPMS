import { PermissionScope } from '@prisma/client';

export interface ScopeResolutionContext {
  userId: string;
  departmentId?: string | null;
  targetDepartmentId?: string | null;
  targetTeamId?: string | null;
  targetProjectId?: string | null;
  targetOwnerId?: string | null;
}

/**
 * Interface contract for resolving domain scopes (OWN, TEAM, DEPARTMENT, ASSIGNED, ALL).
 *
 * Phase 1 implements:
 * - ALL: Always permitted.
 * - OWN: Permitted when targetOwnerId === userId.
 * - DEPARTMENT: Permitted when targetDepartmentId === departmentId.
 *
 * TODO (Phase 2):
 * - TEAM: Query TeamMember / TeamLead to determine if targetTeamId is in user's teams.
 * - ASSIGNED: Query ProjectTeam / ProjectMember to verify if user is assigned to targetProjectId.
 */
export interface IScopeResolver {
  hasScopeAccess(
    scope: PermissionScope,
    context: ScopeResolutionContext,
  ): Promise<boolean>;
}
