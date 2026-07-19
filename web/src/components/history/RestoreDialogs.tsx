import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

export type RestoreDialogMode = 'review' | 'dirty';

interface RestoreDialogsProps {
  mode: RestoreDialogMode | null;
  configName: string;
  timestamp: string;
  summary: { added: number; removed: number; changed: number };
  pending: boolean;
  onCancel(): void;
  onConfirm(): void;
  onSaveDraft(): void;
}

const focusable = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Project-owned alert dialog with the APG keyboard and focus contract. */
export function RestoreDialogs({ mode, configName, timestamp, summary, pending, onCancel, onConfirm, onSaveDraft }: RestoreDialogsProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!mode) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const page = document.getElementById('root');
    page?.setAttribute('inert', '');
    cancelRef.current?.focus();
    return () => {
      page?.removeAttribute('inert');
      returnFocusRef.current?.focus();
    };
  }, [mode]);

  if (!mode) return null;
  const localTime = new Date(timestamp).toLocaleString();
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !pending) { event.preventDefault(); onCancel(); return; }
    if (event.key !== 'Tab') return;
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusable) ?? []);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const description = mode === 'dirty'
    ? 'You have unsaved changes. Save them first, discard them and restore the saved version, or cancel.'
    : <>Restore the saved version from <strong>{localTime}</strong>? Your current saved file will be saved as a new snapshot first, so you can undo this restore.</>;

  return createPortal(
    <div className="gsd-restore-dialog__backdrop">
      <div ref={dialogRef} className="gsd-restore-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} onKeyDown={handleKeyDown}>
        <h2 id={titleId}>{mode === 'dirty' ? 'Unsaved changes' : 'Restore snapshot'}</h2>
        <div id={descriptionId} className="gsd-restore-dialog__content">
          <p>{description}</p>
          {mode === 'review' && <>
            <p><strong>{configName}</strong> · Snapshot from {localTime}</p>
            <p className="gsd-restore-dialog__summary">Added: {summary.added} · Removed: {summary.removed} · Changed: {summary.changed}</p>
            <p>Your current saved file will be saved as a new snapshot before this restore, so you can undo it.</p>
          </>}
          {pending && <p role="status">Restoring snapshot…</p>}
        </div>
        <div className="gsd-restore-dialog__actions">
          {mode === 'dirty' && <button type="button" className="gsd-button gsd-button--secondary gsd-button--md" disabled={pending} onClick={onSaveDraft}>Save draft first</button>}
          {mode === 'dirty' && <button type="button" className="gsd-button gsd-button--danger gsd-button--md" disabled={pending} onClick={onConfirm}>Discard draft and restore</button>}
          <button ref={cancelRef} type="button" className="gsd-button gsd-button--ghost gsd-button--md" disabled={pending} onClick={onCancel}>Cancel</button>
          {mode === 'review' && <button ref={restoreRef} type="button" className="gsd-button gsd-button--danger gsd-button--md" disabled={pending} onClick={onConfirm}>Restore snapshot</button>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
