import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { HistorySnapshotDetail, HistorySnapshotMeta } from '../../../packages/server/src/api-types';
import { getHistorySnapshot } from '../api/configs';
import { buildHistoryComparison } from './compare';
import type { SnapshotChangeCount } from '../components/history/SnapshotTimeline';

/** Maximum number of nonselected snapshot-detail request groups allowed at once. */
export const MAX_BACKGROUND_HISTORY_DETAILS = 2;

const RETRY_DELAYS = [250, 500] as const;

type CountState = Map<number, SnapshotChangeCount>;

interface ProgressiveHistoryCounts {
  counts: CountState;
  terminalErrors: Set<number>;
  retry: (sequence: number) => void;
  clearTerminalError: (sequence: number) => void;
}

function countDetail(detail: HistorySnapshotDetail): SnapshotChangeCount {
  return buildHistoryComparison(detail.snapshot.document, detail.current).summary;
}

/**
 * Resolves every listed snapshot's exact redacted Snapshot → Current count without
 * allowing timeline work to contend with the separately-owned selected-detail query.
 */
export function useProgressiveHistoryCounts(
  configId: string | null | undefined,
  snapshots: HistorySnapshotMeta[] | undefined,
  selectedSeq: number | null,
  selectedDetail: HistorySnapshotDetail | undefined,
): ProgressiveHistoryCounts {
  const queryClient = useQueryClient();
  const [counts, setCounts] = useState<CountState>(new Map());
  const [terminalErrors, setTerminalErrors] = useState<Set<number>>(new Set());
  const [retryGeneration, setRetryGeneration] = useState(0);
  const retrySequence = useRef<number | null>(null);
  const selectedRef = useRef(selectedSeq);
  selectedRef.current = selectedSeq;

  const identity = `${configId ?? ''}:${(snapshots ?? []).map((snapshot) => snapshot.seq).join(',')}`;

  // Selection is deliberately excluded: it changes request ownership, not the
  // authoritative config/list generation, so settled timeline facts stay visible.
  useEffect(() => {
    if (!configId || !selectedSeq || !selectedDetail) return;
    const validSequences = new Set((snapshots ?? []).map((snapshot) => snapshot.seq));
    if (!validSequences.has(selectedSeq)) return;
    setCounts((previous) => new Map(previous).set(selectedSeq, countDetail(selectedDetail)));
    setTerminalErrors((previous) => {
      if (!previous.has(selectedSeq)) return previous;
      const next = new Set(previous); next.delete(selectedSeq); return next;
    });
  }, [configId, identity, selectedDetail, selectedSeq, snapshots]);

  useEffect(() => {
    let active = true;
    let running = 0;
    let queued = [...(snapshots ?? []).map((snapshot) => snapshot.seq)];
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const validSequences = new Set(queued);
    const retryNow = retrySequence.current;
    retrySequence.current = null;

    setCounts(new Map());
    setTerminalErrors(new Set());

    if (!configId || queued.length === 0) return () => { active = false; };

    const install = (sequence: number, detail: HistorySnapshotDetail) => {
      if (!active || !validSequences.has(sequence)) return;
      setCounts((previous) => new Map(previous).set(sequence, countDetail(detail)));
      setTerminalErrors((previous) => {
        if (!previous.has(sequence)) return previous;
        const next = new Set(previous);
        next.delete(sequence);
        return next;
      });
    };

    if (selectedSeq && selectedDetail && validSequences.has(selectedSeq)) install(selectedSeq, selectedDetail);

    const fetchOne = async (sequence: number, attempt = 0): Promise<void> => {
      try {
        const key = ['history', configId, sequence] as const;
        const cached = queryClient.getQueryData<HistorySnapshotDetail>(key);
        const detail = cached ?? await queryClient.fetchQuery({ queryKey: key, queryFn: () => getHistorySnapshot(configId, sequence), retry: false });
        if (!detail) throw new Error('History detail unavailable');
        install(sequence, detail);
      } catch {
        if (!active) return;
        if (attempt < RETRY_DELAYS.length) {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(() => { timers.delete(timer); resolve(); }, RETRY_DELAYS[attempt]);
            timers.add(timer);
          });
          if (active) await fetchOne(sequence, attempt + 1);
          return;
        }
        if (validSequences.has(sequence)) setTerminalErrors((previous) => new Set(previous).add(sequence));
      }
    };

    const pump = () => {
      if (!active) return;
      // A freshly selected row is owned by useQuery and must never wait in a worker.
      queued = queued.filter((sequence) => sequence !== selectedRef.current);
      while (running < MAX_BACKGROUND_HISTORY_DETAILS && queued.length) {
        const sequence = queued.shift()!;
        running += 1;
        void fetchOne(sequence).finally(() => {
          running -= 1;
          pump();
        });
      }
    };

    // An explicit Retry is placed first but remains subject to the same bound.
    if (retryNow !== null && validSequences.has(retryNow) && retryNow !== selectedSeq) {
      queued = [retryNow, ...queued.filter((sequence) => sequence !== retryNow)];
    }
    pump();

    return () => {
      active = false;
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [configId, identity, queryClient, retryGeneration]);

  const retry = useCallback((sequence: number) => {
    retrySequence.current = sequence;
    // A state update gives the effect a new generation without exposing stale terminal UI.
    setTerminalErrors((previous) => {
      const next = new Set(previous);
      next.delete(sequence);
      return next;
    });
    setRetryGeneration((generation) => generation + 1);
  }, []);

  const clearTerminalError = useCallback((sequence: number) => {
    setTerminalErrors((previous) => {
      if (!previous.has(sequence)) return previous;
      const next = new Set(previous); next.delete(sequence); return next;
    });
  }, []);

  return { counts, terminalErrors, retry, clearTerminalError };
}
