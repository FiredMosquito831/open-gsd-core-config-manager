import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const evidence = JSON.parse(readFileSync(resolve(root, 'test/fixtures/phase4-gsd-core-source-evidence.json'), 'utf8'));
const catalog = JSON.parse(readFileSync(resolve(root, 'test/fixtures/phase4-gsd-core-catalog.json'), 'utf8'));
const config = JSON.parse(readFileSync(resolve(root, 'test/fixtures/phase4-specialized-config.json'), 'utf8'));

function runGate(...args: string[]) {
  const { execFileSync } = require('node:child_process');
  return execFileSync(process.execPath, [resolve(root, 'test/scripts/verify-phase4-source-evidence.mjs'), ...args], { encoding: 'utf8' });
}

describe('Phase 4 catalog evidence contract', () => {
  it('re-verifies the immutable source artifact before accepting catalog assertions', () => {
    expect(runGate('--verify-artifact', 'test/fixtures/phase4-gsd-core-source-evidence.json')).toContain('verified immutable');
    expect(evidence.source.revision).toBe('40ce95f8827210afdcb6da5467e0da72b9c68f6c');
    expect(evidence.source.digests).toBeDefined();
    expect(evidence.sourceFiles.every((source: any) => source.url.includes(evidence.source.revision) && source.sha256 && source.anchors.length > 0)).toBe(true);
    expect(evidence.descriptors.every((descriptor: any) => descriptor.evidence.url && descriptor.evidence.path && descriptor.evidence.anchor)).toBe(true);
  });

  it('rejects artifact writes outside the repository-owned fixture', () => {
    for (const path of ['/tmp/phase4-evidence-outside-repo.json', 'test/fixtures/unrelated-evidence.json']) {
      try {
        runGate('--write-artifact', path);
        throw new Error('expected artifact path rejection');
      } catch (error) {
        expect(String(error)).toContain('only permits');
      }
    }
  });

  it('records the complete source-confirmed profile, phase, and agent catalogs', () => {
    expect(catalog.profiles).toEqual(['quality', 'balanced', 'budget', 'adaptive', 'inherit']);
    expect(catalog.phaseTypes).toEqual(['planning', 'discuss', 'research', 'execution', 'verification', 'completion']);
    expect(catalog.agents).toHaveLength(34);
    expect(catalog.unknownSelectorFallback).toBe('balanced');
    expect(catalog.precedence).toEqual(['model_overrides', 'model_policy.runtime_tiers', 'model_profile_overrides', 'models', 'model_profile', 'runtime-default']);
  });

  it('allows only evidence-backed descriptor shapes and preserves unsupported entries read-only', () => {
    expect(catalog.descriptors['ship.pr_body_sections'].entryFields).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'heading', required: true }),
      expect.objectContaining({ path: 'body', required: true }),
    ]));
    expect(catalog.descriptors['review.reviewer_instances'].editor).toBe('read-only-unsupported');
    expect(catalog.unsupported).toContain('review.reviewer_instances.<name>');
    expect(catalog.profilePersistenceShape.editableFields).toEqual(expect.arrayContaining(['model_overrides', 'models', 'model_profile_overrides', 'model_policy']));
    expect(catalog.profilePersistenceShape.forbiddenSerializedFields).toContain('profiles');
  });

  it('covers runtime positives and near misses without a value-bearing diagnostic', () => {
    expect(catalog.runtimeInstallMatrix).toEqual(expect.arrayContaining([
      expect.objectContaining({ runtime: 'codex', command: 'gsd install codex' }),
      expect.objectContaining({ runtime: 'opencode', command: 'gsd install opencode' }),
    ]));
    expect(catalog.runtimeNegativeMatrix).toEqual(expect.arrayContaining([
      expect.objectContaining({ runtime: 'claude' }),
      expect.objectContaining({ runtime: 'unsupported-runtime' }),
      expect.objectContaining({ path: 'model_overrides.<agent-id-with-typo>' }),
      expect.objectContaining({ runtime: null }),
    ]));
    expect(config.projectDraft).not.toHaveProperty('profiles');
    expect(config.projectDraft).not.toHaveProperty('active_profile');
    expect(JSON.stringify(config.projectDraft)).not.toContain('PHASE4_SENTINEL_API_KEY');
    expect(JSON.stringify(catalog)).not.toContain('PHASE4_SENTINEL_API_KEY');
  });
});
