import { create } from 'zustand';

/** Toast feedback kinds. success/info are polite + auto-dismiss; warning/error are assertive + persist. */
export type ToastKind = 'success' | 'info' | 'warning' | 'error';

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  detail?: string;
  /** ms since enqueue — polite kinds auto-dismiss after TTL, hover/focus pauses it. */
  createdAt: number;
  /** True while the exit animation plays, before the toast is actually removed. */
  leaving?: boolean;
}

/** Cap on concurrent toasts; when exceeded, the oldest info/success is dropped first. */
const MAX_TOASTS = 4;
const POLITE_TTL = 5000;
/** Exit-animation window — must be >= --gsd-dur-base in toasts.css so the card
 *  finishes animating out before it is unmounted. */
const EXIT_DURATION = 220;

let counter = 0;

/** Stable unique id: crypto.randomUUID where available, a monotonic counter fallback otherwise. */
function nextId(): string {
  counter += 1;
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${counter}`;
  return `toast-${counter}-${random}`;
}

interface ToastState {
  toasts: Toast[];
  /** Enqueue a toast. Returns its id so callers can dismiss or update it. */
  push: (kind: ToastKind, message: string, detail?: string) => string;
  /** Play the exit animation, then remove the toast once it finishes. */
  beginDismiss: (id: string) => void;
  /** Remove a toast by id immediately (final step after the exit animation). */
  dismiss: (id: string) => void;
  /** Drop every toast (e.g. when leaving an editing workspace). */
  clear: () => void;
}

/**
 * Hold auto-dismiss timers so they can be cleared/paused from the host without the
 * store owning any timers directly. Pausing is keyed by toast id.
 */
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const paused = new Map<string, number>();
const leavingTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (kind, message, detail) => {
    const id = nextId();
    const toast: Toast = { id, kind, message, detail, createdAt: Date.now() };
    set((state) => {
      const merged = [...state.toasts, toast];
      // Enforce the cap, dropping the oldest POLITE toast first; fall back to oldest overall.
      let next = merged;
      while (next.length > MAX_TOASTS) {
        const politeIndex = next.findIndex((t) => t.kind === 'info' || t.kind === 'success');
        const dropIndex = politeIndex >= 0 ? politeIndex : 0;
        const dropped = next[dropIndex];
        clearTimeout(timers.get(dropped.id));
        timers.delete(dropped.id);
        paused.delete(dropped.id);
        next = next.filter((_, index) => index !== dropIndex);
      }
      return { toasts: next };
    });
    if (kind === 'success' || kind === 'info') {
      scheduleDismiss(id, POLITE_TTL);
    }
    return id;
  },
  beginDismiss: (id) => {
    if (leavingTimers.has(id)) return;
    set((state) => ({
      toasts: state.toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
    }));
    leavingTimers.set(
      id,
      setTimeout(() => {
        leavingTimers.delete(id);
        useToastStore.getState().dismiss(id);
      }, EXIT_DURATION),
    );
  },
  dismiss: (id) => {
    clearTimeout(timers.get(id));
    timers.delete(id);
    clearTimeout(leavingTimers.get(id));
    leavingTimers.delete(id);
    paused.delete(id);
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
  clear: () => {
    for (const timer of timers.values()) clearTimeout(timer);
    for (const timer of leavingTimers.values()) clearTimeout(timer);
    timers.clear();
    leavingTimers.clear();
    paused.clear();
    set({ toasts: [] });
  },
}));

function scheduleDismiss(id: string, delay: number): void {
  clearTimeout(timers.get(id));
  const timer = setTimeout(() => {
    paused.delete(id);
    timers.delete(id);
    useToastStore.getState().beginDismiss(id);
  }, delay);
  timers.set(id, timer);
}

/** Pause (or resume) a polite toast's auto-dismiss from the host on hover/focus. */
export function pauseToast(id: string): void {
  const remaining = paused.get(id);
  if (remaining !== undefined) return;
  const timer = timers.get(id);
  if (timer !== undefined) clearTimeout(timer);
  const toast = useToastStore.getState().toasts.find((t) => t.id === id);
  if (!toast) return;
  // Pause the clock; remaining time is recomputed on resume from the createdAt TTL.
  paused.set(id, POLITE_TTL - (Date.now() - toast.createdAt));
}

/** Resume a paused toast with whatever time remains. */
export function resumeToast(id: string): void {
  const remaining = paused.get(id);
  if (remaining === undefined) return;
  paused.delete(id);
  scheduleDismiss(id, Math.max(0, remaining));
}
