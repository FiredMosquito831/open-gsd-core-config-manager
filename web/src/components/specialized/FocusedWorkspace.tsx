import { useMemo, useState } from 'react';
import type { LoadResult } from '../../../../packages/config-io/src/types';
import type { SpecializedDescriptor } from '../../schema/specializedMetadata';
import { getAgentCatalog, getPhaseTypesCatalog, getRoutingTiersCatalog } from '../../schema/specializedMetadata';
import { getEffectiveLeaf, getLayeredValue } from '../../schema/effective';
import { useUiStore } from '../../state/uiStore';
import { LayerSummary } from './LayerSummary';
import { PoolEntryList } from './PoolEntryList';
import { StructuredPoolEditor } from './StructuredPoolEditor';
import { AgentValueMapEditor } from './AgentValueMapEditor';

interface FocusedWorkspaceProps {
  descriptor: SpecializedDescriptor;
  loadResult: LoadResult;
  chapter: string;
  value: unknown;
  onChange: (value: unknown) => void;
}

function asEntries(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asMap(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function catalogFor(keyCatalog: 'agents' | 'phaseTypes' | 'routingTiers'): string[] {
  if (keyCatalog === 'phaseTypes') return getPhaseTypesCatalog();
  if (keyCatalog === 'routingTiers') return getRoutingTiersCatalog();
  return getAgentCatalog();
}

/**
 * Pick the next unused catalog key for a map with a fixed key domain
 * (models.<phase_type>, granularities.<phase_type>, effort.routing_tier_defaults.<tier>).
 * Falls back to an entry-N placeholder when the descriptor has no keyCatalog.
 */
function nextMapKey(map: Record<string, unknown>, descriptor: SpecializedDescriptor): string {
  if (descriptor.keyCatalog) {
    const used = new Set(Object.keys(map));
    const next = catalogFor(descriptor.keyCatalog).find((key) => !used.has(key));
    if (next) return next;
  }
  return `entry-${Object.keys(map).length + 1}`;
}

export function FocusedWorkspace({ descriptor, loadResult, chapter, value, onChange }: FocusedWorkspaceProps) {
  const { setFocusedPath } = useUiStore();
  const entries = asEntries(value);
  const map = asMap(value);
  const mapKeys = Object.keys(map);
  const isArray = descriptor.editor === 'structured-array';
  const [selectedIndex, setSelectedIndex] = useState<number | null>(isArray && entries.length ? 0 : null);
  const [selectedKey, setSelectedKey] = useState<string | null>(!isArray && mapKeys.length ? mapKeys[0] : null);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const selectedMapValue = selectedKey === null ? undefined : map[selectedKey];
  const leaf = getEffectiveLeaf(loadResult.effective, descriptor.path);
  const layered = useMemo(() => getLayeredValue(loadResult, descriptor.path), [loadResult, descriptor.path]);

  const back = () => setFocusedPath(null, null);
  const addEntry = () => {
    const fields = descriptor.fields ?? [];
    const entry = fields.length > 0
      ? Object.fromEntries(fields.map((field) => [field.path, field.type === 'string' ? '' : undefined]))
      : (descriptor.allowedValues?.[0] ?? '');
    if (isArray) {
      const next = [...entries, entry];
      onChange(next);
      setSelectedIndex(entries.length);
    } else {
      const key = nextMapKey(map, descriptor);
      onChange({ ...map, [key]: entry });
      setSelectedKey(key);
    }
  };
  const removeEntry = () => {
    if (removingIndex !== null) {
      onChange(entries.filter((_, index) => index !== removingIndex));
      setSelectedIndex(entries.length <= 1 ? null : Math.min(removingIndex, entries.length - 2));
      setRemovingIndex(null);
    } else if (removingKey !== null) {
      const next = { ...map };
      delete next[removingKey];
      onChange(next);
      setSelectedKey(mapKeys.length <= 1 ? null : mapKeys.find((key) => key !== removingKey) ?? null);
      setRemovingKey(null);
    }
  };
  const moveEntry = (index: number, direction: -1 | 1) => {
    const next = [...entries];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
    setSelectedIndex(target);
  };
  const updateMapValue = (next: unknown) => {
    if (selectedKey !== null) onChange({ ...map, [selectedKey]: next });
  };
  const mapEntries = mapKeys.map((key) => ({ key, value: map[key] }));
  const mapEditor = descriptor.editor === 'agent-map' || descriptor.editor === 'runtime-tier-map';
  const selectedValue = isArray ? (selectedIndex === null ? undefined : entries[selectedIndex]) : selectedMapValue;

  return (
    <section className="gsd-focused-workspace" aria-label={`${descriptor.path} focused editor`}>
      <div className="gsd-focused-workspace__header">
        <button type="button" className="gsd-button gsd-button--ghost gsd-button--md" onClick={back}>Back to {chapter}</button>
        <div>
          <p className="gsd-focused-workspace__eyebrow">Focused workspace</p>
          <h2>{descriptor.path}</h2>
          <p>Edit this supported value without leaving the validated draft.</p>
        </div>
      </div>
      <LayerSummary layers={layered} effectiveSource={leaf?.from ?? 'canonical'} />
      <div className="gsd-focused-workspace__body">
        {isArray ? <PoolEntryList
          entries={entries}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onAdd={addEntry}
          onMove={moveEntry}
          onRemove={setRemovingIndex}
        /> : <section className="gsd-pool-list" aria-label="Map entries">
          <div className="gsd-pool-list__header"><div><h3>Entries</h3><p>{mapEntries.length} {mapEntries.length === 1 ? 'entry' : 'entries'}</p></div><button type="button" className="gsd-button gsd-button--primary gsd-button--sm" onClick={addEntry}>Add entry</button></div>
          <div className="gsd-pool-list__items" role="listbox" aria-label="Select a map entry">{mapEntries.map(({ key }) => <div key={key} role="option" aria-selected={selectedKey === key} className={`gsd-pool-list__row ${selectedKey === key ? 'gsd-pool-list__row--selected' : ''}`}><button type="button" className="gsd-pool-list__select" onClick={() => setSelectedKey(key)}><span className="gsd-pool-list__name">{key}</span></button><button type="button" className="gsd-button gsd-button--danger gsd-button--sm" onClick={() => setRemovingKey(key)} aria-label={`Remove ${key}`}>Remove</button></div>)}</div>
        </section>}
        <div className="gsd-focused-workspace__detail" aria-label="Entry details">
          {selectedValue === undefined ? (
            <div className="gsd-focused-workspace__empty"><h3>Choose an entry</h3><p>Add an entry or select one from the list to edit its details.</p></div>
          ) : descriptor.editor === 'agent-map' ? (
            <AgentValueMapEditor descriptor={descriptor} value={value} onChange={onChange} />
          ) : (
            <StructuredPoolEditor descriptor={descriptor} value={selectedValue} onChange={(next) => isArray && selectedIndex !== null ? (() => { const updated = [...entries]; updated[selectedIndex] = next; onChange(updated); })() : updateMapValue(next)} />
          )}
        </div>
      </div>
      {(removingIndex !== null || removingKey !== null) && (
        <div className="gsd-dialog-overlay" role="presentation">
          <div className="gsd-dialog" role="alertdialog" aria-modal="true" aria-labelledby="remove-entry-title">
            <h2 id="remove-entry-title">Remove {removingKey ?? `Entry ${removingIndex! + 1}`}?</h2>
            <p>This will remove the named entry from the draft. You can still discard the draft before saving.</p>
            <div className="gsd-dialog__actions"><button type="button" className="gsd-button gsd-button--ghost gsd-button--md" onClick={() => setRemovingIndex(null)}>Cancel</button><button type="button" className="gsd-button gsd-button--danger gsd-button--md" onClick={removeEntry}>Remove entry</button></div>
          </div>
        </div>
      )}
    </section>
  );
}
