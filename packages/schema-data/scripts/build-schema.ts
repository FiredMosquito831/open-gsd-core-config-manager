/**
 * Trusted-local maintainer adapter for the canonical schema builder.
 *
 * The only module execution in this file is the local gsd-core capability
 * registry. Reconciliation itself is pure and accepts only parsed data, so no
 * live-refresh caller can acquire this trusted-local capability accidentally.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { reconcileSchemaSources, validateBundledSchemaMetadata } from '../src/reconcile.js';
import type { CanonicalSchema, ParsedSchemaSources, ReconciliationOverlays } from '../src/source-types.js';

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const schemaDataDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(schemaDataDir, '..', '..');
const gsdCoreBin = path.join(process.env.GSD_HOME || os.homedir(), '.claude', 'gsd-core', 'bin');

const manifestPath = path.join(gsdCoreBin, 'shared', 'config-schema.manifest.json');
const defaultsPath = path.join(gsdCoreBin, 'shared', 'config-defaults.manifest.json');
const capabilityRegistryPath = path.join(gsdCoreBin, 'lib', 'capability-registry.cjs');
const outputPath = path.join(schemaDataDir, 'bundled-schema.json');
const metadataPath = path.join(schemaDataDir, 'bundled-schema-meta.json');

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function fixture(name: string): Record<string, unknown> {
  return readJson(path.join(repoRoot, 'test', 'fixtures', name));
}

function activeSchema(): CanonicalSchema {
  return fs.existsSync(outputPath) ? readJson<CanonicalSchema>(outputPath) : {};
}

function overlays(schema: CanonicalSchema): ReconciliationOverlays {
  const curated = fs.existsSync(path.join(schemaDataDir, 'curated-docs.json'))
    ? readJson<ReconciliationOverlays['curated']>(path.join(schemaDataDir, 'curated-docs.json')) : {};
  const specialized = Object.fromEntries(Object.entries(schema)
    .filter(([, entry]) => entry['x-specialized'])
    .map(([key, entry]) => [key, entry['x-specialized']!])) as ReconciliationOverlays['specialized'];
  return { curated, specialized };
}

const manifest = readJson<ParsedSchemaSources['manifest']>(manifestPath);
const defaults = readJson<Record<string, unknown>>(defaultsPath);

// Trusted-local exception: never move this require into reconcile.ts or a remote path.
const capabilityRegistry = require(capabilityRegistryPath) as { configSchema: ParsedSchemaSources['capabilitySchema'] };
const previous = activeSchema();
const metadata = readJson<unknown>(metadataPath);
if (!validateBundledSchemaMetadata(metadata)) throw new Error('Invalid bundled schema identity metadata');

const sources: ParsedSchemaSources = {
  manifest,
  defaults,
  capabilitySchema: capabilityRegistry.configSchema,
  fixtureValues: [fixture('project-config.json'), fixture('global-defaults.json'), fixture('global-defaults-claude-api.json')],
  upstreamDocumentationFingerprints: {},
};
const result = reconcileSchemaSources(sources, previous, overlays(previous), metadata);
fs.writeFileSync(outputPath, `${JSON.stringify(result.schema, null, 2)}\n`, 'utf8');
console.log(`build-schema: wrote ${Object.keys(result.schema).length} keys to ${path.relative(repoRoot, outputPath)}`);
