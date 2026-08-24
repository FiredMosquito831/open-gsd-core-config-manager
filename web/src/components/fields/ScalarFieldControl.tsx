import type { ChangeEvent } from 'react';

interface ScalarConstraints {
  min?: number;
  max?: number;
  step?: number;
}

interface ScalarFieldControlProps {
  value: unknown;
  type: string | string[];
  id: string;
  label: string;
  onChange: (value: unknown) => void;
  onBlur?: () => void;
  disabled?: boolean;
  /** JSON-Schema numeric constraints, when the schema declares them. */
  constraints?: ScalarConstraints;
}

function constraintText(constraints?: ScalarConstraints): string | null {
  if (!constraints) return null;
  const parts: string[] = [];
  if (constraints.min !== undefined) parts.push(`min ${constraints.min}`);
  if (constraints.max !== undefined) parts.push(`max ${constraints.max}`);
  if (constraints.step !== undefined && constraints.step !== 1) parts.push(`step ${constraints.step}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function ScalarFieldControl({
  value,
  type,
  id,
  label,
  onChange,
  onBlur,
  disabled,
  constraints,
}: ScalarFieldControlProps) {
  const types = Array.isArray(type) ? type : [type];

  if (types.includes('boolean')) {
    const checked = Boolean(value);
    return (
      <div className="gsd-switch">
        <div className="gsd-switch__group" id={id} role="radiogroup" aria-label={`${label} (on or off)`}>
          <button
            type="button"
            role="radio"
            aria-checked={!checked}
            className={`gsd-switch__option gsd-switch__option--off ${!checked ? 'gsd-switch__option--active' : ''}`}
            disabled={disabled}
            onClick={() => onChange(false)}
          >
            Off
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={checked}
            className={`gsd-switch__option gsd-switch__option--on ${checked ? 'gsd-switch__option--active' : ''}`}
            disabled={disabled}
            onClick={() => onChange(true)}
          >
            On
          </button>
        </div>
        <span className="gsd-switch__state">Currently {checked ? 'On' : 'Off'}</span>
      </div>
    );
  }

  const constraintCopy = constraintText(constraints);

  if (types.includes('integer') || types.includes('number')) {
    const isInteger = types.includes('integer');
    const inputStep = constraints?.step ?? (isInteger ? 1 : undefined);
    return (
      <>
        <input
          id={id}
          type="number"
          step={inputStep}
          min={constraints?.min}
          max={constraints?.max}
          value={typeof value === 'number' ? value : ''}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const parsed = e.target.value === '' ? '' : Number(e.target.value);
            onChange(Number.isNaN(parsed) ? e.target.value : parsed);
          }}
          disabled={disabled}
          onBlur={onBlur}
          className="gsd-field-card__input"
          aria-label={label}
        />
        {constraintCopy && (
          <p className="gsd-field-card__constraint">{constraintCopy}</p>
        )}
      </>
    );
  }

  return (
    <input
      id={id}
      type="text"
      value={typeof value === 'string' ? value : ''}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      disabled={disabled}
      onBlur={onBlur}
      className="gsd-field-card__input"
      aria-label={label}
    />
  );
}
