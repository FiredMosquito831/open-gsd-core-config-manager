import type { IndexedField } from '../../schema/indexSchema';

interface SpecializedHandoffCardProps {
  field: IndexedField;
}

export function SpecializedHandoffCard({ field }: SpecializedHandoffCardProps) {
  const reasonLabels: Record<string, string> = {
    array: 'array editor',
    object: 'structured object editor',
    'dynamic-map': 'dynamic map editor',
  };

  return (
    <div data-testid={`handoff-${field.path}`} className="gsd-handoff-card">
      <div className="gsd-handoff-card__header">
        <div className="gsd-handoff-card__title">{field.title}</div>
        <span className="gsd-handoff-card__badge">Phase 4</span>
      </div>
      <div className="gsd-handoff-card__path">{field.path}</div>
      <p className="gsd-handoff-card__description">{field.description}</p>
      <p className="gsd-handoff-card__notice">
        Guided {reasonLabels[field.handoffReason ?? 'object']} for this {field.handoffReason} value
        is planned for Phase 4.
      </p>
      {field.handoffReason === 'dynamic-map' && field.entry['x-dynamic-key-hint'] && (
        <p className="gsd-handoff-card__hint">
          Key pattern: <code>{field.entry['x-dynamic-key-hint']}</code>
        </p>
      )}
    </div>
  );
}
