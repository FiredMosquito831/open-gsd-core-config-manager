import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TrackedWorkspaceConfig } from '../../../../packages/server/src/api-types';
import { Button } from '../common/Button';
import { useFocusModal } from '../../lib/focusModal';

interface MissingConfigActionsProps {
  config: TrackedWorkspaceConfig;
  onLocate: () => void;
  onRemove: () => void;
}

export function MissingConfigActions({ config, onLocate, onRemove }: MissingConfigActionsProps) {
  const [confirming, setConfirming] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusModal(confirming, dialogRef, {
    onDismiss: () => setConfirming(false),
  });

  return (
    <div className="gsd-missing-actions">
      <div className="gsd-missing-actions__problem">{config.problem ?? 'This config’s file is missing.'}</div>
      <div className="gsd-missing-actions__buttons">
        <Button size="sm" variant="secondary" onClick={onLocate}>
          Locate again
        </Button>
        <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
          Remove
        </Button>
      </div>
      {confirming && createPortal(
        <div
          ref={dialogRef}
          className="gsd-dialog-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="missing-remove-title"
          aria-describedby="missing-remove-desc"
        >
          <div className="gsd-dialog">
            <h2 id="missing-remove-title">Stop tracking this config?</h2>
            <p id="missing-remove-desc">
              Stop tracking <code className="gsd-missing-actions__path">{config.path}</code>?
              The file on disk is not touched — only this tracking entry is removed, and it cannot be undone.
            </p>
            <div className="gsd-dialog__actions">
              <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
                Keep tracking
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setConfirming(false);
                  onRemove();
                }}
              >
                Stop tracking
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
