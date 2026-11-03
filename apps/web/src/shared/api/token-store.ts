// apps/web/src/shared/api/token-store.ts
// Access token lives in module-level memory only.
// It is NEVER written to localStorage, sessionStorage, or any persistent store.
// This prevents XSS from reading the token.

let accessToken: string | null = null;

export const tokenStore = {
  get: (): string | null => accessToken,
  set: (t: string): void => {
    accessToken = t;
  },
  clear: (): void => {
    accessToken = null;
  },
};
