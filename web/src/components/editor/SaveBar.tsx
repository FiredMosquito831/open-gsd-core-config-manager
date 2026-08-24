import { Button } from '../common/Button';
import { Icons } from '../common/Icons';

export type SaveStatus = 'clean' | 'dirty' | 'saving' | 'saved' | 'blocked';

interface SaveBarProps {
  status: SaveStatus;
  /** Number of fields that must be fixed before the config can be saved. */
  errorCount?: number;
  /** Number of changed/reset fields in the current draft. */
  changedCount?: number;
  onSave: () => void;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function statusText(status: SaveStatus, errorCount: number, changedCount: number): string {
  switch (status) {
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'Saved just now';
    case 'blocked':
      return `Fix ${errorCount} ${plural(errorCount, 'field', 'fields')} before saving`;
    case 'dirty':
      return changedCount > 0
        ? `Unsaved changes · ${changedCount} ${plural(changedCount, 'field', 'fields')}`
        : 'Unsaved changes';
    case 'clean':
    default:
      return 'No changes to save';
  }
}

export function SaveBar({ status, errorCount = 0, changedCount = 0, onSave }: SaveBarProps) {
  const saving = status === 'saving';
  const blocked = status === 'blocked';
  const disabled = saving || blocked;

  return (
    <div className="gsd-save-bar" role="region" aria-label="Save configuration">
      <div className={`gsd-save-bar__status gsd-save-bar__status--${status}`}>
        <span className="gsd-save-bar__icon" aria-hidden="true">
          {status === 'saved' ? <Icons.check size={16} /> : null}
          {status === 'blocked' ? <Icons.warning size={16} /> : null}
          {status === 'saving' ? <Icons.clock size={16} /> : null}
        </span>
        <span className="gsd-save-bar__dot" aria-hidden="true" />
        <span className="gsd-save-bar__status-text" role="status" aria-live="polite">
          {statusText(status, errorCount, changedCount)}
        </span>
      </div>
      <Button
        variant="primary"
        size="md"
        className="gsd-save-bar__save"
        onClick={onSave}
        disabled={disabled}
        aria-disabled={disabled}
      >
        <span>Save changes</span>
        <kbd className="gsd-save-bar__kbd" aria-hidden="true">Ctrl+S</kbd>
      </Button>
    </div>
  );
}
