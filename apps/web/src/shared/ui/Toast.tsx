// apps/web/src/shared/ui/Toast.tsx
// Lightweight toast notification primitive built without external libraries.
// Toasts are triggered imperatively via `toast.success()` / `toast.error()`.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastData {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  addToast: (message: string, variant: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS = 4500;

const variantStyles: Record<ToastVariant, string> = {
  success:
    'bg-success-50 border-l-4 border-success text-green-800',
  error:
    'bg-danger-50 border-l-4 border-danger text-red-800',
  warning:
    'bg-warning-50 border-l-4 border-warning text-amber-800',
  info:
    'bg-primary-50 border-l-4 border-primary-500 text-primary-800',
};

const variantIcons: Record<ToastVariant, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

function ToastItem({ item, onDismiss }: { item: ToastData; onDismiss: (id: string) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(item.id), DURATION_MS);
    return () => clearTimeout(timerRef.current);
  }, [item.id, onDismiss]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-card-hover text-sm font-medium
        animate-fade-in cursor-pointer select-none ${variantStyles[item.variant]}`}
      onClick={() => onDismiss(item.id)}
    >
      <span className="text-base leading-none mt-0.5">{variantIcons[item.variant]}</span>
      <span className="flex-1">{item.message}</span>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((message: string, variant: ToastVariant) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast container — fixed top-right */}
      <div
        aria-label="Notifications"
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} item={t} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function useToastContext(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}

// ─── Imperative API ───────────────────────────────────────────────────────────
// Kept as a simple singleton so QueryProvider's onError callback can call
// toast.error() without needing hook access.

let _addToast: ((msg: string, v: ToastVariant) => void) | null = null;

export function ToastBridge() {
  const { addToast } = useToastContext();
  useEffect(() => {
    _addToast = addToast;
    return () => { _addToast = null; };
  }, [addToast]);
  return null;
}

export const toast = {
  success: (message: string) => _addToast?.(message, 'success'),
  error: (message: string) => _addToast?.(message, 'error'),
  warning: (message: string) => _addToast?.(message, 'warning'),
  info: (message: string) => _addToast?.(message, 'info'),
};

export { useToastContext as useToast };
