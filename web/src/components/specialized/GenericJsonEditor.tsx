import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter } from '@codemirror/lint';
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

/**
 * Inline CodeMirror diagnostic for the value's container contract (array /
 * object / nullable), so a wrong-container value gets an inline squiggle before
 * the user hits Apply. Syntax errors are left to `jsonParseLinter` (returning []
 * here avoids double-reporting a malformed document).
 */
function typeContractLinter(expected: 'array' | 'object', allowNull: boolean) {
  return linter((view) => {
    const source = view.state.doc.toString();
    let parsed: unknown;
    try {
      parsed = JSON.parse(source);
    } catch {
      return [];
    }
    const valid = parsed === null
      ? allowNull
      : expected === 'array'
        ? Array.isArray(parsed)
        : typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
    if (valid) return [];
    return [{
      from: 0,
      to: Math.min(source.length, 1),
      severity: 'error',
      message: `This setting must be a JSON ${expected}${allowNull ? ' or null' : ''}.`,
    }];
  });
}

export function GenericJsonEditor({ field, loadResult, chapter, value, onChange, onBack }: GenericJsonEditorProps) {
  const initialValue = value === undefined ? defaultValue(field) : value;
  const valueText = formatValue(initialValue);
  const [error, setError] = useState<string | null>(null);
  const leaf = getEffectiveLeaf(loadResult.effective, field.path);
  const layered = useMemo(() => getLayeredValue(loadResult, field.path), [loadResult, field.path]);
  const effectiveSource = leaf?.from ?? 'canonical';

  // The CodeMirror view owns the document text after mount; textRef mirrors it
  // so Apply can read the current draft without re-rendering on every keystroke.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const textRef = useRef<string>(valueText);
  const valueTextRef = useRef(valueText);
  valueTextRef.current = valueText;

  // Create the editor once per field. Deps intentionally key on `field.path`
  // (metadata for a given path is stable) so the editor is not recreated when
  // the parent supplies a fresh field object on unrelated renders.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const view = new EditorView({
      doc: valueTextRef.current,
      parent: container,
      extensions: [
        basicSetup,
        json(),
        linter(jsonParseLinter()),
        typeContractLinter(expectedType(field), allowsNull(field)),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ 'aria-label': `${field.title} JSON` }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            textRef.current = update.state.doc.toString();
            setError(null);
          }
        }),
      ],
    });
    viewRef.current = view;
    textRef.current = valueTextRef.current;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.path]);

  // Replace the document when the parent's effective value changes (external
  // update, or after Apply re-formats the value). Same draft-preservation
  // behavior as the old textarea: an unchanged valueText leaves a typed draft
  // untouched.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const next = valueTextRef.current;
    if (view.state.doc.toString() !== next) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueText]);

  const apply = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(textRef.current);
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
          <p className="gsd-generic-json-editor__hint">Changes apply to this entire {expectedType(field)}. Preserve entries you want to keep, including dynamic names. Syntax errors and type mismatches are underlined inline.</p>
        </div>
        <div className="gsd-generic-json-editor__codemirror" ref={containerRef} />
        {error && <p className="gsd-generic-json-editor__error" role="alert">{error}</p>}
        <div className="gsd-generic-json-editor__actions">
          <button type="button" className="gsd-button gsd-button--primary gsd-button--md" onClick={apply}>Apply JSON</button>
        </div>
      </div>
    </section>
  );
}
