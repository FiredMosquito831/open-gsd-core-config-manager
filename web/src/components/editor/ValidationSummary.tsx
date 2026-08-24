import { Icons } from '../common/Icons';

export interface ValidationSummaryError {
  message: string;
  instancePath?: string;
  keyword?: string;
}

interface ValidationSummaryProps {
  errors: ValidationSummaryError[];
  /** Select the field (jump to its chapter, scroll + focus its card). */
  onJump: (path: string) => void;
}

function formatPath(path?: string): string {
  if (!path || path === '/') return 'config';
  return path.replace(/^\//, '').replace(/\//g, '.');
}

const KEYWORD_LABELS: Record<string, string> = {
  required: 'Required',
  type: 'Wrong type',
  enum: 'Invalid option',
  minimum: 'Too small',
  maximum: 'Too large',
  minLength: 'Too short',
  maxLength: 'Too long',
  pattern: 'Wrong format',
  additionalProperties: 'Unexpected key',
};

function keywordLabel(keyword?: string): string | null {
  if (keyword && KEYWORD_LABELS[keyword]) return KEYWORD_LABELS[keyword];
  return null;
}

export function ValidationSummary({ errors, onJump }: ValidationSummaryProps) {
  if (errors.length === 0) return null;

  const noun = errors.length === 1 ? 'field needs' : 'fields need';

  return (
    <div
      className="gsd-validation-summary"
      role="alert"
      aria-label={`${errors.length} ${noun} attention before saving`}
    >
      <div className="gsd-validation-summary__head">
        <Icons.warning size={16} aria-hidden="true" />
        <h3 className="gsd-validation-summary__title">
          {errors.length} {noun} attention before saving
        </h3>
      </div>
      <ul className="gsd-validation-summary__list">
        {errors.map((err, i) => {
          const key = err.instancePath ?? `error-${i}`;
          return (
            <li key={key} className="gsd-validation-summary__item">
              <button
                type="button"
                className="gsd-validation-summary__jump"
                onClick={() => onJump(err.instancePath ?? '/')}
              >
                <code className="gsd-validation-summary__path">{formatPath(err.instancePath)}</code>
                <span className="gsd-validation-summary__message">{err.message}</span>
                {keywordLabel(err.keyword) && (
                  <span className="gsd-validation-summary__keyword">{keywordLabel(err.keyword)}</span>
                )}
                <span className="gsd-validation-summary__goto" aria-hidden="true">Go to field</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
