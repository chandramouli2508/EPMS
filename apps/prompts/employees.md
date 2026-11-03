HTTP client is `http` from `@/shared/api`, which returns data directly and throws `ApiError`. AuthProvider already exposes `user` and `permissions`, and there are `usePermission` and `<Can>` helpers.

TASK: Build the Employee list screen and the Add Employee screen.

FIRST, READ (do not guess field names):
- The employees controller and DTOs in apps/api (list query params, create body, response shape, pagination format) and the matching types in packages/shared.
- The organization controller (departments, designations) and the roles controller, for dropdown data.
- The permission keys in apps/api/prisma/seed* for employees.

REQUIREMENTS
1. `apps/web/src/features/employees/api/employeesApi.ts`: typed functions for list, get, create, update, deactivate, reactivate, plus lookup functions for departments, designations, roles and potential managers. Use query hooks in `hooks.ts` (`useEmployees(params)`, `useCreateEmployee()`, etc.). Invalidate the employees list after mutations.
2. `EmployeeListPage` at `/employees`: table (code, name, email, department, roles, status badge), search with 300 ms debounce, filters (department, status, role), server-side pagination, loading, empty and error states. Keep filters and page in URL search params. Row actions: View/Edit, Deactivate/Reactivate with a confirm dialog. Show `—` for masked or missing values.
3. `AddEmployeePage` at `/employees/new`: a form with first name, last name, email, role multi-select (EMPLOYEE preselected, hint that managers and leaders also need EMPLOYEE), date of joining (date picker, not in the future), and optional department and designation dropdowns. Include any other field the create DTO marks as required. Validate client-side to match the DTO. Disable submit while saving. Show server errors (for example duplicate email) with ApiError.
4. After a successful create, show a modal with the temporary password returned by the API: monospace display, copy-to-clipboard button, and a clear warning that it is shown once. The modal cannot be dismissed by clicking the backdrop. Never store the password in query cache, localStorage or logs. Clear it from state when the modal closes.
5. Routes: add `/employees` and `/employees/new` as lazy-loaded routes inside the protected layout. Use ProtectedRoute's `permission` prop (employees.view for the list, employees.create for the add page). Add an "Employees" item to the sidebar filtered by permission. Show the "Add employee" button only with `<Can>`.
6. Reuse the existing Tailwind classes, button and input styles, and error handling patterns from LoginPage and ChangePasswordPage. Build small shared components only where needed (Table, Pagination, ConfirmDialog, StatusBadge).

CONSTRAINTS
- Do not change backend code unless a needed field is missing. If so, list the change before making it.
- Do not change auth, logout, or token logic.
- UI permission checks are UX only. The server enforces access.
- Accessibility: labelled inputs, focus-trapped modals, `role="alert"` for errors.

TESTS
- Vitest and Testing Library: list renders rows and the empty state, filters update the request params, the add form shows validation errors, and the temporary password modal appears after a successful create and clears on close. Mock the API module.

DONE WHEN
- `npm run typecheck` and `npm run test` pass.
- Give me: the files changed, the DTO field names you used, the permission keys you used, and any assumptions or open questions.