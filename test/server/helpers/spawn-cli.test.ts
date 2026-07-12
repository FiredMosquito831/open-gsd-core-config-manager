import { describe, expect, it } from 'vitest';
import { parseBannerUrl } from './spawn-cli.js';

describe('parseBannerUrl — banner URL parsing (DIST-01, DIST-04 harness foundation)', () => {
  it('extracts port and token from a realistic multi-line plain-mode banner chunk', () => {
    const chunk =
      'GSD Config Manager\n' +
      '\n' +
      '  ->  Local:   http://127.0.0.1:54321/?t=3f2504e0-4f89-41d3-9a0c-0305e82c3301\n' +
      '  ->  Press Ctrl+C to stop\n';

    const result = parseBannerUrl(chunk);

    expect(result).not.toBeNull();
    expect(result?.port).toBe(54321);
    expect(result?.token).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301');
    expect(result?.url).toBe('http://127.0.0.1:54321/?t=3f2504e0-4f89-41d3-9a0c-0305e82c3301');
  });

  it('returns null for a chunk with unrelated log noise and no banner URL', () => {
    const result = parseBannerUrl('some unrelated log line');
    expect(result).toBeNull();
  });

  it('does not match a URL with a non-loopback host', () => {
    const chunk = '  ->  Local:   http://example.com:54321/?t=3f2504e0-4f89-41d3-9a0c-0305e82c3301\n';
    const result = parseBannerUrl(chunk);
    expect(result).toBeNull();
  });

  it('does not match a URL missing a well-formed UUID token', () => {
    const chunk = '  ->  Local:   http://127.0.0.1:54321/?t=not-a-real-token\n';
    const result = parseBannerUrl(chunk);
    expect(result).toBeNull();
  });
});
