# User-Based Permissions Implementation Plan

Status: Required role-based delivery implemented. See [ROLE_PERMISSIONS.md](ROLE_PERMISSIONS.md) for usage, supported scopes, and validation. Individual overrides remain deferred.

## Goal and working assumption

Allow an administrator to control access through a dedicated Roles & Permissions screen. An active `SYSTEM_ADMIN` has full application access. Other users may access only features, actions, and records allowed by their assigned active roles. This role-based model is the required first delivery.

Individual permission overrides described later in this document are an optional future extension, not part of the first delivery. Do not implement them unless separately approved.

Example: An administrator can access all implemented modules and manage role permissions. An employee assigned a role with `employees.view` but without `employees.create` can view permitted employee records but cannot create employees, including through direct API requests.

## Required first delivery: admin permissions screen and role-based access

### Access policy

- Active `SYSTEM_ADMIN` users have all catalog permissions at scope `ALL`, including newly introduced permissions. Implement this centrally in permission resolution rather than with scattered UI checks. Registration of permission keys remains mandatory.
- Administrator access does not bypass authentication, account deactivation, required password changes, data validation, or business workflow rules.
- Non-admin users receive the union of permissions from their assigned active roles, subject to the resource-specific scope policy. Unassigned permissions are denied by default.
- Users with no active roles have no business-module access; authenticated account functions such as password change and logout remain available under existing policy.
- Verify explicit role-only restrictions against this admin-full-access requirement, and define intentional exceptions before implementation.
- Only system administrators manage role permissions and employee role assignments in this delivery. Protect management endpoints on the server as well as in the UI; ordinary role edits must not allow users to grant themselves administrative authority.
- Preserve the last active administrator and existing administrator recovery protections, including concurrent role assignment changes.

### Roles & Permissions screen

Add a Settings > Roles & Permissions screen with:

1. A list of active/inactive roles with name, description, status, and assigned-user count.
2. A module-grouped permission matrix for the selected role, using existing permission catalog keys. Each action can be allowed or denied, with a supported record scope where applicable.
3. Read-only full-access presentation for `SYSTEM_ADMIN`; its full-access guarantee cannot be removed through the matrix.
4. Create, duplicate, edit, and deactivate controls using existing role APIs and their restrictions.
5. An employee role-assignment panel showing assigned roles and effective access, integrated with employee details or a user selector. Reuse existing assignment APIs where available.
6. Save/cancel, a reviewable change summary, validation messages, and clear denial/error states.
7. Permission refresh after role or assignment changes, including a bounded refresh strategy for another user's active session.

### Implementation sequence for the required delivery

1. Inventory current routes, APIs, role assignment support, permission keys, and record filters; prepare the feature/action/scope matrix.
2. Make central resolution guarantee full access for active system administrators and role-derived access for other users. Reuse existing role tables; individual override migrations are unnecessary for this delivery.
3. Secure role management and assignment APIs for administrators, maintain audit events, and enforce record scopes for implemented modules.
4. Build the role list, permission matrix, and employee role-assignment UI. Add administrator-only navigation and route protection.
5. Apply permission checks to implemented module routes, menus, pages, and actions. Return server denial for forbidden direct API requests.
6. Verify with admin, restricted-role, multiple-role, and no-role users; verify live grant/revocation, data scopes, audit events, and administrator recovery protections.
7. Run relevant tests, lint, typecheck, build, and Docker validation; document administrator usage.

### Required acceptance criteria

- An active administrator can access every implemented module and action and manage role permissions and assignments.
- An administrator can assign a role to a user and configure that role through the permissions screen.
- A non-admin user can access only modules/actions granted by assigned active roles, within the allowed record scope.
- Forbidden menus/actions are hidden or disabled appropriately; direct page access and API requests are also denied.
- Saving role changes affects subsequent API requests without requiring another login, and the UI refreshes according to the documented policy.
- Deactivated roles stop contributing grants; users with no active role cannot access business modules.
- Ordinary users cannot use role management or assignment endpoints, even if a custom role is configured incorrectly.
- Administrator protections, audit records, and existing business validations remain effective.

## Optional future extension: individual overrides

