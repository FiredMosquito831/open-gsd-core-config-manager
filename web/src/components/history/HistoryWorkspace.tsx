import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listHistory, getHistorySnapshot } from '../../api/configs';
import { useUiStore } from '../../state/uiStore';
import { SnapshotTimeline, type SnapshotChangeCount } from './SnapshotTimeline';
import { buildComparison, SnapshotDiff } from './SnapshotDiff';

interface HistoryWorkspaceProps {
  configId?: string;
  configName?: string;
  configPath?: string;
  /** Compatibility seam for the forthcoming restore dialog; History never reads drafts. */
  draft?: object | null;
  viewportWidth?: number;
}

export function HistoryWorkspace({ configId: suppliedId, configName: suppliedName, configPath }: HistoryWorkspaceProps) {
  const { activeConfigId, selectedHistorySeq, selectHistorySnapshot, backToEditor } = useUiStore();
  const configId = suppliedId ?? activeConfigId;
  const configName = suppliedName ?? 'Selected configuration';
  const historyQuery = useQuery({ queryKey: ['history', configId], queryFn: () => listHistory(configId!), enabled: Boolean(configId) });
  const [counts, setCounts] = useState<Map<number, SnapshotChangeCount>>(new Map());
  const selectedDetail = useQuery({ queryKey: ['history', configId, selectedHistorySeq], queryFn: () => getHistorySnapshot(configId!, selectedHistorySeq!), enabled: Boolean(configId && selectedHistorySeq) });

  useEffect(() => {
    setCounts(new Map());
    selectHistorySnapshot(null);
  }, [configId, selectHistorySnapshot]);

  useEffect(() => {
    if (!selectedHistorySeq && historyQuery.data?.length) selectHistorySnapshot(historyQuery.data.reduce((latest, entry) => Math.max(latest, entry.seq), 0));
  }, [historyQuery.data, selectedHistorySeq, selectHistorySnapshot]);

  useEffect(() => {
    if (!selectedHistorySeq || !selectedDetail.data) return;
    const comparison = buildComparison(selectedDetail.data);
    setCounts((previous) => new Map(previous).set(selectedHistorySeq, comparison.summary));
  }, [selectedHistorySeq, selectedDetail.data]);

  if (!configId) return <main className="gsd-history" aria-label="Version history"><p>Select a configuration to view its saved versions.</p></main>;

  return <main className="gsd-history" aria-label="Version history">
    <header className="gsd-history__header">
      <div>
        <p className="gsd-history__eyebrow">Version history</p>
        <h1>{configName}</h1>
        {configPath && <p className="gsd-history__path">{configPath}</p>}
        <p className="gsd-history__target">Current saved file</p>
      </div>
      <button type="button" className="gsd-button gsd-button--secondary gsd-button--md" onClick={backToEditor}>Back to editor</button>
    </header>
    <div className="gsd-history__body">
      <aside className="gsd-history__timeline-pane" aria-label="Saved versions">
        {historyQuery.isLoading && <div className="gsd-history__state" role="status">Loading saved versions…</div>}
        {historyQuery.isError && <div className="gsd-history__state" role="alert"><p>Couldn’t load saved versions. Your config was not changed. Try again, or return to the editor.</p><button type="button" className="gsd-button gsd-button--secondary gsd-button--md" onClick={() => void historyQuery.refetch()}>Try again</button><button type="button" className="gsd-button gsd-button--ghost gsd-button--md" onClick={backToEditor}>Back to editor</button></div>}
        {historyQuery.data && historyQuery.data.length === 0 && <div className="gsd-history__state"><h2>No saved versions yet</h2><p>History starts after you change and successfully save this existing config. Your current file is not shown as a restorable version.</p><button type="button" className="gsd-button gsd-button--secondary gsd-button--md" onClick={backToEditor}>Back to editor</button></div>}
        {historyQuery.data && historyQuery.data.length > 0 && <SnapshotTimeline snapshots={historyQuery.data} selectedSeq={selectedHistorySeq} counts={counts} onSelect={selectHistorySnapshot} />}
      </aside>
      <section className="gsd-history__comparison-pane" aria-label="Snapshot comparison">
        {selectedHistorySeq && <SnapshotDiff sequence={selectedHistorySeq} detail={selectedDetail.data} isLoading={selectedDetail.isLoading} isError={selectedDetail.isError} onRetry={() => void selectedDetail.refetch()} />}
      </section>
    </div>
  </main>;
}
