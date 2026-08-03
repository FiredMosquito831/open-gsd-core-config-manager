import { Button } from '../common/Button';

interface SaveBarProps {
  onSave: () => void;
  disabled: boolean;
  dirty: boolean;
  isSaving: boolean;
  snapshotId?: string;
}

export function SaveBar({ onSave, disabled, dirty, isSaving, snapshotId }: SaveBarProps) {
  return (
    <div className="gsd-save-bar">
      <div className="gsd-save-bar__status">
        {isSaving ? (
          <span className="gsd-save-bar__saving">Saving...</span>
        ) : snapshotId ? (
          <span className="gsd-save-bar__saved">Saved successfully</span>
        ) : dirty ? (
          <span className="gsd-save-bar__unsaved">Unsaved changes</span>
        ) : (
          <span className="gsd-save-bar__clean">No changes</span>
        )}
      </div>
      <Button
        variant="primary"
        size="md"
        onClick={onSave}
        disabled={disabled || isSaving}
      >
        Save changes
      </Button>
    </div>
  );
}
