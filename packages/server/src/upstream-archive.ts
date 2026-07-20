import { gunzipSync } from 'node:zlib';

export interface ArchiveLimits {
  maxCompressedBytes: number;
  maxDecompressedBytes: number;
  maxRequiredFileBytes: number;
  maxRetainedBytes: number;
  maxEntries: number;
  maxDepth: number;
  maxHeaderBytes: number;
  maxMetadataRecords: number;
  metadataTimeoutMs: number;
  archiveTimeoutMs: number;
}

export interface InspectedArchive {
  files: Record<string, Uint8Array>;
  entries: number;
}

const REQUIRED = new Set([
  'gsd-core/bin/shared/config-schema.manifest.json',
  'gsd-core/bin/shared/config-defaults.manifest.json',
  'gsd-core/bin/lib/capability-registry.cjs',
  'docs/CONFIGURATION.md',
]);

const BLOCK_SIZE = 512;

function fail(message: string): never {
  throw new Error(`Invalid upstream archive: ${message}`);
}

function expired(start: number, maxMs: number): boolean {
  return maxMs <= 0 || Date.now() - start > maxMs;
}

function readString(header: Uint8Array, offset: number, length: number): string {
  const slice = header.subarray(offset, offset + length);
  const nul = slice.indexOf(0);
  const bytes = nul === -1 ? slice : slice.subarray(0, nul);
  return Buffer.from(bytes).toString('utf8');
}

function readOctal(header: Uint8Array, offset: number, length: number): number {
  const raw = readString(header, offset, length).trim();
  if (!/^[0-7]*$/u.test(raw)) fail('invalid numeric header field');
  const value = raw ? Number.parseInt(raw, 8) : 0;
  if (!Number.isSafeInteger(value) || value < 0) fail('invalid archive size');
  return value;
}

function checksumValid(header: Uint8Array): boolean {
  const declared = readOctal(header, 148, 8);
  let actual = 0;
  for (let index = 0; index < BLOCK_SIZE; index += 1) actual += index >= 148 && index < 156 ? 0x20 : header[index]!;
  return declared === actual;
}

function zeroBlock(header: Uint8Array): boolean {
  return header.every((byte) => byte === 0);
}

function safePath(path: string, maxDepth: number): string {
  if (!path || path.includes('\0') || path.includes('\\') || path.startsWith('/') || path.includes('//')) fail('unsafe entry path');
  const segments = path.split('/');
  if (segments.length > maxDepth || segments.some((segment) => !segment || segment === '.' || segment === '..')) fail('unsafe entry path');
  const normalized = segments.join('/');
  if (normalized !== path || normalized.normalize('NFC') !== normalized) fail('ambiguous entry path');
  return normalized;
}

/** Inspects gzip-compressed tar data without extraction or upstream-code execution. */
export function inspectPinnedArchive(response: Uint8Array, limits: ArchiveLimits): InspectedArchive {
  const started = Date.now();
  if (response.byteLength > limits.maxCompressedBytes) fail('compressed byte limit exceeded');
  if (expired(started, limits.archiveTimeoutMs)) fail('archive timed out');

  let bytes: Uint8Array;
  try {
    // maxOutputLength bounds zlib's output buffer while it inflates, rather
    // than checking only after a tar bomb has already been materialized.
    bytes = gunzipSync(response, { maxOutputLength: limits.maxDecompressedBytes });
  } catch {
    fail('gzip decompression failed');
  }
  if (bytes.byteLength > limits.maxDecompressedBytes) fail('decompressed byte limit exceeded');

  let cursor = 0;
  let entries = 0;
  let retained = 0;
  const files: Record<string, Uint8Array> = Object.create(null) as Record<string, Uint8Array>;
  const seen = new Set<string>();
  let prefix: string | undefined;
  let metadataRecords = 0;

  while (cursor < bytes.byteLength) {
    if (expired(started, limits.archiveTimeoutMs)) fail('archive timed out');
    if (cursor + BLOCK_SIZE > bytes.byteLength) fail('truncated header');
    const header = bytes.subarray(cursor, cursor + BLOCK_SIZE);
    cursor += BLOCK_SIZE;
    if (zeroBlock(header)) {
      if (cursor + BLOCK_SIZE > bytes.byteLength || !zeroBlock(bytes.subarray(cursor, cursor + BLOCK_SIZE))) fail('invalid end-of-archive padding');
      cursor += BLOCK_SIZE;
      // GNU tar permits extra zero blocks after the mandated two-block terminator.
      if (bytes.subarray(cursor).some((byte) => byte !== 0)) fail('trailing archive bytes');
      cursor = bytes.byteLength;
      break;
    }
    if (!checksumValid(header)) fail('invalid header checksum');
    if (readString(header, 257, 6) !== 'ustar') fail('unsupported tar format');
    const name = readString(header, 0, 100);
    const headerPrefix = readString(header, 345, 155);
    const rawPath = headerPrefix ? `${headerPrefix}/${name}` : name;
    if (header.subarray(0, 100).includes(0) && header.subarray(0, 100).subarray(header.subarray(0, 100).indexOf(0) + 1).some((byte) => byte !== 0)) fail('NUL-containing entry path');
    const type = String.fromCharCode(header[156] || 48);
    const size = readOctal(header, 124, 12);
    const padded = Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;
    if (size > limits.maxDecompressedBytes || cursor + padded > bytes.byteLength) fail('truncated entry body');
    const body = bytes.subarray(cursor, cursor + size);
    const padding = bytes.subarray(cursor + size, cursor + padded);
    if (padding.some((byte) => byte !== 0)) fail('invalid entry padding');
    cursor += padded;
    if (type !== 'g') entries += 1;
    if (entries > limits.maxEntries) fail('entry limit exceeded');

    if (type === '5') {
      safePath(rawPath.replace(/\/$/u, ''), limits.maxDepth);
      if (size !== 0) fail('directory body not allowed');
      continue;
    }
    if (type === 'g') {
      if (size > limits.maxHeaderBytes || ++metadataRecords > limits.maxMetadataRecords || expired(started, limits.metadataTimeoutMs)) fail('metadata limit exceeded');
      // The frozen GitHub fixture contains one global PAX header carrying only
      // transport metadata. It must not alter entry paths or types.
      const text = Buffer.from(body).toString('utf8');
      for (const record of text.split('\n')) {
        if (!record) continue;
        if (!/^\d+ (comment|mtime)=/u.test(record)) fail('unsupported PAX metadata');
      }
      continue;
    }
    if (type !== '0' && type !== '\0') fail('unsupported archive entry type');
    const pathname = safePath(rawPath, limits.maxDepth);
    const first = pathname.split('/')[0]!;
    if (!prefix) prefix = first;
    if (first !== prefix) fail('ambiguous archive root');
    const relative = pathname.slice(prefix.length + 1);
    if (!relative) fail('invalid archive root entry');

    if (!REQUIRED.has(relative)) continue;
    if (seen.has(relative)) fail('duplicate required file');
    if (size > limits.maxRequiredFileBytes || retained + size > limits.maxRetainedBytes) fail('retained byte limit exceeded');
    seen.add(relative);
    retained += size;
    files[relative] = Uint8Array.from(body);
  }
  if (cursor !== bytes.byteLength) fail('missing archive terminator');
  for (const path of REQUIRED) if (!seen.has(path)) fail('required archive input missing');
  return { files, entries };
}
