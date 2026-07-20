import { createHash } from 'node:crypto';

export interface DocumentationEvidenceLimits {
  maxSourceBytes: number;
  maxHeadings: number;
  maxSectionBytes: number;
}

export interface DocumentationEvidenceDiagnostic {
  key: string;
  status: 'unavailable';
  reason: 'missing' | 'ambiguous';
}

export type DocumentationFingerprints = Record<string, string> & Record<string, Record<string, string>>;

export interface DocumentationEvidence {
  fingerprints: DocumentationFingerprints;
  diagnostics: DocumentationEvidenceDiagnostic[];
}

interface Section {
  heading: string;
  anchor: string | undefined;
  malformedAnchor: boolean;
  level: number;
  body: string[];
}

const normalize = (value: string) => value.normalize('NFC').replace(/\s+/gu, ' ').trim().toLowerCase();
const token = (value: string, key: string) => new RegExp(`(^|[^A-Za-z0-9_.-])${key.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}(?=$|[^A-Za-z0-9_.-])`, 'u').test(value);

export function extractDocumentationEvidence(markdown: string, knownKeys: readonly string[], limits: DocumentationEvidenceLimits): DocumentationEvidence {
  const input = markdown.replace(/\r\n?/gu, '\n').normalize('NFC');
  if (Buffer.byteLength(input, 'utf8') > limits.maxSourceBytes) throw new Error('Documentation source exceeds byte limit');

  const sections: Section[] = [];
  let current: Section | undefined;
  for (const line of input.split('\n')) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/u.exec(line);
    if (heading) {
      if (sections.length >= limits.maxHeadings) throw new Error('Documentation exceeds heading limit');
      const raw = heading[2]!;
      const anchorMatch = /\s*\{#([^}\s]+)\}\s*$/u.exec(raw);
      if (/\{#/u.test(raw) && !anchorMatch) {
        // Keep this section but ensure it cannot become evidence; malformed anchors are ambiguous.
        current = { heading: raw, anchor: undefined, malformedAnchor: true, level: heading[1]!.length, body: [] };
      } else {
        current = { heading: anchorMatch ? raw.slice(0, anchorMatch.index).trim() : raw, anchor: anchorMatch?.[1], malformedAnchor: false, level: heading[1]!.length, body: [] };
      }
      sections.push(current);
    } else if (current) {
      current.body.push(line);
    }
  }

  const candidates = new Map<string, Section[]>();
  for (const key of knownKeys) candidates.set(key, []);
  for (const section of sections) {
    if (section.malformedAnchor) continue;
    const association = `${normalize(section.heading)} ${normalize(section.anchor ?? '')} ${normalize(section.body.join('\n'))}`;
    const claimed = knownKeys.filter((key) => token(association, key));
    if (claimed.length !== 1) continue;
    const body = normalize(section.body.join('\n'));
    if (Buffer.byteLength(body, 'utf8') > limits.maxSectionBytes) throw new Error('Documentation section exceeds byte limit');
    candidates.get(claimed[0]!)!.push(section);
  }

  const flatFingerprints: Record<string, string> = Object.create(null) as Record<string, string>;
  const diagnostics: DocumentationEvidenceDiagnostic[] = [];
  for (const key of [...knownKeys].sort()) {
    const matches = candidates.get(key)!;
    if (matches.length !== 1) {
      diagnostics.push({ key, status: 'unavailable', reason: matches.length === 0 ? 'missing' : 'ambiguous' });
      continue;
    }
    const section = matches[0]!;
    const body = normalize(section.body.join('\n'));
    flatFingerprints[key] = createHash('sha256').update(body, 'utf8').digest('hex');
  }
  const fingerprints = Object.assign(Object.create(null), flatFingerprints) as DocumentationFingerprints;
  for (const [path, fingerprint] of Object.entries(flatFingerprints)) {
    const segments = path.split('.');
    if (segments.length < 2) continue;
    let target = fingerprints as unknown as Record<string, unknown>;
    for (const segment of segments.slice(0, -1)) {
      if (target[segment] === undefined) {
        Object.defineProperty(target, segment, { value: Object.create(null), enumerable: false, writable: false });
      }
      target = target[segment] as Record<string, unknown>;
    }
    target[segments.at(-1)!] = fingerprint;
  }
  return { fingerprints, diagnostics };
}
