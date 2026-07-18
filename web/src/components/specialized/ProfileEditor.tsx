import { useMemo } from 'react';
import { EnumCombobox } from '../fields/EnumCombobox';
import { Button } from '../common/Button';

const AGENTS = ['gsd-planner', 'gsd-executor', 'gsd-verifier', 'gsd-researcher', 'gsd-code-reviewer'];
const TIERS = ['opus', 'sonnet', 'haiku', 'inherit'];

interface ProfileEditorProps {
  assignments: Record<string, unknown>;
  sessionLabel: string;
  onSessionLabelChange: (label: string) => void;
  onChange: (assignments: Record<string, unknown>) => void;
  onBack: () => void;
}

export function ProfileEditor({ assignments, sessionLabel, onSessionLabelChange, onChange, onBack }: ProfileEditorProps) {
  const available = useMemo(() => AGENTS.filter((agent) => !(agent in assignments)), [assignments]);
  return (
    <section className="gsd-profile-editor" aria-label="Project model configuration editor">
      <div className="gsd-focused-workspace__header">
        <Button variant="ghost" size="md" onClick={onBack}>Back to Profiles</Button>
        <div><p className="gsd-focused-workspace__eyebrow">Project configuration</p><h2>Adjust model assignments</h2><p>These supported fields are saved with this project through the normal validated config flow.</p></div>
      </div>
      <div className="gsd-profile-editor__local">
        <label htmlFor="profile-session-label">Session label (optional)</label>
        <input id="profile-session-label" value={sessionLabel} onChange={(event) => onSessionLabelChange(event.target.value)} />
        <p>This label is local to this editing session only; it is never serialized, reloaded, or validated as profile identity.</p>
      </div>
      <div className="gsd-profile-editor__assignments">
        <h3>Agent assignments</h3>
        {Object.entries(assignments).map(([agent, current]) => (
          <div className="gsd-profile-editor__row" key={agent}>
            <strong>{agent}</strong>
            <EnumCombobox id={`profile-${agent}`} label={`${agent} model tier`} value={current} options={TIERS} meanings={{}} onChange={(next) => onChange({ ...assignments, [agent]: next })} />
            <button type="button" className="gsd-button gsd-button--danger gsd-button--sm" onClick={() => { const next = { ...assignments }; delete next[agent]; onChange(next); }}>Remove</button>
          </div>
        ))}
        <label htmlFor="profile-add-agent">Add supported agent</label>
        <select id="profile-add-agent" defaultValue="" disabled={!available.length} onChange={(event) => { if (!event.target.value) return; onChange({ ...assignments, [event.target.value]: 'inherit' }); event.target.value = ''; }}>
          <option value="">{available.length ? 'Choose an agent' : 'All supported agents added'}</option>
          {available.map((agent) => <option key={agent} value={agent}>{agent}</option>)}
        </select>
      </div>
    </section>
  );
}
