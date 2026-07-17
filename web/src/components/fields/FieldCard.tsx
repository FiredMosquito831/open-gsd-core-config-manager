import { useState } from 'react';
import { useController, type Control } from 'react-hook-form';
import type { IndexedField } from '../../schema/indexSchema';
import type { EffectiveLeaf } from '../../../../packages/config-io/src/types';
import { provenanceLabel } from '../../schema/effective';
import { ScalarFieldControl } from './ScalarFieldControl';
import { EnumCombobox } from './EnumCombobox';

interface FieldCardProps {
  field: IndexedField;
  leaf: EffectiveLeaf | null;
  control: Control<Record<string, unknown>>;
  onFieldChange: (path: string, value: unknown) => void;
  onResetField: (path: string) => void;
}

export function FieldCard({ field, leaf, control, onFieldChange, onResetField }: FieldCardProps) {
  const [expanded, setExpanded] = useState(false);
  const id = `field-${field.path}`;
  const provenance = leaf?.from;
  const effectiveValue = leaf?.value;
  const canReset = provenance === 'project';

  const { field: controllerField, fieldState } = useController({
    name: field.path,
    control,
  });

  const displayValue = controllerField.value !== undefined ? controllerField.value : effectiveValue;

  const handleReset = () => {
    controllerField.onChange(undefined);
    onResetField(field.path);
  };

  const describedOptions = Object.keys(field.optionMeanings);
  const hasContentGap =
    field.enumValues &&
    field.enumValues.length > 0 &&
    describedOptions.length < field.enumValues.length;

  return (
    <div data-testid={`field-${field.path}`} className="gsd-field-card">
      <div className="gsd-field-card__header">
        <div>
          <label className="gsd-field-card__title" htmlFor={id}>
            {field.title}
          </label>
          <div className="gsd-field-card__path">{field.path}</div>
        </div>
        <div className="gsd-field-card__provenance">
          {provenance && (
            <span className={`gsd-provenance gsd-provenance--${provenance}`}>
              {provenanceLabel(provenance)}
            </span>
          )}
        </div>
      </div>

      <p className="gsd-field-card__description">{field.description}</p>

      <div className="gsd-field-card__control">
        {field.enumValues && field.enumValues.length > 0 ? (
          <EnumCombobox
            id={id}
            label={field.title}
            value={displayValue}
            options={field.enumValues}
            meanings={field.optionMeanings}
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
            Reset project override
          </button>
        )}
        <button
          type="button"
          className="gsd-button gsd-button--ghost gsd-button--sm"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Hide details' : 'Show details'}
        </button>
      </div>

      {expanded && (
        <div className="gsd-field-card__details">
          {field.enumValues && field.enumValues.length > 0 && (
            <div className="gsd-field-card__options">
              <h4>Option meanings</h4>
              <dl>
                {field.enumValues.map((option) => {
                  const key = String(option);
                  const meaning = field.optionMeanings[key];
                  return (
                    <div key={key} className="gsd-field-card__option">
                      <dt>{key}</dt>
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
          )}

          <div className="gsd-field-card__current">
            <span>Current value:</span>
            <code>{displayValue === undefined ? 'undefined' : JSON.stringify(displayValue)}</code>
          </div>
        </div>
      )}
    </div>
  );
}
