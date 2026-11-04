# Roles and Permissions

## Administrator usage

1. Open `http://localhost:8080` and sign in as an active System Administrator.
2. Complete the required password change if prompted.
3. Open **Roles & Permissions** in the sidebar (`/settings`).
4. Compare roles in the permission matrix: roles are columns, with module groups and action rows. Use Search permissions, All modules, and All actions to narrow the matrix. Check an action to allow it, uncheck it to remove access, and choose a supported record scope below the checkbox. Review pending changes and select **Save permissions**. **Discard changes** restores the loaded matrix.
5. In **Manage roles**, use **Create role**, or select a role and use **Duplicate role**. Custom roles can be deactivated after active employees are reassigned; system roles cannot be deactivated.
6. In **Assign user roles**, search for an employee, select the employee, choose active roles, review access by role, and save. An empty role selection removes business-module access.

Permission changes apply to the next authenticated API request. Active web sessions refresh permission data every 30 seconds while the tab is active and when the window regains focus. Changes made through this screen invalidate relevant local query data immediately.

## Module actions and reference layout

The screen uses a purple role comparison matrix and a Findings panel. A checked purple control means access is allowed; an outlined minus means OWN scope; an empty control means no access. System Administrator is the first, locked column. Inactive roles and administrator-only account/role operations cannot be enabled for ordinary users.

Actions are drawn from the actual permission catalog for each module:

| Displayed action | Existing permission action | Meaning |
| --- | --- | --- |
| View | view and specialized view permissions | Read permitted records |
| Add | create | Create a record |
| Edit / Update | edit | Change an existing record; Edit and Update filters both include this operation |
| Update | update, when a module defines it | Module-specific update operation |
| Delete | delete | Delete records where the module supports deletion |
| Export | export | Export data where the module supports export |

Specialized actions such as Approve, Submit, Assign, and Deactivate remain separate. The screen does not invent delete or export permissions for modules without those operations.

**Export report** downloads a CSV of the full matrix, including effective access, scopes, role status, and whether values are unsaved drafts. Findings are computed from the current configuration, including broad export access, sensitive access, protected administration, descriptions, and pending changes. They are review prompts, not a claim that a particular business role is misconfigured.

Changes across roles are saved one role at a time. If one update fails, successful saves are reported and remaining drafts are kept for correction/retry. Existing approval limits are preserved when changing scopes.

## Access rules

- An active `SYSTEM_ADMIN` receives every registered catalog permission at `ALL` scope, including newly registered keys. The administrator matrix is read-only.
- Other users receive only permissions from assigned active roles. A missing permission is denied. Inactive accounts cannot authenticate.
- Authentication, required password changes, input validation, and business workflow rules still apply to administrators.
- Account and role administration (`users.*` and `roles.*`) is reserved for System Administrators, even if a custom role contains those grants. Non-admin employee creators cannot select initial roles; the service applies the default EMPLOYEE role.
- Changes to employee department/reporting assignments require an administrator, avoiding scope expansion through profile edits.
- No direct user permission overrides were introduced, and no database schema migration is required.

## Page permissions

| Page | Required permission or role |
| --- | --- |
| Dashboard | reports.view |
| Projects and project details | projects.view |
| Timesheets | timesheets.view |
| Team | organization.view |
| Reports | reports.view |
| Employee directory and details | employees.view |
| Add employee | employees.create |
| Roles & Permissions | SYSTEM_ADMIN |

Navigation uses the same rules as page guards. Login lands on the first permitted page. A user with no applicable page permissions sees a request to contact the administrator. Direct access to a forbidden page shows an access denial. The API separately checks permission requirements.

## Record scopes

Employee read, edit, and deactivate/reactivate operations enforce these scopes on the server:

| Scope | Permitted employee records |
| --- | --- |
| OWN | The caller's employee record |
| TEAM | Members and leads of active teams the caller belongs to or leads |
| DEPARTMENT | Employees in the caller's current department; no department means no records |
| ALL | All employee records |

Employee list queries apply the scope predicate together with search and filters, including their total count. Record operations check the target record. When different roles grant TEAM and DEPARTMENT, access is the union of both record predicates; neither scope is assumed to contain the other. The legacy single-scope permission map is retained for compatibility, while authenticated API context also carries individual role scopes for employee record filtering.

`ASSIGNED` is unsupported for employees because employee records have no project-assignment relation. Employee creation requires ALL. Sensitive employee details support OWN or ALL; personal details remain visible to their subject under existing profile behavior.

Organization, audit, settings, account, and role operations currently require ALL scope. The editor limits these entries accordingly and the API rejects unsupported grants. Project, timesheet, dashboard, and report screens currently contain placeholder/demo content. Their pages are gated, but project/timesheet record authorization must be implemented alongside their future business APIs; catalog entries alone do not implement those modules.

## Audit and recovery

Existing role mutation and assignment audit events remain in use. Role assignments and their audit records share a database transaction. Administrator demotion and deactivation acquire the same PostgreSQL transaction lock before counting remaining administrators, so concurrent operations cannot remove the last active administrator. Role deactivation and initial assignments share that lock to avoid assigning roles during deactivation.

Do not reset role grants by rerunning the full seed to apply this feature. Existing roles and assignments are reused; administrator full access is resolved centrally.

## Running the changes

From the repository root:

```powershell
docker compose up -d --build --wait
docker compose ps -a
```

Open `http://localhost:8080/settings` after administrator login. Existing database volumes and assignments are retained.

## Verification

Automated coverage includes full administrator catalog access, role union, revocation on the next resolution, direct API denials, administrator-only management, employee record filters, administrator recovery, matrix editing, approval-limit preservation, and user role assignment. Use `npm test`, `npm run typecheck`, and `npm run build` for repository checks.

Full repository lint currently encounters pre-existing parse errors in `apps/web/src/features/dashboard/demoComponent.js` and CommonJS globals in generated `packages/shared/src/**/*.js`. Lint changed TypeScript files separately until those unrelated baseline issues are resolved.
