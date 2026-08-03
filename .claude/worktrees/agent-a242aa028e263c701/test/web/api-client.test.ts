// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../web/src/bootstrap/token.js', () => ({
  getLaunchToken: vi.fn(() => 'test-token-123'),
  consumeLaunchToken: vi.fn(),
}));

import { apiFetch, ApiError } from '../../web/src/api/client.js';
import * as configs from '../../web/src/api/configs.js';
import * as schema from '../../web/src/api/schema.js';
import * as workspace from '../../web/src/api/workspace.js';

afterEach(() => {
  vi.restoreAllMocks();
});

function mockJsonResponse(body: unknown, init: ResponseInit = { status: 200 }) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  });
}

function firstFetchCall() {
  const [url, init] = (vi.mocked(globalThis.fetch).mock.calls[0] ?? []) as [string, RequestInit | undefined];
  return { url: String(url), init };
}

describe('apiFetch', () => {
  it('attaches x-gsd-token to /api requests', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse({ ok: true }));
    await apiFetch('/api/configs');
    const { init } = firstFetchCall();
    const headers = new Headers(init?.headers);
    expect(headers.get('x-gsd-token')).toBe('test-token-123');
  });

  it('does not attach a token to non-/api requests', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse({ ok: true }));
    await apiFetch('/assets/main.js');
    const { init } = firstFetchCall();
    const headers = new Headers(init?.headers);
    expect(headers.has('x-gsd-token')).toBe(false);
  });

  it('returns typed ApiOk payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({ ok: true, configs: [{ id: '1', path: '/p', name: 'p/c' }] }),
    );
    const result = await apiFetch<{ configs: Array<{ id: string }> }>('/api/configs');
    expect(result.configs[0].id).toBe('1');
  });

  it('throws ApiError on ApiErr envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(mockJsonResponse({ ok: false, errors: [{ message: 'nope' }] })),
    );
    await expect(apiFetch('/api/configs')).rejects.toBeInstanceOf(ApiError);
    try {
      await apiFetch('/api/configs');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).errors).toEqual([{ message: 'nope' }]);
    }
  });

  it('preserves caller-supplied headers', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse({ ok: true }));
    await apiFetch('/api/configs', { headers: { 'x-extra': 'yes' } });
    const { init } = firstFetchCall();
    const headers = new Headers(init?.headers);
    expect(headers.get('x-gsd-token')).toBe('test-token-123');
    expect(headers.get('x-extra')).toBe('yes');
  });

  it('never puts the token in a URL query string', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse({ ok: true }));
    await apiFetch('/api/configs');
    const { url } = firstFetchCall();
    expect(url).not.toContain('token');
    expect(url).not.toContain('?');
  });

  it('throws a generic error on non-JSON responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not json', { status: 200 }));
    await expect(apiFetch('/api/configs')).rejects.toThrow(/JSON/);
  });
});

describe('route wrappers', () => {
  it('configs.listConfigs calls /api/configs', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse({ ok: true, configs: [] }));
    await configs.listConfigs();
    expect(fetchSpy).toHaveBeenCalledWith('/api/configs', expect.any(Object));
  });

  it('configs.trackConfig POSTs /api/configs/track', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({ ok: true, config: { id: 'x', path: '/p', name: 'p/c' } }),
    );
    await configs.trackConfig('/p');
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/configs/track',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ path: '/p' }) }),
    );
  });

  it('configs.loadConfig GETs /api/configs/:id', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse({ ok: true, data: {} }));
    await configs.loadConfig('id-123');
    expect(fetchSpy).toHaveBeenCalledWith('/api/configs/id-123', expect.any(Object));
  });

  it('configs.saveConfig PUTs the candidate', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse({ ok: true, snapshotId: 's1' }));
    await configs.saveConfig('id-123', { mode: 'interactive' });
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/configs/id-123',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ config: { mode: 'interactive' } }) }),
    );
  });

  it('schema.getSchema calls /api/schema', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse({ ok: true, schema: {} }));
    await schema.getSchema();
    expect(fetchSpy).toHaveBeenCalledWith('/api/schema', expect.any(Object));
  });

  it('workspace.listWorkspaceConfigs calls /api/workspace/configs', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse({ ok: true, configs: [] }));
    await workspace.listWorkspaceConfigs();
    expect(fetchSpy).toHaveBeenCalledWith('/api/workspace/configs', expect.any(Object));
  });
});
