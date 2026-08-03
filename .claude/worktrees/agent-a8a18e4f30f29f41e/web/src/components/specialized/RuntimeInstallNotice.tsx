interface RuntimeInstallNoticeProps {
  runtime: 'codex' | 'opencode';
  settings: string[];
  onDismiss: () => void;
}

export function RuntimeInstallNotice({ runtime, settings, onDismiss }: RuntimeInstallNoticeProps) {
  const command = `gsd install ${runtime}`;
  return (
    <aside className="gsd-runtime-install-notice" role="status" aria-label={`${runtime} installation guidance`}>
      <div><strong>Model setting saved</strong><p>{settings.map((setting) => <span key={setting}>Saved “{setting}”. </span>)}Run <code>{command}</code> for the change to take effect.</p></div>
      <button type="button" className="gsd-button gsd-button--ghost gsd-button--sm" onClick={onDismiss}>Dismiss install guidance</button>
    </aside>
  );
}
