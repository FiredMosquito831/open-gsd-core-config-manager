import { useEffect, useState } from 'react';
import { useProgressiveHistoryCounts } from '../../history/useProgressiveHistoryCounts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import { getHistorySnapshot, listHistory, loadConfig, restoreConfigSnapshot } from '../../api/configs';
import { useUiStore } from '../../state/uiStore';
import type { HistoryDraftController } from '../../editor/useConfigDraft';
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
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
      const result = await restoreConfigSnapshot(idAtStart, selectedAtStart);
      const reloaded = await loadConfig(idAtStart);
      if (useUiStore.getState().activeConfigId !== idAtStart) return;
      queryClient.setQueryData(['config', idAtStart], reloaded);
      draft?.resetFromServer(reloaded);
      await queryClient.invalidateQueries({ queryKey: ['history', idAtStart] });
      await queryClient.invalidateQueries({ queryKey: ['history', idAtStart, selectedAtStart] });
      setDialogMode(null);
      showRestoreNotice(idAtStart, selectedDetail.data?.snapshot.timestamp ?? new Date().toISOString(), Boolean(result.warning));
      backToEditor();
    } catch (error) {
      if (useUiStore.getState().activeConfigId === idAtStart) {
        setDialogMode(null);
        setRestoreError(safeRestoreReason(error));
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
      setDialogMode(null);
    } catch {
      setRestoreError('The draft could not be saved. Try again.');
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
    {restoreError && <div className="gsd-history__state" role="alert"><p>Couldn’t restore this snapshot. Your config was not changed. {restoreError} Try again or return to the editor.</p><button type="button" className="gsd-button gsd-button--secondary gsd-button--md" onClick={() => setDialogMode('review')}>Try again</button><button type="button" className="gsd-button gsd-button--ghost gsd-button--md" onClick={backToEditor}>Back to editor</button></div>}
    <div className="gsd-history__body">
      <aside className="gsd-history__timeline-pane" aria-label="Saved versions">
        {historyQuery.isLoading && <div className="gsd-history__state" role="status">Loading saved versions…</div>}
        {historyQuery.isError && <div className="gsd-history__state" role="alert"><p>Couldn’t load saved versions. Your config was not changed. Try again, or return to the editor.</p><button type="button" className="gsd-button gsd-button--secondary gsd-button--md" onClick={() => void historyQuery.refetch()}>Try again</button><button type="button" className="gsd-button gsd-button--ghost gsd-button--md" onClick={backToEditor}>Back to editor</button></div>}
        {historyQuery.data && historyQuery.data.length === 0 && <div className="gsd-history__state"><h2>No saved versions yet</h2><p>History starts after you change and successfully save this existing config. Your current file is not shown as a restorable version.</p><button type="button" className="gsd-button gsd-button--secondary gsd-button--md" onClick={backToEditor}>Back to editor</button></div>}
        {historyQuery.data && historyQuery.data.length > 0 && <SnapshotTimeline snapshots={historyQuery.data} selectedSeq={selectedHistorySeq} counts={counts} errors={countErrors} onRetry={retryTimelineCount} onSelect={selectHistorySnapshot} />}
      </aside>
      <section className="gsd-history__comparison-pane" aria-label="Snapshot comparison">
        {selectedHistorySeq && <SnapshotDiff sequence={selectedHistorySeq} detail={selectedDetail.data} isLoading={selectedDetail.isLoading} isError={selectedDetail.isError} onRetry={() => void selectedDetail.refetch()} onRestore={startRestore} />}
      </section>
    </div>
    <RestoreDialogs mode={dialogMode} configName={configName} timestamp={timestamp} summary={summary} pending={pending} onCancel={() => !pending && setDialogMode(null)} onConfirm={() => void confirmRestore()} onSaveDraft={() => void saveDraftFirst()} />
  </Container>;
}
