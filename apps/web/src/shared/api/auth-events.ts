// apps/web/src/shared/api/auth-events.ts
// Tiny event bus for authentication lifecycle events.
// Components subscribe to session expiry so they can redirect to /login
// and clear query cache without creating circular imports with the router.

type Listener = () => void;

const listeners = new Set<Listener>();

export const authEvents = {
  /**
   * Subscribe to the session-expired event.
   * Returns an unsubscribe function — call it in useEffect cleanup.
   */
  onSessionExpired(cb: Listener): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  /**
   * Emit session-expired. Called by the Axios interceptor when a token refresh
   * fails. All subscribers are notified synchronously.
   */
  emitSessionExpired(): void {
    listeners.forEach((cb) => cb());
  },
};
