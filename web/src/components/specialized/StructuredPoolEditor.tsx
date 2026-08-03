import { useMemo } from 'react';
import type { SpecializedDescriptor, SpecializedField } from '../../schema/specializedMetadata';
import { EnumCombobox } from '../fields/EnumCombobox';
import { SecretField } from './SecretField';
import bundledSchema from '../../../../packages/schema-data/bundled-schema.json' with { type: 'json' };
import type { SchemaEntry } from '../../../../packages/config-io/src/types';

const schema = bundledSchema as Record<string, SchemaEntry>;

/**
 * Derive plain-language meanings for a dynamic-map leaf value set (e.g. the
 * effort ladder, or coarse/standard/fine) from the schema entry whose enum
 * matches that value set exactly. This keeps the prose in curated-docs.json
 * (single source of truth) instead of duplicating it in the specialized
 * descriptor layer.
 */
function deriveMeanings(values: unknown[]): Record<string, string> {
  const set = new Set(values.map((value) => String(value)));
  for (const entry of Object.values(schema)) {
    const entryEnum = entry.enum ?? [];
    if (entryEnum.length !== set.size) continue;
    if (!entryEnum.every((value) => set.has(String(value)))) continue;
    const meanings: Record<string, string> = {};
    for (const value of entryEnum) {
      const text = entry['x-options']?.[String(value)]?.['x-description'];
      if (text) meanings[String(value)] = text;
    }
    if (Object.keys(meanings).length > 0) return meanings;
  }
  return {};
}

interface StructuredPoolEditorProps {
  descriptor: SpecializedDescriptor;
  value: unknown;
  onChange: (value: unknown) => void;
}

function fieldValue(value: unknown, path: string): unknown {
  if (!value || typeof value !== 'object') return undefined;
  return (value as Record<string, unknown>)[path];
}

export function StructuredPoolEditor({ descriptor, value, onChange }: StructuredPoolEditorProps) {
  const fields = descriptor.fields ?? [];
  const objectValue = useMemo(() => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}), [value]);
  const update = (field: SpecializedField, next: unknown) => onChange({ ...objectValue, [field.path]: next });

  if (descriptor.editor === 'read-only-unsupported' || !descriptor.editable) {
    const redact = (input: unknown, key = ''): unknown => {
      if (typeof input === 'string' && /(token|secret|password|api[_-]?key|credential)/i.test(key)) return '[redacted]';
      if (Array.isArray(input)) return input.map((item) => redact(item));
      if (input && typeof input === 'object') return Object.fromEntries(Object.entries(input).map(([childKey, childValue]) => [childKey, redact(childValue, childKey)]));
      return input;
    };
    return <div className="gsd-specialized-readonly" role="status"><strong>Read-only value</strong><p>{descriptor.reason ?? 'This shape is not confirmed by the bundled validation schema.'}</p><pre>{JSON.stringify(redact(value), null, 2)}</pre></div>;
  }

  // Scalar-leaf map entries (e.g. models.<phase_type>, granularities.<phase_type>,
  // effort.routing_tier_defaults.<tier>) hold one catalogued value rather than a
  // sub-object. Render a validated picker when the descriptor declares
  // allowedValues, and fall back to a plain control otherwise.
  if (fields.length === 0) {
    const id = `specialized-${descriptor.path.replace(/[^a-z0-9]+/gi, '-')}-value`;
    const options = descriptor.allowedValues ?? [];
    if (options.length > 0) {
      const meanings = deriveMeanings(options);
      const descriptorMeanings = descriptor.allowedDescriptions ? descriptor.allowedDescriptions : {};
      const mergedMeanings = Object.keys(meanings).length > 0 ? meanings : descriptorMeanings;
      return (
        <section className="gsd-structured-editor" aria-label="Entry value">
          <h3>Value</h3>
          <p className="gsd-specialized-editor__hint">This entry holds one catalogued value.</p>
          <label htmlFor={id}>{descriptor.path}</label>
          <EnumCombobox id={id} label={descriptor.path} value={value} options={options} meanings={mergedMeanings} onChange={onChange} />
          {Object.keys(mergedMeanings).length > 0 && (
            <dl className="gsd-specialized-editor__meanings">
              {options.map((option) => (
                <div key={String(option)} className="gsd-field-card__option">
                  <dt>{option === null ? '(unset)' : String(option)}</dt>
                  <dd>{mergedMeanings[String(option)] ?? <span className="gsd-content-gap">No description yet</span>}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      );
    }
    if (typeof value === 'boolean') {
      return (
        <section className="gsd-structured-editor" aria-label="Entry value">
          <h3>Value</h3>
          <label htmlFor={id}>{descriptor.path}</label>
          <select id={id} aria-label={descriptor.path} value={String(value)} onChange={(event) => onChange(event.target.value === 'true')}><option value="true">true</option><option value="false">false</option></select>
        </section>
      );
    }
    if (value !== null && typeof value === 'object') {
      return (
        <section className="gsd-structured-editor" aria-label="Entry value">
          <h3>Value</h3>
          <p className="gsd-specialized-editor__hint">This entry holds a nested value with no confirmed per-field editor yet; it stays read-only here.</p>
          <pre>{JSON.stringify(value, null, 2)}</pre>
        </section>
      );
    }
    return (
      <section className="gsd-structured-editor" aria-label="Entry value">
        <h3>Value</h3>
        <label htmlFor={id}>{descriptor.path}</label>
        <input id={id} aria-label={descriptor.path} value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''} onChange={(event) => onChange(event.target.value)} />
      </section>
    );
  }

  return (
    <section className="gsd-structured-editor" aria-label="Structured entry fields">
      <h3>Entry details</h3>
      <p className="gsd-specialized-editor__hint">Only fields confirmed by the catalog are editable. Required fields stay visible when invalid.</p>
      {fields.map((field) => {
        const current = fieldValue(objectValue, field.path);
        const invalid = field.required && (current === undefined || current === '');
        const id = `specialized-${descriptor.path.replace(/[^a-z0-9]+/gi, '-')}-${field.path}`;
        return (
          <div key={field.path} className={`gsd-specialized-field ${invalid ? 'gsd-specialized-field--invalid' : ''}`}>
            <label htmlFor={id}>{field.path}{field.required ? ' (required)' : ''}</label>
            {descriptor.sensitive || field.path.toLowerCase().includes('token') || field.path.toLowerCase().includes('secret') ? (
              <SecretField id={id} label={field.path} value={current} onChange={(next) => update(field, next)} />
            ) : field.type === 'boolean' ? (
              <select id={id} aria-label={field.path} value={String(current ?? false)} onChange={(event) => update(field, event.target.value === 'true')}><option value="true">true</option><option value="false">false</option></select>
            ) : (
              <input id={id} aria-label={field.path} value={typeof current === 'string' || typeof current === 'number' ? String(current) : ''} onChange={(event) => update(field, event.target.value)} />
            )}
            {invalid && <p className="gsd-field-card__error" role="alert">{field.path} is required.</p>}
          </div>
        );
      })}
    </section>
  );
}
