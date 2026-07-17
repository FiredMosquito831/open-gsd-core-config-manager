import type { TrackedWorkspaceConfig } from '../../../../packages/server/src/api-types';
import { Button } from '../common/Button';

interface MissingConfigActionsProps {
  config: TrackedWorkspaceConfig;
  onLocate: () => void;
  onRemove: () => void;
}

export function MissingConfigActions({ onLocate, onRemove }: MissingConfigActionsProps) {
  return (
    <div className="gsd-missing-actions">
      <div className="gsd-missing-actions__buttons">
        <Button size="sm" variant="secondary" onClick={onLocate}>
          Locate again
        </Button>
        <Button size="sm" variant="danger" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </div>
  );
}