The remaining override-specific design is retained for future review. Execute only the role-based portions needed for the required first delivery; direct user grants/denials and their APIs, migration, and UI are deferred.

## Current implementation

- `apps/api/prisma/schema.prisma` defines employees, roles, permission catalog entries, role grants, employee role assignments, and audit logs. There is no individual permission override model.
- `apps/api/src/modules/access-control/permission-resolver.service.ts` combines active roles using a union and a numeric scope ranking.
- `apps/api/src/common/guards/permissions.guard.ts` checks permission keys and minimum scope, plus explicit role requirements where declared.
- `apps/api/src/modules/auth/strategies/jwt.strategy.ts` resolves permissions on every authenticated request, allowing changes to affect subsequent requests without another login.
- Role management API endpoints already exist in `roles.controller.ts`.
- The web app has permission hooks, conditional rendering, and some protected routes. The Settings screen is currently a placeholder.
- The web permission query caches `/auth/me` for 30 seconds. UI refresh behavior must be handled explicitly.

## Proposed permission rules

1. Start with permissions inherited from all active roles.
2. A user override has one of two effects: `ALLOW` with a scope, or `DENY` without a scope.
3. `ALLOW` replaces the inherited scope for that permission. It can add access or deliberately narrow existing access.
4. `DENY` removes that permission regardless of any inherited role grants.
5. Removing an override returns the user to role inheritance. Absence of any effective grant means denial.
6. An inactive employee remains unable to authenticate, regardless of permissions.
7. Permission checks control actions; server-side record filters control which records those actions can access. Hiding a button alone does not enforce access.
8. Existing explicit role restrictions remain additional requirements; an individual grant must not silently bypass them.

Illustrative matrix:

| Role permission | User override | Effective permission |
| --- | --- | --- |
| employees.view: ALL | None | employees.view: ALL |
| employees.view: ALL | ALLOW: OWN | employees.view: OWN |
| employees.create: absent | ALLOW: DEPARTMENT | employees.create: DEPARTMENT |
| employees.create: ALL | DENY | Denied |

## Scope semantics

Use existing scopes: `OWN`, `TEAM`, `DEPARTMENT`, `ASSIGNED`, and `ALL`. Define their meaning per resource before enforcing them. Team, department, and assigned-project access are not universally nested, so the current numeric ranking must not substitute for actual record membership checks.

- Inventory existing service-level scope filters and retain valid restrictions.
- Define a resource-specific scope policy, including create, list, detail, update, delete, and bulk actions where implemented.
- Resolve multiple role scopes using documented resource semantics; use unions of allowed record predicates where scopes overlap without containing each other.
- If a single scope in the current API contract cannot represent the result accurately, extend shared contracts and consumers together.
- Do not treat `ASSIGNED` as available for a resource without assignment data. Future modules need their own authorization policies when implemented.

## Implementation phases

### 1. Complete the authorization inventory

- Inspect repository instructions and existing requirements before implementation.
- Map implemented routes, controllers, service methods, navigation entries, and action buttons to permission keys.
- Identify current role assignment endpoints and admin protections to reuse.
- Record gaps in record filtering and routes without declared permission requirements; distinguish intentionally authenticated-only routes.
- Produce a feature/action/scope matrix for implemented modules. Placeholder screens do not count as secured business features.

### 2. Add persistence and shared contracts

- Add an `EmployeePermissionOverride` Prisma model linked to an employee and catalog permission, unique on `(employeeId, permissionId)`.
- Store effect, optional scope, change reason, timestamps, and the assigning actor. Preserve full history through audit events.
- Require scope for `ALLOW` and reject scope for `DENY` using DTO validation and database constraints where appropriate.
- Add an additive migration; existing users continue to inherit their current role permissions when no override exists.
- Add narrowly scoped administration permissions, proposed as `users.permissions.view` and `users.permissions.manage`, to the catalog and controlled seed/update process. Initially grant management to system administrators only.
- Define shared DTOs for inherited grants, overrides, effective access, and provenance. Preserve existing consumers or update them together.

### 3. Implement resolution and management APIs

