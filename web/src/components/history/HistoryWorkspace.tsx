import { useEffect, useState } from 'react';
import { useProgressiveHistoryCounts } from '../../history/useProgressiveHistoryCounts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import { getHistorySnapshot, listHistory, loadConfig, restoreConfigSnapshot } from '../../api/configs';
import { useUiStore } from '../../state/uiStore';
import type { HistoryDraftController } from '../../editor/useConfigDraft';
import { useToastStore } from '../../state/toastStore';
import { SnapshotTimeline } from './SnapshotTimeline';
import { SnapshotDiff } from './SnapshotDiff';
import { RestoreDialogs, type RestoreDialogMode } from './RestoreDialogs';

interface HistoryWorkspaceProps {
  configId?: string;
  configName?: string;
  configPath?: string;
  /** Optional seam for the editor-owned draft lifecycle. */
  draft?: HistoryDraftController | null;
  /** Render inside AppShell's production main landmark rather than nesting one. */
  embedded?: boolean;
  viewportWidth?: number;
}

type RestoreError =
  | { kind: 'restore-failed'; reason: string }
  | { kind: 'restore-stale' }
  | { kind: 'draft-save-failed' }
  | { kind: 'reconciliation-failed' };

function safeRestoreReason(error: unknown) {
  if (error instanceof ApiError) {
    const message = error.message.toLowerCase();
    if (message.includes('validation')) return 'Fix the validation issue and try again.';
    if (message.includes('atomic') || message.includes('write')) return 'The file could not be safely written. Try again.';
  }
  return 'The restore could not be completed. Try again.';
}

