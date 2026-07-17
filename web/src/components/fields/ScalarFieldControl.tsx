import type { ChangeEvent } from 'react';

interface ScalarFieldControlProps {
  value: unknown;
  type: string | string[];
  id: string;
  label: string;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

export function ScalarFieldControl({
  value,
  type,
  id,
  label,
  onChange,
  disabled,
}: ScalarFieldControlProps) {
  const types = Array.isArray(type) ? type : [type];

  if (types.includes('boolean')) {
    return (
      <label className="gsd-checkbox-label" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <span>Enabled</span>
      </label>
    );
  }

  if (types.includes('integer')) {
    return (
      <input
        id={id}
        type="number"
        step={1}
        value={typeof value === 'number' ? value : ''}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const parsed = e.target.value === '' ? '' : Number(e.target.value);
          onChange(Number.isNaN(parsed) ? e.target.value : parsed);
        }}
        disabled={disabled}
        className="gsd-field-card__input"
        aria-label={label}
      />
    );
  }

  if (types.includes('number')) {
    return (
      <input
        id={id}
        type="number"
        value={typeof value === 'number' ? value : ''}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const parsed = e.target.value === '' ? '' : Number(e.target.value);
          onChange(Number.isNaN(parsed) ? e.target.value : parsed);
        }}
        disabled={disabled}
        className="gsd-field-card__input"
        aria-label={label}
      />
    );
  }

  return (
    <input
      id={id}
      type="text"
      value={typeof value === 'string' ? value : ''}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      disabled={disabled}
      className="gsd-field-card__input"
      aria-label={label}
    />
  );
}
