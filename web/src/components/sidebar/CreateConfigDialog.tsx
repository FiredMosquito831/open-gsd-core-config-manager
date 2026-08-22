import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { previewCreateConfig, createConfig } from '../../api/workspace';
import { pickerStatus, pickDirectory } from '../../api/picker';
import { Button } from '../common/Button';

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
  const queryClient = useQueryClient();

  useEffect(() => {
    let alive = true;
    pickerStatus()
      .then((s) => { if (alive) setPickerAvailable(s.supported); })
      .catch(() => { /* keep default true */ });
    return () => { alive = false; };
  }, []);

  const handlePreview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPreview(await previewCreateConfig(projectDir));
    setConfirmed(false);
  };

  const handleBrowse = async () => {
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
    try {
      await createConfig(projectDir, preview?.exists ?? false);
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'configs'] });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="gsd-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="create-dialog-title">
      <div className="gsd-dialog">
        <h2 id="create-dialog-title">Create new config</h2>
        <form className="gsd-dialog__form" onSubmit={handlePreview}>
          <label className="gsd-dialog__label">
            Project folder (absolute path)
            <div className="gsd-dialog__path-row">
              <input
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
            <p>Target: {preview.targetPath}</p>
            {preview.exists && (
              <>
                <p className="gsd-preview__warning" role="alert">A config already exists at this path. Creating will overwrite it.</p>
                <label className="gsd-checkbox-label">
                  <input type="checkbox" checked={confirmed} onChange={(event: ChangeEvent<HTMLInputElement>) => setConfirmed(event.target.checked)} />
                  I understand this will overwrite the existing config.
                </label>
              </>
            )}
          </div>
        )}
        <div className="gsd-dialog__actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleCreate} disabled={!preview || (preview.exists && !confirmed) || submitting}>
            Create config
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
