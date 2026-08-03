import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { indexSchema } from '../../schema/indexSchema';
import { useUiStore } from '../../state/uiStore';
import { getSchema } from '../../api/schema';
import { loadConfig } from '../../api/configs';

export function ChapterNav() {
  const { data: schema } = useQuery({
    queryKey: ['schema'],
    queryFn: getSchema,
  });
  const { activeConfigId, activeChapter, setActiveChapter } = useUiStore();
  const profileChapter = 'Profiles';
  const { data: loadResult } = useQuery({
    queryKey: ['config', activeConfigId],
    queryFn: () => loadConfig(activeConfigId!),
    enabled: !!activeConfigId,
  });
  const index = useMemo(() => (schema ? indexSchema(schema) : null), [schema]);
  const categories = useMemo(
    () => (index ? [...index.categories, profileChapter, ...(loadResult?.unknown.length ? ['Unrecognized'] : [])] : []),
    [index, loadResult?.unknown.length],
  );

  useEffect(() => {
    if (categories.length > 0) {
      if (!activeChapter || !categories.includes(activeChapter)) {
        setActiveChapter(categories[0]);
      }
    }
  }, [categories, activeChapter, setActiveChapter]);

  if (!index || categories.length === 0) {
    return <div className="gsd-placeholder">Loading chapters...</div>;
  }

  return (
    <div className="gsd-chapter-nav">
      <h2 className="gsd-sidebar__heading">Chapters</h2>
      <ul className="gsd-chapter-nav__list" role="tablist" aria-label="Chapters">
        {categories.map((category) => (
          <li key={category} className="gsd-chapter-nav__item">
            <button
              type="button"
              role="tab"
              aria-selected={activeChapter === category}
              aria-label={category}
              className={`gsd-chapter-nav__button ${activeChapter === category ? 'gsd-chapter-nav__button--active' : ''}`}
              onClick={() => setActiveChapter(category)}
            >
              {category}
              <span className="gsd-chapter-nav__count" aria-hidden="true">
                {category === profileChapter ? 5 : category === 'Unrecognized' ? loadResult?.unknown.length ?? 0 : index.fieldsByCategory.get(category)?.length ?? 0}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
