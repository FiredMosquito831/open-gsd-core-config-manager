import { describe, expect, it } from 'vitest';
import { safeSet, FORBIDDEN_SEGMENTS } from '../../packages/config-io/src/patch.js';

describe('safeSet', () => {
  it('sets a nested value, creating intermediate objects as needed', () => {
    const obj: Record<string, unknown> = {};
    safeSet(obj, 'workflow.tdd_mode', true);
    expect((obj as { workflow: { tdd_mode: boolean } }).workflow.tdd_mode).toBe(true);
  });

  it('overwrites only the target leaf and leaves sibling keys untouched (patch-in-place fidelity)', () => {
    const obj: Record<string, unknown> = {
      workflow: { tdd_mode: false, code_review_depth: 'standard' },
      other: { untouched: 'value' },
    };
    safeSet(obj, 'workflow.tdd_mode', true);
    expect(obj).toEqual({
      workflow: { tdd_mode: true, code_review_depth: 'standard' },
      other: { untouched: 'value' },
    });
  });

  it('throws on a __proto__ path segment and causes no global prototype pollution', () => {
    const obj: Record<string, unknown> = {};
    expect(() => safeSet(obj, 'a.__proto__.polluted', 1)).toThrow(
      /Refusing to patch unsafe path segment: __proto__/,
    );
    // Prove no global pollution occurred: a brand-new plain object must not
    // carry the injected property.
    expect((({} as Record<string, unknown>).polluted)).toBeUndefined();
  });

  it('throws on a bare "constructor" final segment', () => {
    const obj: Record<string, unknown> = {};
    expect(() => safeSet(obj, 'constructor', 1)).toThrow(
      /Refusing to patch unsafe path segment: constructor/,
    );
  });

  it('throws on a "prototype" intermediate segment', () => {
    const obj: Record<string, unknown> = {};
    expect(() => safeSet(obj, 'x.prototype.y', 1)).toThrow(
      /Refusing to patch unsafe path segment: prototype/,
    );
  });

  it('exposes the forbidden-segment denylist for auditability', () => {
    expect(FORBIDDEN_SEGMENTS.has('__proto__')).toBe(true);
    expect(FORBIDDEN_SEGMENTS.has('constructor')).toBe(true);
    expect(FORBIDDEN_SEGMENTS.has('prototype')).toBe(true);
  });
});
