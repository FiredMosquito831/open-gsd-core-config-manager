import { FormProvider } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loadConfig } from '../../api/configs';
import { getSchema } from '../../api/schema';
import { useConfigDraft } from '../../editor/useConfigDraft';
import { useUiStore } from '../../state/uiStore';
import { EmptyState } from '../common/EmptyState';
import { Button } from '../common/Button';
import { ChapterView } from '../chapters/ChapterView';
import { SearchView } from '../search/SearchView';
import { SaveBar } from './SaveBar';
import { ValidationSummary } from './ValidationSummary';
import { RuntimeInstallNotice } from '../specialized/RuntimeInstallNotice';
import type { LoadResult, SchemaEntry } from '../../../../packages/config-io/src/types';

function RestoreNotice() {
  const { restoreNotice, clearRestoreNotice, openHistory } = useUiStore();
  if (!restoreNotice) return null;
  return <div className="gsd-restore-notice" role="status">
    Restored snapshot from {new Date(restoreNotice.timestamp).toLocaleString()}.
    <Button size="sm" onClick={openHistory}>View history</Button>
    <Button size="sm" variant="ghost" onClick={clearRestoreNotice}>Dismiss</Button>
  </div>;
}

export function ConfigEditor() {
  const { activeConfigId, searchQuery, searchOpen, setActiveChapter, setHighlightTarget, setSearchOpen, openHistory } = useUiStore();
  const queryClient = useQueryClient();
  const configQuery = useQuery({ queryKey: ['config', activeConfigId], queryFn: () => loadConfig(activeConfigId!), enabled: !!activeConfigId });
  const schemaQuery = useQuery({ queryKey: ['schema'], queryFn: getSchema });

  if (!activeConfigId) return <EmptyState title="Select a configuration" description="Choose a tracked config from the sidebar to begin editing." />;
  if (configQuery.isLoading || schemaQuery.isLoading) return <div className="gsd-sidebar__loading">Loading config...</div>;
  if (configQuery.error || schemaQuery.error) return <div className="gsd-sidebar__error">Failed to load config.</div>;
  if (!configQuery.data || !schemaQuery.data) return <div className="gsd-sidebar__error">Config data unavailable.</div>;

  return <EditorContents key={activeConfigId} configId={activeConfigId} loadResult={configQuery.data} schema={schemaQuery.data} onSaved={(refreshed: LoadResult) => queryClient.setQueryData(['config', activeConfigId], refreshed)} searchQuery={searchQuery} searchOpen={searchOpen} setActiveChapter={setActiveChapter} setHighlightTarget={setHighlightTarget} setSearchOpen={setSearchOpen} openHistory={openHistory} />;
}

function EditorContents({ configId, loadResult, schema, onSaved, searchQuery, searchOpen, setActiveChapter, setHighlightTarget, setSearchOpen, openHistory }: any) {
  const draft = useConfigDraft(configId, loadResult, schema);
  return <FormProvider {...draft.form}>
    <div className="gsd-config-editor">
      <div className="gsd-config-editor__header">
        <h2 className="gsd-sidebar__heading">Config editor</h2>
        <Button size="sm" variant="secondary" onClick={openHistory}>View history</Button>
        {loadResult.meta.globalDefaultsFound && <p className="gsd-preview">Global defaults loaded from {loadResult.meta.globalDefaultsPath}</p>}
      </div>
      <RestoreNotice />
      <ValidationSummary errors={draft.serverErrors} kind="server" />
      {draft.runtimeNotice && <RuntimeInstallNotice runtime={draft.runtimeNotice.runtime} settings={draft.runtimeNotice.settings} onDismiss={draft.dismissRuntimeNotice} />}
      {searchOpen && searchQuery.trim() ? <SearchView loadResult={loadResult} schema={schema} query={searchQuery} onOpenResult={(chapter: string, path: string) => { setActiveChapter(chapter); setHighlightTarget(path); setSearchOpen(false); }} /> :
        <ChapterView loadResult={loadResult} schema={schema} control={draft.form.control} onFieldChange={draft.onFieldChange} onResetField={draft.onResetField} />}
      <SaveBar dirty={draft.isDirty} disabled={!draft.isDirty || Object.keys(draft.form.formState.errors).length > 0} isSaving={draft.isSaving} snapshotId={draft.snapshotId} onSave={() => void draft.form.handleSubmit(async () => { const outcome = await draft.saveDraft(); if (outcome === 'saved') onSaved(await loadConfig(configId)); })()} />
    </div>
  </FormProvider>;
}
