import type { ChangeEvent } from 'react';

interface EnumComboboxProps {
  value: unknown;
  options: unknown[];
  meanings: Record<string, string>;
  id: string;
  label: string;
  onChange: (value: unknown) => void;
  onBlur?: () => void;
  disabled?: boolean;
}

export function EnumCombobox({
  value,
  options,
  meanings,
  id,
  label,
  onChange,
  onBlur,
  disabled,
}: EnumComboboxProps) {
  return (
    <select
      id={id}
      value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
      disabled={disabled}
      onBlur={onBlur}
      className="gsd-field-card__select"
      aria-label={label}
    >
      {options.map((option) => {
        const key = String(option);
        return (
          <option key={key} value={key}>
            {key}
          </option>
        );
      })}
    </select>
  );
}
