import type { Control } from 'react-hook-form';
import { indexSchema } from '../../schema/indexSchema';
import type { SchemaEntry } from '../../../../packages/config-io/src/types';
import { useUiStore } from '../../state/uiStore';
import { getEffectiveLeaf } from '../../schema/effective';
import type { LoadResult } from '../../../../packages/config-io/src/types';
import { FieldCard } from '../fields/FieldCard';
import { SpecializedHandoffCard } from '../fields/SpecializedHandoffCard';
import { UnknownChapter } from '../unknown/UnknownChapter';
import { getSpecializedDescriptor } from '../../schema/specializedMetadata';
import { FocusedWorkspace } from '../specialized/FocusedWorkspace';
import { GenericJsonEditor } from '../specialized/GenericJsonEditor';
import { useWatch } from 'react-hook-form';
import { useUiStore as uiStore } from '../../state/uiStore';
import { ProfileCards } from '../specialized/ProfileCards';
import { ProfileEditor } from '../specialized/ProfileEditor';
import { useState } from 'react';
import { getAgentCatalog } from '../../schema/specializedMetadata';

const AGENTS = getAgentCatalog();
const PROFILE_ASSIGNMENTS: Record<string, Record<string, string>> = {
  quality: Object.fromEntries(AGENTS.map((agent) => [agent, ['gsd-planner', 'gsd-executor'].includes(agent) ? 'opus' : 'sonnet'])),
  balanced: Object.fromEntries(AGENTS.map((agent) => [agent, 'sonnet'])),
  budget: Object.fromEntries(AGENTS.map((agent) => [agent, agent === 'gsd-executor' ? 'sonnet' : 'haiku'])),
  adaptive: Object.fromEntries(AGENTS.map((agent) => [agent, 'inherit'])),
  inherit: {},
};

function profileAssignmentsFor(profile: string): Record<string, string> {
  return { ...(PROFILE_ASSIGNMENTS[profile] ?? PROFILE_ASSIGNMENTS.balanced) };
}
function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function effectiveAt(loadResult: LoadResult, path: string): unknown { return getEffectiveLeaf(loadResult.effective, path)?.value; }

interface ChapterViewProps {
  loadResult: LoadResult;
  schema: Record<string, SchemaEntry>;
  control: Control<Record<string, unknown>>;
  onFieldChange: (path: string, value: unknown) => void;
  onResetField: (path: string) => void;
}

export function ChapterView({ loadResult, schema, control, onFieldChange, onResetField }: ChapterViewProps) {
  const { activeChapter, focusedPath, setFocusedPath, profileEditorOpen, setProfileEditorOpen, profileSessionLabel, setProfileSessionLabel } = useUiStore();
  const focusedValue = useWatch({ control, name: focusedPath ?? '__no_focused_path__' });
  const index = indexSchema(schema);
  const focusedField = focusedPath ? index.fieldsByPath.get(focusedPath) : undefined;
  const focusedDescriptor = focusedPath ? getSpecializedDescriptor(focusedPath) : undefined;
  const [profileAssignments, setProfileAssignments] = useState<Record<string, unknown>>({});
  const profileValue = String(effectiveAt(loadResult, 'model_profile') ?? 'balanced');

  if (activeChapter === 'Profiles') {
    if (profileEditorOpen) {
      return <ProfileEditor assignments={profileAssignments} sessionLabel={profileSessionLabel} onSessionLabelChange={setProfileSessionLabel} onChange={(next) => { setProfileAssignments(next); onFieldChange('model_overrides', next); }} onBack={() => setProfileEditorOpen(false)} />;
    }
    return <ProfileCards value={profileValue} onSelect={(next) => onFieldChange('model_profile', next)} onCreate={(profile) => { setProfileAssignments(profileAssignmentsFor(profile)); setProfileSessionLabel(''); setProfileEditorOpen(true); }} />;
  }

  if (focusedDescriptor?.editable && activeChapter) {
    const currentValue = focusedValue ?? getEffectiveLeaf(loadResult.effective, focusedDescriptor.path)?.value;
    return <FocusedWorkspace descriptor={focusedDescriptor} loadResult={loadResult} chapter={activeChapter} value={currentValue} onChange={(value) => {
      setFocusedPath(focusedDescriptor.path, activeChapter);
      onFieldChange(focusedDescriptor.path, value);
    }} />;
  }

  if (focusedField?.isHandoff && !focusedDescriptor && activeChapter) {
    const currentValue = focusedValue ?? getEffectiveLeaf(loadResult.effective, focusedField.path)?.value;
    return <GenericJsonEditor
      field={focusedField}
      loadResult={loadResult}
      chapter={activeChapter}
      value={currentValue}
      onChange={(value) => onFieldChange(focusedField.path, value)}
      onBack={() => setFocusedPath(null, null)}
    />;
  }
  const fields = activeChapter ? index.fieldsByCategory.get(activeChapter) ?? [] : [];

  if (!activeChapter) {
    return <div className="gsd-placeholder">Select a chapter</div>;
  }

  if (activeChapter === 'Unrecognized') {
    return <UnknownChapter entries={loadResult.unknown} />;
  }

  return (
    <div className="gsd-chapter-view">
      <h2 className="gsd-chapter-view__title">{activeChapter}</h2>
      <div className="gsd-chapter-view__fields">
        {fields.map((field) => {
          const leaf = getEffectiveLeaf(loadResult.effective, field.path);
          if (field.isHandoff) {
            const descriptor = getSpecializedDescriptor(field.path);
            if (descriptor?.editable || !descriptor) {
              return <button key={field.path} data-testid={`handoff-${field.path}`} type="button" className="gsd-specialized-launch" onClick={() => setFocusedPath(field.path, activeChapter)}><span>{field.title}</span><span>{field.path}</span><small>{descriptor ? 'Open focused editor' : 'Open JSON editor'}</small></button>;
            }
            return <SpecializedHandoffCard key={field.path} field={field} />;
          }
          return (
            <FieldCard
              key={field.path}
              field={field}
              leaf={leaf}
              control={control}
              onFieldChange={onFieldChange}
              onResetField={onResetField}
            />
          );
        })}
      </div>
    </div>
  );
}
