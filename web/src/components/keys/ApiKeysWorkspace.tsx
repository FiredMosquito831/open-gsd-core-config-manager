import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clearKey, listKeys, setKey } from '../../api/keys';
import type { KeyStatusDto } from '../../../../packages/server/src/api-types';
import type { SearchProvider } from '../../../../packages/server/src/keys/providers';
import { SEARCH_PROVIDERS } from '../../../../packages/server/src/keys/providers';
import { Icons } from '../common/Icons';
import { useUiStore } from '../../state/uiStore';
import { useToastStore } from '../../state/toastStore';

type Channel = 'file' | 'env' | 'both';

interface FormState {
  provider: string;
  value: string;
  channel: Channel;
}

const focusable = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function providerTitle(provider: string): string {
  return SEARCH_PROVIDERS.find((item) => item.key === provider)?.title ?? provider;
}

export function ApiKeysWorkspace() {
  const backToEditor = useUiStore((state) => state.backToEditor);
  const [keys, setKeys] = useState<KeyStatusDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({ provider: SEARCH_PROVIDERS[0].key, value: '', channel: 'file' });
  const [notice, setNotice] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [clearProvider, setClearProvider] = useState<string | null>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);
  const clearDialogRef = useRef<HTMLDivElement>(null);
  const cancelClearRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const providerMeta = useMemo(() => new Map(SEARCH_PROVIDERS.map((p) => [p.key, p as SearchProvider])), []);
  const byProvider = useMemo(() => new Map((keys ?? []).map((k) => [k.provider, k])), [keys]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setKeys(await listKeys());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load key status.');
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!clearProvider) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const page = document.getElementById('root');
    page?.setAttribute('inert', '');
    cancelClearRef.current?.focus();
    return () => {
      page?.removeAttribute('inert');
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    };
  }, [clearProvider]);

  const configured = keys?.filter((k) => k.configured).length ?? 0;
  const selectedStatus = byProvider.get(form.provider);
  const selectedProvider = providerMeta.get(form.provider);
  const selectedPath = selectedStatus?.channels.file.path ?? (selectedProvider ? `~/.gsd/${selectedProvider.fileSlug}` : '');

  const selectProvider = (provider: string) => {
    setForm((current) => ({ ...current, provider, value: '' }));
    setShowSecret(false);
    window.requestAnimationFrame(() => keyInputRef.current?.focus());
  };

  const handleSave = async () => {
    if (!form.value.trim()) {
      setError('Enter an API key before saving. To remove a saved key, choose Remove on its provider row.');
      setNotice('');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice('');
    try {
      if (!providerMeta.has(form.provider)) {
        setError('Select a provider.');
        return;
      }
      const status = await setKey(form.provider, form.value, form.channel);
      setKeys((prev) => (prev ? prev.map((k) => (k.provider === status.provider ? status : k)) : [status]));
      setNotice('');
      useToastStore.getState().push('success', `Key saved for ${status.title}.`);
      setForm((current) => ({ ...current, value: '' }));
      setShowSecret(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the key.');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async (provider: string) => {
    setSaving(true);
    setError(null);
    setNotice('');
    try {
      const status = await clearKey(provider);
      setKeys((prev) => (prev ? prev.map((k) => (k.provider === status.provider ? status : k)) : [status]));
      setNotice('');
      useToastStore.getState().push('info', `Key removed for ${status.title}.`);
      if (form.provider === provider) setForm((current) => ({ ...current, value: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove the key.');
    } finally {
      setSaving(false);
    }
  };

  const confirmClear = async () => {
    if (!clearProvider) return;
    const provider = clearProvider;
    await handleClear(provider);
    setClearProvider(null);
  };

  const clearStatus = clearProvider ? byProvider.get(clearProvider) : undefined;
  const clearMeta = clearProvider ? providerMeta.get(clearProvider) : undefined;
  const clearPath = clearStatus?.channels.file.path ?? (clearMeta ? `~/.gsd/${clearMeta.fileSlug}` : '');
  const clearHasFile = clearStatus?.channels.file.configured ?? false;
  const clearHasEnv = clearStatus?.channels.envVar.configured ?? false;

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !saving) {
      event.preventDefault();
      setClearProvider(null);
      return;
    }
    if (event.key !== 'Tab') return;
    const items = Array.from(clearDialogRef.current?.querySelectorAll<HTMLElement>(focusable) ?? []);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return (
    <section className="gsd-keys-workspace" aria-label="Search API keys">
      <div className="gsd-keys-workspace__header">
        <button type="button" className="gsd-button gsd-button--ghost gsd-button--md" onClick={backToEditor}>Back to editor</button>
        <div>
          <p className="gsd-keys-workspace__eyebrow">Configuration</p>
          <h1>Search API keys</h1>
          <p>Configure the API keys that power GSD&apos;s optional search providers.</p>
        </div>
        <p className="gsd-keys-workspace__summary" role="status" aria-live="polite">{configured} of {SEARCH_PROVIDERS.length} providers configured</p>
      </div>

      {error && <div className="gsd-keys-workspace__alert" role="alert">{error}</div>}
      {notice && !error && <div className="gsd-keys-workspace__notice" role="status">{notice}</div>}

      <div className="gsd-keys-workspace__body">
        <section className="gsd-keys-workspace__list" aria-label="Provider key status">
          <h2>Providers</h2>
          <p className="gsd-keys-workspace__list-help">Choose a provider to edit its key. GSD checks the file and environment variable locations shown here.</p>
          {loading ? (
            <p role="status">Loading key status…</p>
          ) : (
            <ul className="gsd-keys-list">
              {SEARCH_PROVIDERS.map((provider) => {
                const status = byProvider.get(provider.key);
                const fileConfigured = status?.channels.file.configured ?? false;
                const envConfigured = status?.channels.envVar.configured ?? false;
                const selected = form.provider === provider.key;
                return (
                  <li key={provider.key} className={`gsd-keys-list__item ${status?.configured ? 'gsd-keys-list__item--configured' : ''} ${selected ? 'gsd-keys-list__item--selected' : ''}`}>
                    <button
                      type="button"
                      className="gsd-keys-list__select"
                      aria-pressed={selected}
                      onClick={() => selectProvider(provider.key)}
                    >
                      <span className="gsd-keys-list__main">
                        <span className="gsd-keys-list__title">
                          <span className="gsd-keys-list__provider-title">{provider.title}</span>
                          {status?.configured ? (
                            <span className="gsd-keys-list__badge gsd-keys-list__badge--on">Configured</span>
                          ) : (
                            <span className="gsd-keys-list__badge gsd-keys-list__badge--off">No key</span>
                          )}
                        </span>
                        <span className="gsd-keys-list__channels">
                          <span>
                            <span className="gsd-keys-list__channel-label">Environment variable</span>
                            <span className="gsd-keys-list__channel-value"><code>{provider.envVar}</code> <span className={`gsd-keys-list__dot gsd-keys-list__dot--${envConfigured ? 'on' : 'off'}`} aria-label={envConfigured ? 'configured' : 'not configured'}>●</span></span>
                          </span>
                          <span>
                            <span className="gsd-keys-list__channel-label">Key file</span>
                            <span className="gsd-keys-list__channel-value gsd-keys-list__file"><code>{status?.channels.file.path ?? `~/.gsd/${provider.fileSlug}`}</code> <span className={`gsd-keys-list__dot gsd-keys-list__dot--${fileConfigured ? 'on' : 'off'}`} aria-label={fileConfigured ? 'configured' : 'not configured'}>●</span></span>
                          </span>
                        </span>
                      </span>
                    </button>
                    <span className="gsd-keys-list__actions">
                      {provider.homepage && (
                        <a className="gsd-keys-list__link" href={provider.homepage} target="_blank" rel="noreferrer noopener">Get a key ↗</a>
                      )}
                      <button
                        type="button"
                        className="gsd-button gsd-button--ghost gsd-button--sm gsd-keys-list__remove"
                        disabled={saving || !status?.configured}
                        onClick={() => setClearProvider(provider.key)}
                      >
                        Remove
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="gsd-keys-workspace__form" aria-label={`Set a key for ${selectedProvider?.title ?? form.provider}`}>
          <div className="gsd-keys-form__heading">
            <p className="gsd-keys-workspace__eyebrow">Selected provider</p>
            <h2>{selectedProvider?.title ?? form.provider}</h2>
          </div>
          <p className="gsd-keys-form__explanation">
            The key file <code>{selectedPath}</code> is saved on this machine and survives restarts. The environment variable <code>{selectedProvider?.envVar ?? selectedStatus?.envVar ?? ''}</code> is read by shells and CI. GSD checks both locations, so either works.
          </p>
          <p className="gsd-keys-form__path"><span>Resolved key-file path</span><code>{selectedPath}</code></p>
          <form
            className="gsd-keys-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
            }}
          >
            <label className="gsd-keys-form__label" htmlFor="gsd-api-key-input">API key</label>
            <div className="gsd-keys-form__secret-wrap">
              <input
                ref={keyInputRef}
                id="gsd-api-key-input"
                className="gsd-keys-form__input"
                type={showSecret ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                placeholder="Paste the provider key"
                value={form.value}
                aria-describedby="gsd-api-key-help"
                onChange={(event) => {
                  setForm((current) => ({ ...current, value: event.target.value }));
                  setError(null);
                }}
              />
              <button
                type="button"
                className="gsd-keys-form__visibility"
                aria-label={showSecret ? 'Hide API key' : 'Show API key'}
                aria-pressed={showSecret}
                onClick={() => setShowSecret((visible) => !visible)}
              >
                {showSecret ? <Icons.eyeOff size={17} aria-hidden="true" /> : <Icons.eye size={17} aria-hidden="true" />}
              </button>
            </div>
            <p id="gsd-api-key-help" className="gsd-keys-form__hint">
              {selectedStatus?.configured
                ? 'A key is already configured. Enter a new key to replace it, or use Remove on this provider row to delete the saved locations.'
                : 'Your key is never shown after saving. Use Remove on a configured provider to delete its saved locations.'}
            </p>

            <fieldset className="gsd-keys-form__channels">
              <legend>Where should GSD read this key?</legend>
              <p className="gsd-keys-form__channels-help">Choose the location that fits how you run GSD. Both options are supported.</p>
              {(['file', 'env', 'both'] as const).map((channel) => (
                <label key={channel} className="gsd-keys-form__radio">
                  <input
                    type="radio"
                    name="key-channel"
                    value={channel}
                    checked={form.channel === channel}
                    onChange={() => setForm((current) => ({ ...current, channel }))}
                  />
                  <span>
                    <strong>{channel === 'file' ? 'Key file' : channel === 'env' ? 'Environment variable' : 'Both locations'}</strong>
                    <small>{channel === 'file' ? `Saved on this machine at ${selectedPath}.` : channel === 'env' ? `Read from ${selectedProvider?.envVar ?? selectedStatus?.envVar ?? 'the provider variable'} in shells and CI.` : 'Keep a local file and an environment variable available; GSD checks both.'}</small>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="gsd-keys-form__actions">
              <button type="submit" className="gsd-button gsd-button--primary gsd-button--md" disabled={saving || !form.value.trim()} aria-busy={saving}>
                {saving ? 'Saving…' : 'Save key'}
              </button>
              <button type="button" className="gsd-button gsd-button--ghost gsd-button--md" disabled={saving} onClick={() => void refresh()}>
                Refresh
              </button>
            </div>
          </form>
        </section>
      </div>

      {clearProvider && clearMeta && createPortal(
        <div className="gsd-keys-clear-dialog__backdrop">
          <div
            ref={clearDialogRef}
            className="gsd-keys-clear-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="gsd-clear-key-title"
            aria-describedby="gsd-clear-key-description"
            onKeyDown={handleDialogKeyDown}
          >
            <div className="gsd-keys-clear-dialog__icon" aria-hidden="true"><Icons.warning size={20} /></div>
            <h2 id="gsd-clear-key-title">Remove {clearMeta.title} API key?</h2>
            <div id="gsd-clear-key-description" className="gsd-keys-clear-dialog__content">
              <p>This will delete the stored key file <code>{clearPath}</code>{clearHasEnv ? <> and remove the configured <code>{clearMeta.envVar}</code> environment-variable channel.</> : clearHasFile ? <>. The environment variable <code>{clearMeta.envVar}</code> is not currently configured here.</> : <>. It will not affect your provider account.</>}</p>
              <p className="gsd-keys-clear-dialog__warning"><Icons.warning size={16} aria-hidden="true" /> This cannot be undone.</p>
            </div>
            <div className="gsd-keys-clear-dialog__actions">
              <button ref={cancelClearRef} type="button" className="gsd-button gsd-button--ghost gsd-button--md" disabled={saving} onClick={() => setClearProvider(null)}>Cancel</button>
              <button type="button" className="gsd-button gsd-button--danger gsd-button--md" disabled={saving} onClick={() => void confirmClear()} aria-busy={saving}>{saving ? 'Deleting…' : 'Delete key file'}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
