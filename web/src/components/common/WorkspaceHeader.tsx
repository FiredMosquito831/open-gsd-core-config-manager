import { useQuery } from '@tanstack/react-query';
import { listWorkspaceConfigs } from '../../api/workspace';
import { useUiStore } from '../../state/uiStore';
import { Icons } from './Icons';
import { buildProjectIdentities } from '../../lib/path-identity';

/** Destination tabs — backed by the existing uiStore workspaceMode actions. */
const WORKSPACE_TABS = [
  { id: 'editor' as const, label: 'Editor', icon: Icons.config },
  { id: 'history' as const, label: 'History', icon: Icons.history },
  { id: 'schema' as const, label: 'Schema', icon: Icons.schema },
  { id: 'keys' as const, label: 'API keys', icon: Icons.key },
];

/**
 * Persistent context header across the top of the main pane. Always shows the
 * active project identity and a labeled Editor / History / Schema / API keys
 * switcher so the user never loses track of which file they're in or which
 * workspace they've opened. Tabs are disabled until a config is selected.
 */
export function WorkspaceHeader() {
  const activeConfigId = useUiStore((state) => state.activeConfigId);
  const workspaceMode = useUiStore((state) => state.workspaceMode);
  const openHistory = useUiStore((state) => state.openHistory);
  const openSchemaMaintenance = useUiStore((state) => state.openSchemaMaintenance);
  const openKeys = useUiStore((state) => state.openKeys);
  const backToEditor = useUiStore((state) => state.backToEditor);

  const configsQuery = useQuery({ queryKey: ['workspace', 'configs'], queryFn: listWorkspaceConfigs });
  const identities = buildProjectIdentities(configsQuery.data ?? []);
  const active = activeConfigId ? configsQuery.data?.find((c) => c.id === activeConfigId) : undefined;
  const identity = activeConfigId ? identities.get(activeConfigId) : undefined;

  const activate = (id: typeof WORKSPACE_TABS[number]['id']) => {
    if (id === 'editor') backToEditor();
    else if (id === 'history') openHistory();
    else if (id === 'schema') openSchemaMaintenance();
    else openKeys();
  };

  const activeTab = WORKSPACE_TABS.find((tab) => tab.id === workspaceMode)?.label ?? 'Editor';

  return (
    <header className="gsd-workspace-header">
      <div className="gsd-workspace-header__identity">
        {identity ? (
          <>
            <span className="gsd-workspace-header__project" title={identity.fullPath}>
              {identity.name}
            </span>
            <span className="gsd-workspace-header__path" title={identity.fullPath}>
              {identity.shortPath}
            </span>
          </>
        ) : (
          <span className="gsd-workspace-header__empty">No config selected</span>
        )}
      </div>

      <nav className="gsd-workspace-header__tabs" aria-label="Workspace">
        {WORKSPACE_TABS.map((tab) => {
          const isActive = workspaceMode === tab.id;
          const disabled = !activeConfigId;
          return (
            <button
              key={tab.id}
              type="button"
              className="gsd-workspace-header__tab"
              aria-current={isActive ? 'page' : undefined}
              aria-disabled={disabled}
              disabled={disabled}
              onClick={() => activate(tab.id)}
            >
              <tab.icon size={15} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Announces the active workspace to screen readers when it changes. */}
      <span className="gsd-visually-hidden" role="status" aria-live="polite">
        {identity ? `${identity.name} — ${activeTab}` : `Workspace: ${activeTab}`}
      </span>
    </header>
  );
}
