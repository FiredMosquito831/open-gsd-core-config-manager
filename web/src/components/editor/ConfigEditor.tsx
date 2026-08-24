import { useCallback, useEffect, useMemo } from 'react';
import { FormProvider, type FieldErrors } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loadConfig, type LoadedConfig } from '../../api/configs';
import { getSchema } from '../../api/schema';
import { useConfigDraft } from '../../editor/useConfigDraft';
import { useUiStore } from '../../state/uiStore';
import { indexSchema } from '../../schema/indexSchema';
import { EmptyState } from '../common/EmptyState';
import { Button } from '../common/Button';
import { ChapterView } from '../chapters/ChapterView';
import { SearchView } from '../search/SearchView';
import { SaveBar, type SaveStatus } from './SaveBar';
import { ValidationSummary } from './ValidationSummary';
import { RuntimeInstallNotice } from '../specialized/RuntimeInstallNotice';
import { HistoryWorkspace } from '../history/HistoryWorkspace';
import { SchemaWorkspace } from '../schema/SchemaWorkspace';
import { SearchProvidersPanel } from '../keys/SearchProvidersPanel';
import type { LoadResult, SchemaEntry } from '../../../../packages/config-io/src/types';

function RestoreNotice() {
  const { restoreNotice, clearRestoreNotice, openHistory } = useUiStore();
  if (!restoreNotice) return null;
  return <div className={`gsd-restore-notice${restoreNotice.warning ? ' gsd-restore-notice--warning' : ''}`} role="status">
    {restoreNotice.warning
      ? 'Your config was restored, but we couldn’t record its recovery snapshot. Your restored file is safe; check the warning and save again when ready.'
      : `Restored the snapshot from ${new Date(restoreNotice.timestamp).toLocaleString()}.`}
    <Button size="sm" onClick={openHistory}>View history</Button>
    <Button size="sm" variant="ghost" onClick={clearRestoreNotice}>Dismiss</Button>
  </div>;
}

/** Flatten react-hook-form's nested error tree into flat { message, instancePath } rows. */
function flattenFormErrors(
  errors: FieldErrors<Record<string, unknown>>,
  prefix = '',
): { message: string; instancePath: string }[] {
  const out: { message: string; instancePath: string }[] = [];
  for (const [key, value] of Object.entries(errors)) {
    if (!value) continue;
    const child = value as Record<string, unknown>;
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child.message === 'string' && 'type' in child) {
      out.push({ message: child.message, instancePath: `/${path.replace(/\./g, '/')}` });
    } else if (typeof child === 'object') {
      out.push(...flattenFormErrors(child as FieldErrors<Record<string, unknown>>, path));
    }
  }
  return out;
}

