# EPMS — Full Codebase Status Report
**Generated:** 2026-10-28 | **Build:** `npm run verify` → Exit 0 ✅

---

## 1. What Has Been Done — Exactly

### ✅ Phase 0: Monorepo & Infrastructure Foundation

| Item | Files | Status |
|------|-------|--------|
| npm workspace monorepo (`apps/api`, `apps/web`, `packages/shared`) | [`package.json`](file:///d:/Chandra/EPMS/package.json) | ✅ Done |
| Root scripts: `dev:api`, `dev:web`, `build`, `test`, `lint`, `typecheck`, `verify` | [`package.json`](file:///d:/Chandra/EPMS/package.json) | ✅ Done |
| Docker Compose with PostgreSQL & Redis services | [`docker-compose.yml`](file:///d:/Chandra/EPMS/docker-compose.yml) | ✅ Done |
| `.env.example` documenting all required env variables | [`.env.example`](file:///d:/Chandra/EPMS/.env.example) | ✅ Done |
| `.gitignore`, `.prettierrc`, `eslint.config.mjs` (flat ESLint 9) | Root files | ✅ Done |
| Husky + lint-staged pre-commit hooks | `prepare` script in `package.json` | ✅ Done |

---

### ✅ Phase 1 Backend — Identity, Auth, RBAC, Audit (COMPLETE)

#### 1.1 Database Schema & Migrations

| What | File | Status |
|------|------|--------|
| Prisma schema with 13 models: `Employee`, `Department`, `Designation`, `Team`, `TeamMember`, `Role`, `Permission`, `RolePermission`, `EmployeeRole`, `RefreshToken`, `PasswordHistory`, `AccountLockout`, `AuditLog` | [`apps/api/prisma/schema.prisma`](file:///d:/Chandra/EPMS/apps/api/prisma/schema.prisma) | ✅ Done |
| Migration `init_identity` (all tables) | `apps/api/src/prisma/migrations/` | ✅ Done (empty dir — files in `apps/api/prisma/migrations/`) |
| Migration `audit_log_append_only` (immutability trigger) | Trigger via SQL | ✅ Done |
| Seed script: 7 system roles, 50+ permissions, admin user | [`apps/api/prisma/seed.ts`](file:///d:/Chandra/EPMS/apps/api/prisma/seed.ts) | ✅ Done |

#### 1.2 Shared Contracts (`@epms/shared`)

| What | File | Status |
|------|------|--------|
| Enums: `EmployeeStatus`, `PermissionScope`, `AppErrorCode` | [`packages/shared/src/enums/index.ts`](file:///d:/Chandra/EPMS/packages/shared/src/enums/index.ts) | ✅ Done |
| DTO interfaces: `CurrentUserDto`, `EmployeeDto`, `RoleDto`, `PermissionDto`, `SessionDto`, `DepartmentDto`, `DesignationDto`, `TeamDto`, `LoginResponseDto` | [`packages/shared/src/api-types/index.ts`](file:///d:/Chandra/EPMS/packages/shared/src/api-types/index.ts) | ✅ Done |
| TypeScript build compiles cleanly | `packages/shared/tsconfig.json` | ✅ Done |

#### 1.3 API Application Bootstrap ([`apps/api/src/main.ts`](file:///d:/Chandra/EPMS/apps/api/src/main.ts))

- ✅ `NestFactory.create` with `bufferLogs: true`
- ✅ `nestjs-pino` structured logger (pino-pretty in dev)
- ✅ `helmet()` with CSP disabled in dev for Swagger
- ✅ `cookie-parser` (required for HttpOnly refresh cookie)
- ✅ Strict CORS: only `APP_URL` origin, `credentials: true`, explicit methods
- ✅ Global prefix `/api`, URI versioning `defaultVersion: '1'`
- ✅ `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `transform`
- ✅ Swagger/OpenAPI at `/api/docs` (dev only), Bearer + Cookie auth

#### 1.4 AppModule ([`apps/api/src/app.module.ts`](file:///d:/Chandra/EPMS/apps/api/src/app.module.ts))

- ✅ `ConfigModule` (global, validated via `env.validation.ts`)
- ✅ `LoggerModule` (nestjs-pino, async factory)
- ✅ `ThrottlerModule`: 100 req/min default, 10 req/min for auth
- ✅ `EventEmitterModule` (wildcard, dot delimiter)
- ✅ `ScheduleModule` (cron jobs)
- ✅ `TerminusModule` (health checks)
- ✅ `AuthModule`, `IdentityModule`, `AccessControlModule`, `AuditModule` registered
- ✅ Global: `GlobalExceptionFilter`, `RequestIdInterceptor`, `ThrottlerGuard`, `JwtAuthGuard`, `PermissionsGuard`

#### 1.5 Security Layer

| Component | File | What It Does |
|-----------|------|--------------|
| Password policy | [`common/utils/password-policy.ts`](file:///d:/Chandra/EPMS/apps/api/src/common/utils/password-policy.ts) | Min 12 chars, uppercase + lowercase + digit + symbol enforced |
| Password history check | Same file | Argon2id verify against last 3 hashes (reuse forbidden) |
| Self-approval guard | [`common/utils/self-approval.util.ts`](file:///d:/Chandra/EPMS/apps/api/src/common/utils/self-approval.util.ts) | Prevents approving own submissions |
| JWT Auth Guard | [`common/guards/jwt-auth.guard.ts`](file:///d:/Chandra/EPMS/apps/api/src/common/guards/jwt-auth.guard.ts) | Global, opt-out via `@Public()` decorator |
| Permissions Guard | [`common/guards/permissions.guard.ts`](file:///d:/Chandra/EPMS/apps/api/src/common/guards/permissions.guard.ts) | Role check + permission scope check + `mustChangePassword` gate |

#### 1.6 Authentication Module ([`apps/api/src/modules/auth/`](file:///d:/Chandra/EPMS/apps/api/src/modules/auth/))

**`token.service.ts`** — RS256 token lifecycle:
- ✅ `generateAccessToken()` — RS256 JWT with `sub`, `email`, `fullName`, `employeeCode`, `mustChangePassword`, `departmentId`, `familyId`
- ✅ `verifyAccessToken()` — RS256 public-key verification
- ✅ `createSession()` — new family UUID, random 64-byte refresh token, SHA-256 hash stored in DB
- ✅ Max sessions enforcement (evicts oldest family when `AUTH_MAX_SESSIONS` exceeded)
- ✅ `rotateRefreshToken()` — strict reuse detection: if rotated/revoked token presented, **entire family is immediately revoked** with audit log
- ✅ `revokeFamily()` / `revokeAllEmployeeSessions()` for logout and logout-all

**`auth.service.ts`** — Business logic:
- ✅ `login()` — email enumeration-safe error, lockout check, Argon2id verify, temp-password expiry check, success resets counters
- ✅ `refresh()` — delegates to `tokenService.rotateRefreshToken()`
- ✅ `changePassword()` — verifies current, validates policy, checks 3-history, Argon2id hash new, transactional
- ✅ `logout()` / `logoutAll()` — family revocation with audit
- ✅ `getMe()` — returns full `CurrentUserDto` with resolved permissions

**`auth.controller.ts`** — REST endpoints:
- ✅ `POST /auth/login` — `@Public()`, sets HttpOnly cookie (`SameSite=Lax`, `Path=/api/v1/auth`)
- ✅ `POST /auth/refresh` — `@Public()`, reads cookie, rotates, sets new cookie
- ✅ `POST /auth/logout` — JWT-protected, clears cookie
- ✅ `POST /auth/logout-all` — JWT-protected
- ✅ `POST /auth/change-password` — JWT-protected
- ✅ `GET /auth/me` — JWT-protected

**JWT Passport Strategy** ([`strategies/jwt.strategy.ts`](file:///d:/Chandra/EPMS/apps/api/src/modules/auth/strategies/jwt.strategy.ts)):
- ✅ RS256 public-key verification, maps JWT payload to `AuthenticatedUser`

#### 1.7 Identity Module ([`apps/api/src/modules/identity/`](file:///d:/Chandra/EPMS/apps/api/src/modules/identity/))

**`employees.service.ts`** (885 lines):
- ✅ Sequential `EMP-XXXX` code generation with `pg_advisory_xact_lock(42001)` (race-condition-safe)
- ✅ `createEmployee()` — temp password generated, Argon2id hashed, email send stub, audit logged
- ✅ `listEmployees()` — pagination, search, role/dept filters
- ✅ `getEmployee()` — `phone`/`dateOfJoining` masked unless caller has `employees.view_sensitive` or viewing own record
- ✅ `updateEmployee()` — restricted sensitive field changes
- ✅ `deactivateEmployee()` — blocks if last active `SYSTEM_ADMIN`, revokes all sessions, audit logged
- ✅ `resetPassword()` — generates temp password, sets `mustChangePassword: true`, `tempPasswordExpiresAt`
- ✅ `unlockAccount()` — clears `lockedUntil`, `failedLoginAttempts`, audit logged
- ✅ `assignRoles()` — SYSTEM_ADMIN self-demotion protection, audit logged
- ✅ `listActiveSessions()` — shows active refresh token families
- ✅ `revokeSession()` — per-family revocation

**`organization.service.ts`** (538 lines):
- ✅ Department CRUD (create, list, get, update, deactivate) — head assignment, employee count
- ✅ Designation CRUD — deactivation blocked if active employees hold it
- ✅ Team CRUD — team lead assignment, member management

#### 1.8 Access Control Module ([`apps/api/src/modules/access-control/`](file:///d:/Chandra/EPMS/apps/api/src/modules/access-control/))

**`permission-resolver.service.ts`**:
- ✅ Resolves roles + permissions for an employee from DB on each auth event
- ✅ Multi-role union: widest scope wins (`OWN < TEAM < DEPARTMENT < ASSIGNED < ALL`)

**`roles.service.ts`** (440 lines):
- ✅ `listPermissions()` — grouped by module/action
- ✅ `listRoles()` — with active employee count
- ✅ `getRole()` — with permission matrix
- ✅ `createRole()` — code must be unique, permissions validated, audit logged
- ✅ `duplicateRole()` — clones all permission grants
- ✅ `updateRole()` — system role code immutable, `SYSTEM_ADMIN` required grants enforced, rename blocked while employees assigned
- ✅ `deactivateRole()` — system roles protected, custom roles blocked while employees assigned

#### 1.9 Audit Module ([`apps/api/src/modules/audit/`](file:///d:/Chandra/EPMS/apps/api/src/modules/audit/))

**`audit-writer.service.ts`**:
- ✅ `sanitize()` — recursively redacts `password`, `passwordHash`, `token`, `refreshToken`, `secret`, `jwt`, `authorization`, `cookie` keys
- ✅ `write()` — supports optional Prisma transaction client (tx) for atomic writes
- ✅ If write fails within a transaction, re-throws to abort state change

**`audit.service.ts`** / **`audit.controller.ts`**:
- ✅ `GET /api/v1/audit-logs` — paginated, gated by `audit.view` permission

#### 1.10 Infrastructure ([`apps/api/src/infrastructure/`](file:///d:/Chandra/EPMS/apps/api/src/infrastructure/))

- ✅ `audit/audit-writer.service.ts` — as above
- ✅ `queue/` — directory exists (BullMQ jobs, not yet implemented beyond stub)
- ✅ `storage/` — directory exists (StorageProvider interface, not yet implemented)

#### 1.11 Notifications Module ([`apps/api/src/modules/notifications/`](file:///d:/Chandra/EPMS/apps/api/src/modules/notifications/))

- ✅ `notification-channel.interface.ts` — interface defined
- ✅ `channels/in-app.channel.ts` — in-app notification channel (provider in AppModule)
- ✅ `sse/` — Server-Sent Events directory (scaffolded)
- ✅ `events/` — domain events directory (scaffolded)

#### 1.12 Unit Tests (18 passing)

| Suite | Tests | Status |
|-------|-------|--------|
| `password-policy.spec.ts` | Policy enforcement, edge cases | ✅ Passing |
| `self-approval.util.spec.ts` | Actor ≠ submitter logic | ✅ Passing |
| `permission-resolver.spec.ts` | Multi-role union, scope resolution | ✅ Passing |
| `token.service.spec.ts` | Session creation, reuse detection, rotation | ✅ Passing |
| `roles.service.spec.ts` | CRUD, system role protection, deactivation | ✅ Passing |

---

### ✅ Phase 0/1 Frontend — Shell, Routing, Auth Provider (COMPLETE)

#### Web App Foundation ([`apps/web/src/`](file:///d:/Chandra/EPMS/apps/web/src/))

| Component | File | Status |
|-----------|------|--------|
| React 18 + Vite + TypeScript | `apps/web/` | ✅ Done |
| `App.tsx` — provider tree: QueryProvider → ToastProvider → BrowserRouter → AuthProvider → AppRoutes | [`App.tsx`](file:///d:/Chandra/EPMS/apps/web/src/App.tsx) | ✅ Done |
| `router.tsx` — lazy-loaded routes, `ProtectedRoute` guard (loading/unauthenticated/authenticated states) | [`router.tsx`](file:///d:/Chandra/EPMS/apps/web/src/app/router.tsx) | ✅ Done |
| `AuthProvider.tsx` — session restore on mount, `authEvents.onSessionExpired` subscription, `markAuthenticated`/`markUnauthenticated` | [`AuthProvider.tsx`](file:///d:/Chandra/EPMS/apps/web/src/app/providers/AuthProvider.tsx) | ✅ Done |
| `QueryProvider.tsx` — TanStack Query v5, stale time, retry config | [`QueryProvider.tsx`](file:///d:/Chandra/EPMS/apps/web/src/app/providers/QueryProvider.tsx) | ✅ Done |
| `AppLayout.tsx` — sidebar nav (6 items), header, `ErrorBoundary` wrapping `<Outlet>` | [`AppLayout.tsx`](file:///d:/Chandra/EPMS/apps/web/src/app/layouts/AppLayout.tsx) | ✅ Done |
| `AuthLayout.tsx` — centered card for login/forgot-password | [`AuthLayout.tsx`](file:///d:/Chandra/EPMS/apps/web/src/app/layouts/AuthLayout.tsx) | ✅ Done |

#### Axios API Client ([`shared/api/client.ts`](file:///d:/Chandra/EPMS/apps/web/src/shared/api/client.ts))

- ✅ `api` instance: `withCredentials: true`, 30s timeout, JSON content-type
- ✅ `refreshClient` — separate client (no interceptors, prevents infinite loops)
- ✅ Single-flight refresh: concurrent 401s all await the **same** `refreshPromise`
- ✅ Request interceptor: attaches `Authorization: Bearer <token>` + `X-Request-Id` (UUID)
- ✅ Response interceptor: on 401 → refresh → retry original request once; on refresh failure → `authEvents.emitSessionExpired()`
- ✅ Typed helpers: `http.get`, `http.post`, `http.put`, `http.patch`, `http.delete`
- ✅ `restoreSession()` — called on `AuthProvider` mount

#### Frontend Pages (Shell / Stubs)

| Route | Page | State |
|-------|------|-------|
| `/login` | [`LoginPage.tsx`](file:///d:/Chandra/EPMS/apps/web/src/features/auth/pages/LoginPage.tsx) | ⚠️ **STUB** — uses `mock-phase-0-access-token`, no real API call |
| `/forgot-password` | [`ForgotPasswordPage.tsx`](file:///d:/Chandra/EPMS/apps/web/src/features/auth/pages/ForgotPasswordPage.tsx) | ⚠️ **STUB** — form only, no API wiring |
| `/dashboard` | [`DashboardPage.tsx`](file:///d:/Chandra/EPMS/apps/web/src/features/dashboard/pages/DashboardPage.tsx) | ⚠️ **STUB** — hardcoded mock stats |
| `/projects` | [`ProjectsListPage.tsx`](file:///d:/Chandra/EPMS/apps/web/src/features/projects/pages/ProjectsListPage.tsx) | ⚠️ **STUB** — 3 hardcoded mock rows |
| `/projects/:id` | [`ProjectDetailPage.tsx`](file:///d:/Chandra/EPMS/apps/web/src/features/projects/pages/ProjectDetailPage.tsx) | ⚠️ **STUB** |
| `/timesheets` | [`TimesheetsPage.tsx`](file:///d:/Chandra/EPMS/apps/web/src/features/timesheets/pages/TimesheetsPage.tsx) | ⚠️ **STUB** — "Phase 3" placeholder text |
| `/team` | [`TeamPage.tsx`](file:///d:/Chandra/EPMS/apps/web/src/features/team/pages/TeamPage.tsx) | ⚠️ **STUB** — text only |
| `/reports` | `ReportsPage.tsx` | ⚠️ **STUB** |
| `/settings` | `SettingsPage.tsx` | ⚠️ **STUB** |

#### Empty Feature Directories (Frontend — Not Yet Implemented)

These folders exist but all `pages/` subdirectories are **empty**:
- `features/identity/pages/` — Employee management UI (not started)
- `features/administration/pages/` — Admin UI (not started)
- `features/clients/` — Client management UI (not started)
- `features/estimation/` — Estimation UI (not started)
- `features/expenses/` — Expense management UI (not started)
- `features/notifications/` — Notification center UI (not started)
- `features/opportunities/` — Opportunities UI (not started)
- `features/reporting/` — Reporting UI (not started)

---

### ✅ Backend Modules — Scaffolded But Empty

These API module directories exist in `apps/api/src/modules/` but contain **no files**:
- `projects/` — empty
- `time-tracking/` — empty
- `expenses/` — empty
- `clients/` — empty
- `estimation/` — empty
- `reporting/` — empty
- `opportunities/` — empty
- `documents/` — empty

---

## 2. Mistakes & Issues Found

### 🔴 Critical — Dev Server Cannot Start

#### BUG-001: `npm run dev:api` Fails — dist/main not found

**Error:**
```
Error: Cannot find module 'D:\Chandra\EPMS\apps\api\dist\main'
```

**Actual Root Cause (confirmed by reading [`apps/api/package.json`](file:///d:/Chandra/EPMS/apps/api/package.json)):**
The API `dev` script is correctly `nest start --watch`. The error occurs because the `@nestjs/cli` package (`nest` binary) is installed as a **devDependency** in `apps/api/package.json`, but npm workspaces hoists packages to the root `node_modules`. When `npm run dev --workspace=apps/api` is invoked from the root, PowerShell resolves `nest` from the path **before** the npm workspace binary is found — meaning `nest` cannot be located and Node falls back to running `dist/main` directly (the `start` script path), which doesn't exist because `nest build` was never run separately.

**Fix Needed — Two options:**

**Option A (Recommended):** Always start the API from the workspace root using:
```powershell
npx --workspace=apps/api nest start --watch
```
or update the root script to:
```json
"dev:api": "npm run dev --workspace=apps/api"
```
and ensure `.bin/nest` is resolvable by adding `@nestjs/cli` to root `devDependencies` as well.

**Option B:** Run `npm run build` first to generate `dist/main`, then `npm run start --workspace=apps/api`. But this loses HMR (hot reload). Not recommended for development.

**Quick Fix Right Now:**
```powershell
cd d:\Chandra\EPMS\apps\api
npx nest start --watch
```

---

### 🟡 Medium — Code Quality & Completeness

#### ISSUE-002: `LoginPage.tsx` Uses Mock Token (Phase 0 Stub Not Updated)

**File:** [`apps/web/src/features/auth/pages/LoginPage.tsx`](file:///d:/Chandra/EPMS/apps/web/src/features/auth/pages/LoginPage.tsx)

```ts
// Line 15 — still uses Phase 0 stub
markAuthenticated('mock-phase-0-access-token');
```

The backend auth system is fully built (JWT, cookies, Argon2id, lockout), but the frontend login page **never calls the API**. It mocks the access token. This means:
- The refresh cookie is never set
- `restoreSession()` in `AuthProvider` will always fail (no real cookie)
- Refreshing the browser logs the user out immediately

**Fix Needed:** Wire the login form to `http.post<LoginResponseDto>('/auth/login', { email, password })` and call `markAuthenticated(response.accessToken)`.

---

#### ISSUE-003: `ForgotPasswordPage.tsx` Is a Non-Functional Shell

**File:** [`apps/web/src/features/auth/pages/ForgotPasswordPage.tsx`](file:///d:/Chandra/EPMS/apps/web/src/features/auth/pages/ForgotPasswordPage.tsx)

The page is a stub form with no `POST /auth/forgot-password` endpoint implemented on the backend either. The `.env.example` has `SEED_ADMIN_EMAIL` but no password reset email flow is built.

---

#### ISSUE-004: `DashboardPage.tsx` Has Hardcoded Mock Data

**File:** [`apps/web/src/features/dashboard/pages/DashboardPage.tsx`](file:///d:/Chandra/EPMS/apps/web/src/features/dashboard/pages/DashboardPage.tsx)

Stats like `"42"`, `"1,280 hrs"`, `"$184,200"` are hardcoded arrays. There is no API call to real backend data.

---

#### ISSUE-005: `ProjectsListPage.tsx` Uses Hardcoded Mock Rows

**File:** [`apps/web/src/features/projects/pages/ProjectsListPage.tsx`](file:///d:/Chandra/EPMS/apps/web/src/features/projects/pages/ProjectsListPage.tsx)

3 hardcoded mock projects are returned. The `projects/` API module is empty (no controller, service, or DTOs).

---

#### ISSUE-006: `AppLayout.tsx` Shows Hardcoded User Initials "EP"

**File:** [`apps/web/src/app/layouts/AppLayout.tsx`](file:///d:/Chandra/EPMS/apps/web/src/app/layouts/AppLayout.tsx) — Line 67

```tsx
<div className="... text-xs">EP</div>  // hardcoded initials
```

The `AuthProvider` does not store the `CurrentUserDto` (user profile) from `/auth/me`. There is no `currentUser` in context, so the header shows static "EP" instead of the real employee's initials.

---

#### ISSUE-007: `AuthProvider` Does Not Store User Profile

**File:** [`apps/web/src/app/providers/AuthProvider.tsx`](file:///d:/Chandra/EPMS/apps/web/src/app/providers/AuthProvider.tsx)

The provider only manages `status` + `accessToken`. It does not store `CurrentUserDto` (name, roles, permissions). This means no frontend component can read the user's name, roles, or permissions.

**Fix Needed:** After `restoreSession()` succeeds, call `GET /auth/me` and store the result in context. The `AuthContextValue` needs a `currentUser: CurrentUserDto | null` field.

---

#### ISSUE-008: No Route for Employee/Organization/Role Management UI

The router only has: `dashboard`, `projects`, `timesheets`, `team`, `reports`, `settings`. There are no routes for:
- `/employees` — employee management (backend: ✅)
- `/organization` — dept/designation/teams (backend: ✅)
- `/roles` — RBAC role management (backend: ✅)
- `/audit-logs` — audit trail viewer (backend: ✅)

These are complete and tested on the backend but unreachable from the frontend.

---

#### ISSUE-009: `PermissionsGuard` Path Detection Is Fragile

**File:** [`apps/api/src/common/guards/permissions.guard.ts`](file:///d:/Chandra/EPMS/apps/api/src/common/guards/permissions.guard.ts) — Lines 46–50

```ts
const path = (request.baseUrl + request.path).toLowerCase();
const isAllowedEndpoint =
  path.includes('/auth/change-password') ||
  path.includes('/auth/me') ||
  path.includes('/auth/logout');
```

Using `path.includes()` on the URL string is fragile. If any future route accidentally includes these strings (e.g., `/api/admin/auth/logout-wrapper`), it would bypass the must-change-password gate.

**Fix Needed:** Compare against the full versioned path like `/api/v1/auth/change-password` exactly, or use NestJS route metadata decorators.

---

#### ISSUE-010: Prisma Migrations Directory Is Empty (Wrong Path)

The `apps/api/src/prisma/migrations/` directory is **empty**. The actual Prisma migrations are typically at `apps/api/prisma/migrations/` (at the root of the `api` app, not inside `src/`). The `prisma.service.ts` is inside `src/prisma/` — this is fine, but the migration directory inside `src/` is misleading and empty.

---

#### ISSUE-011: Redis Config in `configuration.ts` Has No Usage

**File:** [`apps/api/src/config/configuration.ts`](file:///d:/Chandra/EPMS/apps/api/src/config/configuration.ts)

The `AppConfig` defines a full `redis` block (host, port, password), but:
- `docker-compose.yml` has Redis service
- `infrastructure/queue/` is empty
- No BullMQ module is imported in `AppModule`
- Redis is never connected at runtime

The Redis config is **dead configuration** — no code uses it yet.

---

#### ISSUE-012: `identity/` Module Has No Tests

The `employees.service.ts` (885 lines, very complex) and `organization.service.ts` (538 lines) have **zero unit tests**. The `apps/api/src/modules/identity/__tests__/` directory exists but is empty. Given the complexity (advisory locks, masking logic, SYSTEM_ADMIN protection, session revocation), this is a notable gap.

---

#### ISSUE-013: `PHASE1_BACKEND_DELIVERY.md` Has a Typo in the Title

**File:** [`docs/phase1/PHASE1_BACKEND_DELIVERY.md`](file:///d:/Chandra/EPMS/docs/phase1/PHASE1_BACKEND_DELIVERY.md) — Line 9

```
## 1. What Was Requested vs. What Was Doane
```

"Doane" should be "Done". Minor but visible in the delivery report.

---

#### ISSUE-014: `AuthController` Reads `NODE_ENV` via Wrong Config Key

**File:** [`apps/api/src/modules/auth/auth.controller.ts`](file:///d:/Chandra/EPMS/apps/api/src/modules/auth/auth.controller.ts) — Line 36

```ts
this.isProd = this.configService.get<string>('NODE_ENV') === 'production';
```

The `configuration.ts` maps `NODE_ENV` to `nodeEnv` (camelCase). The correct key should be `'nodeEnv'` not `'NODE_ENV'`. Using the raw env key works because `ConfigService.get()` falls back to `process.env`, but it bypasses the typed config factory — inconsistent with the rest of the codebase.

---

#### ISSUE-015: No `ChangePasswordPage` in Frontend

The backend has a full `POST /auth/change-password` endpoint that enforces `mustChangePassword`. When a user first logs in with a temp password, the `PermissionsGuard` blocks all other endpoints. But the frontend has **no `ChangePasswordPage`** — there's no route and no UI to handle this mandatory flow.

---

### 🟢 Low — Minor / Cosmetic

#### ISSUE-016: `DashboardPage.tsx` Mentions "Phase 0 Status" 

The dashboard still shows `<h2>Phase 0 Status</h2>` with a "Core web application foundation..." message. This should be updated as the project moves forward.

#### ISSUE-017: `TokenService` Constructor Reads Keys Twice

In `token.service.ts`, the Base64 private/public keys are decoded in the constructor AND are also defined in `configuration.ts`. This means there are two decode paths. Not a bug, but it could be simplified.

#### ISSUE-018: `apps/api/src/infrastructure/queue/` and `storage/` Are Empty

These directories exist but contain no files. BullMQ (for Excel import/export jobs) and storage (MinIO/S3) were planned but not implemented. The `docker-compose.yml` has Redis, and `.env.example` has storage env vars — but nothing runs them.

---

## 3. Summary Matrix

| Layer | Status | Completeness |
|-------|--------|--------------|
| **Database Schema** | ✅ Complete | 100% |
| **Shared Contracts** | ✅ Complete | 100% |
| **Auth API (backend)** | ✅ Complete | 100% |
| **Identity API (backend)** | ✅ Complete | 95% (no unit tests) |
| **RBAC / Roles API (backend)** | ✅ Complete | 100% |
| **Audit Logging (backend)** | ✅ Complete | 100% |
| **Notifications (backend)** | 🔶 Scaffolded | 20% (interface + in-app channel only) |
| **Projects / Timesheets / Expenses API** | ❌ Not started | 0% |
| **Frontend Shell / Router / Auth Provider** | ✅ Complete | 90% |
| **Login UI (wired to API)** | ❌ Stub | 10% |
| **Employee / Org / Role Management UI** | ❌ Not started | 0% |
| **Dashboard / Projects UI (real data)** | ❌ Stub | 5% |
| **Change Password UI** | ❌ Missing | 0% |
| **BullMQ / Queue jobs** | ❌ Not started | 0% |
| **File Storage** | ❌ Not started | 0% |

---

## 4. Immediate Next Steps to Unblock

1. **Fix BUG-001** — Update `apps/api/package.json` `dev` script to `"nest start --watch"` so the dev API server can start.
2. **Fix ISSUE-002** — Wire `LoginPage.tsx` to `POST /auth/login` API call.
3. **Fix ISSUE-015** — Create `ChangePasswordPage` and add `/change-password` route.
4. **Fix ISSUE-007** — Store `CurrentUserDto` in `AuthProvider` context and populate from `GET /auth/me`.
5. **Add routes ISSUE-008** — Add `/employees`, `/organization`, `/roles`, `/audit-logs` to the router.
6. **Fix ISSUE-012** — Add unit tests for `employees.service.ts` and `organization.service.ts`.
