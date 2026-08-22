import { useEffect, useState } from 'react';
import { listKeys } from '../../api/keys';
import { useUiStore } from '../../state/uiStore';
import { Icons, Icon } from '../common/Icons';

/**
 * Rail control for the search-API-keys workspace (mirrors
 * SchemaStatusControl). Shows how many of the seven search providers have a
 * key configured (via either the env-var or key-file channel) and opens the
 * key-management workspace on click.
 */
export function ApiKeysStatusControl() {
  const openKeys = useUiStore((state) => state.openKeys);
  const setKeysStatus = useUiStore((state) => state.setKeysStatus);
  const [count, setCount] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let mounted = true;
    void Promise.resolve()
      .then(() => listKeys())
      .then((statuses) => {
        if (!mounted) return;
        setTotal(statuses.length);
        setCount(statuses.filter((s) => s.configured).length);
        setKeysStatus(statuses);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setBusy(false);
      });
    return () => {
      mounted = false;
    };
  }, [setKeysStatus]);

  const label = busy
    ? 'Loading search API keys…'
    : `Search API keys, ${count ?? 0} of ${total} configured. Open API key settings`;
  return (
    <div className="gsd-keys-status-control">
      <button
        type="button"
        className="gsd-rail-button gsd-keys-status-control__button"
        onClick={openKeys}
        aria-busy={busy}
        aria-label={label}
        title="Search API keys"
      >
        <Icons.key size={16} />
        {!busy && count !== null && total > 0 && (
          <span className="gsd-keys-status-control__count">{count}/{total}</span>
        )}
      </button>
    </div>
  );
}
