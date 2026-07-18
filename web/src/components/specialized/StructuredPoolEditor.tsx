import { useMemo } from 'react';
import type { SpecializedDescriptor, SpecializedField } from '../../schema/specializedMetadata';
import { SecretField } from './SecretField';

interface StructuredPoolEditorProps {
  descriptor: SpecializedDescriptor;
  value: unknown;
  onChange: (value: Record<string, unknown>) => void;
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
      {fields.length === 0 && <p className="gsd-specialized-editor__hint">No confirmed editable fields are available for this shape.</p>}
    </section>
  );
}
