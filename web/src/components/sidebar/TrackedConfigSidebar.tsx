import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listWorkspaceConfigs, locateWorkspace, removeWorkspace } from '../../api/workspace';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../common/Button';
import { MissingConfigActions } from './MissingConfigActions';
import { PathEntryDialog } from './PathEntryDialog';
import { AddConfigMenu } from './AddConfigMenu';
import { CreateConfigDialog } from './CreateConfigDialog';
import type { TrackedWorkspaceConfig } from '../../../../packages/server/src/api-types';

export function TrackedConfigSidebar() {
  const { data: configs, isLoading, error } = useQuery({
    queryKey: ['workspace', 'configs'],
    queryFn: listWorkspaceConfigs,
  });
  const { activeConfigId, setActiveConfigId } = useUiStore();
  const queryClient = useQueryClient();
  const [locatingId, setLocatingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleSelect = (config: TrackedWorkspaceConfig) => {
    if (config.status !== 'ok') return;
    setActiveConfigId(config.id);
  };

  const handleRemove = async (id: string) => {
    await removeWorkspace(id);
    if (activeConfigId === id) {
      setActiveConfigId(null);
    }
    await queryClient.invalidateQueries({ queryKey: ['workspace', 'configs'] });
  };

  const handleLocate = async (path: string) => {
    if (!locatingId) return;
    await locateWorkspace(locatingId, path);
    setLocatingId(null);
    await queryClient.invalidateQueries({ queryKey: ['workspace', 'configs'] });
  };

  if (isLoading) return <div className="gsd-sidebar__loading">Loading tracked configs...</div>;
  if (error) return <div className="gsd-sidebar__error">Failed to load tracked configs.</div>;

  return (
    <div className="gsd-sidebar">
      <div className="gsd-sidebar__header">
        <h2 className="gsd-sidebar__heading">Tracked configs</h2>
        <div className="gsd-sidebar__actions">
          <AddConfigMenu />
          <Button onClick={() => setCreating(true)}>Create new config</Button>
        </div>
      </div>
      {!configs?.length ? (
        <div className="gsd-sidebar__empty">No tracked configs yet.</div>
      ) : (
        <ul className="gsd-sidebar__list" role="listbox" aria-label="Tracked configs">
          {configs.map((config) => (
            <li
              key={config.id}
              className={`gsd-sidebar__item ${activeConfigId === config.id ? 'gsd-sidebar__item--active' : ''}`}
              role="option"
              aria-selected={activeConfigId === config.id}
            >
              <button
                type="button"
                className="gsd-sidebar__button"
                onClick={() => handleSelect(config)}
                disabled={config.status !== 'ok'}
                aria-disabled={config.status !== 'ok'}
              >
                <span className="gsd-sidebar__name">{config.name}</span>
                <span className="gsd-sidebar__path">{config.path}</span>
                <span className={`gsd-sidebar__status gsd-sidebar__status--${config.status}`}>
                  {config.status === 'ok' ? 'Ready' : config.problem}
                </span>
              </button>
              {config.status !== 'ok' && (
                <MissingConfigActions
                  config={config}
                  onLocate={() => setLocatingId(config.id)}
                  onRemove={() => handleRemove(config.id)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {locatingId && (
        <PathEntryDialog
          title="Locate config"
          description="Enter the new absolute path for this tracked config. The server will validate it before updating the tracked entry."
          submitLabel="Locate"
          onSubmit={handleLocate}
          onCancel={() => setLocatingId(null)}
        />
      )}
      {creating && <CreateConfigDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
