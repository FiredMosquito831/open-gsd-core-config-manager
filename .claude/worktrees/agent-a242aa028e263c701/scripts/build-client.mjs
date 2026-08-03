#!/usr/bin/env node
// Client build step for the frozen dist/client/** output contract.
//
// Today this is a plain copy step: everything under web/ is copied into
// dist/client/ verbatim. Phase 3 replaces the body of this script (or the
// build:client npm script itself) with a Vite build whose outDir is
// dist/client - the output contract (dist/client/index.html + dist/client/**)
// stays identical, so the server's static-file serving and the packaging
// pipeline never change.
//
// IMPORTANT: this script cleans ONLY dist/client, never the whole dist/
// directory. Plan 07 runs the CLI bundle (tsup, which cleans dist/) first and
// this client step second; if this script wiped dist/, it would delete the
// freshly built dist/cli.js. The narrow clean scope is what keeps both
// artifacts in the published tarball.
//
// WR-04 fix: a blanket `cpSync(srcDir, outDir, { recursive: true })` copies
// EVERYTHING under web/ verbatim, with no filter. Harmless today (web/
// contains only index.html), but there is nothing stopping a future stray
// dev artifact (a .env, an editor backup file, a source map) placed under
// web/ from being copied straight into dist/client and shipped in the
// published npm tarball -- test/packaging/tarball-contents.test.ts's
// "ships no source/test/planning artifacts" check only excludes web/
// itself, never files copied OUT of web/ into dist/client. `copyAllowed`
// below walks the tree itself and only copies files whose extension is on
// a fixed allowlist of real web-bundle asset types, skipping (and logging)
// anything else -- including extension-less dotfiles like .env, whose
// `path.extname()` is the empty string and therefore never matches.

import { existsSync, rmSync, mkdirSync, readdirSync, copyFileSync, accessSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const srcDir = path.join(repoRoot, "web");
const srcEntry = path.join(srcDir, "index.html");
const outDir = path.join(repoRoot, "dist", "client");

/** Real front-end bundle asset extensions -- deliberately excludes .map, .env, and any extension-less dotfile. */
const ALLOWED_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".mjs",
  ".css",
  ".json",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".webp",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
]);

function copyAllowed(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyAllowed(srcPath, destPath);
      continue;
    }
    if (!entry.isFile()) continue; // skip symlinks/sockets/etc.

    const ext = path.extname(entry.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      console.warn(`build-client: skipping disallowed file ${srcPath}`);
      continue;
    }
    copyFileSync(srcPath, destPath);
  }
}

if (!existsSync(srcEntry)) {
  console.error(`build-client: missing ${srcEntry} - nothing to copy into dist/client`);
  process.exit(1);
}

// Clean only dist/client - never dist/ itself.
rmSync(outDir, { recursive: true, force: true });
copyAllowed(srcDir, outDir);

// Confirm the frozen entry point actually landed where @fastify/static (Plan 04)
// and the npm tarball (Plan 07) expect it.
const outEntry = path.join(outDir, "index.html");
accessSync(outEntry);

console.log(`build-client: wrote ${outEntry}`);
