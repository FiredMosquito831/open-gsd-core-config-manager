import { useEffect, useRef, useState } from 'react';
import { useController, type Control } from 'react-hook-form';
import type { IndexedField } from '../../schema/indexSchema';
import type { EffectiveLeaf } from '../../../../packages/config-io/src/types';
import { provenanceLabel } from '../../schema/effective';
import { useUiStore } from '../../state/uiStore';
import { ScalarFieldControl } from './ScalarFieldControl';
import { EnumCombobox } from './EnumCombobox';

interface FieldCardProps {
  field: IndexedField;
  leaf: EffectiveLeaf | null;
  control: Control<Record<string, unknown>>;
  onFieldChange: (path: string, value: unknown) => void;
  onResetField: (path: string) => void;
}

/** Render a leaf value as compact, human-readable chip text. */
function displayScalar(value: unknown): string {
  if (value === null) return '(unset)';
  if (value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return value === '' ? '""' : value;
  return String(value);
}

/** First sentence of a paragraph — the default scan-time summary. */
function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](?=\s|$)/);
  return match ? match[0].trim() : text.trim();
}

/** Pull JSON-Schema numeric constraints off the entry when present. */
function readConstraints(entry: IndexedField['entry']): { min?: number; max?: number; step?: number } | undefined {
  const record = entry as unknown as Record<string, unknown>;
  const min = typeof record.minimum === 'number' ? record.minimum : undefined;
  const max = typeof record.maximum === 'number' ? record.maximum : undefined;
  const step = typeof record.multipleOf === 'number' ? record.multipleOf : undefined;
  if (min === undefined && max === undefined && step === undefined) return undefined;
  return { min, max, step };
}

export function FieldCard({ field, leaf, control, onFieldChange, onResetField }: FieldCardProps) {
  const [explainOpen, setExplainOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { highlightTarget, clearHighlight } = useUiStore();
  const isHighlighted = highlightTarget === field.path;
  const id = `field-${field.path}`;
  const provenance = leaf?.from;
  const effectiveValue = leaf?.value;
  const canReset = provenance === 'project';
  const defaultValue = field.entry.default;

  const { field: controllerField, fieldState } = useController({
    name: field.path,
    control,
  });

  const displayValue = controllerField.value !== undefined ? controllerField.value : effectiveValue;
  const isDirty = Boolean(fieldState.isDirty);
  const isInvalid = Boolean(fieldState.error);

  useEffect(() => {
    if (!isHighlighted || !cardRef.current) return;
    cardRef.current.focus();
    cardRef.current.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    const timeout = window.setTimeout(() => clearHighlight(), 1800);
    return () => window.clearTimeout(timeout);
  }, [clearHighlight, isHighlighted]);

  const handleReset = () => {
    controllerField.onChange(undefined);
    onResetField(field.path);
  };

  const summary = field.description ? firstSentence(field.description) : '';
  const isEnum = Boolean(field.enumValues && field.enumValues.length > 0);
  const describedOptions = Object.keys(field.optionMeanings);
  const hasContentGap =
    isEnum && field.enumValues!.length > 0 && describedOptions.length < field.enumValues!.length;
  const cardClass = [
    'gsd-field-card',
    isHighlighted ? 'gsd-field-card--highlighted' : '',
    isDirty ? 'gsd-field-card--dirty' : '',
    isInvalid ? 'gsd-field-card--invalid' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={cardRef}
      data-testid={`field-${field.path}`}
      className={cardClass}
      tabIndex={-1}
    >
      <div className="gsd-field-card__header">
        <div>
          <label className="gsd-field-card__title" htmlFor={id}>
            {field.title}
          </label>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
          <span className="gsd-field-card__path">{field.path}</span>
          {isDirty && <span className="gsd-field-card__edited-tag">Edited</span>}
        </div>
      </div>

      {summary && <p className="gsd-field-card__summary">{summary}</p>}

      <div className="gsd-field-card__chips">
        <span className="gsd-field-card__chip">
          <span className="gsd-field-card__chip-label">Effective</span>
          <span className="gsd-field-card__chip-value">{displayScalar(effectiveValue)}</span>
        </span>
        {provenance && (
          <span className={`gsd-field-card__chip gsd-field-card__chip--source gsd-provenance--${provenance}`}>
            <span className="gsd-field-card__chip-label">Source</span>
            <span>{provenanceLabel(provenance)}</span>
          </span>
        )}
        {defaultValue !== undefined && (
          <span className="gsd-field-card__chip">
            <span className="gsd-field-card__chip-label">Default</span>
            <span className="gsd-field-card__chip-value">{displayScalar(defaultValue)}</span>
          </span>
        )}
      </div>

      {isDirty && provenance !== 'project' && (
        <p className="gsd-field-card__override-note">Your edit will override the inherited value.</p>
      )}

      <div className="gsd-field-card__control">
        {isEnum ? (
          <EnumCombobox
            id={id}
            label={field.title}
            value={displayValue}
            options={field.enumValues!}
            meanings={field.optionMeanings}
            describedById={`${id}-meaning`}
            onChange={(value) => {
              controllerField.onChange(value);
              onFieldChange(field.path, value);
            }}
            onBlur={controllerField.onBlur}
          />
        ) : (
          <ScalarFieldControl
            id={id}
            label={field.title}
            value={displayValue}
            type={field.entry.type}
            constraints={readConstraints(field.entry)}
            onChange={(value) => {
              controllerField.onChange(value);
              onFieldChange(field.path, value);
            }}
            onBlur={controllerField.onBlur}
          />
        )}
      </div>

      {fieldState.error && fieldState.isTouched && (
        <div className="gsd-field-card__error" role="alert">
          {fieldState.error.message}
        </div>
      )}

      <div className="gsd-field-card__actions">
        {canReset && (
          <button
            type="button"
            className="gsd-button gsd-button--ghost gsd-button--sm"
            onClick={handleReset}
          >
            Restore inherited value
          </button>
        )}
        <button
          type="button"
          className="gsd-button gsd-button--ghost gsd-button--sm"
          onClick={() => setExplainOpen((v) => !v)}
          aria-expanded={explainOpen}
        >
          {explainOpen ? 'Hide explanation' : 'What this controls'}
        </button>
        {isEnum && (
          <button
            type="button"
            className="gsd-button gsd-button--ghost gsd-button--sm"
            onClick={() => setOptionsOpen((v) => !v)}
            aria-expanded={optionsOpen}
          >
            {optionsOpen ? 'Hide options' : `Compare options (${field.enumValues!.length})`}
          </button>
        )}
      </div>

      {explainOpen && (
        <div className="gsd-field-card__disclosure">
          <h4 className="gsd-field-card__disclosure-title">What this controls</h4>
          <p className="gsd-field-card__explanation">{field.description}</p>
        </div>
      )}

      {optionsOpen && isEnum && (
        <div className="gsd-field-card__disclosure">
          <h4 className="gsd-field-card__disclosure-title">Option meanings</h4>
          <div className="gsd-field-card__options">
            <dl>
              {field.enumValues!.map((option) => {
                const key = String(option);
                const meaning = field.optionMeanings[key];
                return (
                  <div key={key} className="gsd-field-card__option">
                    <dt>{option === null ? '(unset)' : key}</dt>
                    <dd>{meaning || <span className="gsd-content-gap">No description yet</span>}</dd>
                  </div>
                );
              })}
            </dl>
            {hasContentGap && (
              <p className="gsd-content-gap-notice">
                Option meanings missing for some values. Curated explanations will appear here
                once added to the schema.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
