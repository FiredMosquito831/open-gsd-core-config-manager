import type { ChangeEvent } from 'react';

interface EnumComboboxProps {
  value: unknown;
  options: unknown[];
  meanings: Record<string, string>;
  id: string;
  label: string;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

export function EnumCombobox({
  value,
  options,
  meanings,
  id,
  label,
  onChange,
  disabled,
}: EnumComboboxProps) {
  return (
    <select
      id={id}
      value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
      disabled={disabled}
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
