import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import type { ErrorObject } from 'ajv';
import { buildAjvSchema } from '../../../packages/config-io/src/schema-convert';
import type { SchemaEntry } from '../../../packages/config-io/src/types';

export interface ClientValidationError {
  message: string;
  path: string;
}

export interface ClientValidationResult {
  valid: boolean;
  errors: ClientValidationError[];
}

const VENDOR_KEYWORDS = [
  'x-category',
  'x-description',
  'x-provenance',
  'x-options',
  'x-dynamic-key-hint',
];

export function createClientValidator(schema: Record<string, SchemaEntry>) {
  const ajv = new Ajv({
    allErrors: true,
    strict: true,
    allowUnionTypes: true,
    allowMatchingProperties: true,
  });
  addFormats(ajv);
  for (const keyword of VENDOR_KEYWORDS) {
    ajv.addKeyword({ keyword });
  }

  const ajvSchema = buildAjvSchema(schema);
  const validateFn = ajv.compile(ajvSchema);

  return (data: unknown): ClientValidationResult => {
    const valid = validateFn(data) as boolean;
    if (valid) return { valid: true, errors: [] };
    return {
      valid: false,
      errors: (validateFn.errors ?? []).map((err: ErrorObject) => ({
        message: err.message ?? 'invalid',
        path: err.instancePath || '/',
      })),
    };
  };
}
