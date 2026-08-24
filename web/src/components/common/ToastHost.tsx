import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from './Icons';
import {
  useToastStore,
  pauseToast,
  resumeToast,
  type Toast,
  type ToastKind,
} from '../../state/toastStore';

const POLITE_KINDS: ToastKind[] = ['success', 'info'];

function kindIcon(kind: ToastKind) {
  switch (kind) {
    case 'success':
      return <Icons.success size={16} aria-hidden="true" />;
    case 'info':
      return <Icons.info size={16} aria-hidden="true" />;
    case 'warning':
      return <Icons.warning size={16} aria-hidden="true" />;
    case 'error':
      return <Icons.error size={16} aria-hidden="true" />;
  }
}

function kindLabel(kind: ToastKind): string {
  switch (kind) {
    case 'success':
      return 'Success';
    case 'info':
      return 'Info';
    case 'warning':
      return 'Warning';
    case 'error':
      return 'Error';
  }
}

interface ToastCardProps {
  toast: Toast;
}

function ToastCard({ toast }: ToastCardProps) {
  const beginDismissToast = useToastStore((state) => state.beginDismiss);
  const [showDetail, setShowDetail] = useState(false);
  const polite = POLITE_KINDS.includes(toast.kind);

  return (
    <div
      className={`gsd-toast gsd-toast--${toast.kind}${toast.leaving ? ' gsd-toast--leaving' : ''}`}
      role={polite ? 'status' : 'alert'}
      aria-live={polite ? 'polite' : 'assertive'}
      aria-atomic="true"
      onMouseEnter={polite ? () => pauseToast(toast.id) : undefined}
      onMouseLeave={polite ? () => resumeToast(toast.id) : undefined}
      onFocus={polite ? () => pauseToast(toast.id) : undefined}
      onBlur={polite ? () => resumeToast(toast.id) : undefined}
    >
      <span className={`gsd-toast__icon gsd-toast__icon--${toast.kind}`} aria-hidden="true">
        {kindIcon(toast.kind)}
      </span>
      <div className="gsd-toast__body">
        <p className="gsd-toast__message">
          <span className="gsd-toast__visually-hidden">{kindLabel(toast.kind)}: </span>
          {toast.message}
        </p>
        {toast.detail && (
          <div className="gsd-toast__detail">
            <button
              type="button"
              className="gsd-toast__detail-toggle"
              aria-expanded={showDetail}
              onClick={() => setShowDetail((value) => !value)}
            >
              {showDetail ? 'Hide details' : 'Show details'}
            </button>
            {showDetail && <p className="gsd-toast__detail-text">{toast.detail}</p>}
          </div>
        )}
      </div>
      <button
        type="button"
        className="gsd-toast__dismiss"
        onClick={() => beginDismissToast(toast.id)}
        aria-label={`${polite ? 'Dismiss' : 'Close'} notification: ${toast.message}`}
      >
        <Icons.close size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

/** Visually-hidden clip used for the inline kind prefix. */
const visuallyHidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

/**
 * Fixed bottom-right toast stack, portaled to <body>. Polite toasts (success/info)
 * auto-dismiss after a TTL and pause on hover/focus; assertive toasts (warning/
 * error) persist until dismissed. No wiring needed — reads the global toast store.
 */
export function ToastHost() {
  const toasts = useToastStore((state) => state.toasts);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || toasts.length === 0) return null;

  return createPortal(
    <div className="gsd-toast-host" aria-label="Notifications">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
      <span className="gsd-toast__visually-hidden" style={visuallyHidden}>Notifications</span>
    </div>,
    document.body,
  );
}
