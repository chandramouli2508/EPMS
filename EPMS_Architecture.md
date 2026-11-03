# EPMS — Proposed Architecture Document
**Version:** 0.1 — Architecture Definition Phase  
**Date:** 2026-10-26  
**Status:** Awaiting product-owner review and approval before implementation begins

---

## Table of Contents

1. [Product Scope, Assumptions, and Non-Goals](#1-product-scope-assumptions-and-non-goals)
2. [User Roles and Permission Model](#2-user-roles-and-permission-model)
3. [End-to-End Business Workflows](#3-end-to-end-business-workflows)
4. [Domain Modules and Responsibilities](#4-domain-modules-and-responsibilities)
5. [Module Dependency Map and Boundaries](#5-module-dependency-map-and-boundaries)
6. [Monorepo Directory Tree](#6-monorepo-directory-tree)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Backend Architecture](#8-backend-architecture)
9. [Data Domain Model and Key Relationships](#9-data-domain-model-and-key-relationships)
10. [Authentication and Security Architecture](#10-authentication-and-security-architecture)
11. [File Storage, Notifications, Background Jobs, and Integrations](#11-file-storage-notifications-background-jobs-and-integrations)
12. [API Conventions and OpenAPI Documentation](#12-api-conventions-and-openapi-documentation)
13. [Testing Strategy and Quality Gates](#13-testing-strategy-and-quality-gates)
14. [Development, Local Environment, Docker, Deployment, Backup, and Recovery](#14-development-local-environment-docker-deployment-backup-and-recovery)
15. [Logging, Auditability, Monitoring, and Operational Concerns](#15-logging-auditability-monitoring-and-operational-concerns)
16. [Implementation Phases](#16-implementation-phases)
17. [Key Risks, Unresolved Business Rules, and Open Decisions](#17-key-risks-unresolved-business-rules-and-open-decisions)

---

## 1. Product Scope, Assumptions, and Non-Goals

### 1.1 Confirmed Scope

The EPMS covers the complete project lifecycle for an engineering consultancy with ~50 employees, 6 teams, and 500–600 projects per year across disciplines including HVAC, electrical, fire protection, and plumbing.

Confirmed capabilities:
- Identity, organization, access control, and audit
- Clients and opportunity management
- Estimation, estimate versioning, and multi-step approvals
- Project planning: stages, milestones, tasks, assignments
- Time tracking: timer-based entries, timesheets, approval
- Expenses, budget tracking, and financial summaries
- Document and deliverable management
- Notifications, dashboards, and reporting

### 1.2 Assumptions

| # | Assumption |
|---|-----------|
| A1 | Single-tenant deployment — one company, one database instance. No multi-tenancy. |
| A2 | All users are internal employees. There is no external client portal at this stage. |
| A3 | English is the only UI language required initially. |
| A4 | Working days and leave schedules follow a standard calendar configurable by an administrator. |
| A5 | Files are stored in a private S3-compatible store (AWS S3, MinIO, or equivalent). |
| A6 | Email notifications are sent via an SMTP relay or transactional email provider (e.g., SendGrid, SES). The provider is not locked in during architecture. |
| A7 | The system is accessed via a web browser only; no native mobile application is in scope. |
| A8 | All monetary amounts are stored in a single currency. Multi-currency is out of scope unless confirmed. |
| A9 | "Client approval" of estimates means the client signs off externally; the system records that approval was received, but clients do not log in. |

### 1.3 Non-Goals (explicitly out of scope)

- Full accounting, invoicing, tax calculation, or accounts-payable/receivable
- Payroll processing or salary management
- External client portal or client-facing login
- Real-time collaborative document editing (e.g., Google Docs-style)
- Native mobile applications
- Multi-tenant SaaS architecture
- Third-party ERP integration (flagged as a future recommendation)

### 1.4 Recommended Additions *(not yet confirmed — flagged for review)*

> [!NOTE]  
> The following capabilities are essential for a coherent EPMS but were not explicitly listed in the requirements. They are **recommendations**, not confirmed scope.

| # | Recommendation | Reason |
|---|---------------|---------|
| R1 | **Leave and availability management** — employee leave requests and a simple availability calendar | Required for realistic task assignment and workload planning |
| R2 | **Holiday/working-calendar administration** | Needed for timer enforcement and schedule accuracy |
| R3 | **Scope change / variation orders** | Projects in engineering frequently diverge from approved baselines; without a formal variation record the budget and baseline data becomes unreliable |
| R4 | **Rate card management** — cost rates per employee grade or designation | Required to translate person-hours into cost figures for financial tracking |
| R5 | **Revision control for drawings and BOQs** — sequential revision numbers with supersession | Standard practice in engineering deliverables |
| R6 | **Project risk register** | Mentioned in scope description but not modelled explicitly |

---

## 2. User Roles and Permission Model

### 2.1 Proposed Role Hierarchy

Rather than a fixed role list, the permission model combines **a small set of named roles** with **feature-level permissions** that can be assigned per role. This avoids both a rigid role table that cannot accommodate edge cases and an overly complex RBAC system that is hard to administer.

| Role | Description |
|------|-------------|
| `SYSTEM_ADMIN` | Full system access; manages users, roles, configuration, and audit logs |
| `BUSINESS_MANAGER` | Client management, opportunity pipeline, estimation approval, financial visibility |
| `PROJECT_MANAGER` | Project creation, planning, team assignment, progress and risk management |
| `TEAM_LEAD` | Task assignment within their team, timesheet review for direct reports |
| `ENGINEER` | Task execution, time entry, document upload, timesheet submission |
| `FINANCE_OFFICER` | Expense review, budget reports, financial exports |
| `VIEWER` | Read-only access to assigned projects and documents |

> [!IMPORTANT]  
> These role names are a **starting proposal**. The final role definitions must be confirmed with the product owner. Role names and permission assignments are stored in the database and are configurable by `SYSTEM_ADMIN` — they are not hard-coded enumerations in application code (except for the bootstrap `SYSTEM_ADMIN` role).

### 2.2 Permission Enforcement

- Every API endpoint is guarded by a server-side authorization check.
- Permissions are checked against the authenticated user's role and, for resource-scoped operations, against their project membership.
- Project-scoped permissions: a user may have one role system-wide but be explicitly added to a project team with a project-level role override.
- File download and document access are authorized server-side before a signed URL is issued; the S3 bucket is never publicly accessible.

### 2.3 Approval Authority

- Estimates require an internal approval from a designated approver (e.g., `BUSINESS_MANAGER` or `PROJECT_MANAGER`).
- Timesheets require approval from a `TEAM_LEAD` or `PROJECT_MANAGER`.
- Expenses require approval from a `FINANCE_OFFICER` or `BUSINESS_MANAGER`.
- Delegation of approval authority is a **recommended feature** (R-Delegation) — flagged for product-owner decision.

---

## 3. End-to-End Business Workflows

### 3.1 Opportunity-to-Project Workflow

```
Client Enquiry Received
  → Opportunity created (status: OPEN)
  → Opportunity owner assigned
  → Estimation initiated
      → Scope defined: disciplines, deliverables, assumptions, BOQ
      → Hours, fees, and duration estimated
      → Estimate submitted for internal approval
          → APPROVED → Estimate baseline locked
          → REJECTED → Revision cycle
      → (Optional) Sent to client for approval
          → CLIENT_APPROVED → Project created from approved estimate
          → CLIENT_REJECTED → Revision cycle
  → Project created (status: ACTIVE)
  → Opportunity status → WON / LOST
```

### 3.2 Project Execution Workflow

```
Project Created (from approved estimate)
  → Project baseline established (budget, scope, schedule)
  → Team assigned, tasks created and assigned
  → Work begins:
      → Engineers log time (timer or manual entry)
      → Documents and deliverables uploaded
      → Progress updated on tasks and milestones
  → Scope changes → Variation order raised → Approved → Baseline updated
  → All milestones complete → Project moves to CLOSURE
  → Final deliverables confirmed, timesheets closed
  → Project CLOSED
```

### 3.3 Time Tracking Workflow

```
Engineer starts timer (one active timer enforced per employee, server-side)
  → Timer running (heartbeat or polling)
  → Engineer stops timer → Time entry created (DRAFT)
  → OR: Engineer creates manual time entry (DRAFT)
  → Timesheet compiled (weekly grouping)
  → Engineer submits timesheet (status: SUBMITTED)
  → Team Lead / PM reviews → APPROVED or RETURNED
  → If RETURNED → Engineer corrects and resubmits
  → Approved hours flow into project actuals
```

### 3.4 Estimate Lifecycle (Status Machine)

```
DRAFT → SUBMITTED → APPROVED
                  ↘ REJECTED → REVISED (new version) → SUBMITTED
APPROVED → SUPERSEDED (when a new version is approved)
```

An approved estimate is **immutable**. A revision creates a new estimate version linked to the same opportunity or project. The approved baseline is never edited in place.

### 3.5 Document Review Workflow

```
Document uploaded (DRAFT)
  → Submitted for review (UNDER_REVIEW)
  → Reviewer approves → APPROVED (revision locked)
  → Reviewer rejects → REVISE → new revision uploaded
```

---

## 4. Domain Modules and Responsibilities

Each module owns its data, its business rules, and its public API surface. Cross-module access goes through defined service interfaces, not direct database joins across module boundaries.

### Module: `identity`
**Owns:** employees, accounts, credentials, sessions, roles, permissions, teams, departments, designations, reporting relationships  
**Responsibilities:** authentication, password hashing, session/token lifecycle, role assignment, permission resolution, audit trail for identity actions  
**Public interface:** `IdentityService` — resolve authenticated user, check permissions, list employees

### Module: `clients`
**Owns:** client organizations, client contacts  
**Responsibilities:** client CRUD, contact management, association of clients to opportunities  
**Public interface:** `ClientService` — find client, list clients

### Module: `opportunities`
**Owns:** enquiries, opportunities, opportunity status history, opportunity-to-project conversion records  
**Responsibilities:** opportunity lifecycle (OPEN → WON/LOST), ownership assignment, conversion trigger  
**Public interface:** `OpportunityService` — create opportunity, get opportunity, convert to project

### Module: `estimation`
**Owns:** estimates, estimate versions, line items (disciplines, deliverables, BOQ rows), assumptions, fees, hour allocations, approval records  
**Responsibilities:** estimate authoring, version control, submission workflow, approval/rejection state machine, baseline locking, change traceability  
**Public interface:** `EstimationService` — create estimate, submit, approve, reject, get approved baseline

### Module: `projects`
**Owns:** projects, project team memberships, stages, milestones, tasks, subtasks, task assignments, dependencies, risk register entries, scope change records  
**Responsibilities:** project lifecycle, planning, scheduling, progress tracking, baseline management, scope change recording  
**Public interface:** `ProjectService` — create project, get project, add team member, update progress

### Module: `time-tracking`
**Owns:** timers, time entries, timesheets, timesheet approval records  
**Responsibilities:** timer start/stop/pause, one-active-timer enforcement (with database-level lock), overlap prevention, timesheet compilation, submission and approval workflow  
**Public interface:** `TimeTrackingService` — start timer, stop timer, get timesheet, approve timesheet

### Module: `expenses`
**Owns:** expense records, expense approval records, supporting document references  
**Responsibilities:** expense submission, approval workflow, budget consumption updates, reimbursement status  
**Public interface:** `ExpenseService` — submit expense, approve expense, get project expenses

### Module: `documents`
**Owns:** document metadata records, revision records, review workflow states, download audit entries  
**Responsibilities:** file upload coordination (via `storage` infrastructure), metadata management, revision sequencing, review workflow, authorized download URL issuance  
**Public interface:** `DocumentService` — upload document, get document, issue download URL

### Module: `notifications`
**Owns:** notification records, notification preferences, email send records  
**Responsibilities:** creating in-app notifications triggered by domain events, dispatching email notifications, managing read/unread state  
**Public interface:** `NotificationService` — notify user, list notifications

### Module: `reporting`
**Owns:** no primary data — reads from other modules' read-optimized views  
**Responsibilities:** project dashboards, workload and utilization reports, time and cost reports, financial summaries, export generation  
**Public interface:** `ReportingService` — generate report (query-only)

### Module: `administration`
**Owns:** system configuration, working calendars, holidays, rate cards (if confirmed), audit log read access  
**Responsibilities:** global configuration, calendar management, rate administration  
**Public interface:** `AdminService` — get config, set config, list holidays

### Infrastructure Modules (not business modules)
- `storage` — S3/MinIO client, upload URL generation, download URL generation
- `mail` — SMTP/transactional email abstraction
- `queue` — BullMQ job queue (only introduced when justified — see §11)
- `audit` — structured audit log writer

---

## 5. Module Dependency Map and Boundaries

```
                    ┌─────────────────────────────────┐
                    │           identity               │
                    │  (employees, roles, sessions)    │
                    └──────────────┬──────────────────┘
                                   │ used by all
          ┌────────────────────────┼────────────────────────┐
          │                        │                         │
   ┌──────▼──────┐        ┌────────▼────────┐      ┌────────▼───────┐
   │   clients   │        │  opportunities  │      │  administration │
   └──────┬──────┘        └────────┬────────┘      └────────────────┘
          │                        │
          │               ┌────────▼────────┐
          └──────────────►│   estimation    │
                          └────────┬────────┘
                                   │ approved estimate → project
                          ┌────────▼────────┐
                          │    projects     │◄────────────────┐
                          └────────┬────────┘                 │
                    ┌─────────────┼──────────────┐            │
                    │             │              │             │
             ┌──────▼──────┐ ┌───▼────┐  ┌─────▼──────┐     │
             │time-tracking│ │expenses│  │ documents  │     │
             └──────┬──────┘ └───┬────┘  └─────┬──────┘     │
                    │            │              │             │
                    └────────────┼──────────────┘             │
                                 │                            │
                        ┌────────▼────────┐                  │
                        │   reporting     │──────────────────┘
                        └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │  notifications  │
                        └─────────────────┘

Infrastructure (used by any module, never depending on business modules):
  storage │ mail │ audit │ queue (conditional)
```

**Boundary rules:**
1. `reporting` is read-only and may query other modules' repositories directly via dedicated read-models or database views — it never writes to them.
2. `time-tracking` references `projects` and `tasks` by ID for foreign-key integrity but does not import the `projects` module's service layer. Cross-module service calls go through published interfaces only.
3. `notifications` is a consumer of domain events emitted by other modules. It has no circular dependencies.
4. Infrastructure modules have no dependency on any business module.

---

## 6. Monorepo Directory Tree

```
EPMS/
├── apps/
│   ├── web/                          # React + Vite frontend
│   │   ├── src/
│   │   │   ├── app/                  # App shell, providers, router
│   │   │   ├── features/             # Feature-sliced modules
│   │   │   │   ├── identity/
│   │   │   │   ├── clients/
│   │   │   │   ├── opportunities/
│   │   │   │   ├── estimation/
│   │   │   │   ├── projects/
│   │   │   │   ├── time-tracking/
│   │   │   │   ├── expenses/
│   │   │   │   ├── documents/
│   │   │   │   ├── notifications/
│   │   │   │   ├── reporting/
│   │   │   │   └── administration/
│   │   │   ├── shared/               # Shared UI components, hooks, utils
│   │   │   │   ├── components/
│   │   │   │   ├── hooks/
│   │   │   │   ├── utils/
│   │   │   │   └── api/              # API client (axios instance, interceptors)
│   │   │   └── assets/
│   │   ├── public/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── api/                          # NestJS backend
│       ├── src/
│       │   ├── main.ts               # Bootstrap
│       │   ├── app.module.ts         # Root module
│       │   ├── modules/
│       │   │   ├── identity/
│       │   │   │   ├── identity.module.ts
│       │   │   │   ├── identity.controller.ts
│       │   │   │   ├── identity.service.ts
│       │   │   │   ├── auth/
│       │   │   │   │   ├── auth.controller.ts
│       │   │   │   │   ├── auth.service.ts
│       │   │   │   │   ├── strategies/    # Passport strategies
│       │   │   │   │   └── guards/
│       │   │   │   ├── dto/
│       │   │   │   ├── entities/          # Prisma model wrappers / domain types
│       │   │   │   └── __tests__/
│       │   │   ├── clients/
│       │   │   ├── opportunities/
│       │   │   ├── estimation/
│       │   │   ├── projects/
│       │   │   ├── time-tracking/
│       │   │   ├── expenses/
│       │   │   ├── documents/
│       │   │   ├── notifications/
│       │   │   ├── reporting/
│       │   │   └── administration/
│       │   ├── infrastructure/
│       │   │   ├── storage/           # S3/MinIO client wrapper
│       │   │   ├── mail/              # Email abstraction
│       │   │   ├── audit/             # Structured audit log writer
│       │   │   └── queue/             # BullMQ (added only when needed)
│       │   ├── common/
│       │   │   ├── decorators/        # CurrentUser, Roles, etc.
│       │   │   ├── guards/            # JwtAuthGuard, RolesGuard
│       │   │   ├── filters/           # Global exception filter
│       │   │   ├── interceptors/      # Logging, response transform
│       │   │   ├── pipes/             # Validation pipe config
│       │   │   └── types/             # Shared server-side types
│       │   └── prisma/
│       │       ├── schema.prisma
│       │       └── migrations/
│       ├── test/                      # E2E tests (Jest + Supertest)
│       ├── tsconfig.json
│       ├── tsconfig.build.json
│       └── package.json
│
├── packages/
│   └── shared/                        # Shared contracts — see §6.1
│       ├── src/
│       │   ├── api-types/             # Request/response DTOs (interfaces, not classes)
│       │   ├── enums/                 # Status enums shared between front and back
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
│
├── infrastructure/
│   ├── docker/
│   │   ├── Dockerfile.api
│   │   ├── Dockerfile.web
│   │   └── docker-compose.yml         # Dev compose (postgres, minio, api, web)
│   └── nginx/
│       └── nginx.conf                 # Reverse proxy for production
│
├── docs/
│   ├── architecture/
│   │   └── ARCHITECTURE.md            # This document (living)
│   ├── decisions/                     # ADR files (Architecture Decision Records)
│   │   └── ADR-001-monorepo.md
│   └── requirements/
│       └── business-requirements.md
│
├── package.json                        # Root workspace definition
├── package-lock.json
├── tsconfig.json                       # Root tsconfig (references only)
├── .gitignore
├── .env.example
└── .env                               # Local only — never committed
```

### 6.1 `packages/shared` — Boundary Rules

The `shared` package contains **only**:
- TypeScript `interface` definitions for API request and response shapes (not NestJS classes)
- Status/type enumerations that must match between frontend and backend
- Simple utility types (e.g., `PaginatedResponse<T>`)

It does **not** contain:
- NestJS decorators, class-validator decorators, or any framework-specific code
- Database entity classes or Prisma-generated types
- Business logic or domain rules
- React components or hooks

This boundary ensures the shared package remains a lightweight, framework-agnostic contract layer. The backend validates with its own NestJS DTO classes; the frontend uses the shared interfaces only for type safety.

### 6.2 Root `package.json` (workspace definition)

```json
{
  "name": "epms",
  "private": true,
  "workspaces": [
    "apps/web",
    "apps/api",
    "packages/shared"
  ],
  "scripts": {
    "dev:api": "npm run dev --workspace=apps/api",
    "dev:web": "npm run dev --workspace=apps/web",
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present"
  }
}
```

### 6.3 TypeScript Project References

The root `tsconfig.json` uses `references` only — no `include` or `paths`:

```json
{
  "files": [],
  "references": [
    { "path": "packages/shared" },
    { "path": "apps/api" },
    { "path": "apps/web" }
  ]
}
```

Each `apps/*` and `packages/*` has its own `tsconfig.json` that extends a shared base config and declares its own `references` as needed.

---

## 7. Frontend Architecture

### 7.1 Technology Decisions

| Technology | Version intent | Rationale |
|------------|---------------|-----------|
| React | 18.x | Concurrent features, mature ecosystem |
| TypeScript | 5.x | Type safety across the monorepo |
| Vite | 5.x | Fast HMR, ES modules, simpler config than webpack |
| Ant Design | 5.x | Comprehensive component library with enterprise data components (tables, forms, date pickers) aligned with the engineering tool use case |
| TanStack Query | 5.x | Server state management, caching, background refetch, optimistic updates |
| React Router | 6.x | Declarative routing with data loaders |
| Axios | 1.x | HTTP client with interceptor support for token refresh |

**Why Ant Design?** An engineering project management tool involves dense data tables, complex forms, multi-step wizards, date pickers, and tree structures. Ant Design 5 covers all of these with production-quality implementations and strong TypeScript support. The alternatives (MUI, Chakra) are equally viable but Ant Design's table and form components have fewer workarounds for complex enterprise data scenarios.

### 7.2 Feature-Slice Structure

Each feature directory under `src/features/<domain>/` follows a consistent internal layout:

```
features/projects/
├── api/           # TanStack Query hooks (useProjects, useProject, useMutateProject)
├── components/    # Feature-specific components
├── pages/         # Route-level page components
├── types.ts       # Local types (extends shared interfaces if needed)
└── index.ts       # Public exports — only what other features need
```

Cross-feature imports go through `index.ts` only. Direct deep imports between features are disallowed (enforced by ESLint import rules).

### 7.3 Routing Strategy

Routes are defined centrally in `src/app/router.tsx` using React Router 6 with lazy loading. Layout routes provide authenticated shells. Unauthenticated routes are separate.

```
/                        → redirect to /dashboard
/login                   → public
/forgot-password         → public
/dashboard               → authenticated shell
/projects                → project list
/projects/:id            → project detail (tabs: overview, tasks, documents, time, expenses)
/projects/:id/tasks/:tid → task detail
/estimation/:id          → estimate editor
/clients                 → client list
/clients/:id             → client detail
/opportunities           → pipeline view
/timesheets              → my timesheets
/timesheets/review       → team lead review queue
/expenses                → expense list
/documents               → document library
/reports/*               → reporting sub-routes
/admin/*                 → administration sub-routes
```

Route guards check the authenticated session on load. Unauthorized routes redirect to `/login`.

### 7.4 API Client

A single Axios instance is created in `src/shared/api/client.ts`:
- `baseURL` from environment variable `VITE_API_BASE_URL`
- Attaches access token from memory (not `localStorage`) on every request
- Interceptor catches `401` responses, attempts token refresh via a `/auth/refresh` call using the HttpOnly refresh cookie, retries the original request once, then redirects to `/login` on failure
- All API calls go through typed wrapper functions in `src/shared/api/` that return the shared interface types

### 7.5 State Management

| State category | Mechanism |
|---------------|-----------|
| Server data (projects, tasks, estimates, etc.) | TanStack Query cache |
| Authentication state (current user, token) | React Context + in-memory variable |
| UI state (modals, drawers, selected items) | Local component state or Zustand slice (only if component tree is deep) |
| Form state | Ant Design Form + React Hook Form for complex multi-step forms |

> [!NOTE]  
> Zustand is introduced only if there are UI coordination scenarios that genuinely cannot be solved with local state or context. It is not added speculatively.

### 7.6 Error Handling

- Axios interceptor handles network-level and `401` errors globally.
- TanStack Query `onError` callbacks surface API errors to toast notifications via an Ant Design `message` or `notification` API.
- Form validation errors are returned as structured `400` responses and mapped to Ant Design form field errors.
- An `ErrorBoundary` wraps each major page to catch unexpected React rendering errors.

### 7.7 Accessibility and Responsive Behavior

- Ant Design 5 follows WAI-ARIA conventions. All custom components must maintain this standard.
- The layout uses Ant Design's `Layout` and `Grid` system for responsive breakpoints.
- The target is a minimum viewport of 1280px wide (desktop-first). Mobile optimization is deferred unless confirmed as a requirement.
- All interactive elements have stable, unique `id` attributes for test targeting.

---

## 8. Backend Architecture

### 8.1 Modular Monolith

NestJS's module system maps directly to the business module structure defined in §4. Each module:
- Declares its own controllers, services, and providers
- Imports only the modules it explicitly depends on
- Exports only the services that other modules need to call

The result is a modular monolith that can be understood, tested, and maintained without microservice complexity. A future extraction path to separate services remains possible because module boundaries are clean, but it is not an objective of this phase.

### 8.2 Request Lifecycle

```
HTTP Request
  → Global Rate Limiter (throttler guard)
  → Helmet / CORS middleware
  → JwtAuthGuard (extracts and verifies access token)
  → RolesGuard / PermissionsGuard (checks role and project membership)
  → ValidationPipe (class-validator on DTO, strict mode)
  → Controller method
    → Service layer (business logic and invariant enforcement)
      → Repository layer (Prisma queries, within transactions where needed)
      → Infrastructure calls (storage, mail, audit)
  → Response interceptor (normalizes envelope)
  → GlobalExceptionFilter (maps exceptions to structured error responses)
```

### 8.3 Validation Strategy

- Every controller method accepts a typed DTO class decorated with `class-validator` and `class-transformer`.
- `ValidationPipe` is applied globally with `{ whitelist: true, forbidNonWhitelisted: true, transform: true }`.
- Domain-level invariants (e.g., "cannot submit an estimate that is not in DRAFT status") are enforced in the service layer and throw domain exceptions.
- Domain exceptions map to appropriate HTTP status codes via the global exception filter.

### 8.4 Authorization

- `JwtAuthGuard` is applied globally; individual public endpoints (login, refresh, health) opt out via `@Public()` decorator.
- `@Roles()` decorator declares required roles; `RolesGuard` checks the resolved user.
- For resource-scoped access (e.g., "can this user see this project?"), a `ProjectMemberGuard` or similar is applied per controller.
- File download: the signed URL issuance endpoint checks authorization before generating the URL. The S3 bucket does not allow public access.

### 8.5 Transaction Management

Critical multi-step operations use Prisma's `$transaction`:
- Timer start (check no active timer, insert timer record — serialized)
- Estimate approval (update estimate status, lock line items, create baseline record)
- Project creation from approved estimate (create project, copy baseline, mark estimate as converted)
- Timesheet approval (update all entries to approved, update project actuals)

Prisma's interactive transactions are used for operations where the business logic needs to execute between queries.

### 8.6 Error Handling

A global `ExceptionFilter` maps exceptions to a consistent JSON error envelope:

```json
{
  "statusCode": 422,
  "error": "ESTIMATE_NOT_SUBMITTABLE",
  "message": "An estimate in APPROVED status cannot be submitted.",
  "timestamp": "2026-10-26T12:00:00.000Z",
  "path": "/api/v1/estimates/42/submit"
}
```

Business domain exceptions extend a `DomainException` base class and carry a machine-readable error code alongside the HTTP status. This allows the frontend to handle specific error cases programmatically without parsing message strings.

### 8.7 Concurrency — Timer Enforcement

The one-active-timer-per-employee rule is enforced with a **PostgreSQL advisory lock** (or a `SELECT FOR UPDATE` on the employee's active timer row) inside a transaction:

```
BEGIN
  SELECT * FROM timers WHERE employee_id = $1 AND status = 'RUNNING' FOR UPDATE
  IF row exists → raise conflict error
  INSERT INTO timers (employee_id, ...) VALUES (...)
COMMIT
```

This prevents race conditions from concurrent requests (e.g., double-tap or mobile + desktop).

---

## 9. Data Domain Model and Key Relationships

This is the **conceptual model** — not the final Prisma schema. Exact column names and constraints are established in Phase 1 implementation.

### 9.1 Identity Domain

```
Employee
  id, email, firstName, lastName, passwordHash, isActive
  designationId → Designation
  departmentId  → Department
  managerId     → Employee (self-reference)
  createdAt, updatedAt

Team ──< TeamMembership >── Employee

Role
  id, name, description
  permissions: Permission[]   (many-to-many via RolePermission)

EmployeeRole
  employeeId → Employee
  roleId     → Role
  assignedAt, assignedBy
```

### 9.2 Client and Opportunity Domain

```
Client
  id, name, type (COMPANY | INDIVIDUAL), industry
  contacts: ClientContact[]

Opportunity
  id, title, clientId → Client
  ownerId → Employee
  status: OPEN | WON | LOST | ON_HOLD
  statusHistory: OpportunityStatusEvent[]
  estimateId → Estimate (nullable, set when estimate is created)
  projectId  → Project  (nullable, set when converted)
  createdAt, updatedAt
```

### 9.3 Estimation Domain

```
Estimate
  id, opportunityId → Opportunity
  version: Int         (incremented per revision, scoped to opportunity)
  status: DRAFT | SUBMITTED | APPROVED | REJECTED | SUPERSEDED
  preparedById → Employee
  totalFees: Decimal
  totalHours: Decimal
  calendarDays: Int
  currency: String
  notes: String
  createdAt, updatedAt, submittedAt, approvedAt

EstimateLineItem
  id, estimateId → Estimate
  discipline: String   (HVAC | ELECTRICAL | FIRE | PLUMBING | OTHER)
  deliverable: String
  description: String
  estimatedHours: Decimal
  unitRate: Decimal
  quantity: Decimal
  totalFee: Decimal

EstimateAssumption
  id, estimateId → Estimate
  description: String

EstimateApprovalRecord
  id, estimateId → Estimate
  action: SUBMITTED | APPROVED | REJECTED | REVISED
  actorId → Employee
  comment: String
  createdAt
```

### 9.4 Project Domain

```
Project
  id, name, code (unique)
  clientId → Client
  opportunityId → Opportunity (nullable)
  estimateId → Estimate (the approved estimate this was created from)
  status: ACTIVE | ON_HOLD | COMPLETED | CANCELLED
  startDate, endDate (planned)
  actualStartDate, actualEndDate
  baselineBudgetHours: Decimal   (copied from approved estimate at creation)
  baselineBudgetFees: Decimal
  createdAt, updatedAt

ProjectTeamMember
  projectId → Project
  employeeId → Employee
  projectRole: String   (e.g., PROJECT_MANAGER, LEAD_ENGINEER, ENGINEER)
  joinedAt

Stage
  id, projectId → Project
  name, order: Int, status

Milestone
  id, stageId → Stage (or directly on projectId)
  name, dueDate, status, completedAt

Task
  id, projectId → Project
  stageId → Stage (nullable)
  title, description
  assigneeId → Employee (nullable)
  status: TODO | IN_PROGRESS | BLOCKED | REVIEW | DONE
  priority: LOW | MEDIUM | HIGH | CRITICAL
  plannedHours: Decimal
  actualHours: Decimal   (computed from approved time entries)
  startDate, dueDate
  parentTaskId → Task (nullable, for subtasks)
  dependencies: TaskDependency[]

ProjectRisk
  id, projectId → Project
  description, likelihood, impact, mitigation, status, ownerId → Employee
```

### 9.5 Time Tracking Domain

```
Timer
  id, employeeId → Employee
  taskId → Task (nullable)
  projectId → Project
  status: RUNNING | PAUSED | STOPPED
  startedAt, pausedAt, stoppedAt
  accumulatedSeconds: Int   (for pause/resume support)

TimeEntry
  id, employeeId → Employee
  projectId → Project
  taskId → Task (nullable)
  date: Date
  hours: Decimal
  description: String
  source: TIMER | MANUAL
  status: DRAFT | SUBMITTED | APPROVED | RETURNED
  timesheetId → Timesheet (nullable, set on submission)

Timesheet
  id, employeeId → Employee
  weekStartDate: Date
  status: DRAFT | SUBMITTED | APPROVED | RETURNED
  entries: TimeEntry[]
  submittedAt, reviewedById → Employee, reviewedAt, reviewerComment
```

### 9.6 Document Domain

```
Document
  id, projectId → Project
  name, description
  category: DRAWING | BOQ | CALCULATION | REPORT | OTHER
  discipline: String
  currentRevisionId → DocumentRevision (nullable, set after first revision)
  createdById → Employee
  createdAt

DocumentRevision
  id, documentId → Document
  revisionNumber: String  (e.g., "A", "B", "C" or "00", "01")
  storageKey: String      (S3 object key — never the public URL)
  fileName, mimeType, sizeBytes
  status: DRAFT | UNDER_REVIEW | APPROVED | SUPERSEDED
  uploadedById → Employee
  uploadedAt, approvedById → Employee (nullable), approvedAt

DocumentDownloadAudit
  id, documentRevisionId → DocumentRevision
  downloadedById → Employee
  downloadedAt, ipAddress
```

### 9.7 Expense Domain

```
Expense
  id, projectId → Project
  submittedById → Employee
  category: String
  description: String
  amount: Decimal
  currency: String
  incurredDate: Date
  status: DRAFT | SUBMITTED | APPROVED | REJECTED | REIMBURSED
  receiptStorageKey: String (nullable)
  approvedById → Employee (nullable), approvedAt
  createdAt, updatedAt
```

---

## 10. Authentication and Security Architecture

### 10.1 Authentication Flow

```
POST /api/v1/auth/login  { email, password }
  → Validate credentials (Argon2id verify)
  → On success:
      → Issue short-lived Access Token (JWT, 15 minutes, signed with RS256)
      → Issue long-lived Refresh Token (opaque, 7 days, stored in database)
      → Set Refresh Token in HttpOnly, Secure, SameSite=Strict cookie
      → Return Access Token in response body
  → Frontend stores Access Token in memory only (not localStorage, not sessionStorage)

POST /api/v1/auth/refresh  (no body — reads HttpOnly cookie)
  → Validate refresh token against database (check not revoked, not expired)
  → Issue new Access Token
  → Optionally rotate Refresh Token (sliding window)

POST /api/v1/auth/logout
  → Revoke refresh token in database
  → Clear HttpOnly cookie
```

**Why RS256 (asymmetric)?** The API signs tokens with a private key and verifies with the public key. If a future reporting service or integration needs to verify tokens, it only needs the public key — the private key never leaves the API.

**Why access token in memory?** Reduces exposure vs localStorage; XSS must still be prevented via CSP, helmet and no raw HTML rendering. The HttpOnly cookie for refresh is inaccessible to JavaScript. This is the recommended pattern for SPAs with sensitive data.

### 10.2 Password Policy

- Hashed with **Argon2id** (via the `argon2` npm package) with recommended memory cost, time cost, and parallelism parameters.
- Minimum 10 characters, must include at least one uppercase, one lowercase, one digit, and one special character (configurable).
- Account lockout after N consecutive failures (configurable via administration module, default: 5 attempts, 15-minute lockout). Implemented in database, not in-memory, to survive restarts.
- Password reset via email — a time-limited, single-use signed token sent to the employee's work email.

### 10.3 Security Headers and Transport

- `helmet` applied globally in NestJS to set `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, etc.
- CORS configured to allow only the known frontend origin.
- All traffic in production is served over HTTPS via the nginx reverse proxy.
- `@nestjs/throttler` applies rate limiting to authentication endpoints (stricter limit) and general endpoints (looser limit).

### 10.4 Secrets Management

- All secrets (database URL, JWT private/public keys, S3 credentials, SMTP credentials) are read from environment variables.
- `.env` is in `.gitignore` — never committed.
- `.env.example` contains all keys with placeholder values and is committed.
- In production, secrets are injected via the container orchestrator's secret management (Docker secrets, Kubernetes secrets, or a vault — not determined yet, flagged as an open decision).

---

## 11. File Storage, Notifications, Background Jobs, and Integrations

### 11.1 File Storage

- **Store:** S3-compatible object storage. Development uses **MinIO** (runs in Docker). Production uses AWS S3 or a compatible service.
- **Bucket policy:** private. No public access. All downloads go through the API, which checks authorization and issues a pre-signed URL valid for a short duration (e.g., 5 minutes).
- **Upload flow:** The frontend requests an upload URL from the API (`POST /api/v1/documents/:id/upload-url`). The API checks authorization, generates a pre-signed PUT URL from the storage infrastructure module, and returns it. The frontend uploads directly to S3. The API then records the `storageKey` in the database.
- **Object key convention:** `projects/{projectId}/documents/{documentId}/revisions/{revisionId}/{filename}` — structured for future lifecycle policies and auditing.
- **Virus scanning:** flagged as a **recommendation** — a ClamAV sidecar or S3 event + Lambda scan on upload is advisable for production but is not confirmed scope.

### 11.2 Notifications

- **In-app:** Notifications are records in the `notifications` table. The frontend polls or (preferably) uses **Server-Sent Events (SSE)** for real-time delivery. SSE is lightweight and does not require WebSocket infrastructure.
- **Email:** An email infrastructure module wraps an SMTP client (Nodemailer). Templates are simple HTML templates rendered server-side (no heavy template engine needed initially). The provider (SMTP relay, SendGrid, SES) is configured via environment variables.
- **Trigger mechanism:** Domain events are emitted within service methods (using NestJS's built-in `EventEmitter2`) and the `notifications` module subscribes to them. This decouples the notification logic from business logic without requiring a queue for simple cases.

**When is a queue needed?**  
Redis + BullMQ are introduced **only** when one of these conditions is met:
1. Email sending is moved to a background retry queue (needed when SMTP reliability becomes a concern)
2. Report generation is too slow to complete synchronously (large exports, complex aggregations)
3. Document processing (e.g., thumbnail generation, virus scan) needs to run asynchronously

Until then, EventEmitter2 is sufficient and avoids the operational overhead of Redis.

### 11.3 Background Jobs (Current Assessment)

| Job | Sync or Async | Queue needed? |
|-----|--------------|---------------|
| Send notification email | Sync (initially) | No — add queue if reliability requires it |
| Generate Excel export | Sync for small datasets | Async queue when datasets become large |
| Produce pre-signed download URL | Sync | No |
| Virus scan on upload | Async | Yes — add queue at that point |
| Timer heartbeat / stale timer cleanup | Scheduled cron | NestJS `@nestjs/schedule` (no queue needed) |

### 11.4 Excel Import/Export

- Export: `exceljs` library generates `.xlsx` files server-side for reports and data exports. For small reports, streamed synchronously. Large reports moved to async job.
- Import: For bulk data upload (e.g., task import, employee import), `exceljs` parses the file, validates row by row, returns a structured result with row-level errors.

### 11.5 Third-Party Integrations

None are confirmed in scope. The architecture is designed so integrations can be added as new infrastructure modules without disrupting business modules.

---

## 12. API Conventions and OpenAPI Documentation

### 12.1 URL Structure

```
/api/v1/{resource}
/api/v1/{resource}/{id}
/api/v1/{resource}/{id}/{sub-resource}
```

`/api/v1` prefix is the versioning namespace. If breaking changes require a v2, `/api/v2` is added alongside v1 with a defined deprecation timeline.

### 12.2 HTTP Method Semantics

| Operation | Method | Notes |
|-----------|--------|-------|
| List | GET | Paginated, filterable |
| Get one | GET | |
| Create | POST | |
| Full replace | PUT | Rarely used; prefer PATCH |
| Partial update | PATCH | |
| Delete | DELETE | Soft delete preferred for audit |
| State transition | POST | e.g., `POST /estimates/:id/submit` |

State transitions (submit, approve, reject, start-timer, stop-timer) are **explicit POST actions**, not PATCH updates to a `status` field. This ensures the transition is validated, audited, and cannot be bypassed by directly patching the status.

### 12.3 Pagination and Filtering

```
GET /api/v1/projects?page=1&limit=20&sort=createdAt:desc&status=ACTIVE&search=bridge
```

Response envelope:

```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 147,
    "totalPages": 8
  }
}
```

### 12.4 Error Response

```json
{
  "statusCode": 422,
  "error": "ESTIMATE_ALREADY_APPROVED",
  "message": "Human-readable description",
  "timestamp": "2026-10-26T12:00:00.000Z",
  "path": "/api/v1/estimates/42/submit",
  "details": [
    { "field": "hours", "message": "Must be greater than 0" }
  ]
}
```

`details` is present only for `400` validation errors with field-level issues.

### 12.5 OpenAPI Documentation

- NestJS `@nestjs/swagger` generates the OpenAPI spec from decorators.
- The spec is served at `/api/docs` (disabled in production unless behind authentication or restricted network).
- A generated spec file (`openapi.json`) is committed to `docs/` and can be imported into Postman or used to generate client type stubs.
- Shared interface types in `packages/shared` should align with the OpenAPI spec; discrepancies are caught by type tests.

---

## 13. Testing Strategy and Quality Gates

### 13.1 Testing Layers

| Layer | Tool | What it tests |
|-------|------|--------------|
| Unit — service | Jest | Business logic, state machines, computation, invariant enforcement |
| Unit — frontend | Vitest + React Testing Library | Component rendering, user interactions, hook logic |
| Integration — API | Jest + Supertest + test database | Full request → response, auth, validation, DB state |
| Integration — Prisma | Jest + test database | Repository query correctness, transaction behavior |
| E2E | Playwright | Critical user journeys: login, create project, submit timesheet, upload document |

### 13.2 Test Database Strategy

- Integration tests run against a real PostgreSQL instance (separate test database or Docker container in CI).
- Prisma migrations are run against the test database before the test suite.
- Each integration test suite runs inside a transaction that is rolled back after each test (where Prisma supports it) or truncates tables between tests.

### 13.3 Coverage and Quality Gates

- Minimum coverage targets (enforced in CI): 80% line coverage for service layer and domain logic.
- Coverage is a floor, not a target — meaningful tests over coverage gaming.
- Pull request checks: lint, type-check, unit tests, integration tests must all pass.
- E2E tests run on main branch merges and before deployment.

### 13.4 Linting and Formatting

- ESLint with TypeScript plugin and import-order plugin (enforces feature boundary rules).
- Prettier for consistent formatting.
- Husky pre-commit hook runs lint and format check.

---

## 14. Development, Local Environment, Docker, Deployment, Backup, and Recovery

### 14.1 Local Development

Developers run the full stack locally with Docker Compose:

```yaml
services:
  postgres:   # PostgreSQL 16
  minio:      # S3-compatible local storage
  api:        # NestJS (or run directly via npm run dev:api)
  web:        # Vite dev server (or run directly via npm run dev:web)
```

For day-to-day development, the API and frontend are run directly (`npm run dev:api`, `npm run dev:web`) with only the infrastructure services (postgres, minio) in Docker. This gives faster HMR and easier debugging.

### 14.2 Environment Configuration

| Variable category | Examples |
|------------------|---------|
| Database | `DATABASE_URL` |
| Auth | `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY` |
| Storage | `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` |
| App | `APP_URL`, `API_URL`, `NODE_ENV`, `PORT` |

All variables are documented in `.env.example` with descriptions. No secrets have defaults in code.

### 14.3 Docker Build

- `Dockerfile.api`: multi-stage build — `builder` stage (compile TypeScript), `runner` stage (Node Alpine, production dependencies only).
- `Dockerfile.web`: multi-stage build — `builder` stage (Vite build), `runner` stage (nginx serving static assets).
- Images are versioned with Git SHA tags in CI.

### 14.4 Deployment Architecture (Proposed)

```
Internet
  → nginx (TLS termination, reverse proxy)
      → /api/* → API container (port 3000)
      → /*     → Web container (static, port 80)

Alongside:
  → PostgreSQL (managed or self-hosted)
  → MinIO / S3 (object storage)
  → (Future) Redis if queue is introduced
```

Docker Compose is used for single-server deployment. A migration to container orchestration (e.g., Docker Swarm or Kubernetes) is a future concern.

### 14.5 Database Migrations

- Prisma Migrate is used for all schema changes.
- Migrations are committed to the repository (`prisma/migrations/`).
- A migration is run as part of the deployment process before the new API version starts (`prisma migrate deploy`).
- Migrations that cannot be rolled back safely (destructive) are flagged for manual review.

### 14.6 Backup and Recovery

- **Database:** Nightly `pg_dump` to a separate storage location (S3 bucket or offsite). Retention: 30 days daily, 12 months monthly.
- **Object storage:** S3 versioning or MinIO versioning enabled. Separate backup bucket for critical documents.
- **Recovery drill:** Documented restoration procedure tested quarterly. RTO and RPO targets are an open decision for the product owner.
- Backup scripts and cron schedules are defined in `infrastructure/`.

---

## 15. Logging, Auditability, Monitoring, and Operational Concerns

### 15.1 Application Logging

- NestJS uses a structured JSON logger (e.g., `pino` via `nestjs-pino`) in production. Human-readable logs in development.
- Every request is logged with: `requestId` (UUID injected at entry), method, path, status, duration, userId (if authenticated).
- Errors are logged with stack traces and request context.
- Log level is configurable via environment variable.

### 15.2 Audit Trail

A dedicated `AuditLog` table records significant domain actions:

```
AuditLog
  id, actorId → Employee, actorEmail
  action: String         (e.g., ESTIMATE_APPROVED, TIMER_STARTED)
  resourceType: String   (e.g., Estimate, Project)
  resourceId: String
  previousState: Json    (nullable)
  nextState: Json        (nullable)
  metadata: Json         (IP address, user agent)
  createdAt
```

The `audit` infrastructure module writes these records. It is called by service methods at the point of significant state changes. It never prevents the primary operation from succeeding (it is written in the same transaction where critical).

### 15.3 Monitoring and Health

- `GET /api/health` — liveness check (returns `200 OK` with basic status).
- `GET /api/health/ready` — readiness check (verifies database connectivity).
- Application metrics (request rate, error rate, response times) can be exposed via a Prometheus endpoint if a monitoring stack is available. This is a future recommendation — not blocking initial deployment.

### 15.4 Operational Runbook

`docs/operations/` will contain:
- Service startup and shutdown procedures
- Database migration runbook
- Backup and restore runbook
- Common incident response steps (connection pool exhaustion, disk full, high memory)

---

## 16. Implementation Phases

Each phase has a defined end state and acceptance criteria. No phase begins until the previous is verified working.

### Phase 0 — Repository Foundation
**Goal:** Clean, working monorepo skeleton with CI and tooling in place.

- Initialize npm workspace
- Create `apps/web`, `apps/api`, `packages/shared` directory structures
- Configure root and per-package `tsconfig.json` with project references
- Initialize Vite + React + TypeScript in `apps/web`
- Initialize NestJS + TypeScript in `apps/api`
- Configure ESLint, Prettier, Husky pre-commit
- Create `docker-compose.yml` with postgres and minio
- Create `Dockerfile.api` and `Dockerfile.web` skeletons
- Create `.env.example` with all variables
- Configure GitHub Actions (or equivalent CI) with lint + type-check + test pipeline
- Create `packages/shared` with initial `PaginatedResponse` type and status enums

**Acceptance criteria:** `npm install` succeeds. `npm run build` compiles both apps. `npm run lint` and `npm run test` pass (with empty test suites). Docker Compose starts postgres and minio.

---

### Phase 1 — Identity, Auth, and Organization
**Goal:** Employees can log in, sessions are managed securely, roles are assigned, and the permission system is working end-to-end.

- Prisma schema: Employee, Role, Permission, RolePermission, EmployeeRole, Team, Department, Designation, RefreshToken, AccountLockout, AuditLog
- NestJS `identity` module: registration (admin only), login, refresh, logout, password reset
- JWT RS256 with HttpOnly refresh cookie
- Argon2id password hashing
- Role assignment and permission resolution
- `JwtAuthGuard`, `RolesGuard`, `@CurrentUser()` decorator
- Audit log writes for auth events
- Frontend: login page, password reset, authenticated layout shell, current-user context
- Admin UI: employee list, create employee, assign role

**Acceptance criteria:** Login issues tokens. Refresh works. Logout revokes. Concurrent login from same user invalidates old session (or allows configurable concurrent sessions — open decision). Protected routes return `401` without a valid token. Role-protected routes return `403` for unauthorized roles.

---

### Phase 2 — Clients and Opportunities
**Goal:** Business development pipeline is operable.

- Prisma schema: Client, ClientContact, Opportunity, OpportunityStatusEvent
- `clients` and `opportunities` modules
- Full CRUD for clients and contacts
- Opportunity lifecycle: create, assign owner, update status, view history
- Frontend: client list/detail, opportunity pipeline view, opportunity detail

**Acceptance criteria:** Client and contact CRUD works. Opportunity status transitions are enforced. WON/LOST opportunities cannot be re-opened without a confirmed business rule.

---

### Phase 3 — Estimation
**Goal:** Estimates can be created, versioned, submitted, approved, and locked.

- Prisma schema: Estimate, EstimateLineItem, EstimateAssumption, EstimateApprovalRecord
- `estimation` module: create estimate, add/edit line items, submit, approve, reject, revision workflow
- Baseline locking on approval (line items become immutable)
- Link estimate to opportunity
- Frontend: estimate editor (disciplines, deliverables, BOQ rows, assumptions, fee summary)

**Acceptance criteria:** Estimate status machine is enforced. An approved estimate cannot be edited. A new revision correctly increments version. Approval records are written with actor and timestamp.

---

### Phase 4 — Projects and Planning
**Goal:** A project can be created from an approved estimate, teams assembled, and tasks planned.

- Prisma schema: Project, ProjectTeamMember, Stage, Milestone, Task, TaskDependency, ProjectRisk
- `projects` module
- Project creation from approved estimate (copies baseline)
- Team assignment with project roles
- Stage, milestone, and task CRUD
- Task status machine
- Frontend: project detail page with tabs (overview, team, stages/tasks, risks)

**Acceptance criteria:** Project cannot be created without an approved estimate (open decision: should admin be able to create projects manually without an estimate?). Baseline budget and hours are copied correctly and remain unchanged when tasks are edited. Task status transitions are enforced.

---

### Phase 5 — Time Tracking
**Goal:** Engineers can track time accurately; timesheets flow through review and approval.

- Prisma schema: Timer, TimeEntry, Timesheet
- `time-tracking` module: start/pause/resume/stop timer, create manual entry, compile timesheet, submit, review, approve/return
- One-active-timer enforcement with PostgreSQL lock
- Overlap prevention
- Frontend: timer widget (persistent in header), my timesheet, team lead review queue

**Acceptance criteria:** Two simultaneous timer-start requests for the same employee — only one succeeds. Overlapping manual time entries are rejected. Approved time entries update task actual hours. Returned timesheets can be corrected and resubmitted.

---

### Phase 6 — Documents and Deliverables
**Goal:** Project files can be uploaded, versioned, reviewed, and downloaded securely.

- Prisma schema: Document, DocumentRevision, DocumentDownloadAudit
- `documents` module: pre-signed upload URL, record revision, review workflow, pre-signed download URL, download audit
- Frontend: document library per project, upload drawer, revision history, download

**Acceptance criteria:** Upload URL is only issued to authorized users. Download URL expires after 5 minutes. Every download is audited. Revision status machine is enforced.

---

### Phase 7 — Expenses and Financial Tracking
**Goal:** Project expenses are recorded, approved, and reflected in budget consumption.

- Prisma schema: Expense
- `expenses` module
- Frontend: expense submission, approval queue, project budget summary

**Acceptance criteria:** Expense approval updates budget consumption. Rejected expenses can be corrected and resubmitted. Budget totals are accurate.

---

### Phase 8 — Notifications and Reporting
**Goal:** Users are informed of actions relevant to them; managers have dashboards and reports.

- `notifications` module (in-app + email)
- SSE endpoint for real-time in-app notifications
- `reporting` module: project summary, time report, workload report, financial summary
- Excel export for time and financial reports
- Frontend: notification bell, notification panel, dashboard per role, report pages

**Acceptance criteria:** Notification is delivered within 5 seconds of the triggering event (SSE). Email is sent within 60 seconds. Reports match the underlying data. Excel export opens correctly in Excel.

---

### Phase 9 — Administration and Polish
**Goal:** System is configurable, auditable, and production-ready.

- Administration module: working calendar, holidays, rate cards (if confirmed), system configuration
- Audit log viewer (admin only)
- Account lockout management
- Performance review: query optimization, index review, response time targets
- Security review: OWASP Top 10 pass
- Accessibility audit
- E2E test coverage for all critical journeys
- Operational documentation

**Acceptance criteria:** All Phase 0–8 acceptance criteria remain passing. E2E test suite covers login, project creation, timer workflow, timesheet approval, document upload, and expense approval. Load test demonstrates acceptable response times under expected concurrent user count.

---

## 17. Key Risks, Unresolved Business Rules, and Open Decisions

### 17.1 Decisions Required Before Phase 0 Begins (Blocking)

These must be answered before any code is written to avoid costly rework.

| # | Decision | Options | Impact if deferred |
|---|---------|---------|-------------------|
| D1 | **Deployment target** — single server (Docker Compose), managed Kubernetes, or a PaaS? | Self-hosted VM, AWS ECS, Render, etc. | Affects Dockerfile design, secret management, backup strategy |
| D2 | **Object storage provider** — AWS S3 or self-hosted MinIO in production? | AWS S3, MinIO, Cloudflare R2 | Affects infrastructure configuration and cost |
| D3 | **Email provider** — SMTP relay or transactional API? | SendGrid, AWS SES, Postfix relay | Affects `mail` module implementation |
| D4 | **Concurrent sessions** — should an employee be allowed to be logged in on multiple devices simultaneously? | Yes (multiple refresh tokens) / No (invalidate old on new login) | Auth design |

### 17.2 Decisions That Can Be Made in Phase 1–2 (Non-Blocking Now)

| # | Decision | Impact |
|---|---------|--------|
| D5 | **Can a project be created without an approved estimate?** (e.g., internal projects, emergency work) | Project creation logic and baseline handling |
| D6 | **Approval delegation** — can a PM delegate their approval authority to another employee? | `identity` module complexity |
| D7 | **Rate card management** — are person-hours costed using a rate per employee or per grade/designation? | `administration` and `expenses` modules |
| D8 | **Timesheet period** — is the submission unit a week (Mon–Sun), a fortnight, or a month? | `time-tracking` schema |
| D9 | **Client approval of estimates** — is this tracked in the system, or only internal approval? | `estimation` module workflow |
| D10 | **Scope change / variation orders** — is this in scope for Phase 1 or a later addition? | `projects` module and baseline management |

### 17.3 Business Rules That Need Clarification

| # | Rule area | Specific question |
|---|----------|-----------------|
| BR1 | Opportunity conversion | Can an opportunity be converted to a project without an estimate? Under what conditions? |
| BR2 | Timer behaviour | If an engineer's timer is left running overnight, what happens? Auto-stop after N hours? Alert only? |
| BR3 | Timesheet correction | Can approved time entries ever be corrected after approval? Who can authorize a correction? |
| BR4 | Document ownership | Can a document be transferred to a different project? Can it be deleted after approval? |
| BR5 | Project cancellation | When a project is cancelled, what happens to open timers, pending timesheets, and open expenses? |
| BR6 | Expense currency | Are all expenses logged in a single currency? Or can expenses be in foreign currencies with a conversion rate? |

### 17.4 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Timer race condition under load | Low (single-server) | High (data corruption) | PostgreSQL `SELECT FOR UPDATE` enforced in all timer operations — covered in Phase 5 |
| Large project data slowing report queries | Medium (500+ projects/year) | Medium | Read-optimized database views and indexes from Phase 8; can add materialized views if needed |
| S3 pre-signed URL misuse | Low | Medium | Short expiry (5 min), download audit, CORS restriction on bucket |
| Estimate / baseline data drift | Low (with correct design) | High (financial integrity) | Immutable approved estimate, explicit baseline copy on project creation — design prevents this |
| Shared package becoming a dumping ground | Medium | Medium | Strict boundary rules enforced by ESLint import rules and code review |

---

## Decision Summary — Items Requiring Your Approval

Before implementation begins, please confirm or decide the following:

### Must decide before Phase 0 (blocking):
1. **D1 — Deployment target**: Where will the production system be hosted?
2. **D2 — Object storage**: AWS S3 or self-hosted MinIO in production?
3. **D3 — Email provider**: Which email sending service or SMTP relay?
4. **D4 — Concurrent sessions**: One active session per employee, or multiple devices?

### Should decide before Phase 1:
5. **D5 — Projects without estimates**: Can projects be created without an approved estimate?
6. **D9 — Client approval tracking**: Do we track client approval of estimates inside the system?
7. **BR2 — Stale timer policy**: What happens to a timer left running overnight?

### Confirm recommended scope:
8. **R1/R2 — Leave and holiday calendar**: Confirmed as in scope?
9. **R3 — Variation orders / scope change**: Confirmed as in scope for which phase?
10. **R4 — Rate cards**: Are employee cost rates managed in the system?

---

*End of EPMS Architecture Document v0.1*
