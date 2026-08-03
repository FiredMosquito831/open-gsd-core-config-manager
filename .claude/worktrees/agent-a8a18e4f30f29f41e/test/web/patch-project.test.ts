// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  setDotPath,
  deleteDotPath,
  buildProjectSaveCandidate,
  FORBIDDEN_SEGMENTS,
} from '../../web/src/schema/patchProject.js';
import unknownFixture from '../fixtures/project-config-with-fabricated-unknown-keys.json' with { type: 'json' };
import type { LoadResult } from '../../packages/config-io/src/types.js';

function makeLoadResult(project: Record<string, unknown>): LoadResult {
  return {
    raw: { project, global: null },
    effective: {},
    unknown: [],
    meta: { globalDefaultsPath: '', globalDefaultsFound: false },
  };
}

describe('setDotPath', () => {
  it('sets a nested path', () => {
    const obj: Record<string, unknown> = {};
    setDotPath(obj, 'a.b.c', 1);
    expect(obj).toEqual({ a: { b: { c: 1 } } });
  });

  it('rejects forbidden segments', () => {
    for (const seg of Array.from(FORBIDDEN_SEGMENTS)) {
      const obj: Record<string, unknown> = {};
      expect(() => setDotPath(obj, `a.${seg}.c`, 1)).toThrow(/unsafe/);
    }
  });
});

describe('deleteDotPath', () => {
  it('removes a nested path', () => {
    const obj = { a: { b: { c: 1 } } };
    deleteDotPath(obj, 'a.b.c');
    expect(obj).toEqual({ a: { b: {} } });
  });

  it('rejects forbidden segments', () => {
    const obj = { a: { b: { c: 1 } } };
    expect(() => deleteDotPath(obj, 'a.__proto__.c')).toThrow(/unsafe/);
  });
});

describe('buildProjectSaveCandidate', () => {
  it('clones raw.project and applies project changes', () => {
    const loadResult = makeLoadResult({ mode: 'interactive' });
    const candidate = buildProjectSaveCandidate(loadResult, [{ path: 'mode', value: 'autonomous' }], []);
    expect(candidate.mode).toBe('autonomous');
    expect(loadResult.raw.project.mode).toBe('interactive');
  });

  it('preserves unknown keys from the fixture', () => {
    const candidate = buildProjectSaveCandidate(
      makeLoadResult(unknownFixture as Record<string, unknown>),
      [{ path: 'mode', value: 'autonomous' }],
      [],
    );
    expect(candidate.x_gsdcm_test_future_key).toEqual({ nested: true });
    expect(candidate.workflow).toMatchObject({ x_test_unknown_toggle: false });
  });

  it('removes reset paths without mutating the original raw.project', () => {
    const loadResult = makeLoadResult({ mode: 'interactive', workflow: { tdd_mode: true } });
    const candidate = buildProjectSaveCandidate(loadResult, [], ['workflow.tdd_mode']);
    expect(candidate.workflow).toEqual({});
    expect(loadResult.raw.project).toEqual({ mode: 'interactive', workflow: { tdd_mode: true } });
  });
});
