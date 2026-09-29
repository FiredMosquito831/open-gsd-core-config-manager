import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../common/Button';
import { useFocusModal } from '../../lib/focusModal';
import { useToastStore } from '../../state/toastStore';
import { useUiStore } from '../../state/uiStore';
import type { ScanCandidate } from '../../api/workspace';

interface ScanReviewDialogProps {
  candidates: ScanCandidate[];
  /** Track a single candidate. Rejects are caught per-item and reported inline. */
  track: (path: string) => Promise<unknown>;
  /** Called once every selected candidate was added successfully. */
  onDone: () => void;
  onCancel: () => void;
}

export function ScanReviewDialog({ candidates, track, onDone, onCancel }: ScanReviewDialogProps) {
  const setActiveConfigId = useUiStore((state) => state.setActiveConfigId);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(candidates.filter((c) => c.status === 'new').map((c) => c.path)));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const descriptionId = useId();

  useFocusModal(true, dialogRef, {
    onDismiss: onCancel,
    dismissable: !submitting,
  });

  const toggle = (path: string) => {
    const next = new Set(selected);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setSelected(next);
    setError(null);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    const failedPaths: string[] = [];
    let firstAdded: { id?: string } | null = null;
    for (const path of selected) {
      try {
        const tracked = (await track(path)) as { id?: string } | null;
        // Select the first config that landed so the scan flow also ends with
        // the editor showing something, not an empty pane.
        if (!firstAdded && tracked?.id) firstAdded = tracked;
      } catch {
        failedPaths.push(path);
      }
    }
    setSubmitting(false);
    if (failedPaths.length > 0) {
      const added = selected.size - failedPaths.length;
      setError(
        added > 0
          ? `Added ${added} config(s). ${failedPaths.length} could not be added — check the path and try again.`
          : `Couldn't add these configs. Check that each path exists and that you have permission to read it.`,
      );
      return;
    }
    useToastStore.getState().push('success', 'Configs added', `${selected.size} config(s) tracked.`);
    if (firstAdded?.id) setActiveConfigId(firstAdded.id);
    onDone();
  };

  return createPortal(
    <div ref={dialogRef} className="gsd-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="scan-dialog-title" aria-describedby={descriptionId}>
      <div className="gsd-dialog">
        <h2 id="scan-dialog-title">Review scan results</h2>
        <p id={descriptionId}>Select the configs you want to track. Already-tracked configs are disabled. Nothing is written to disk until you click Add selected.</p>
        <ul className="gsd-scan-list">
          {candidates.map((candidate) => (
            <li key={candidate.path} className="gsd-scan-list__item">
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(candidate.path)}
                  onChange={() => toggle(candidate.path)}
                  disabled={candidate.status === 'tracked'}
                />
                {candidate.status === 'tracked' ? (
                  <span>{candidate.projectName} — already tracked</span>
                ) : (
                  <span>
                    {candidate.projectName}
                    <span className="gsd-scan-list__path">{candidate.path}</span>
                  </span>
                )}
              </label>
            </li>
          ))}
        </ul>
        {error && <p className="gsd-dialog__error" role="alert">{error}</p>}
        <div className="gsd-dialog__actions">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleConfirm} disabled={selected.size === 0 || submitting}>
            {submitting ? 'Adding…' : 'Add selected'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
