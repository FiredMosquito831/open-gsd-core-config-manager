import type { UnknownKeyEntry } from '../../../../packages/config-io/src/types';
import { SafeValuePreview, valueType } from './SafeValuePreview';

interface UnknownChapterProps {
  entries: UnknownKeyEntry[];
}

export function UnknownChapter({ entries }: UnknownChapterProps) {
  return (
    <div className="gsd-unknown-chapter">
      <h2 className="gsd-chapter-view__title">Unrecognized</h2>
      <p className="gsd-preview">
        These keys exist in the loaded config but are not described by the bundled schema. The schema cannot document or guide this key yet, so Phase 3 keeps it read-only while preserving it on save.
      </p>
      <div className="gsd-unknown-chapter__cards">
        {entries.map((entry) => (
          <article key={entry.path} data-testid={`unknown-${entry.path}`} className="gsd-unknown-card">
            <div className="gsd-unknown-card__header">
              <div>
                <h3 className="gsd-unknown-card__title">{entry.path}</h3>
                <p className="gsd-unknown-card__note">
                  The schema cannot document or guide this key. It is read-only in Phase 3 and remains preserved when known settings are saved.
                </p>
              </div>
              <span className="gsd-provenance gsd-provenance--project">Unrecognized</span>
            </div>
            <dl className="gsd-unknown-card__meta">
              <div>
                <dt>Present in</dt>
                <dd>{entry.presentIn.join(', ')}</dd>
              </div>
              <div>
                <dt>Value type</dt>
                <dd>{valueType(entry.value)}</dd>
              </div>
            </dl>
            <SafeValuePreview value={entry.value} />
          </article>
        ))}
      </div>
    </div>
  );
}