- Extend the central resolver to combine roles and overrides using the agreed rules.
- Reuse fresh per-request resolution; avoid placing authoritative permission grants in long-lived JWT claims.
- Proposed endpoints under the existing API prefix:
  - `GET /employees/:id/permissions`: inherited grants, overrides, and effective permissions.
  - `PUT /employees/:id/permissions`: atomically replace overrides using validated entries, a change reason, and a concurrency token/version.
  - `DELETE /employees/:id/permissions/:permissionKey`: remove one override and restore inheritance.
- Validate employee identifiers, permission keys, duplicates, effects, supported scopes, and actor authority.
- Restrict initial management to organization-wide authorized administrators. Do not enable delegated grant administration without an explicit policy.
- Block self-escalation and changes that remove the last active administrator's effective recovery permissions. Check role changes and overrides together, including concurrent changes.
- Write the mutation and before/after audit event in one transaction. Record actor, target, reason, and request metadata without secrets.

### 4. Enforce access throughout the backend

- Use effective permissions consistently in guards and service policies.
- Apply record filters to lists, counts, exports, detail reads, writes, and bulk operations wherever those operations exist.
- Prevent direct access to another employee's or department's records when outside the permitted scope.
- Define OWN explicitly per resource; do not assume it always means creator rather than subject or assignee.
- Reuse existing approval-limit behavior; do not introduce individual monetary overrides without a separate requirement.

### 5. Build the administration UI

- Add an employee Permissions tab or panel integrated with existing employee details and Settings navigation.
- Show assigned roles and a module-grouped permission matrix with Inherit, Allow, and Deny controls.
- Show inherited scope, selected override, effective result, and source. Offer only scopes supported by that resource/action.
- Provide a change reason, reviewable change summary, save/cancel, and reset-to-inherited action.
- Restrict viewing and editing with the new administration permissions and handle server denials clearly.
- Apply effective permission checks to implemented navigation, routes, and action controls.
- Refresh the current-user permission query after relevant local changes, on window focus, and through a bounded refresh policy for changes made in another session. API denial remains authoritative while UI data refreshes.

### 6. Verify and deliver

- Resolver tests: inheritance, multiple roles, direct grant, scope replacement, denial precedence, override removal, and inactive roles.
- API/integration tests: unauthorized management, invalid input, direct URL/API access, cross-user/department access, transaction rollback, audit records, concurrent updates, and administrator recovery protections.
- Confirm an already logged-in user's next API request reflects a grant or revocation.
- UI tests: matrix state, effective-access explanation, hidden actions, protected routes, save failures, and permission refresh.
- Validate the migration on existing data and verify that users without overrides retain expected access.
- Run repository lint, typecheck, relevant tests, and build using existing scripts. Validate Docker startup and migration before delivery.
- Document administrator usage, permission precedence, scope rules, deployment, and recovery steps.

## Acceptance criteria

- Two users with the same role can have different effective permissions through explicit overrides.
- An authorized administrator can inspect inherited, overridden, and effective access and restore inheritance.
- Denial overrides role grants; removing denial restores inherited access.
- API enforcement matches the permission policy even when requests bypass the web UI.
- Record visibility and mutations honor the applicable resource scope.
- Permission changes affect subsequent authenticated API requests and become visible through the documented UI refresh behavior.
- Every permission mutation is attributable through an audit event.
- Unauthorized users cannot change permissions or escalate themselves; a usable administrator recovery path remains protected.
- Existing access is preserved when no overrides have been configured.

## Review decisions for the optional override extension

- Confirm the proposed roles-plus-user-overrides model and deny precedence.
- Confirm that an explicit Allow scope replaces inherited scope, including narrowing access.
- Confirm initial management is limited to organization-wide administrators.
- Review the feature/action/scope inventory produced in phase 1 before expanding enforcement to additional business modules.

## Suggested delivery order

1. Authorization inventory and agreed scope rules.
2. Migration, resolver, management APIs, audit events, and backend verification.
3. Administration UI, route/action integration, and UI verification.
4. Docker validation and administrator documentation.

The required first delivery was authorized and implemented: the admin permissions screen and role-based enforcement described above. Individual overrides still require separate approval.
