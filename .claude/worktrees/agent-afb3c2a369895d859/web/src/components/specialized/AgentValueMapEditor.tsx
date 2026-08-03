import { useMemo } from 'react';
import type { SpecializedDescriptor } from '../../schema/specializedMetadata';
import { getAgentCatalog } from '../../schema/specializedMetadata';
import { EnumCombobox } from '../fields/EnumCombobox';

interface AgentValueMapEditorProps {
  descriptor: SpecializedDescriptor;
  value: unknown;
  onChange: (value: Record<string, unknown>) => void;
}

const KNOWN_AGENTS = getAgentCatalog();

export function AgentValueMapEditor({ descriptor, value, onChange }: AgentValueMapEditorProps) {
  const map = useMemo(() => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}, [value]);
  const supported = descriptor.allowedValues ?? [];
  const available = KNOWN_AGENTS.filter((agent) => !(agent in map));
  const add = (agent: string) => onChange({ ...map, [agent]: supported[0] });
  const remove = (agent: string) => {
    const next = { ...map };
    delete next[agent];
    onChange(next);
  };
  return (
    <section className="gsd-agent-map-editor" aria-label="Agent value map editor">
      <h3>Agent values</h3>
      <p className="gsd-specialized-editor__hint">Choose an agent and a catalogued value. Unknown keys remain preserved and read-only.</p>
      {Object.entries(map).map(([agent, current]) => {
        const isKnown = KNOWN_AGENTS.includes(agent);
        return (
          <div key={agent} className={`gsd-agent-map-editor__row ${isKnown ? '' : 'gsd-agent-map-editor__row--unsupported'}`}>
            <strong>{agent}</strong>
            {isKnown ? <EnumCombobox id={`agent-${agent}`} label={`${agent} value`} value={current} options={supported} meanings={{}} onChange={(next) => onChange({ ...map, [agent]: next })} /> : <span className="gsd-agent-map-editor__readonly">Unsupported value preserved: {String(current)}</span>}
            {isKnown && <button type="button" className="gsd-button gsd-button--danger gsd-button--sm" onClick={() => remove(agent)}>Remove</button>}
          </div>
        );
      })}
      <div className="gsd-agent-map-editor__add"><label htmlFor="agent-to-add">Add supported agent</label><select id="agent-to-add" defaultValue="" disabled={available.length === 0} onChange={(event) => { if (event.target.value) add(event.target.value); event.target.value = ''; }}><option value="">{available.length ? 'Choose an agent' : 'All supported agents added'}</option>{available.map((agent) => <option key={agent} value={agent}>{agent}</option>)}</select></div>
    </section>
  );
}
