import { useEffect, useState } from 'react';
import type { SchemaStatusDto } from '../../../../packages/server/src/api-types';
import { getSchemaStatus } from '../../api/schema';
import { useUiStore } from '../../state/uiStore';

export function SchemaStatusControl() {
  const openSchemaMaintenance = useUiStore((state) => state.openSchemaMaintenance);
  const [status, setStatus] = useState<SchemaStatusDto>();
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let mounted = true;
    // Keep the rail control inert when legacy shallow test mocks omit a return
    // value, while real request errors still settle the busy state safely.
    void Promise.resolve().then(() => getSchemaStatus()).then((value) => {
      if (mounted) setStatus(value);
    }).catch(() => undefined).finally(() => {
      if (mounted) setBusy(false);
    });
    return () => { mounted = false; };
  }, []);
  const source = status?.source === 'refreshed' ? 'Refreshed' : 'Bundled';
  const version = status?.gsdCoreVersion ?? 'schema unavailable';
  const sourceDate = status?.source === 'refreshed' ? status.activatedAt : status?.generatedAt;
  const date = sourceDate ? new Date(sourceDate).toLocaleDateString() : 'date unavailable';
  return <div className="gsd-schema-status-control">
    <button type="button" className="gsd-rail-button gsd-schema-status-control__button" onClick={openSchemaMaintenance} aria-busy={busy} aria-label={`${source} schema, gsd-core v${version}, ${date}. Open schema maintenance`}>
      <span aria-hidden="true">{source === 'Refreshed' ? 'R' : 'B'}</span><span className="gsd-schema-status-control__text">{source} · gsd-core v{version}</span>
    </button>
    {status?.warning && <span className="gsd-schema-status-control__warning" role="alert">Schema warning</span>}
  </div>;
}
