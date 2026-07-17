import { useQuery } from '@tanstack/react-query';
import { loadConfig } from '../../api/configs';
import { getSchema } from '../../api/schema';
import { useUiStore } from '../../state/uiStore';
import { EmptyState } from '../common/EmptyState';
import { ChapterView } from '../chapters/ChapterView';

export function ConfigEditor() {
  const { activeConfigId } = useUiStore();
  const { data: loadResult, isLoading: isLoadingConfig, error: configError } = useQuery({
    queryKey: ['config', activeConfigId],
    queryFn: () => loadConfig(activeConfigId!),
    enabled: !!activeConfigId,
  });
  const { data: schema, isLoading: isLoadingSchema, error: schemaError } = useQuery({
    queryKey: ['schema'],
    queryFn: getSchema,
  });

  if (!activeConfigId) {
    return (
      <EmptyState
        title="Select a configuration"
        description="Choose a tracked config from the sidebar to begin editing."
      />
    );
  }

  if (isLoadingConfig || isLoadingSchema) return <div className="gsd-sidebar__loading">Loading config...</div>;
  if (configError || schemaError) return <div className="gsd-sidebar__error">Failed to load config.</div>;
  if (!loadResult || !schema) return <div className="gsd-sidebar__error">Config data unavailable.</div>;

  return (
    <div className="gsd-config-editor">
      <div className="gsd-config-editor__header">
        <h2 className="gsd-sidebar__heading">Config editor</h2>
        {loadResult.meta.globalDefaultsFound && (
          <p className="gsd-preview">Global defaults loaded from {loadResult.meta.globalDefaultsPath}</p>
        )}
      </div>
      <ChapterView loadResult={loadResult} schema={schema} />
    </div>
  );
}
