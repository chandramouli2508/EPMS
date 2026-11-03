# ADR-001: Monorepo Architecture and Infrastructure Locations

## Status
Accepted (Locked Decision)

## Context
The Engineering Project Management System (EPMS) comprises a React Single Page Application (`apps/web`), a NestJS REST API (`apps/api`), and shared TypeScript contracts, schemas, and utilities (`packages/shared`).

To streamline developer workflow, enable strict end-to-end type sharing, and ensure reproducible local development and container deployments, a unified repository structure is required.

## Decision

### 1. Monorepo Workspace Structure
We use standard npm workspaces configured at the repository root:
- `apps/web`: React 18 frontend built with Vite and Tailwind CSS.
- `apps/api`: NestJS 10 backend API with Prisma ORM.
- `packages/shared`: Shared TypeScript types, Zod validation schemas, and domain constants.

### 2. Infrastructure Configuration Locations
The final, permanent locations for infrastructure and deployment configuration are:
- **Docker Compose:** `docker-compose.yml` resides permanently at the **repository root** (`/docker-compose.yml`). It orchestrates PostgreSQL 16 and Redis 7 for local development.
- **Nginx Reverse Proxy:** The production reverse proxy configuration resides at `infrastructure/nginx/default.conf`. It manages same-origin routing for `/api` to NestJS and `/` to the Vite static SPA bundle.

These file locations are fixed and must not be moved.

### 3. Tooling and Quality Gates
- `npm run verify` runs workspace-wide linting, typechecks, tests, and production builds.
- Cross-platform Node scripts ensure compatibility across Windows PowerShell and Unix-like environments.
