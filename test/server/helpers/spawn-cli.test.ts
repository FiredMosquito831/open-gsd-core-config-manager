import { describe, expect, it } from 'vitest';
import { parseBannerUrl } from './spawn-cli.js';

describe('parseBannerUrl — banner URL parsing (DIST-01, DIST-04 harness foundation)', () => {
  it('extracts the port from a realistic multi-line plain-mode banner chunk', () => {
    const chunk =
      'GSD Config Manager\n' +
      '\n' +
      '  ->  Local:   http://127.0.0.1:54321/\n' +
      '  ->  Press Ctrl+C to stop\n';

    const result = parseBannerUrl(chunk);

    expect(result).not.toBeNull();
    expect(result?.port).toBe(54321);
    expect(result?.url).toBe('http://127.0.0.1:54321/');
  });

  it('returns null for a chunk with unrelated log noise and no banner URL', () => {
    const result = parseBannerUrl('some unrelated log line');
    expect(result).toBeNull();
  });

  it('does not match a URL with a non-loopback host', () => {
    const chunk = '  ->  Local:   http://example.com:54321/\n';
    const result = parseBannerUrl(chunk);
    expect(result).toBeNull();
  });
});
