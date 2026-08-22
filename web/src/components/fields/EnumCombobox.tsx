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
  const hasNull = options.includes(null);
  const currentKey = value === null || value === undefined ? '' : String(value);
  return (
    <select
      id={id}
      value={currentKey}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
        const raw = e.target.value;
        if (raw === '' && hasNull) {
          onChange(null);
          return;
        }
        // Preserve the option's original type (boolean/number/null) instead of
        // always emitting a string: match the selected value back onto the
        // option that rendered it.
        const matched = options.find((option) => option !== null && String(option) === raw);
        onChange(matched !== undefined ? matched : raw);
      }}
      disabled={disabled}
      onBlur={onBlur}
      className="gsd-field-card__select"
      aria-label={label}
    >
      {hasNull && (
        <option value="">(unset)</option>
      )}
      {options.filter((option) => option !== null).map((option) => {
        const key = String(option);
        const meaning = meanings[key];
        const label = meaning
          ? `${key} — ${meaning.length > 80 ? meaning.slice(0, 77) + '…' : meaning}`
          : key;
        return (
          <option key={key} value={key}>
            {label}
          </option>
        );
      })}
    </select>
  );
}
