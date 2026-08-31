#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const EXPECTED_ARTIFACT_PATH = resolve(REPOSITORY_ROOT, 'test/fixtures/phase4-gsd-core-source-evidence.json');

function assertArtifactPath(path) {
  const resolvedPath = resolve(REPOSITORY_ROOT, path);
  if (resolvedPath !== EXPECTED_ARTIFACT_PATH) {
    fail(`--write-artifact only permits ${EXPECTED_ARTIFACT_PATH}`);
  }
  return resolvedPath;
}

async function writeArtifactAtomically(path, contents) {
  const directory = dirname(path);
  const temporaryDirectory = await mkdtemp(resolve(directory, '.phase4-evidence-'));
  const temporaryPath = resolve(temporaryDirectory, 'artifact.json');
  try {
    await writeFile(temporaryPath, contents, 'utf8');
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

// Immutable evidence is verified against this reviewed source revision, never
// the moving `next` branch head. Updating it is an explicit review action.
const REVISION = '40ce95f8827210afdcb6da5467e0da72b9c68f6c';
const RAW_ROOT = `https://raw.githubusercontent.com/open-gsd/gsd-core/${REVISION}/`;
const SOURCES = [
  'docs/CONFIGURATION.md',
  'docs/how-to/configure-model-profiles.md',
  'gsd-core/bin/shared/model-catalog.json',
  'src/model-catalog.cts',
  'src/model-resolver.cts',
  'src/config-loader.cts',
  'src/model-profiles.cts',
];
const EXPECTED_DIGESTS = {
  'docs/CONFIGURATION.md': '92e71b15bba6d328bafee191ae9448a4baab895d0441ba37f9c430830c31a7f7',
  'docs/how-to/configure-model-profiles.md': '46b5bbb0c03d0cdf6c20030a8eae65c4481d256229665e604014df8aeb684821',
  'gsd-core/bin/shared/model-catalog.json': 'b55176ca044728d3aa098ae8a750fccd4f00489289f6150e549aa577e49b2caf',
  'src/model-catalog.cts': 'b2992277815323befe7a3f111b031024b37903097124cf9d1f543503b27380f4',
  'src/model-resolver.cts': '76292d87f414c0f4731544fabf5c5a870884fcb0a226729389a4257639182cdc',
  'src/config-loader.cts': '08eda003f85ca87a973747d3aabe086458dfa008be2a2020fd73c0f10d229ead',
  'src/model-profiles.cts': '0b6567730e11c945b2b399f68aed8c14774d17b904b0d9ecf203eb2d7c13a543',
};
const ANCHORS = {
  'docs/CONFIGURATION.md': ['model_profile', 'model_overrides', 'model_profile_overrides', 'model_policy.runtime_tiers', 'review.reviewer_instances', 'Displayed as `****<last-4>`'],
  'docs/how-to/configure-model-profiles.md': ['quality', 'balanced', 'budget', 'adaptive', 'inherit', 'planning', 'discuss', 'research', 'execution', 'verification', 'completion'],
  'gsd-core/bin/shared/model-catalog.json': ['profiles', 'phaseTypes', 'adaptiveTierMap', 'runtimeTierDefaults', 'agents'],
  'src/model-resolver.cts': ['model_profile_overrides', 'runtime_tiers', 'balanced'],
  'src/config-loader.cts': ['model_policy', 'model_overrides'],
  'src/model-catalog.cts': ['agents', 'phaseTypes'],
  'src/model-profiles.cts': ['model-profiles'],
};
const DESCRIPTORS = [
  ['model_overrides.<agent-id>', 'docs/CONFIGURATION.md', 'model_overrides'],
  ['models.<phase_type>', 'docs/CONFIGURATION.md', 'models.<phase_type>'],
  ['effort.agent_overrides.<agent-id>', 'docs/CONFIGURATION.md', 'agent_overrides'],
  ['fast_mode.agent_overrides.<agent-id>', 'docs/CONFIGURATION.md', 'fast_mode.agent_overrides'],
  ['model_profile_overrides.<runtime>.<tier>', 'docs/CONFIGURATION.md', 'model_profile_overrides.<runtime>.<tier>'],
  ['model_policy.runtime_tiers.<runtime>.<tier>', 'docs/CONFIGURATION.md', 'model_policy.runtime_tiers'],
  ['review.reviewer_instances.<name>', 'docs/CONFIGURATION.md', 'reviewer_instances.<name>.cli'],
  ['search-api-key', 'docs/CONFIGURATION.md', 'Masked in display'],
];
const MATRIX = [
  { runtime: 'codex', path: 'model_overrides.gsd-executor', matches: true, install: 'gsd install codex' },
  { runtime: 'opencode', path: 'model_overrides.gsd-executor', matches: true, install: 'gsd install opencode' },
  { runtime: 'claude', path: 'model_overrides.gsd-executor', matches: false, install: null },
  { runtime: 'codex', path: 'models.execution', matches: true, install: 'gsd install codex' },
  { runtime: 'opencode', path: 'model_profile_overrides.opencode.sonnet', matches: true, install: 'gsd install opencode' },
  { runtime: 'codex', path: 'model_profile_overrides.codex.sonnet', matches: true, install: 'gsd install codex' },
  { runtime: 'claude', path: 'model_profile_overrides.claude.sonnet', matches: false, install: null },
  { runtime: 'codex', path: 'model_overrides.gsd-executr', matches: false, install: null },
  { runtime: 'codex', path: 'review.models.codex', matches: false, install: null },
  { runtime: null, path: 'model_overrides.gsd-executor', matches: false, install: null },
  { runtime: 'unsupported-runtime', path: 'model_overrides.gsd-executor', matches: false, install: null },
];

function fail(message) { throw new Error(`STATIC SOURCE EVIDENCE FAILURE: ${message}`); }
async function fetchText(path) {
  const response = await fetch(RAW_ROOT + path, { headers: { 'User-Agent': 'open-gsd-core-config-manager-phase4-evidence' } });
  if (!response.ok) fail(`unable to retrieve ${path} (${response.status})`);
  return response.text();
}
async function retrieve() {
  const contents = Object.fromEntries(await Promise.all(SOURCES.map(async path => [path, await fetchText(path)])));
  const digests = Object.fromEntries(SOURCES.map(path => [path, createHash('sha256').update(contents[path]).digest('hex')]));
  for (const path of SOURCES) if (digests[path] !== EXPECTED_DIGESTS[path]) fail(`digest mismatch for ${path}`);
  for (const [path, required] of Object.entries(ANCHORS)) for (const anchor of required) if (!contents[path].includes(anchor)) fail(`missing anchor ${anchor} in ${path}`);
  const catalog = JSON.parse(contents['gsd-core/bin/shared/model-catalog.json']);
  if (JSON.stringify(catalog.profiles) !== JSON.stringify(['quality', 'balanced', 'budget', 'adaptive', 'inherit'])) fail('profile order mismatch');
  if (JSON.stringify(catalog.phaseTypes) !== JSON.stringify(['planning', 'discuss', 'research', 'execution', 'verification', 'completion'])) fail('phase type order mismatch');
  if (Object.keys(catalog.agents ?? {}).length !== 34) fail(`expected 34 agents, found ${Object.keys(catalog.agents ?? {}).length}`);
  return { contents, digests, catalog };
}
function buildArtifact(retrieved) {
  return {
    schemaVersion: 1,
    source: { revision: REVISION, retrievedAt: new Date().toISOString(), rawRoot: RAW_ROOT, digests: retrieved.digests },
    sourceFiles: SOURCES.map(path => ({ path, url: RAW_ROOT + path, sha256: retrieved.digests[path], anchors: ANCHORS[path] })),
    profileCatalog: retrieved.catalog.profiles,
    phaseTypes: retrieved.catalog.phaseTypes,
    adaptiveTierMap: retrieved.catalog.adaptiveTierMap,
    agentCatalog: Object.keys(retrieved.catalog.agents),
    profilePersistenceShape: {
      entity: 'ordinary-project-config',
      fields: ['model_overrides', 'models', 'model_profile_overrides', 'model_policy'],
      forbiddenSerializedFields: ['profiles', 'active_profile', 'profile_id', 'profile_description', 'profile_assignments', 'model_profile_name'],
      customFlow: 'copy-built-in-assignment-set-into-project-draft',
    },
    precedence: ['model_overrides', 'model_policy.runtime_tiers', 'model_profile_overrides', 'models', 'model_profile', 'runtime-default'],
    sensitivePaths: ['brave_search', 'firecrawl', 'exa_search', 'tavily_search', 'ref_search', 'perplexity', 'jina'],
    descriptors: DESCRIPTORS.map(([id, path, anchor]) => ({ id, evidence: { path, url: RAW_ROOT + path, anchor } })),
    unsupported: [{ path: 'review.reviewer_instances.<name>', reason: 'bundled schema has no matching validation shape; preserve read-only' }],
    runtimeInstallMatrix: MATRIX,
    decisions: { noCustomProfileEntity: true, reviewerInstances: { cli: 'required', model: 'optional', agent: 'optional' }, unknownSelectorFallback: 'balanced', codexOpenCodeInstallSensitive: true },
  };
}
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0];
  const artifactPath = args[1];
  if (!['--verify-only', '--write-artifact', '--verify-artifact'].includes(mode)) { console.error('usage: --verify-only | --write-artifact <path> | --verify-artifact <path>'); process.exit(2); }
  const outputPath = mode === '--write-artifact' ? assertArtifactPath(artifactPath ?? '') : undefined;
  const retrieved = await retrieve();
  const artifact = buildArtifact(retrieved);
  if (mode === '--verify-artifact') {
    if (!artifactPath) fail('artifact path is required');
    let stored; try { stored = JSON.parse(await readFile(artifactPath, 'utf8')); } catch { fail(`cannot read artifact ${artifactPath}`); }
    if (stored.source?.revision !== REVISION || JSON.stringify(stored.source?.digests) !== JSON.stringify(artifact.source.digests)) fail('artifact revision or source digests are stale');
    if (JSON.stringify(stored.sourceFiles?.map(x => [x.path, x.sha256, x.anchors])) !== JSON.stringify(artifact.sourceFiles.map(x => [x.path, x.sha256, x.anchors]))) fail('artifact source references are stale');
    if (stored.descriptors?.length !== DESCRIPTORS.length || stored.runtimeInstallMatrix?.length !== MATRIX.length) fail('artifact evidence is incomplete');
  } else if (mode === '--write-artifact') {
    if (!artifactPath) fail('artifact path is required');
    const outputPath = assertArtifactPath(artifactPath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeArtifactAtomically(outputPath, JSON.stringify(artifact, null, 2) + '\n');
  }
  console.log(`verified immutable gsd-core source ${REVISION}`);
}
main().catch(error => { console.error(error.message); process.exit(1); });
