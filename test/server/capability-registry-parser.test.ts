import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCapabilityRegistryLiteral } from '../../packages/server/src/capability-registry-parser.js';

const fixture = (name: string) => readFileSync(new URL(`../fixtures/schema-refresh/valid/${name}`, import.meta.url), 'utf8');

const limits = { maxSourceBytes: 256 * 1024, maxNodes: 20_000, maxDepth: 32 };

describe('parseCapabilityRegistryLiteral', () => {
  it('reads the literal configSchema fixture without executing its top-level trap', () => {
    delete (globalThis as Record<string, unknown>).__schemaRefreshFixtureExecuted;

    const parsed = parseCapabilityRegistryLiteral(fixture('capability-registry.cjs'), limits);

    expect(parsed).toMatchObject({ model_profile: expect.any(Object) });
    expect((globalThis as Record<string, unknown>).__schemaRefreshFixtureExecuted).toBeUndefined();
  });

  it('accepts only an object-literal configSchema and finite literal values including unary minus', () => {
    expect(parseCapabilityRegistryLiteral(`const configSchema = {\n  enabled: true,\n  retry: -2,\n  ratio: 1.5,\n  value: null,\n  tags: ['a', false],\n  nested: { key: 'value' }\n};`, limits)).toEqual({
      enabled: true, retry: -2, ratio: 1.5, value: null, tags: ['a', false], nested: { key: 'value' },
    });
  });

  it.each([
    ['calls', 'const configSchema = { value: read() };'],
    ['identifiers', 'const value = 1; const configSchema = { value };'],
    ['property access', 'const configSchema = { value: process.env.X };'],
    ['spread', 'const configSchema = { ...other };'],
    ['computed property', "const configSchema = { ['key']: 1 } ;"],
    ['shorthand property', 'const configSchema = { key };'],
    ['method', 'const configSchema = { method() {} };'],
    ['accessor', 'const configSchema = { get value() { return 1; } };'],
    ['template', 'const configSchema = { value: `text` };'],
    ['regexp', 'const configSchema = { value: /text/ };'],
    ['function', 'const configSchema = { value: () => 1 };'],
    ['unsafe object key', "const configSchema = { '__proto__': 1 };"],
    ['duplicate declaration', 'const configSchema = {}; const configSchema = {};'],
    ['parse diagnostics', 'const configSchema = { broken: };'],
  ])('rejects %s', (_name, source) => {
    expect(() => parseCapabilityRegistryLiteral(source, limits)).toThrow();
  });

  it('rejects source, AST-node, and nesting-cap breaches', () => {
    expect(() => parseCapabilityRegistryLiteral('const configSchema = {};', { ...limits, maxSourceBytes: 1 })).toThrow();
    expect(() => parseCapabilityRegistryLiteral('const configSchema = { a: { b: { c: 1 } } };', { ...limits, maxDepth: 2 })).toThrow();
    expect(() => parseCapabilityRegistryLiteral('const configSchema = { a: 1, b: 2 };', { ...limits, maxNodes: 2 })).toThrow();
  });
});
