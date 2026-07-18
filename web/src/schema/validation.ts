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
  'x-specialized',
];

function dotPathFromInstancePath(instancePath: string): string {
  return instancePath || '/';
}

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

  const enumByPath = new Map(
    Object.entries(schema)
      .filter(([, entry]) => entry.enum)
      .map(([path, entry]) => [path, entry.enum!] as const),
  );

  return (data: unknown): ClientValidationResult => {
    const valid = validateFn(data) as boolean;
    const enumErrors: ClientValidationError[] = [];
    for (const [path, allowed] of enumByPath) {
      const segments = path.split('.');
      let value: unknown = data;
      for (const segment of segments) {
        if (value === null || typeof value !== 'object') { value = undefined; break; }
        value = (value as Record<string, unknown>)[segment];
      }
      if (value !== undefined && !allowed.includes(value)) {
        enumErrors.push({ path: `/${path.replaceAll('.', '/')}`, message: 'must be an allowed option' });
      }
    }
    if (valid && enumErrors.length === 0) return { valid: true, errors: [] };
    if (valid) return { valid: false, errors: enumErrors };
    const ajvErrors = (validateFn.errors ?? []).map((err: ErrorObject) => ({
      message: err.message ?? 'invalid',
      path: dotPathFromInstancePath(err.instancePath || '/'),
    }));
    if (enumErrors.length > 0) ajvErrors.push(...enumErrors);
    return {
      valid: false,
      errors: ajvErrors,
    };
  };
}
