import { useEffect, useRef, type RefObject } from 'react';

/** Selector for every focusable control a Tab trap must account for. */
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface FocusModalOptions {
  /** Element to focus on open (defaults to the first focusable in the container). */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Called when Escape is pressed (and `dismissable` is true). */
  onDismiss?: () => void;
  /**
   * When false, Escape is swallowed and focus trapping still applies — use this
   * while a submit is in flight so a stray Escape cannot abort a commit.
   * Defaults to true.
   */
  dismissable?: boolean;
}

/**
 * Shared APG-style modal contract for portaled dialogs. Mirrors the behavior
 * already proven in `history/RestoreDialogs.tsx`, extracted so every sidebar
 * dialog gets the same accessibility guarantees:
 *
 *  - captures the element that had focus before open
 *  - marks the app root `#root` inert so the background cannot be reached
 *  - moves focus inside the dialog (initialFocus, else first focusable)
 *  - traps Tab / Shift+Tab within the container
 *  - closes on Escape unless `dismissable` is false
 *  - restores focus to the opener on unmount
 *
 * `open` is expected to be true for the dialog's whole mounted life; pass the
 * component's render condition so mount/unmount drive focus capture + restore.
 */
export function useFocusModal<T extends HTMLElement>(
  open: boolean,
  containerRef: RefObject<T | null>,
  opts: FocusModalOptions = {},
) {
  // Read options through a ref so changing onDismiss/dismissable between renders
  // does not re-run the effect (and re-grab focus) every time.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const root = document.getElementById('root');
    root?.setAttribute('inert', '');

    const focusTarget = optsRef.current.initialFocus?.current
      ?? container.querySelector<HTMLElement>(FOCUSABLE);
    focusTarget?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      const { onDismiss, dismissable = true } = optsRef.current;
      if (event.key === 'Escape') {
        if (dismissable && onDismiss) {
          event.preventDefault();
          onDismiss();
        }
        return;
      }
      if (event.key !== 'Tab') return;
      const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      root?.removeAttribute('inert');
      previouslyFocused?.focus();
    };
  }, [open, containerRef]);
}
