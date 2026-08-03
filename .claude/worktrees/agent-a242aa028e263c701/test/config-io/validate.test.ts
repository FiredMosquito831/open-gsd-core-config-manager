import { describe, expect, it } from 'vitest';
import { createValidator, formatErrors } from '../../packages/config-io/src/validate.js';

/**
 * Small inline 2020-12 fixture schema — deliberately does not depend on
 * Plan 02's bundled-schema.json artifact (01-03-PLAN.md Task 1 read_first
 * note). Exercises: a boolean field, an enum field, vendor keywords, and
 * open additionalProperties at every object node.
 */
const FIXTURE_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    workflow: {
      type: 'object',
      'x-category': 'Workflow',
      properties: {
        tdd_mode: {
          type: 'boolean',
          default: false,
          title: 'TDD Mode',
          'x-category': 'Workflow',
          'x-description': 'Whether TDD mode is enabled.',
          'x-provenance': 'capability-registry',
        },
        code_review_depth: {
          type: 'string',
          enum: ['quick', 'standard', 'deep'],
          default: 'standard',
          title: 'Code Review Depth',
          'x-category': 'Workflow',
          'x-description': 'Default depth for code review.',
          'x-provenance': 'capability-registry',
          'x-options': {
            quick: { 'x-description': '' },
            standard: { 'x-description': '' },
            deep: { 'x-description': '' },
          },
        },
        api_key: {
          type: 'string',
          title: 'API Key',
          'x-category': 'Workflow',
          'x-description': 'A secret-shaped field used only to prove errors never leak values.',
          'x-provenance': 'fixture-observed',
        },
      },
      // additionalProperties intentionally left open (undeclared).
    },
  },
  // additionalProperties intentionally left open (undeclared) at the root too.
};

describe('createValidator (Ajv 2020-12)', () => {
  it('compiles the fixture schema without throwing on x-* vendor keywords', () => {
    expect(() => createValidator(FIXTURE_SCHEMA)).not.toThrow();
  });

  it('returns { valid: true, errors: [] } for valid data', () => {
    const validate = createValidator(FIXTURE_SCHEMA);
    const result = validate({ workflow: { tdd_mode: true, code_review_depth: 'deep' } });
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('returns { valid: false, errors: [...] } with instancePath for structurally-invalid data, never throwing', () => {
    const validate = createValidator(FIXTURE_SCHEMA);

    // boolean field given a string
    expect(() => validate({ workflow: { tdd_mode: 'not-a-boolean' } })).not.toThrow();
    const badBoolean = validate({ workflow: { tdd_mode: 'not-a-boolean' } });
    expect(badBoolean.valid).toBe(false);
    expect(badBoolean.errors.length).toBeGreaterThan(0);
    expect((badBoolean.errors[0] as { instancePath: string }).instancePath).toBeDefined();

    // enum field given an out-of-enum value
    const badEnum = validate({ workflow: { code_review_depth: 'ultra-deep' } });
    expect(badEnum.valid).toBe(false);
    expect(badEnum.errors.length).toBeGreaterThan(0);
    expect((badEnum.errors[0] as { instancePath: string }).instancePath).toBeDefined();
  });

  it('returns { valid: true } for data carrying an unknown/future key (additionalProperties open)', () => {
    const validate = createValidator(FIXTURE_SCHEMA);
    const result = validate({
      workflow: { tdd_mode: true, x_test_unknown_toggle: true },
      x_gsdcm_test_future_key: 'some-future-value',
    });
    expect(result.valid).toBe(true);
  });

  it('formatErrors never includes the offending secret-shaped value in rendered error text', () => {
    const validate = createValidator(FIXTURE_SCHEMA);
    const SECRET = 'sk-fake-secret-shaped-value-1234567890';
    const result = validate({ workflow: { api_key: 123, tdd_mode: SECRET } });
    expect(result.valid).toBe(false);

    const rendered = formatErrors(result.errors).join('\n');
    expect(rendered).not.toContain(SECRET);
    // Sanity: rendered output should still be non-empty and reference instancePath-shaped info.
    expect(rendered.length).toBeGreaterThan(0);
  });
});
