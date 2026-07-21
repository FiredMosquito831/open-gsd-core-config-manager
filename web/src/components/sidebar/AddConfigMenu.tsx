import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { trackWorkspace, scanWorkspace } from '../../api/workspace';
import { Button } from '../common/Button';
import { PathEntryDialog } from './PathEntryDialog';
import { ScanReviewDialog } from './ScanReviewDialog';
import type { ScanCandidate } from '../../api/workspace';

export function AddConfigMenu() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'idle' | 'file' | 'path' | 'scan'>('idle');
  const [scanCandidates, setScanCandidates] = useState<ScanCandidate[] | null>(null);
  const queryClient = useQueryClient();

  const closeMenu = () => {
    setOpen(false);
    setMode('idle');
    setScanCandidates(null);
  };

  const handleTrack = async (path: string) => {
    await trackWorkspace(path);
    await queryClient.invalidateQueries({ queryKey: ['workspace', 'configs'] });
    closeMenu();
  };

  const handleScan = async (rootPath: string) => {
    const candidates = await scanWorkspace(rootPath);
    setScanCandidates(candidates);
  };

  return (
    <div className="gsd-add-menu">
      <Button
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? 'add-menu-dropdown' : undefined}
      >
        Add
      </Button>
      {open && (
        <div id="add-menu-dropdown" className="gsd-add-menu__dropdown" role="menu">
          <button
            type="button"
            className="gsd-add-menu__item"
            role="menuitem"
            onClick={() => { setMode('file'); setOpen(false); }}
          >
            File picker
          </button>
          <button
            type="button"
            className="gsd-add-menu__item"
            role="menuitem"
            onClick={() => { setMode('path'); setOpen(false); }}
          >
            Absolute path
          </button>
          <button
            type="button"
            className="gsd-add-menu__item"
            role="menuitem"
            onClick={() => { setMode('scan'); setOpen(false); }}
          >
            Scan chosen folder
          </button>
        </div>
      )}
      {mode === 'file' && (
        <PathEntryDialog
          title="Add config from file picker"
          description="Pick a GSD config.json with the OS file picker, paste its absolute path, or use Scan chosen folder to discover configs automatically."
          submitLabel="Add config"
          pickKind="file"
          onSubmit={handleTrack}
          onCancel={closeMenu}
        />
      )}
      {mode === 'path' && (
        <PathEntryDialog
          title="Add config by absolute path"
          submitLabel="Add config"
          pickKind="file"
          onSubmit={handleTrack}
          onCancel={closeMenu}
        />
      )}
      {mode === 'scan' && !scanCandidates && (
        <PathEntryDialog
          title="Scan folder for configs"
          description="Pick a folder with the OS file picker, or enter an absolute path. The scan will find .planning/config.json files inside."
          submitLabel="Scan"
          submittingLabel="Scanning…"
          pickKind="directory"
          pathLabel="Folder to scan"
          placeholder="/home/projects"
          onSubmit={handleScan}
          onCancel={closeMenu}
        />
      )}
      {scanCandidates && (
        <ScanReviewDialog
          candidates={scanCandidates}
          onConfirm={async (selected) => {
            for (const path of selected) {
              await trackWorkspace(path);
            }
            await queryClient.invalidateQueries({ queryKey: ['workspace', 'configs'] });
            closeMenu();
          }}
          onCancel={closeMenu}
        />
      )}
    </div>
  );
}