/** Convert a JSON-pointer instancePath (/a/b) back to a dotted schema field path (a.b). */
function pointerToDotted(pointer: string): string {
  if (!pointer || pointer === '/') return '';
  return pointer.replace(/^\//, '').replace(/\//g, '.');
}

interface ConfigEditorProps {
  workspaceMode?: 'editor' | 'history' | 'schema' | 'keys';
}

export function ConfigEditor({ workspaceMode = 'editor' }: ConfigEditorProps) {
  if (workspaceMode === 'schema') return <SchemaWorkspace />;
  if (workspaceMode === 'history') return <HistoryWorkspace embedded />;

  const {
    activeConfigId,
    searchQuery,
    searchOpen,
    setActiveChapter,
    setHighlightTarget,
    setSearchOpen,
    setDirtyConfigIds,
    openHistory,
  } = useUiStore();
  const queryClient = useQueryClient();
  const configQuery = useQuery({ queryKey: ['config', activeConfigId], queryFn: () => loadConfig(activeConfigId!), enabled: !!activeConfigId });
  const schemaQuery = useQuery({ queryKey: ['schema'], queryFn: getSchema });

  if (!activeConfigId) return (
    <EmptyState
      variant="guided"
      title="Select a configuration"
      description="Choose a tracked config from the sidebar to begin editing. Configs live at .planning/config.json inside a project folder."
      actions={<>
        <Button onClick={() => useUiStore.getState().setTrackConfigOpen(true)}>Add an existing config…</Button>
        <Button variant="secondary" onClick={() => useUiStore.getState().setCreateConfigOpen(true)}>Create new config…</Button>
      </>}
    />
  );
  if (configQuery.isLoading || schemaQuery.isLoading) return <div className="gsd-sidebar__loading">Loading config...</div>;
  if (configQuery.error || schemaQuery.error) return <div className="gsd-sidebar__error">Failed to load config.</div>;
  if (!configQuery.data || !schemaQuery.data) return <div className="gsd-sidebar__error">Config data unavailable.</div>;

  return <EditorContents key={activeConfigId} configId={activeConfigId} loadResult={configQuery.data} schema={schemaQuery.data} workspaceMode={workspaceMode} onSaved={(refreshed: LoadedConfig) => queryClient.setQueryData(['config', activeConfigId], refreshed)} searchQuery={searchQuery} searchOpen={searchOpen} setActiveChapter={setActiveChapter} setHighlightTarget={setHighlightTarget} setSearchOpen={setSearchOpen} setDirtyConfigIds={setDirtyConfigIds} openHistory={openHistory} />;
}

interface EditorContentsProps {
  configId: string;
  loadResult: LoadedConfig;
  schema: Record<string, SchemaEntry>;
  workspaceMode: 'editor' | 'history' | 'schema' | 'keys';
  onSaved(refreshed: LoadedConfig): void;
  searchQuery: string;
  searchOpen: boolean;
  setActiveChapter(chapter: string | null): void;
  setHighlightTarget(path: string | null): void;
  setSearchOpen(open: boolean): void;
  setDirtyConfigIds(ids: string[]): void;
  openHistory(): void;
}

function EditorContents({ configId, loadResult, schema, workspaceMode, onSaved, searchQuery, searchOpen, setActiveChapter, setHighlightTarget, setSearchOpen, setDirtyConfigIds, openHistory }: EditorContentsProps) {
  const draft = useConfigDraft(configId, loadResult, schema);
  const index = useMemo(() => indexSchema(schema), [schema]);
  const reloadAndDiscard = async () => {
    const reloaded = await loadConfig(configId);
    draft.resetFromServer(reloaded);
    onSaved(reloaded);
  };

  const clientErrors = flattenFormErrors(draft.form.formState.errors);
  const serverErrors = draft.serverErrors;
  const mergedErrors = [...serverErrors, ...clientErrors];
  const blockingErrors = serverErrors.length > 0 || clientErrors.length > 0;
  const changedCount = Object.keys(draft.changes).length + draft.resets.size;
  const errorCount = serverErrors.length + clientErrors.length;

  const status: SaveStatus = draft.isSaving
    ? 'saving'
    : blockingErrors
      ? 'blocked'
      : draft.isDirty
        ? 'dirty'
        : draft.snapshotId
          ? 'saved'
          : 'clean';

  const handleSave = useCallback(() => {
    void draft.form.handleSubmit(async () => {
      const outcome = await draft.saveDraft();
      if (outcome === 'saved') onSaved(await loadConfig(configId));
    })();
  }, [draft, configId, onSaved]);

  const onJumpToField = useCallback((pointer: string) => {
    const dotted = pointerToDotted(pointer);
    const field = dotted ? index.fieldsByPath.get(dotted) : undefined;
    if (field?.category) {
      setActiveChapter(field.category);
      setSearchOpen(false);
    }
    setHighlightTarget(dotted || null);
  }, [index, setActiveChapter, setHighlightTarget, setSearchOpen]);

  // Keep the parked-draft dirty indicator in sync with this editor's state.
  useEffect(() => {
    setDirtyConfigIds(draft.isDirty ? [configId] : []);
    return () => { setDirtyConfigIds([]); };
  }, [draft.isDirty, configId, setDirtyConfigIds]);

  // Ctrl/Cmd+S saves while the editor is dirty and not blocked.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
      if (draft.isSaving || blockingErrors || !draft.isDirty) return;
      const target = event.target as HTMLElement | null;
      if (target && target.closest('[role="dialog"]')) return;
      event.preventDefault();
      handleSave();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [draft.isDirty, draft.isSaving, blockingErrors, handleSave]);

  // Reflect unsaved state in the document title so it is visible across tabs.
  useEffect(() => {
    const SUFFIX = ' (unsaved)';
    const apply = (unsaved: boolean) => {
      const base = document.title.endsWith(SUFFIX)
        ? document.title.slice(0, -SUFFIX.length)
        : document.title;
      document.title = unsaved ? `${base}${SUFFIX}` : base;
    };
    apply(draft.isDirty);
    return () => { apply(false); };
  }, [draft.isDirty, configId]);

  if (workspaceMode === 'history') {
    return <HistoryWorkspace configId={configId} draft={draft} embedded />;
  }
  return <FormProvider {...draft.form}>
    <div className="gsd-config-editor">
      <div className="gsd-config-editor__header">
        <h2 className="gsd-sidebar__heading">Config editor</h2>
        <Button size="sm" variant="secondary" onClick={openHistory}>View history</Button>
        {loadResult.meta.globalDefaultsFound && <p className="gsd-preview">Global defaults loaded from {loadResult.meta.globalDefaultsPath}</p>}
      </div>
      <RestoreNotice />
      <SearchProvidersPanel />
      {draft.isStale && <div className="gsd-restore-notice gsd-restore-notice--warning" role="alert"><span>This configuration changed on disk. Your draft was not saved.</span><Button size="sm" variant="secondary" onClick={() => void reloadAndDiscard()}>Reload and discard my draft</Button></div>}
      <ValidationSummary errors={mergedErrors} onJump={onJumpToField} />
      {draft.runtimeNotice && <RuntimeInstallNotice runtime={draft.runtimeNotice.runtime} settings={draft.runtimeNotice.settings} onDismiss={draft.dismissRuntimeNotice} />}
      {searchOpen && searchQuery.trim() ? <SearchView loadResult={loadResult} schema={schema} query={searchQuery} onOpenResult={(chapter: string, path: string) => { setActiveChapter(chapter); setHighlightTarget(path); setSearchOpen(false); }} /> :
        <ChapterView loadResult={loadResult} schema={schema} control={draft.form.control} onFieldChange={draft.onFieldChange} onResetField={draft.onResetField} />}
      <SaveBar status={status} errorCount={errorCount} changedCount={changedCount} onSave={handleSave} />
    </div>
  </FormProvider>;
}
