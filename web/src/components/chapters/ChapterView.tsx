import { indexSchema } from '../../schema/indexSchema';
import type { SchemaEntry } from '../../../../packages/config-io/src/types';
import { useUiStore } from '../../state/uiStore';
import { getEffectiveLeaf } from '../../schema/effective';
import type { LoadResult } from '../../../../packages/config-io/src/types';

interface ChapterViewProps {
  loadResult: LoadResult;
  schema: Record<string, SchemaEntry>;
}

export function ChapterView({ loadResult, schema }: ChapterViewProps) {
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
            return (
              <div
                key={field.path}
                data-testid={`handoff-${field.path}`}
                className="gsd-handoff-card"
              >
                <div className="gsd-handoff-card__title">{field.title}</div>
                <div className="gsd-handoff-card__path">{field.path}</div>
              </div>
            );
          }
          return (
            <div
              key={field.path}
              data-testid={`field-${field.path}`}
              className="gsd-field-card"
            >
              <div className="gsd-field-card__title">{field.title}</div>
              <div className="gsd-field-card__path">{field.path}</div>
              <div className="gsd-field-card__value">{String(leaf?.value ?? '')}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
