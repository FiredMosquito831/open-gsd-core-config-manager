import { useEffect, useId, useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { previewCreateConfig, createConfig } from '../../api/workspace';
import { pickerStatus, pickDirectory } from '../../api/picker';
import { Button } from '../common/Button';
import { useFocusModal } from '../../lib/focusModal';
import { useToastStore } from '../../state/toastStore';

interface CreateConfigDialogProps {
  onClose: () => void;
}

export function CreateConfigDialog({ onClose }: CreateConfigDialogProps) {
  const [projectDir, setProjectDir] = useState('');
  const [preview, setPreview] = useState<{ targetPath: string; exists: boolean } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [pickerAvailable, setPickerAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const descriptionId = useId();
  const queryClient = useQueryClient();

  useFocusModal(true, dialogRef, {
    onDismiss: onClose,
    dismissable: !submitting,
    initialFocus: inputRef,
  });

  useEffect(() => {
    let alive = true;
    pickerStatus()
      .then((s) => { if (alive) setPickerAvailable(s.supported); })
      .catch(() => { /* keep default true */ });
    return () => { alive = false; };
  }, []);

  const handlePreview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      setPreview(await previewCreateConfig(projectDir));
      setConfirmed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not preview this path');
    }
  };

  const handleBrowse = async () => {
    setError(null);
    setBrowsing(true);
    try {
      const chosen = await pickDirectory();
      if (chosen) {
        setProjectDir(chosen);
        setPreview(null);
      }
    } finally {
      setBrowsing(false);
    }
  };

  const handleCreate = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await createConfig(projectDir, preview?.exists ?? false);
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'configs'] });
      useToastStore.getState().push('success', 'Config created', preview?.targetPath ?? projectDir);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create this config';
      setError(message);
      useToastStore.getState().push('error', "Couldn't create config", message);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div ref={dialogRef} className="gsd-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="create-dialog-title" aria-describedby={descriptionId}>
      <div className="gsd-dialog">
        <h2 id="create-dialog-title">Create new config</h2>
        <p id={descriptionId}>A new config is created at <code className="gsd-dialog__code">.planning/config.json</code> inside the folder you choose. Nothing on disk changes until you confirm. If one already exists, creating replaces it — your current file is kept as a snapshot you can restore.</p>
        <form className="gsd-dialog__form" onSubmit={handlePreview}>
          <label className="gsd-dialog__label">
            Project folder (absolute path)
            <div className="gsd-dialog__path-row">
              <input
                ref={inputRef}
                className="gsd-dialog__input"
                type="text"
                value={projectDir}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setProjectDir(event.target.value)}
                placeholder="/home/projects/my-project"
              />
              {pickerAvailable && (
                <Button type="button" variant="secondary" disabled={browsing} onClick={handleBrowse}>
                  {browsing ? 'Opening…' : 'Browse…'}
                </Button>
              )}
            </div>
          </label>
          <Button type="submit" variant="secondary" disabled={!projectDir}>
            Preview target path
          </Button>
        </form>
        {preview && (
          <div className="gsd-preview">
            <p>Target: <span className="gsd-dialog__code">{preview.targetPath}</span></p>
            {preview.exists && (
              <>
                <p className="gsd-preview__warning" role="alert">A config already exists at this path. Continuing replaces it with a new one (your current file is saved as a snapshot first).</p>
                <label className="gsd-checkbox-label">
                  <input type="checkbox" checked={confirmed} onChange={(event: ChangeEvent<HTMLInputElement>) => setConfirmed(event.target.checked)} />
                  I understand this replaces the existing config.
                </label>
              </>
            )}
          </div>
        )}
        {error && <p className="gsd-dialog__error" role="alert">{error}</p>}
        <div className="gsd-dialog__actions">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleCreate} disabled={!preview || (preview.exists && !confirmed) || submitting}>
            {submitting ? 'Creating…' : (preview?.exists ? 'Replace existing config' : 'Create config')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
