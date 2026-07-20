import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { inspectPinnedArchive } from '../../packages/server/src/upstream-archive.js';

const REQUIRED = [
  'gsd-core/bin/shared/config-schema.manifest.json',
  'gsd-core/bin/shared/config-defaults.manifest.json',
  'gsd-core/bin/lib/capability-registry.cjs',
  'docs/CONFIGURATION.md',
] as const;

const caps = {
  maxCompressedBytes: 8 * 1024 * 1024,
  maxDecompressedBytes: 32 * 1024 * 1024,
  maxRequiredFileBytes: 1024 * 1024,
  maxRetainedBytes: 4 * 1024 * 1024,
  maxEntries: 4_096,
  maxDepth: 12,
  maxHeaderBytes: 64 * 1024,
  maxMetadataRecords: 16,
  metadataTimeoutMs: 15_000,
  archiveTimeoutMs: 30_000,
};

function field(value: string, length: number): Buffer {
  const result = Buffer.alloc(length);
  result.write(value.slice(0, length), 'ascii');
  return result;
}

function tar(entries: Array<{ path: string; body?: string; type?: string }>): Uint8Array {
  const chunks: Buffer[] = [];
  for (const entry of entries) {
    const body = Buffer.from(entry.body ?? 'body');
    const header = Buffer.alloc(512);
    field(entry.path, 100).copy(header, 0);
    field('0000644\0', 8).copy(header, 100);
    field('00000000000\0', 12).copy(header, 124);
    field(body.length.toString(8).padStart(11, '0') + '\0', 12).copy(header, 124);
    field(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0', 12).copy(header, 136);
    header.fill(0x20, 148, 156);
    header[156] = (entry.type ?? '0').charCodeAt(0);
    field('ustar\0', 6).copy(header, 257);
    field('00', 2).copy(header, 263);
    const sum = header.reduce((total, value) => total + value, 0);
    field(sum.toString(8).padStart(6, '0') + '\0 ', 8).copy(header, 148);
    chunks.push(header, body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  return gzipSync(Buffer.concat([...chunks, Buffer.alloc(1024)]));
}

const inspect = (archive: Uint8Array, overrides: Partial<typeof caps> = {}) => inspectPinnedArchive(archive, { ...caps, ...overrides });

describe('inspectPinnedArchive', () => {
  it('accepts the complete official v1.7.0 commit-pinned GitHub archive (b1c9381b7abbf443f16c197118236b45cdd0486a)', () => {
    const archive = readFileSync(new URL('../fixtures/schema-refresh/official-github-archive.tar.gz', import.meta.url));
    const result = inspect(archive);

    expect(Object.keys(result.files).sort()).toEqual([...REQUIRED].sort());
    expect(result.entries).toBe(2702);
    expect(Object.values(result.files).every((content) => content.byteLength > 0)).toBe(true);
  });

  it('rejects a highly compressible archive before decompression exceeds the configured cap', () => {
    const archive = gzipSync(Buffer.alloc(33 * 1024 * 1024, 0));

    expect(() => inspect(archive)).toThrow();
  });

  it('retains only required regular-file bodies while safe unrelated files consume entry and byte budgets', () => {
    const archive = tar([
      ...REQUIRED.map((path) => ({ path: `prefix/${path}`, body: path })),
      { path: 'prefix/LICENSE', body: 'unrelated but safe' },
    ]);
    const result = inspect(archive);

    expect(Object.keys(result.files).sort()).toEqual([...REQUIRED].sort());
    expect(result.entries).toBe(5);
    expect(JSON.stringify(result)).not.toContain('unrelated but safe');
    expect(() => inspect(archive, { maxEntries: 4 })).toThrow();
    expect(() => inspect(archive, { maxDecompressedBytes: 64 })).toThrow();
  });

  it.each([
    ['absolute path', { path: '/outside', body: 'x' }],
    ['traversal path', { path: 'prefix/../outside', body: 'x' }],
    ['backslash-confused path', { path: 'prefix\\outside', body: 'x' }],
    ['symlink', { path: 'prefix/link', type: '2' }],
    ['hardlink', { path: 'prefix/link', type: '1' }],
    ['device', { path: 'prefix/device', type: '3' }],
    ['special entry', { path: 'prefix/other', type: '5' }],
  ])('fails closed for a non-allowlisted %s', (_name, hostile) => {
    expect(() => inspect(tar([...REQUIRED.map((path) => ({ path: `prefix/${path}`, body: path })), hostile]))).toThrow();
  });

  it('rejects duplicate and wrong-type required files, missing inputs, malformed headers, and hard caps', () => {
    const required = REQUIRED.map((path) => ({ path: `prefix/${path}`, body: path }));
    expect(() => inspect(tar([...required, required[0]!]))).toThrow();
    expect(() => inspect(tar([...required.slice(1), { path: `prefix/${REQUIRED[0]}`, type: '2' }]))).toThrow();
    expect(() => inspect(tar(required.slice(1)))).toThrow();
    const malformed = Buffer.from(tar(required)); malformed[10] ^= 0xff;
    expect(() => inspect(malformed)).toThrow();
    expect(() => inspect(tar(required), { maxCompressedBytes: 1 })).toThrow();
    expect(() => inspect(tar(required), { maxRequiredFileBytes: 1 })).toThrow();
    expect(() => inspect(tar(required), { archiveTimeoutMs: 0 })).toThrow();
  });

  it('rejects NUL or normalization-ambiguous names and PAX/GNU metadata not explicitly supported by the frozen fixture', () => {
    const required = REQUIRED.map((path) => ({ path: `prefix/${path}`, body: path }));
    const nul = tar([...required, { path: 'prefix/NUL\0suffix', body: 'x' }]);
    expect(() => inspect(nul)).toThrow();
    expect(() => inspect(tar([...required, { path: 'PaxHeader', type: 'x', body: '20 path=prefix/unsafe\n' }]))).toThrow();
    expect(() => inspect(tar([...required, { path: 'LongLink', type: 'L', body: 'prefix/unsafe\0' }]))).toThrow();
  });
});
