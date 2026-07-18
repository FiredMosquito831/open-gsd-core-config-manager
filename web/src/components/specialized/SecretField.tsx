import { useEffect, useRef, useState } from 'react';
export interface SecretFieldProps {
  id: string;
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
}

const REMASK_AFTER_MS = 15_000;

export function SecretField({ id, label, value, onChange, onBlur, error, disabled }: SecretFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef<number | null>(null);

  const remask = () => {
    setRevealed(false);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const reveal = () => {
    if (disabled) return;
    setRevealed(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setRevealed(false), REMASK_AFTER_MS);
  };

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  return (
    <div className="gsd-secret-field">
      <div className="gsd-secret-field__control">
        <div className={revealed ? '' : 'gsd-secret-field__masked'}>
          <input id={id} aria-label={label} type={revealed ? 'text' : 'password'} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} onBlur={() => { remask(); onBlur?.(); }} disabled={disabled} className="gsd-field-card__input" autoComplete="off" />
        </div>
        <button type="button" className="gsd-button gsd-button--ghost gsd-button--sm" onClick={revealed ? remask : reveal} disabled={disabled}>
          {revealed ? 'Hide value' : 'Reveal value'}
        </button>
      </div>
      <p className="gsd-secret-field__helper">Re-hides when this field loses focus or after a short period of inactivity.</p>
      {error && <div className="gsd-field-card__error" role="alert">{error}</div>}
    </div>
  );
}
