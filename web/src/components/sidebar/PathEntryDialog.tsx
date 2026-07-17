import { useState, type FormEvent, type ChangeEvent } from 'react';
import { Button } from '../common/Button';

interface PathEntryDialogProps {
  title: string;
  description?: string;
  submitLabel: string;
  onSubmit: (path: string) => Promise<void>;
  onCancel: () => void;
}

export function PathEntryDialog({ title, description, submitLabel, onSubmit, onCancel }: PathEntryDialogProps) {
  const [path, setPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit path');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="gsd-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="path-dialog-title">
      <div className="gsd-dialog">
        <h2 id="path-dialog-title">{title}</h2>
        {description && <p>{description}</p>}
        <form className="gsd-dialog__form" onSubmit={handleSubmit}>
          <label className="gsd-dialog__label">
            Absolute path
            <input
              className="gsd-dialog__input"
              type="text"
              value={path}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setPath(event.target.value)}
              placeholder="/home/projects/my-project/.planning/config.json"
            />
          </label>
          {error && <p className="gsd-dialog__error" role="alert">{error}</p>}
          <div className="gsd-dialog__actions">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!path || submitting}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
