import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { trackWorkspace, scanWorkspace } from '../../api/workspace';
import { Button } from '../common/Button';
import { Icons } from '../common/Icons';
import { PathEntryDialog } from './PathEntryDialog';
import { ScanReviewDialog } from './ScanReviewDialog';
import { useUiStore } from '../../state/uiStore';
import { useToastStore } from '../../state/toastStore';
import type { ScanCandidate } from '../../api/workspace';

interface AddMenuItem {
  label: string;
  description: string;
  icon: ReactNode;
  setMode: () => void;
}

export function AddConfigMenu() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'idle' | 'file' | 'path' | 'scan'>('idle');
  const [scanCandidates, setScanCandidates] = useState<ScanCandidate[] | null>(null);
  const queryClient = useQueryClient();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const trackConfigOpen = useUiStore((state) => state.trackConfigOpen);
  const setTrackConfigOpen = useUiStore((state) => state.setTrackConfigOpen);
  const setActiveConfigId = useUiStore((state) => state.setActiveConfigId);

  const closeMenu = () => {
    setOpen(false);
    setMode('idle');
    setScanCandidates(null);
  };

  useEffect(() => {
    if (open) firstItemRef.current?.focus();
  }, [open]);

  const items: AddMenuItem[] = [
    {
      label: 'Add existing config…',
      description: 'Choose a GSD config.json file from your computer.',
      icon: <Icons.file size={16} aria-hidden="true" />,
      setMode: () => { setMode('file'); setOpen(false); },
    },
    {
      label: 'Add by path…',
      description: 'Paste the absolute path to a config.json you already know.',
      icon: <Icons.folder size={16} aria-hidden="true" />,
      setMode: () => { setMode('path'); setOpen(false); },
    },
    {
      label: 'Scan a folder…',
      description: 'Look inside a folder for .planning/config.json files to review.',
      icon: <Icons.search size={16} aria-hidden="true" />,
      setMode: () => { setMode('scan'); setOpen(false); },
    },
  ];

  const handleTrack = async (path: string) => {
    const config = await trackWorkspace(path);
    await queryClient.invalidateQueries({ queryKey: ['workspace', 'configs'] });
    // Select the config we just added. Without this the user adds a config,
    // sees it appear in the sidebar, and the editor stays on whatever it was
    // showing before — on a first run that is an empty pane and a dead end.
    setActiveConfigId(config.id);
    useToastStore.getState().push('success', 'Config added');
    setTrackConfigOpen(false);
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
        title="Add a tracked config"
      >
        <Icons.add size={15} aria-hidden="true" />
        Add
      </Button>
      {open && (
        <div
          id="add-menu-dropdown"
          ref={dropdownRef}
          className="gsd-add-menu__dropdown"
          role="menu"
          onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); closeMenu(); } }}
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              ref={index === 0 ? firstItemRef : undefined}
              type="button"
              className="gsd-add-menu__item"
              role="menuitem"
              onClick={item.setMode}
            >
              <span className="gsd-add-menu__item-icon">{item.icon}</span>
              <span className="gsd-add-menu__item-text">
                <span className="gsd-add-menu__item-label">{item.label}</span>
                <span className="gsd-add-menu__item-desc">{item.description}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {(mode === 'file' || trackConfigOpen) && (
        <PathEntryDialog
          title="Add an existing config"
          description="Choose a GSD config.json, paste its absolute path, or use Scan a folder to discover configs automatically. Configs live at .planning/config.json inside a project folder."
          submitLabel="Add config"
          pickKind="file"
          onSubmit={handleTrack}
          onCancel={() => { setTrackConfigOpen(false); closeMenu(); }}
        />
      )}
      {mode === 'path' && (
        <PathEntryDialog
          title="Add config by path"
          submitLabel="Add config"
          pickKind="file"
          onSubmit={handleTrack}
          onCancel={closeMenu}
        />
      )}
      {mode === 'scan' && !scanCandidates && (
        <PathEntryDialog
          title="Scan a folder for configs"
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
          track={trackWorkspace}
          onDone={async () => {
            await queryClient.invalidateQueries({ queryKey: ['workspace', 'configs'] });
            closeMenu();
          }}
          onCancel={closeMenu}
        />
      )}
    </div>
  );
}
