/**
 * Site integrity tests.
 *
 * The documentation site is generated from docs/canonical-schema.json and
 * committed to docs/. These tests keep the committed output honest:
 *
 *   1. every canonical key is rendered server-side (the explorer is
 *      searchable without a client-side data payload);
 *   2. every enum option and meaning is present;
 *   3. every page carries a unique title, canonical URL, OG/Twitter tags and
 *      an existing asset set;
 *   4. CNAME, sitemap and robots agree with the one SITE_URL constant;
 *   5. the social image is a real 1200x630 PNG.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DOCS = path.join(REPO_ROOT, 'docs');
const SITE_URL = 'https://gsd.danubelabs.net';

const PAGES = [
  'index.html',
  'schema.html',
  'cli.html',
  'history.html',
  'faq.html',
  'about.html',
  '404.html',
];

interface CanonicalKey {
  type: string;
  category: string;
  description: string;
  default?: unknown;
  allowedValues?: Array<{ value: string | number | boolean | null; meaning: string }>;
  defaultNote?: string;
}

interface CanonicalSchema {
  version: string;
  keys: Record<string, CanonicalKey>;
}

const schema = JSON.parse(fs.readFileSync(path.join(DOCS, 'canonical-schema.json'), 'utf8')) as CanonicalSchema;

function readPage(name: string): string {
  return fs.readFileSync(path.join(DOCS, name), 'utf8');
}

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function plainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

describe('generated documentation site', () => {
  it('ships every expected page and auxiliary file', () => {
    for (const name of PAGES) expect(fs.existsSync(path.join(DOCS, name)), name).toBe(true);
    for (const name of ['sitemap.xml', 'robots.txt', 'CNAME', 'og.png', 'favicon.svg']) {
      expect(fs.existsSync(path.join(DOCS, name)), name).toBe(true);
    }
  });

  it('renders every canonical key exactly once in the server-side explorer', () => {
    const html = readPage('schema.html');
    const paths = Object.keys(schema.keys);
    expect(paths.length).toBeGreaterThan(0);

    for (const keyPath of paths) {
      const occurrences = html.split(`<code>${escapeHtml(keyPath)}</code>`).length - 1;
      expect(occurrences, keyPath).toBeGreaterThanOrEqual(1);
      expect(html).toContain(`data-key="${escapeHtml(keyPath)}"`);
    }

    const cards = html.match(/<article class="key-card"/g) ?? [];
    expect(cards.length).toBe(paths.length);
  });

  it('renders every enum value and its meaning', () => {
    const html = readPage('schema.html');
    const enums = Object.entries(schema.keys).filter(([, meta]) => meta.allowedValues?.length);
    expect(enums.length).toBeGreaterThan(0);

    for (const [keyPath, meta] of enums) {
      for (const option of meta.allowedValues ?? []) {
        const display = option.value === null ? 'null' : String(option.value);
        expect(html, `${keyPath}=${display}`).toContain(`<code>${escapeHtml(display)}</code>`);
        if (option.meaning) {
          expect(plainText(html).replace(/\s+/g, ''), `${keyPath} meaning`).toContain(
            option.meaning.replace(/`/g, '').replace(/\s+/g, ''),
          );
        }
      }
    }
  });

  it('reports the schema version and key count from real data', () => {
    const home = readPage('index.html');
    expect(home).toContain(`gsd-core v${schema.version}`);
    expect(readPage('schema.html')).toContain(String(Object.keys(schema.keys).length));
  });

  it('does not contain unresolved template placeholders', () => {
    for (const name of PAGES) {
      const html = readPage(name);
      expect(html, name).not.toContain('{{');
      expect(html, name).not.toContain('__KEYS__');
      expect(html, name).not.toContain('__VERSION__');
    }
  });

  it('gives every page a title, description, canonical and social metadata', () => {
    const titles = new Set<string>();
    for (const name of PAGES) {
      const html = readPage(name);
      const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
      expect(title, name).toBeTruthy();
      titles.add(title as string);
      expect(html, name).toContain('<meta name="description" content="');
      expect(html, name).toContain(`rel="canonical" href="${SITE_URL}/`);
      expect(html, name).toContain('property="og:image"');
      expect(html, name).toContain(`${SITE_URL}/og.png`);
      expect(html, name).toContain('name="twitter:card"');
      expect(html, name).toContain('<meta name="viewport"');
      expect(html, name).toContain('<html lang="en">');
    }
    expect(titles.size).toBe(PAGES.length);
  });

  it('includes parseable SoftwareApplication JSON-LD on the home page', () => {
    const html = readPage('index.html');
    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(match).toBeTruthy();
    const data = JSON.parse(match![1]) as Record<string, unknown>;
    expect(data['@type']).toBe('SoftwareApplication');
    expect(data.name).toBe('GSD Config Manager');
    expect(data.url).toBe(SITE_URL);
    expect(data.license).toBe('https://opensource.org/licenses/MIT');
  });

  it('publishes the configured origin in CNAME, sitemap and robots', () => {
    expect(fs.readFileSync(path.join(DOCS, 'CNAME'), 'utf8').trim()).toBe(
      SITE_URL.replace('https://', ''),
    );
    const sitemap = fs.readFileSync(path.join(DOCS, 'sitemap.xml'), 'utf8');
    for (const page of PAGES.filter((name) => name !== '404.html')) {
      const loc = page === 'index.html' ? `${SITE_URL}/` : `${SITE_URL}/${page}`;
      expect(sitemap).toContain(`<loc>${loc}</loc>`);
    }
    expect(sitemap).not.toContain('404.html');
    expect(fs.readFileSync(path.join(DOCS, 'robots.txt'), 'utf8')).toContain(
      `Sitemap: ${SITE_URL}/sitemap.xml`,
    );
  });

  it('references only local assets that exist', () => {
    for (const name of PAGES) {
      const html = readPage(name);
      const refs = [...html.matchAll(/(?:src|href)="(\/[^"#?]+)"/g)].map((match) => match[1]);
      for (const ref of refs) {
        if (ref === '/') continue;
        const target = path.join(DOCS, ref.replace(/^\//, ''));
        expect(fs.existsSync(target), `${name} -> ${ref}`).toBe(true);
      }
    }
  });

  it('emits a real 1200x630 PNG social card', () => {
    const png = fs.readFileSync(path.join(DOCS, 'og.png'));
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    expect(width).toBe(1200);
    expect(height).toBe(630);
    expect(png.length).toBeGreaterThan(10_000);
  });

  it('marks the schema explorer readable without JavaScript', () => {
    const html = readPage('schema.html');
    expect(html).toContain('<noscript>');
    expect(html).toContain(
      `All ${Object.keys(schema.keys).length} keys are listed above and remain readable without it.`,
    );
  });
});
