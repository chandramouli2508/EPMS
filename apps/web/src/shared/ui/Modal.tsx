import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = panel.current!;
    const focusables = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        ),
      );
    (focusables()[0] ?? root).focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        close.current();
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      const first = items[0] ?? root;
      const last = items[items.length - 1] ?? root;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === root)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    const retain = (event: FocusEvent) => {
      if (!root.contains(event.target as Node)) (focusables()[0] ?? root).focus();
    };
    document.addEventListener('keydown', trap);
    document.addEventListener('focusin', retain);
    return () => {
      document.removeEventListener('keydown', trap);
      document.removeEventListener('focusin', retain);
      previous?.focus();
    };
  }, [busy]);
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/60 p-4">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 id={id} className="mb-4 text-xl font-bold text-surface-900">
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
