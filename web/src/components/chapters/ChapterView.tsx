import type { Control } from 'react-hook-form';
import { indexSchema } from '../../schema/indexSchema';
import type { SchemaEntry } from '../../../../packages/config-io/src/types';
import { useUiStore } from '../../state/uiStore';
import { getEffectiveLeaf } from '../../schema/effective';
import type { LoadResult } from '../../../../packages/config-io/src/types';
import { FieldCard } from '../fields/FieldCard';
import { SpecializedHandoffCard } from '../fields/SpecializedHandoffCard';

interface ChapterViewProps {
  loadResult: LoadResult;
  schema: Record<string, SchemaEntry>;
  control: Control<Record<string, unknown>>;
  onFieldChange: (path: string, value: unknown) => void;
  onResetField: (path: string) => void;
}

export function ChapterView({ loadResult, schema, control, onFieldChange, onResetField }: ChapterViewProps) {
  const { activeChapter } = useUiStore();
  const index = indexSchema(schema);
  const fields = activeChapter ? index.fieldsByCategory.get(activeChapter) ?? [] : [];

  if (!activeChapter) {
    return <div className="gsd-placeholder">Select a chapter</div>;
  }

  return (
    <div className="gsd-chapter-view">
      <h2 className="gsd-chapter-view__title">{activeChapter}</h2>
      <div className="gsd-chapter-view__fields">
        {fields.map((field) => {
          const leaf = getEffectiveLeaf(loadResult.effective, field.path);
          if (field.isHandoff) {
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
