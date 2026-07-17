import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { indexSchema } from '../../schema/indexSchema';
import { useUiStore } from '../../state/uiStore';
import { getSchema } from '../../api/schema';

export function ChapterNav() {
  const { data: schema } = useQuery({
    queryKey: ['schema'],
    queryFn: getSchema,
  });
  const { activeChapter, setActiveChapter } = useUiStore();
  const index = schema ? indexSchema(schema) : null;

  useEffect(() => {
    if (index && index.categories.length > 0) {
      if (!activeChapter || !index.categories.includes(activeChapter)) {
        setActiveChapter(index.categories[0]);
      }
    }
  }, [index, activeChapter, setActiveChapter]);

  if (!index || index.categories.length === 0) {
    return <div className="gsd-placeholder">Loading chapters...</div>;
  }

  return (
    <div className="gsd-chapter-nav">
      <h2 className="gsd-sidebar__heading">Chapters</h2>
      <ul className="gsd-chapter-nav__list" role="tablist" aria-label="Chapters">
        {index.categories.map((category) => (
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
                {index.fieldsByCategory.get(category)?.length ?? 0}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
