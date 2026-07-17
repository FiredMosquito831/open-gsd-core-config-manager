// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createClientValidator } from '../../web/src/schema/validation';
import type { SchemaEntry } from '../../packages/config-io/src/types';

const schema: Record<string, SchemaEntry> = {
  mode: {
    type: 'string',
    enum: ['interactive', 'autonomous'],
    title: 'Mode',
    'x-category': 'Core',
    'x-description': 'Mode',
    'x-provenance': 'config-defaults',
  },
  count: {
    type: 'integer',
    title: 'Count',
    'x-category': 'Core',
    'x-description': 'Count',
    'x-provenance': 'config-defaults',
  },
};

describe('createClientValidator', () => {
  it('validates a conforming object', () => {
    const validate = createClientValidator(schema);
    const result = validate({ mode: 'interactive', count: 5, email: 'hi@example.com' });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('reports invalid enum values', () => {
    const validate = createClientValidator(schema);
    const result = validate({ mode: 'unknown', count: 5 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === '/mode')).toBe(true);
  });

  it('reports invalid integer values', () => {
    const validate = createClientValidator(schema);
    const result = validate({ mode: 'interactive', count: 3.5 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === '/count')).toBe(true);
  });

  it('allows unknown additional keys', () => {
    const validate = createClientValidator(schema);
    const result = validate({ mode: 'interactive', future_key: true });
    expect(result.valid).toBe(true);
  });
});
