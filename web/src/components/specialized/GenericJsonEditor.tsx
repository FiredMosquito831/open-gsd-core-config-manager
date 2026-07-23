import { useEffect, useMemo, useState } from 'react';
import type { LoadResult } from '../../../../packages/config-io/src/types';
import type { IndexedField } from '../../schema/indexSchema';
import { getEffectiveLeaf, getLayeredValue } from '../../schema/effective';
import { LayerSummary } from './LayerSummary';

interface GenericJsonEditorProps {
  field: IndexedField;
  loadResult: LoadResult;
  chapter: string;
  value: unknown;
  onChange: (value: unknown) => void;
  onBack: () => void;
}

function defaultValue(field: IndexedField): unknown {
  return Array.isArray(field.entry.type)
    ? field.entry.type.includes('array') ? [] : {}
    : field.entry.type === 'array' ? [] : {};
}

function formatValue(value: unknown): string {
  const formatted = JSON.stringify(value, null, 2);
  return formatted === undefined ? '' : formatted;
}

function expectedType(field: IndexedField): 'array' | 'object' {
  if (Array.isArray(field.entry.type)) {
    return field.entry.type.includes('array') ? 'array' : 'object';
  }
  return field.entry.type === 'array' ? 'array' : 'object';
}

function allowsNull(field: IndexedField): boolean {
  return Array.isArray(field.entry.type) && field.entry.type.includes('null');
}

function typeDescription(field: IndexedField): string {
  const type = expectedType(field);
  return allowsNull(field) ? `${type} or null` : type;
}

export function GenericJsonEditor({ field, loadResult, chapter, value, onChange, onBack }: GenericJsonEditorProps) {
  const initialValue = value === undefined ? defaultValue(field) : value;
  const valueText = formatValue(initialValue);
  const [text, setText] = useState(() => valueText);
  const [error, setError] = useState<string | null>(null);
  const leaf = getEffectiveLeaf(loadResult.effective, field.path);
  const layered = useMemo(() => getLayeredValue(loadResult, field.path), [loadResult, field.path]);
  const effectiveSource = leaf?.from ?? 'canonical';

  useEffect(() => {
    setText(valueText);
    setError(null);
  }, [field.path, valueText]);

  const apply = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setError('Enter valid JSON before applying this structured value.');
      return;
    }

    const type = expectedType(field);
    const validType = parsed === null
      ? allowsNull(field)
      : type === 'array'
        ? Array.isArray(parsed)
        : typeof parsed === 'object' && !Array.isArray(parsed);
    if (!validType) {
      setError(`This setting must be a JSON ${typeDescription(field)}.`);
      return;
    }

    setError(null);
    onChange(parsed);
  };

  return (
    <section className="gsd-focused-workspace" aria-label={`${field.path} JSON editor`} data-testid={`generic-json-editor-${field.path}`}>
      <div className="gsd-focused-workspace__header">
        <button type="button" className="gsd-button gsd-button--ghost gsd-button--md" onClick={onBack}>Back to {chapter}</button>
        <div>
          <p className="gsd-focused-workspace__eyebrow">Structured value editor</p>
          <h2>{field.title}</h2>
          <p>{field.description}</p>
        </div>
      </div>
      <LayerSummary
        layers={{
          canonical: effectiveSource === 'canonical' ? leaf?.value : undefined,
          global: layered.global,
          project: layered.project,
        }}
        effectiveSource={effectiveSource}
      />
      <div className="gsd-generic-json-editor">
        <div>
          <h3>Edit complete JSON value</h3>
          <p className="gsd-generic-json-editor__hint">Changes apply to this entire {expectedType(field)}. Preserve entries you want to keep, including dynamic names.</p>
        </div>
        <label className="gsd-visually-hidden" htmlFor={`generic-json-${field.path}`}>{field.title} JSON</label>
        <textarea
          id={`generic-json-${field.path}`}
          className="gsd-generic-json-editor__textarea"
          aria-label={`${field.title} JSON`}
          value={text}
          onChange={(event) => { setText(event.target.value); setError(null); }}
          spellCheck={false}
        />
        {error && <p className="gsd-generic-json-editor__error" role="alert">{error}</p>}
        <div className="gsd-generic-json-editor__actions">
          <button type="button" className="gsd-button gsd-button--primary gsd-button--md" onClick={apply}>Apply JSON</button>
        </div>
      </div>
    </section>
  );
}
