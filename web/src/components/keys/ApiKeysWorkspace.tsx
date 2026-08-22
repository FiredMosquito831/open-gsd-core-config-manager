import { useCallback, useEffect, useMemo, useState } from 'react';
import { clearKey, getKey, listKeys, setKey } from '../../api/keys';
import type { KeyStatusDto } from '../../../../packages/server/src/api-types';
import { useUiStore } from '../../state/uiStore';
import type { SearchProvider } from '../../../../packages/server/src/keys/providers';
import { SEARCH_PROVIDERS } from '../../../../packages/server/src/keys/providers';

type Channel = 'file' | 'env' | 'both';

interface FormState {
  provider: string;
  value: string;
  channel: Channel;
}

function mask(value: string): string {
  if (value.length <= 8) return '•'.repeat(value.length);
  return `${value.slice(0, 4)}${'•'.repeat(Math.min(12, value.length - 8))}${value.slice(-4)}`;
}

export function ApiKeysWorkspace() {
  const backToEditor = useUiStore((state) => state.backToEditor);
  const [keys, setKeys] = useState<KeyStatusDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({ provider: SEARCH_PROVIDERS[0].key, value: '', channel: 'file' });
  const [notice, setNotice] = useState('');

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

  const configured = keys?.filter((k) => k.configured).length ?? 0;

  const handleSave = async () => {
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
      setNotice(form.value ? `Key saved for ${status.title}.` : `Key cleared for ${status.title}.`);
      setForm((f) => ({ ...f, value: '' }));
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
      setNotice(`Key cleared for ${status.title}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear the key.');
    } finally {
      setSaving(false);
    }
  };

  const selectedStatus = byProvider.get(form.provider);

  return (
    <section className="gsd-keys-workspace" aria-label="Search API keys">
      <div className="gsd-keys-workspace__header">
        <button type="button" className="gsd-button gsd-button--ghost gsd-button--md" onClick={backToEditor}>Back to editor</button>
        <div>
          <p className="gsd-keys-workspace__eyebrow">Configuration</p>
          <h1>Search API keys</h1>
          <p>Configure the API keys that power GSD&apos;s optional search providers. A key can be delivered via an environment variable or a stored key file &mdash; either channel works.</p>
        </div>
        <p className="gsd-keys-workspace__summary" role="status" aria-live="polite">{configured} of {SEARCH_PROVIDERS.length} providers configured</p>
      </div>

      {error && <div className="gsd-keys-workspace__alert" role="alert">{error}</div>}
      {notice && !error && <div className="gsd-keys-workspace__notice" role="status">{notice}</div>}

      <div className="gsd-keys-workspace__body">
        <section className="gsd-keys-workspace__list" aria-label="Provider key status">
          <h2>Providers</h2>
          {loading ? (
            <p>Loading key status…</p>
          ) : (
            <ul className="gsd-keys-list">
              {SEARCH_PROVIDERS.map((provider) => {
                const status = byProvider.get(provider.key);
                const fileConfigured = status?.channels.file.configured ?? false;
                const envConfigured = status?.channels.envVar.configured ?? false;
                return (
                  <li key={provider.key} className={`gsd-keys-list__item ${status?.configured ? 'gsd-keys-list__item--configured' : ''}`}>
                    <div className="gsd-keys-list__main">
                      <div className="gsd-keys-list__title">
                        <h3>{provider.title}</h3>
                        {status?.configured ? (
                          <span className="gsd-keys-list__badge gsd-keys-list__badge--on">Key configured</span>
                        ) : (
                          <span className="gsd-keys-list__badge gsd-keys-list__badge--off">No key</span>
                        )}
                      </div>
                      <dl className="gsd-keys-list__channels">
                        <div>
                          <dt>Env variable</dt>
                          <dd><code>{provider.envVar}</code> {envConfigured ? <span className="gsd-keys-list__dot gsd-keys-list__dot--on" aria-label="configured">●</span> : <span className="gsd-keys-list__dot gsd-keys-list__dot--off" aria-label="not configured">●</span>}</dd>
                        </div>
                        <div>
                          <dt>Key file</dt>
                          <dd className="gsd-keys-list__file">
                            <code>{status?.channels.file.path ?? `~/.gsd/${provider.fileSlug}`}</code>
                            {fileConfigured ? <span className="gsd-keys-list__dot gsd-keys-list__dot--on" aria-label="configured">●</span> : <span className="gsd-keys-list__dot gsd-keys-list__dot--off" aria-label="not configured">●</span>}
                          </dd>
                        </div>
                      </dl>
                      {provider.homepage && (
                        <a className="gsd-keys-list__link" href={provider.homepage} target="_blank" rel="noreferrer noopener">Get a key ↗</a>
                      )}
                      {selectedStatus?.provider === provider.key && form.value === '' ? null : null}
                    </div>
                    <div className="gsd-keys-list__actions">
                      <button
                        type="button"
                        className="gsd-button gsd-button--danger gsd-button--sm"
                        disabled={saving || !status?.configured}
                        onClick={() => handleClear(provider.key)}
                      >
                        Clear
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="gsd-keys-workspace__form" aria-label="Set a key">
          <h2>Set a key</h2>
          <form
            className="gsd-keys-form"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
          >
            <label className="gsd-keys-form__label">
              Provider
              <select
                className="gsd-keys-form__select"
                value={form.provider}
                onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
              >
                {SEARCH_PROVIDERS.map((provider) => (
                  <option key={provider.key} value={provider.key}>
                    {provider.title} ({provider.key})
                  </option>
                ))}
              </select>
            </label>

            <label className="gsd-keys-form__label">
              API key
              <input
                className="gsd-keys-form__input"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-… (leave empty to clear)"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              />
            </label>

            {selectedStatus?.configured && form.value === '' && (
              <p className="gsd-keys-form__hint">
                Shows {mask((selectedStatus.channels.file.configured ? 'file:' : '') + (selectedStatus.channels.envVar.configured ? 'env' : '') || 'currently stored')}. Saving with an empty key clears it.
              </p>
            )}

            <fieldset className="gsd-keys-form__channels">
              <legend>Store via</legend>
              {(['file', 'env', 'both'] as const).map((channel) => (
                <label key={channel} className="gsd-keys-form__radio">
                  <input
                    type="radio"
                    name="key-channel"
                    value={channel}
                    checked={form.channel === channel}
                    onChange={() => setForm((f) => ({ ...f, channel }))}
                  />
                  {channel === 'file' ? 'Key file only' : channel === 'env' ? 'Environment variable only' : 'Both channels'}
                </label>
              ))}
            </fieldset>

            <div className="gsd-keys-form__actions">
              <button type="submit" className="gsd-button gsd-button--primary gsd-button--md" disabled={saving}>
                {saving ? 'Saving…' : form.value ? 'Save key' : 'Clear key'}
              </button>
              <button type="button" className="gsd-button gsd-button--ghost gsd-button--md" disabled={saving} onClick={() => void refresh()}>
                Refresh
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
  );
}
