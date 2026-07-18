import { useMemo, useState } from 'react';
import type { LoadResult } from '../../../../packages/config-io/src/types';
import type { SpecializedDescriptor } from '../../schema/specializedMetadata';
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

export function FocusedWorkspace({ descriptor, loadResult, chapter, value, onChange }: FocusedWorkspaceProps) {
  const { setFocusedPath } = useUiStore();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(asEntries(value).length ? 0 : null);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const entries = asEntries(value);
  const leaf = getEffectiveLeaf(loadResult.effective, descriptor.path);
  const layered = useMemo(() => getLayeredValue(loadResult, descriptor.path), [loadResult, descriptor.path]);

  const back = () => setFocusedPath(null, null);
  const addEntry = () => {
    const fields = descriptor.fields ?? [];
    const entry = Object.fromEntries(fields.map((field) => [field.path, field.type === 'string' ? '' : undefined]));
    const next = descriptor.editor === 'structured-array' ? [...entries, entry] : { ...(value && typeof value === 'object' ? value : {}), [`entry-${entries.length + 1}`]: entry };
    onChange(next);
    if (descriptor.editor === 'structured-array') setSelectedIndex(entries.length);
  };
  const removeEntry = () => {
    if (removingIndex === null) return;
    onChange(entries.filter((_, index) => index !== removingIndex));
    setSelectedIndex(entries.length <= 1 ? null : Math.min(removingIndex, entries.length - 2));
    setRemovingIndex(null);
  };
  const moveEntry = (index: number, direction: -1 | 1) => {
    const next = [...entries];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
    setSelectedIndex(target);
  };

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
        <PoolEntryList
          entries={entries}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onAdd={addEntry}
          onMove={moveEntry}
          onRemove={setRemovingIndex}
        />
        <div className="gsd-focused-workspace__detail" aria-label="Entry details">
          {selectedIndex === null ? (
            <div className="gsd-focused-workspace__empty"><h3>Choose an entry</h3><p>Add an entry or select one from the list to edit its details.</p></div>
          ) : descriptor.editor === 'agent-map' ? (
            <AgentValueMapEditor descriptor={descriptor} value={value} onChange={onChange} />
          ) : (
            <StructuredPoolEditor descriptor={descriptor} value={descriptor.editor === 'structured-array' ? entries[selectedIndex] : value} onChange={(next) => {
              if (descriptor.editor === 'structured-array') {
                const updated = [...entries]; updated[selectedIndex] = next; onChange(updated);
              } else onChange(next);
            }} />
          )}
        </div>
      </div>
      {removingIndex !== null && (
        <div className="gsd-dialog-overlay" role="presentation">
          <div className="gsd-dialog" role="alertdialog" aria-modal="true" aria-labelledby="remove-entry-title">
            <h2 id="remove-entry-title">Remove {`Entry ${removingIndex + 1}`}?</h2>
            <p>This will remove the named entry from the draft. You can still discard the draft before saving.</p>
            <div className="gsd-dialog__actions"><button type="button" className="gsd-button gsd-button--ghost gsd-button--md" onClick={() => setRemovingIndex(null)}>Cancel</button><button type="button" className="gsd-button gsd-button--danger gsd-button--md" onClick={removeEntry}>Remove entry</button></div>
          </div>
        </div>
      )}
    </section>
  );
}
