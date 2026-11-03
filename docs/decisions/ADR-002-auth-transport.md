# ADR-002: Authentication Transport Strategy

## Status
Accepted (Locked Decision)

## Context
Engineering Project Management System (EPMS) manages proprietary engineering designs, commercial project budgets, client billing, and employee timesheets. Protecting user credentials and session tokens from token exfiltration and session hijacking is a fundamental architectural requirement.

Historically, Single Page Applications (SPAs) store JWT access tokens in browser `localStorage` or `sessionStorage`. However:
1. **XSS Exposure:** Any third-party dependency compromise, malicious NPM package, or script injection vulnerability allows full access to `localStorage`/`sessionStorage`, allowing instant token theft.
2. **CSRF Vulnerability:** Storing access tokens in standard cookies and sending them on every request subjects all mutating API operations to Cross-Site Request Forgery (CSRF).
3. **Cross-Origin Cookie Complexities:** Running API on a distinct domain or port causes `SameSite=Strict` or `Lax` cookie dropping, third-party cookie blocking in modern browsers (Safari ITP, Chrome Privacy Sandbox), and CORS preflight overhead on every API call.

## Decision

### 1. In-Memory Access Token
- Access tokens (RS256 JWT, 15-minute lifetime) are stored strictly in JavaScript runtime memory (`tokenStore`).
- Access tokens are **never** written to `localStorage`, `sessionStorage`, or cookies.
- Closing or refreshing the browser tab discards the access token immediately.

### 2. HttpOnly Scoped Refresh Cookie
- Refresh tokens (7-day lifetime, rotated on use, stored hashed in database) are transported exclusively via an `HttpOnly` cookie.
- Cookie security attributes:
  - `HttpOnly: true` — completely inaccessible to JavaScript (`document.cookie`), preventing exfiltration via XSS.
  - `SameSite: Lax` — prevents CSRF attacks on cross-site sub-requests while allowing top-level navigation.
  - `Secure: true` — enforced in production (only sent over TLS/HTTPS).
  - `Path: /api/v1/auth` — restricted so the browser only transmits the cookie to authentication endpoints (`/auth/refresh`, `/auth/logout`), never to general business endpoints.

### 3. Same-Origin Architecture via Reverse Proxy
- The browser must treat the frontend and backend as the identical origin.
- **Development:** Vite dev server proxies `/api` requests to `http://localhost:3000`. The browser interacts solely with `http://localhost:5173`.
- **Production:** Cloud-agnostic Nginx reverse proxy routes `/api/` to the NestJS API container and `/` to Vite static assets under the same domain.
- **CORS:** NestJS API explicitly configures `origin: APP_URL` (never wildcard `*`) with `credentials: true`.

### 4. Single-Flight Refresh Interceptor & Session Restoration
- On app mount, `AuthProvider` invokes `restoreSession()` to silently exchange the HttpOnly cookie for a fresh access token.
- When an API call returns `401 Unauthorized`:
  - The request interceptor intercepts the failure.
  - If a refresh request is already pending, subsequent 401s latch onto the existing `refreshPromise` (single-flight deduplication). Exactly **one** refresh call is made regardless of how many requests failed in parallel.
  - Upon successful refresh, the failed requests are retried with the new `Authorization: Bearer <token>` header.
  - If the refresh call fails (e.g., refresh token expired or revoked in DB), `tokenStore.clear()` is called, `authEvents.emitSessionExpired()` notifies listeners, TanStack Query cache is purged, and the user is redirected to `/login`.

## Consequences
- **Positive:** In-memory access token storage reduces exposure vs localStorage; XSS must still be prevented via CSP, helmet and no raw HTML rendering. Refresh token in HttpOnly cookie prevents token theft via JavaScript; protection against CSRF; eliminates third-party cookie restrictions.
- **Positive:** Zero redundant refresh calls during bursts of parallel data fetching.
- **Negative:** Full-page reloads require a single initial silent refresh request to establish an in-memory token before private queries fire (handled by `AuthProvider` loading state).
