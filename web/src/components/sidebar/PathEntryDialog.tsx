import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../common/Button';
import { pickerStatus, pickFile, pickDirectory } from '../../api/picker';

interface PathEntryDialogProps {
  title: string;
  description?: string;
  submitLabel: string;
  /** Optional verb shown while the form is submitting (e.g. "Scanning…"). Defaults to `submitLabel`. */
  submittingLabel?: string;
  /**
   * When set, renders a "Browse…" button that opens the native OS picker of
   * this kind and pre-fills the path. `'file'` = single JSON config file,
   * `'directory'` = a scan root / project folder. Omit to render the
   * paste-an-absolute-path input only (legacy behavior).
   */
  pickKind?: 'file' | 'directory';
  /** Optional label for the path field, e.g. "Project folder (absolute path)". Defaults to "Absolute path". */
  pathLabel?: string;
  /** Optional placeholder for the path input. */
  placeholder?: string;
  onSubmit: (path: string) => Promise<void>;
  onCancel: () => void;
}

export function PathEntryDialog({
  title,
  description,
  submitLabel,
  submittingLabel,
  pickKind,
  pathLabel = 'Absolute path',
  placeholder = '/home/projects/my-project/.planning/config.json',
  onSubmit,
  onCancel,
}: PathEntryDialogProps) {
  const [path, setPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [pickerAvailable, setPickerAvailable] = useState(true);

  // Probe once: hide the Browse button entirely on platforms with no native
  // picker backend (headless box / WSL without Windows interop) so the UX never
  // offers a control that no-ops. A failed status probe leaves the button on
  // (best-effort); a failed pick surfaces an inline error.
  useEffect(() => {
    let alive = true;
    pickerStatus()
      .then((s) => { if (alive) setPickerAvailable(s.supported); })
      .catch(() => { /* keep default true */ });
    return () => { alive = false; };
  }, []);

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

  const handleBrowse = async () => {
    setError(null);
    setBrowsing(true);
    try {
      const chosen = pickKind === 'directory' ? await pickDirectory() : await pickFile();
      if (chosen) setPath(chosen);
      // cancelled or no backend: leave the field as-is, user can still paste
    } finally {
      setBrowsing(false);
    }
  };

  return createPortal(
    <div className="gsd-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="path-dialog-title">
      <div className="gsd-dialog">
        <h2 id="path-dialog-title">{title}</h2>
        {description && <p>{description}</p>}
        <form className="gsd-dialog__form" onSubmit={handleSubmit}>
          <label className="gsd-dialog__label">
            {pathLabel}
            <div className="gsd-dialog__path-row">
              <input
                className="gsd-dialog__input"
                type="text"
                value={path}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setPath(event.target.value)}
                placeholder={placeholder}
              />
              {pickKind && pickerAvailable && (
                <Button type="button" variant="secondary" disabled={browsing} onClick={handleBrowse}>
                  {browsing ? 'Opening…' : 'Browse…'}
                </Button>
              )}
            </div>
          </label>
          {error && <p className="gsd-dialog__error" role="alert">{error}</p>}
          <div className="gsd-dialog__actions">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!path || submitting}>
              {submitting ? (submittingLabel ?? submitLabel) : submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
