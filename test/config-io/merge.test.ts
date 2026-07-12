import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import { buildEffectiveTree, getAtPath, resolveLeaf } from '../../packages/config-io/src/merge.js';
import type { EffectiveNode } from '../../packages/config-io/src/types.js';

describe('getAtPath', () => {
  it('finds a nested value at a dot-path', () => {
    expect(getAtPath({ a: { b: 1 } }, 'a.b')).toEqual({ found: true, value: 1 });
  });

  it('reports not found when a segment is absent', () => {
    expect(getAtPath({ a: {} }, 'a.b')).toEqual({ found: false, value: undefined });
  });

  it('reports not found on null/non-object roots', () => {
    expect(getAtPath(null, 'a.b')).toEqual({ found: false, value: undefined });
    expect(getAtPath('not-an-object', 'a.b')).toEqual({ found: false, value: undefined });
  });
});

describe('resolveLeaf', () => {
  it('resolves project when project supplies the value (project wins)', () => {
    const layers = {
      project: { a: { b: 1 } },
      global: { a: { b: 2 } },
      canonical: { a: { b: 3 } },
    };
    expect(resolveLeaf('a.b', layers)).toEqual({ path: 'a.b', value: 1, from: 'project' });
  });

  it('resolves global when project is missing it (global wins)', () => {
    const layers = {
      project: {},
      global: { a: { b: 2 } },
      canonical: { a: { b: 3 } },
    };
    expect(resolveLeaf('a.b', layers)).toEqual({ path: 'a.b', value: 2, from: 'global' });
  });

  it('resolves canonical when project+global are both missing it (canonical wins)', () => {
    const layers = {
      project: {},
      global: {},
      canonical: { a: { b: 3 } },
    };
    expect(resolveLeaf('a.b', layers)).toEqual({ path: 'a.b', value: 3, from: 'canonical' });
  });

  it('throws a descriptive error when no layer supplies the path', () => {
    const layers = { project: {}, global: {}, canonical: {} };
    expect(() => resolveLeaf('a.b', layers)).toThrow(/no layer supplies/i);
  });
});

describe('buildEffectiveTree', () => {
  it('assembles a nested EffectiveNode tree with correctly-tagged leaves', () => {
    const layers = {
      project: { workflow: { tdd_mode: true } },
      global: { workflow: { code_review_depth: 'deep' }, mode: 'interactive' },
      canonical: { workflow: { tdd_mode: false, code_review_depth: 'standard' }, mode: 'batch' },
    };

    const tree = buildEffectiveTree(['workflow.tdd_mode', 'workflow.code_review_depth', 'mode'], layers);

    const workflowNode = tree.workflow as Record<string, EffectiveNode>;
    expect(workflowNode.tdd_mode).toEqual({ path: 'workflow.tdd_mode', value: true, from: 'project' });
    expect(workflowNode.code_review_depth).toEqual({
      path: 'workflow.code_review_depth',
      value: 'deep',
      from: 'global',
    });
    expect(tree.mode).toEqual({ path: 'mode', value: 'interactive', from: 'global' });
  });
});

describe('merge.ts purity', () => {
  it('imports no bundled schema module', async () => {
    const source = await fs.readFile('packages/config-io/src/merge.ts', 'utf8');
    expect(source).not.toMatch(/schema-data|bundled-schema/i);
  });
});
