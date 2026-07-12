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

import { existsSync, rmSync, cpSync, accessSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const srcDir = path.join(repoRoot, "web");
const srcEntry = path.join(srcDir, "index.html");
const outDir = path.join(repoRoot, "dist", "client");

if (!existsSync(srcEntry)) {
  console.error(`build-client: missing ${srcEntry} - nothing to copy into dist/client`);
  process.exit(1);
}

// Clean only dist/client - never dist/ itself.
rmSync(outDir, { recursive: true, force: true });
cpSync(srcDir, outDir, { recursive: true });

// Confirm the frozen entry point actually landed where @fastify/static (Plan 04)
// and the npm tarball (Plan 07) expect it.
const outEntry = path.join(outDir, "index.html");
accessSync(outEntry);

console.log(`build-client: wrote ${outEntry}`);
