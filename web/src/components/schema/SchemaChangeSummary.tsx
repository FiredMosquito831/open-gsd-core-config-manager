import type { SchemaChangeDto } from '../../../../packages/server/src/api-types';

type Group = 'added' | 'changed' | 'deprecated' | 'documentation';
const groups: Array<{ id: Group; heading: string; singular: string }> = [
  { id: 'added', heading: 'Added', singular: 'added' }, { id: 'changed', heading: 'Changed', singular: 'changed' },
  { id: 'deprecated', heading: 'Deprecated', singular: 'deprecated' }, { id: 'documentation', heading: 'Documentation notes', singular: 'documentation note' },
];

function groupFor(change: SchemaChangeDto): Group {
  return change.kind === 'documentation' || change.kind === 'documentation-drift' ? 'documentation' : change.kind === 'deprecated' ? 'deprecated' : change.kind === 'added' ? 'added' : 'changed';
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/** Plain-language, beginner-facing explanation of what a proposal change means for their config. */
function impactSentence(change: SchemaChangeDto): string {
  switch (change.kind) {
    case 'added':
      return 'Adds a new setting. Your existing config keeps working; you can start using it when you want.';
    case 'deprecated':
      return 'This setting is no longer in gsd-core. It stays listed as deprecated so older configs still make sense.';
    case 'documentation':
    case 'documentation-drift':
      return 'Upstream documentation changed. Your curated, beginner-friendly explanation stays active and was not overwritten.';
    default:
      return 'Changes an existing setting. Review what the new value means for your config before activating.';
  }
}

export function SchemaChangeSummary({ changes, filter, onFilter, expanded, onToggle }: { changes: readonly SchemaChangeDto[]; filter: Group | 'all'; onFilter(filter: Group | 'all'): void; expanded: Set<string>; onToggle(path: string): void }) {
  const counts = Object.fromEntries(groups.map(({ id }) => [id, changes.filter((change) => groupFor(change) === id).length])) as Record<Group, number>;
  const visible = filter === 'all' ? changes : changes.filter((change) => groupFor(change) === filter);
  return <div className="gsd-schema-review" data-schema-backstop="many-keys">
    <aside className="gsd-schema-review__summary" aria-label="Schema change summary">
      <h2 tabIndex={-1}>Review schema changes</h2>
      <button type="button" className="gsd-schema-filter" aria-pressed={filter === 'all'} onClick={() => onFilter('all')}>All changes</button>
      {groups.map(({ id, singular }) => <button key={id} type="button" className="gsd-schema-filter" aria-pressed={filter === id} onClick={() => onFilter(id)}>{counts[id]} {singular}{counts[id] === 1 ? '' : id === 'documentation' ? 's' : ''}</button>)}
      <p>Activation applies the complete validated proposal.</p>
    </aside>
    <div className="gsd-schema-review__evidence">
      {groups.map(({ id, heading, singular }) => {
        const entries = visible.filter((change) => groupFor(change) === id);
        if (!entries.length) return null;
        return <section key={id} aria-labelledby={`schema-group-${id}`}><h2 id={`schema-group-${id}`}>{heading} ({entries.length})</h2>{entries.map((change) => {
          const open = expanded.has(change.path);
          const marker = id === 'documentation' ? 'Documentation note' : capitalize(singular);
          return <div className="gsd-schema-change" key={`${id}-${change.path}`}>
            <button type="button" className="gsd-schema-change__disclosure" aria-expanded={open} aria-controls={`schema-evidence-${change.path}`} onClick={() => onToggle(change.path)}>
              <strong>{marker}</strong>
              <code>{change.path}</code>
              <span>{open ? 'Hide details' : 'Show details'}</span>
            </button>
            {open && <div id={`schema-evidence-${change.path}`} className="gsd-schema-change__details">
              <p className="gsd-schema-change__impact">{impactSentence(change)}</p>
              <details className="gsd-schema-change__technical">
                <summary>Technical details</summary>
                <dl>
                  <dt>Previous</dt>
                  <dd><code>{JSON.stringify(change.before ?? 'Not present')}</code></dd>
                  <dt>Proposed</dt>
                  <dd><code>{JSON.stringify(change.after ?? 'Not present')}</code></dd>
                </dl>
              </details>
              {id === 'deprecated' && <p>No longer present in gsd-core. Kept as deprecated so older configs remain understood.</p>}
            </div>}
          </div>;
        })}</section>;
      })}
    </div>
  </div>;
}
