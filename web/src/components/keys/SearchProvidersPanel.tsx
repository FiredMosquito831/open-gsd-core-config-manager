import { useCallback, useEffect, useMemo, useState } from 'react';
import { clearKey, listKeys, setKey } from '../../api/keys';
import type { KeyStatusDto } from '../../../../packages/server/src/api-types';
import { SEARCH_PROVIDERS, type SearchProvider } from '../../../../packages/server/src/keys/providers';
import { Icons } from '../common/Icons';
import { useToastStore } from '../../state/toastStore';

type Channel = 'file' | 'env' | 'both';

/**
 * Compact, inline view of every search provider's key state, rendered inside
 * the editor so the user can see what is configured and toggle providers
 * without leaving the page. Each row carries an on/off switch; configuring a
 * key or clearing it expands inline rather than opening a separate workspace.
 */
export function SearchProvidersPanel() {
  const pushToast = useToastStore((state) => state.push);
  const [keys, setKeys] = useState<KeyStatusDto[] | null>(null);
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [formValue, setFormValue] = useState('');
  const [channel, setChannel] = useState<Channel>('file');
  const [busy, setBusy] = useState<string | null>(null);

  const byProvider = useMemo(() => new Map((keys ?? []).map((k) => [k.provider, k])), [keys]);

  const refresh = useCallback(async () => {
    try {
      setKeys(await listKeys());
    } catch {
      setKeys([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const configured = keys?.filter((k) => k.configured).length ?? 0;
  const busyAny = busy !== null;

  const beginConfigure = (provider: string) => {
    setExpanded(provider);
    setFormValue('');
    setChannel('file');
  };

  const cancelConfigure = () => {
    setExpanded(null);
    setFormValue('');
  };

  const save = async (provider: string) => {
    if (!formValue.trim()) {
      pushToast('warning', 'Paste the API key before saving.');
      return;
    }
    setBusy(provider);
    try {
      const status = await setKey(provider, formValue, channel);
      setKeys((prev) => (prev ? prev.map((k) => (k.provider === status.provider ? status : k)) : [status]));
      pushToast('success', `Key saved for ${status.title}.`);
      setExpanded(null);
      setFormValue('');
    } catch (err) {
      pushToast('error', `Couldn't save the ${provider} key.`, err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (provider: string, title: string) => {
    setBusy(provider);
    try {
      const status = await clearKey(provider);
      setKeys((prev) => (prev ? prev.map((k) => (k.provider === status.provider ? status : k)) : [status]));
      pushToast('info', `Key removed for ${title}.`);
      if (expanded === provider) cancelConfigure();
    } catch (err) {
      pushToast('error', `Couldn't remove the ${title} key.`, err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="gsd-search-providers" aria-label="Search providers">
      <button
        type="button"
        className="gsd-search-providers__header"
        aria-expanded={open}
        aria-controls="search-providers-body"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="gsd-search-providers__title">
          <Icons.search size={16} aria-hidden="true" />
          Search providers
        </span>
        <span className="gsd-search-providers__count">
          {loading(keys) ? 'Checking…' : `${configured} of ${SEARCH_PROVIDERS.length}`}
          <Icons.chevronDown size={14} className={`gsd-search-providers__chevron ${open ? 'gsd-search-providers__chevron--open' : ''}`} aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div id="search-providers-body" className="gsd-search-providers__body">
          {SEARCH_PROVIDERS.map((provider) => (
            <ProviderRow
              key={provider.key}
              provider={provider}
              status={byProvider.get(provider.key)}
              expanded={expanded === provider.key}
              formValue={formValue}
              channel={channel}
              busy={busyAny}
              loading={loading(keys)}
              onBegin={() => beginConfigure(provider.key)}
              onCancel={cancelConfigure}
              onValueChange={setFormValue}
              onChannelChange={setChannel}
              onSave={() => save(provider.key)}
              onRemove={() => void remove(provider.key, provider.title)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function loading(keys: KeyStatusDto[] | null): boolean {
  return keys === null;
}

interface ProviderRowProps {
  provider: SearchProvider;
  status: KeyStatusDto | undefined;
  expanded: boolean;
  formValue: string;
  channel: Channel;
  busy: boolean;
  loading: boolean;
  onBegin(): void;
  onCancel(): void;
  onValueChange(v: string): void;
  onChannelChange(c: Channel): void;
  onSave(): void;
  onRemove(): void;
}

function ProviderRow({
  provider,
  status,
  expanded,
  formValue,
  channel,
  busy,
  loading,
  onBegin,
  onCancel,
  onValueChange,
  onChannelChange,
  onSave,
  onRemove,
}: ProviderRowProps) {
  const configured = status?.configured ?? false;
  const fileConfigured = status?.channels.file.configured ?? false;
  const envConfigured = status?.channels.envVar.configured ?? false;
  const path = status?.channels.file.path ?? `~/.gsd/${provider.fileSlug}`;
  const disabled = busy;

  return (
    <div className={`gsd-search-provider-row ${configured ? 'gsd-search-provider-row--configured' : ''}`}>
      <span className={`gsd-search-provider-row__icon ${configured ? 'gsd-search-provider-row__icon--on' : ''}`} aria-hidden="true">
        {configured ? <Icons.key size={16} /> : <Icons.search size={16} />}
      </span>

      <div className="gsd-search-provider-row__main">
        <div className="gsd-search-provider-row__title">
          <span className="gsd-search-provider-row__name">{provider.title}</span>
          <span className={`gsd-search-provider-row__badge ${configured ? 'gsd-search-provider-row__badge--on' : ''}`}>
            {loading ? '…' : configured ? 'On' : 'Off'}
          </span>
        </div>
        <div className="gsd-search-provider-row__channels">
          <span className="gsd-search-provider-row__channel">
            <code>{provider.envVar}</code>
            <span className={`gsd-search-provider-row__dot ${envConfigured ? 'gsd-search-provider-row__dot--on' : ''}`} aria-label={envConfigured ? 'env configured' : 'env not configured'}>●</span>
          </span>
          <span className="gsd-search-provider-row__channel">
            <code>{provider.fileSlug}</code>
            <span className={`gsd-search-provider-row__dot ${fileConfigured ? 'gsd-search-provider-row__dot--on' : ''}`} aria-label={fileConfigured ? 'file configured' : 'file not configured'}>●</span>
          </span>
        </div>
      </div>

      <div className="gsd-search-provider-row__actions">
        {configured ? (
          <>
            <button type="button" className="gsd-button gsd-button--ghost gsd-button--sm" disabled={disabled} onClick={onBegin}>
              {expanded ? 'Close' : 'Edit'}
            </button>
            <button type="button" className="gsd-button gsd-button--danger gsd-button--sm" disabled={disabled} onClick={onRemove}>
              Remove
            </button>
          </>
        ) : (
          <button type="button" className="gsd-button gsd-button--secondary gsd-button--sm" disabled={disabled} onClick={onBegin}>
            {expanded ? 'Close' : 'Add key'}
          </button>
        )}
      </div>

      {expanded && !configured && (
        <div className="gsd-search-provider-inline" role="group" aria-label={`Set key for ${provider.title}`}>
          <p className="gsd-search-provider-inline__explanation">
            GSD checks the environment variable <code>{provider.envVar}</code> and the key file <span className="gsd-search-provider-inline__path">{path}</span>. Either works.
          </p>
          <div className="gsd-search-provider-inline__field">
            <input
              className="gsd-input gsd-search-provider-inline__input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="Paste the provider key"
              value={formValue}
              onChange={(e) => onValueChange(e.target.value)}
            />
          </div>
          <div className="gsd-search-provider-inline__channels">
            {(['file', 'env', 'both'] as const).map((c) => (
              <label key={c}>
                <input type="radio" name={`sp-${provider.key}`} checked={channel === c} onChange={() => onChannelChange(c)} />
                {c === 'file' ? 'Key file' : c === 'env' ? 'Env variable' : 'Both'}
              </label>
            ))}
          </div>
          <div className="gsd-search-provider-inline__actions">
            <button type="button" className="gsd-button gsd-button--primary gsd-button--sm" disabled={disabled || !formValue.trim()} onClick={onSave}>
              Save key
            </button>
            <button type="button" className="gsd-button gsd-button--ghost gsd-button--sm" disabled={disabled} onClick={onCancel}>
              Cancel
            </button>
            {provider.homepage && (
              <a className="gsd-button gsd-button--ghost gsd-button--sm" href={provider.homepage} target="_blank" rel="noreferrer noopener">
                Get a key ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
