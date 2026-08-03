export interface ValidationSummaryError {
  message: string;
  instancePath?: string;
  keyword?: string;
}

interface ValidationSummaryProps {
  errors: ValidationSummaryError[];
  kind: 'client' | 'server';
}

function formatPath(path?: string) {
  if (!path || path === '/') return 'config';
  return path.replace(/^\//, '').replace(/\//g, '.');
}

export function ValidationSummary({ errors, kind }: ValidationSummaryProps) {
  if (errors.length === 0) return null;

  return (
    <div className="gsd-validation-summary" role="alert">
      <h3 className="gsd-validation-summary__title">
        {kind === 'server' ? 'Server validation failed' : 'Validation errors'}
      </h3>
      <ul className="gsd-validation-summary__list">
        {errors.map((err, i) => (
          <li key={i} className="gsd-validation-summary__item">
            <code className="gsd-validation-summary__path">
              {formatPath(err.instancePath)}
            </code>
            <span className="gsd-validation-summary__message">{err.message}</span>
            {err.keyword && (
              <span className="gsd-validation-summary__keyword">{err.keyword}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
