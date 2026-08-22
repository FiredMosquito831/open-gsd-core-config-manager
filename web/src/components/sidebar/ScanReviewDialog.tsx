import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../common/Button';
import type { ScanCandidate } from '../../api/workspace';

interface ScanReviewDialogProps {
  candidates: ScanCandidate[];
  onConfirm: (selected: string[]) => Promise<void>;
  onCancel: () => void;
}

export function ScanReviewDialog({ candidates, onConfirm, onCancel }: ScanReviewDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(candidates.filter((c) => c.status === 'new').map((c) => c.path)));
  const [submitting, setSubmitting] = useState(false);

  const toggle = (path: string) => {
    const next = new Set(selected);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setSelected(next);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(Array.from(selected));
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="gsd-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="scan-dialog-title">
      <div className="gsd-dialog">
        <h2 id="scan-dialog-title">Review scan results</h2>
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
        <div className="gsd-dialog__actions">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleConfirm} disabled={selected.size === 0 || submitting}>
            Add selected
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
