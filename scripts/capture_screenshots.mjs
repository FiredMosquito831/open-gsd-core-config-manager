#!/usr/bin/env node
/**
 * Capture real screenshots of the built documentation site and render the
 * 1200x630 social card from site/static/og-template.html.
 *
 * Serves docs/ over HTTP (loopback), drives it with Playwright Chromium, and
 * writes into site/static/screenshots/ plus docs/og.png.
 *
 * Usage: node scripts/capture_screenshots.mjs
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const DOCS = join(ROOT, 'docs');
const OUT = join(ROOT, 'site', 'static', 'screenshots');
const SCHEMA = JSON.parse(await readFile(join(DOCS, 'canonical-schema.json'), 'utf8'));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = join(DOCS, path.replace(/^\/+/, ''));
  if (!file.startsWith(DOCS)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(await readFile(join(DOCS, '404.html')));
  }
});

await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
await mkdir(OUT, { recursive: true });

const keys = Object.keys(SCHEMA.keys);
const stats = {
  keys: keys.length,
  defaults: keys.filter((key) => 'default' in SCHEMA.keys[key]).length,
  enums: keys.filter((key) => SCHEMA.keys[key].allowedValues).length,
  version: SCHEMA.version,
};

const browser = await chromium.launch();
const errors = [];

async function capture(name, path, { width, height, fullPage = false, scrollTo, hideHeader = false }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${name}: console ${message.text()}`);
  });
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts?.ready);
  if (hideHeader) {
    await page.addStyleTag({ content: '.site-header{position:static!important}' });
  }
  if (scrollTo) {
    await page.evaluate((selector) => {
      const target = document.querySelector(selector);
      if (target) target.scrollIntoView({ block: 'start' });
    }, scrollTo);
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage });
  await context.close();
}

const pages = [
  ['home', '/', '#main'],
  ['schema', '/schema.html?cat=model-routing', '.explorer'],
  ['cli', '/cli.html', '.page-head'],
  ['history', '/history.html', '.pipeline'],
  ['faq', '/faq.html', '.faq-item'],
  ['about', '/about.html', '.page-head'],
];
for (const [name, path, scrollTo] of pages) {
  await capture(`${name}-desktop`, path, { width: 1440, height: 900, scrollTo });
  await capture(`${name}-mobile`, path, { width: 390, height: 844, scrollTo });
}
await capture('404-desktop', '/404.html', { width: 1440, height: 900 });
await capture('404-mobile', '/404.html', { width: 390, height: 844 });

// Social card — rendered from the same live stats as the site.
const template = await readFile(join(ROOT, 'site', 'static', 'og-template.html'), 'utf8');
const rendered = template
  .replaceAll('__VERSION__', stats.version)
  .replaceAll('__KEYS__', String(stats.keys))
  .replaceAll('__DEFAULTS__', String(stats.defaults))
  .replaceAll('__ENUMS__', String(stats.enums));
const ogPath = join(tmpdir(), `gsd-og-${process.pid}.html`);
await writeFile(ogPath, rendered, 'utf8');
const ogContext = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const ogPage = await ogContext.newPage();
await ogPage.goto(`file:///${ogPath.replace(/\\/g, '/')}`, { waitUntil: 'load' });
await ogPage.evaluate(() => document.fonts?.ready);
await ogPage.screenshot({ path: join(DOCS, 'og.png') });
await ogContext.close();

await browser.close();
server.close();

if (errors.length) {
  console.error('Browser issues:\n' + errors.join('\n'));
  process.exitCode = 1;
}
console.log(`Captured ${pages.length * 2 + 2} screenshots into ${OUT}`);
console.log(`Wrote docs/og.png (${1200}x630) from schema v${stats.version}: ${stats.keys} keys, ${stats.defaults} defaults, ${stats.enums} enums`);