export function HistoryWorkspace({ configId: suppliedId, configName: suppliedName, configPath, draft, embedded = false, viewportWidth }: HistoryWorkspaceProps) {
  const { activeConfigId, selectedHistorySeq, selectHistorySnapshot, backToEditor, showRestoreNotice } = useUiStore();
  const Container = embedded ? 'div' : 'main';
  const landmarkProps = embedded ? {} : { 'aria-label': `History for ${suppliedName ?? 'Selected configuration'}` };
  const queryClient = useQueryClient();
  const configId = suppliedId ?? activeConfigId;
  const configName = suppliedName ?? 'Selected configuration';
  const historyQuery = useQuery({ queryKey: ['history', configId], queryFn: () => listHistory(configId!), enabled: Boolean(configId) });
  const selectedDetail = useQuery({ queryKey: ['history', configId, selectedHistorySeq], queryFn: () => getHistorySnapshot(configId!, selectedHistorySeq!), enabled: Boolean(configId && selectedHistorySeq) });
  const { counts, terminalErrors: countErrors, retry: retryCount, clearTerminalError } = useProgressiveHistoryCounts(configId, historyQuery.data, selectedHistorySeq, selectedDetail.data);
  const retryTimelineCount = (sequence: number) => {
    if (sequence === selectedHistorySeq) {
      clearTerminalError(sequence);
      void selectedDetail.refetch();
      return;
    }
    retryCount(sequence);
  };
  const [dialogMode, setDialogMode] = useState<RestoreDialogMode | null>(null);
  const [summary, setSummary] = useState({ added: 0, removed: 0, changed: 0 });
  const [restoreError, setRestoreError] = useState<RestoreError | null>(null);
  const [pending, setPending] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  useEffect(() => {
    selectHistorySnapshot(null);
    setDialogMode(null);
    setRestoreError(null);
  }, [configId, selectHistorySnapshot]);

  useEffect(() => {
    if (!selectedHistorySeq && historyQuery.data?.length) selectHistorySnapshot(historyQuery.data.reduce((latest, entry) => Math.max(latest, entry.seq), 0));
  }, [historyQuery.data, selectedHistorySeq, selectHistorySnapshot]);


  const startRestore = (nextSummary: typeof summary) => {
    setSummary(nextSummary);
    setRestoreError(null);
    setDialogMode('review');
  };
  const confirmRestore = async () => {
    if (!configId || !selectedHistorySeq || pending) return;
    const selectedAtStart = selectedHistorySeq;
    const idAtStart = configId;
    if (dialogMode === 'review' && draft?.isDirty) {
      setDialogMode('dirty');
      return;
    }
    setPending(true);
    setRestoreError(null);
    try {
      const revision = selectedDetail.data?.currentRevision;
      if (!revision) return;
      const result = await restoreConfigSnapshot(idAtStart, selectedAtStart, revision);
      try {
        const reloaded = await loadConfig(idAtStart);
        if (useUiStore.getState().activeConfigId !== idAtStart) return;
        queryClient.setQueryData(['config', idAtStart], reloaded);
        draft?.resetFromServer(reloaded);
        await queryClient.invalidateQueries({ queryKey: ['history', idAtStart] });
        await queryClient.invalidateQueries({ queryKey: ['history', idAtStart, selectedAtStart] });
        setDialogMode(null);
        showRestoreNotice(idAtStart, selectedDetail.data?.snapshot.timestamp ?? new Date().toISOString(), Boolean(result.warning));
        useToastStore.getState().push('success', 'Snapshot restored');
        backToEditor();
      } catch {
        if (useUiStore.getState().activeConfigId === idAtStart) {
          setDialogMode(null);
          setRestoreError({ kind: 'reconciliation-failed' });
        }
      }
    } catch (error) {
      if (useUiStore.getState().activeConfigId === idAtStart) {
        setDialogMode(null);
        if (error instanceof ApiError && error.status === 409) { setRestoreError({ kind: 'restore-stale' }); }
        else { setRestoreError({ kind: 'restore-failed', reason: safeRestoreReason(error) }); useToastStore.getState().push('error', "Couldn't restore this snapshot", safeRestoreReason(error)); }
      }
    } finally { setPending(false); }
  };
  const saveDraftFirst = async () => {
    if (!draft || pending) return;
    setPending(true);
    try {
      const outcome = await draft.saveDraft();
      if (outcome === 'blocked') return;
      await queryClient.invalidateQueries({ queryKey: ['config', configId] });
      await queryClient.invalidateQueries({ queryKey: ['history', configId] });
      // Keep the selected snapshot selected and reopen the restore review so the
      // user can continue into the restore instead of starting over. The draft is
      // now clean, so confirming from this review proceeds with the restore.
      setDraftSaved(true);
      setDialogMode('review');
    } catch {
      setRestoreError({ kind: 'draft-save-failed' });
    } finally {
      setPending(false);
    }
  };

  const responsiveClass = viewportWidth !== undefined ? viewportWidth <= 768 ? ' gsd-history--stacked' : viewportWidth <= 900 ? ' gsd-history--compact' : '' : '';
  if (!configId) return <Container className={`gsd-history${responsiveClass}`} {...landmarkProps}><p>Select a configuration to view its saved versions.</p></Container>;
  const timestamp = selectedDetail.data?.snapshot.timestamp ?? new Date().toISOString();
  return <Container className={`gsd-history${responsiveClass}`} {...landmarkProps}>
    <header className="gsd-history__header">
      <div><p className="gsd-history__eyebrow">Version history</p><h1>{configName}</h1>{configPath && <p className="gsd-history__path">{configPath}</p>}<p className="gsd-history__target">Current saved file</p></div>
      <button type="button" className="gsd-button gsd-button--secondary gsd-button--md" onClick={backToEditor}>Back to editor</button>
    </header>
    {restoreError?.kind === 'restore-failed' && <div className="gsd-history__state" role="alert"><p>Couldn’t restore this snapshot. Your config was not changed. {restoreError.reason} Try again or return to the editor.</p><button type="button" className="gsd-button gsd-button--secondary gsd-button--md" onClick={() => setDialogMode('review')}>Try again</button><button type="button" className="gsd-button gsd-button--ghost gsd-button--md" onClick={backToEditor}>Back to editor</button></div>}
    {restoreError?.kind === 'restore-stale' && <div className="gsd-history__state" role="alert"><p>The configuration changed on disk. This snapshot was not restored; refresh the comparison before deciding what to restore.</p><button type="button" className="gsd-button gsd-button--secondary gsd-button--md" onClick={() => { setRestoreError(null); void selectedDetail.refetch(); }}>Refresh comparison</button><button type="button" className="gsd-button gsd-button--ghost gsd-button--md" onClick={backToEditor}>Back to editor</button></div>}
    {restoreError?.kind === 'draft-save-failed' && <div className="gsd-history__state" role="alert"><p>The draft could not be saved. Try again.</p></div>}
    {restoreError?.kind === 'reconciliation-failed' && <div className="gsd-history__state" role="alert"><p>The snapshot was restored, but the editor could not reload it. Return to the editor and reload.</p><button type="button" className="gsd-button gsd-button--secondary gsd-button--md" onClick={backToEditor}>Return to editor</button></div>}
    {dialogMode === 'review' && draftSaved && <div className="gsd-history__state gsd-history__state--info" role="status"><p>Draft saved. Review the snapshot before restoring — your current file becomes a new snapshot when you restore.</p></div>}
    <div className="gsd-history__body">
      <aside className="gsd-history__timeline-pane" aria-label="Saved versions">
        {historyQuery.isLoading && <div className="gsd-history__state" role="status">Loading saved versions…</div>}
        {historyQuery.isError && <div className="gsd-history__state" role="alert"><p>Couldn’t load saved versions. Your config was not changed. Try again, or return to the editor.</p><button type="button" className="gsd-button gsd-button--secondary gsd-button--md" onClick={() => void historyQuery.refetch()}>Try again</button><button type="button" className="gsd-button gsd-button--ghost gsd-button--md" onClick={backToEditor}>Back to editor</button></div>}
        {historyQuery.data && historyQuery.data.length === 0 && <div className="gsd-history__state"><h2>No saved versions yet</h2><p>This tool keeps your config safe by design. Every time you change and successfully save, it stores a restorable snapshot first — so a previous version is always recoverable and nothing is lost.</p><p>Until you make a change, there is nothing to restore, and your current file stays exactly as it is.</p><button type="button" className="gsd-button gsd-button--secondary gsd-button--md" onClick={backToEditor}>Back to editor</button></div>}
        {historyQuery.data && historyQuery.data.length > 0 && <SnapshotTimeline snapshots={historyQuery.data} selectedSeq={selectedHistorySeq} counts={counts} errors={countErrors} onRetry={retryTimelineCount} onSelect={selectHistorySnapshot} />}
      </aside>
      <section className="gsd-history__comparison-pane" aria-label="Snapshot comparison">
        {selectedHistorySeq && <SnapshotDiff sequence={selectedHistorySeq} detail={selectedDetail.data} isLoading={selectedDetail.isLoading} isError={selectedDetail.isError} onRetry={() => void selectedDetail.refetch()} onRestore={startRestore} />}
      </section>
    </div>
    <RestoreDialogs mode={dialogMode} configName={configName} timestamp={timestamp} summary={summary} pending={pending} onCancel={() => { setDraftSaved(false); !pending && setDialogMode(null); }} onConfirm={() => void confirmRestore()} onSaveDraft={() => void saveDraftFirst()} />
  </Container>;
}
