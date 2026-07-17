import { useQuery } from '@tanstack/react-query';
import { loadConfig } from '../api/configs';
import { useUiStore } from '../state/uiStore';
import { EmptyState } from './common/EmptyState';

export function ConfigEditor() {
  const { activeConfigId } = useUiStore();
  const { data, isLoading, error } = useQuery({
    queryKey: ['config', activeConfigId],
    queryFn: () => loadConfig(activeConfigId!),
    enabled: !!activeConfigId,
  });

  if (!activeConfigId) {
    return (
      <EmptyState
        title="Select a configuration"
        description="Choose a tracked config from the sidebar to begin editing."
      />
    );
  }

  if (isLoading) return <div className="gsd-sidebar__loading">Loading config...</div>;
  if (error) return <div className="gsd-sidebar__error">Failed to load config.</div>;

  return (
    <div>
      <h2 className="gsd-sidebar__heading">Config editor</h2>
      <p>Ready to edit</p>
      {data?.meta.globalDefaultsFound && (
        <p className="gsd-preview">Global defaults loaded from {data.meta.globalDefaultsPath}</p>
      )}
    </div>
  );
}
