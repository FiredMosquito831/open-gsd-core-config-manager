import { Button } from '../common/Button';

export interface PoolEntryListProps {
  entries: unknown[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
  invalidIndexes?: Set<number>;
  addLabel?: string;
}

function entryName(entry: unknown, index: number): string {
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    const value = entry as Record<string, unknown>;
    const name = value.name ?? value.heading ?? value.id ?? value.key;
    if (typeof name === 'string' && name.trim()) return name;
  }
  return `Entry ${index + 1}`;
}

export function PoolEntryList({
  entries,
  selectedIndex,
  onSelect,
  onAdd,
  onMove,
  onRemove,
  invalidIndexes = new Set(),
  addLabel = 'Add entry',
}: PoolEntryListProps) {
  return (
    <section className="gsd-pool-list" aria-label="Pool entries">
      <div className="gsd-pool-list__header">
        <div>
          <h3>Entries</h3>
          <p>{entries.length === 0 ? 'No entries yet.' : `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`}</p>
        </div>
        <Button variant="primary" size="sm" onClick={onAdd}>{addLabel}</Button>
      </div>
      <div className="gsd-pool-list__items" role="listbox" aria-label="Select an entry">
        {entries.map((entry, index) => {
          const invalid = invalidIndexes.has(index);
          return (
            <div key={`pool-entry-${index}`} role="option" aria-selected={selectedIndex === index} className={`gsd-pool-list__row ${selectedIndex === index ? 'gsd-pool-list__row--selected' : ''} ${invalid ? 'gsd-pool-list__row--invalid' : ''}`}>
              <button type="button" className="gsd-pool-list__select" onClick={() => onSelect(index)}>
                <span className="gsd-pool-list__name">{entryName(entry, index)}</span>
                {invalid && <span className="gsd-pool-list__status">Needs attention</span>}
              </button>
              <div className="gsd-pool-list__actions" aria-label={`Actions for ${entryName(entry, index)}`}>
                <Button variant="ghost" size="sm" onClick={() => onMove(index, -1)} disabled={index === 0} aria-label={`Move ${entryName(entry, index)} up`}>Move up</Button>
                <Button variant="ghost" size="sm" onClick={() => onMove(index, 1)} disabled={index === entries.length - 1} aria-label={`Move ${entryName(entry, index)} down`}>Move down</Button>
                <Button variant="danger" size="sm" onClick={() => onRemove(index)} aria-label={`Remove ${entryName(entry, index)}`}>Remove</Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
