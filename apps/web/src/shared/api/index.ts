// apps/web/src/shared/api/index.ts
// Public API of the shared/api module.
// Feature code imports ONLY from this file — never from internal modules directly.

export { http, restoreSession } from './client';
export { tokenStore } from './token-store';
export { authEvents } from './auth-events';
export { ApiError, toApiError } from './api-error';
