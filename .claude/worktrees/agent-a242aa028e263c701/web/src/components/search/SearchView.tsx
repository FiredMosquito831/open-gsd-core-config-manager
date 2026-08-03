import type { ReactNode } from 'react';
import { buildSearchResults, type SearchResult } from './searchIndex';
import type { LoadResult, SchemaEntry } from '../../../../packages/config-io/src/types';

interface SearchViewProps {
  schema: Record<string, SchemaEntry>;
  loadResult: LoadResult;
  query: string;
  onOpenResult: (chapter: string, path: string) => void;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return <>{text}</>;
  const index = normalizedText.indexOf(normalizedQuery);
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index) ? <span>{text.slice(0, index).trimEnd()}</span> : null}
      {text.slice(0, index) ? ' ' : null}
      <mark>{text.slice(index, index + normalizedQuery.length)}</mark>
      {text.slice(index + normalizedQuery.length)}
    </>
  );
}

function ResultRow({ result, query, onOpen }: { result: SearchResult; query: string; onOpen: () => void }) {
  const description: ReactNode = result.matchKind === 'description'
    ? <Highlight text={result.field.description} query={query} />
    : result.field.description;

  return (
    <button
      type="button"
      className="gsd-search-result"
      onClick={onOpen}
      aria-label={`Open ${result.field.path}`}
    >
      <span className="gsd-search-result__meta">{result.chapter}</span>
      <span className="gsd-search-result__title">
        <Highlight text={result.field.title} query={query} />
      </span>
      <code className="gsd-search-result__path"><Highlight text={result.field.path} query={query} /></code>
      <span className="gsd-search-result__description">{description}</span>
      <span className="gsd-search-result__footer">
        <span>Current value: {result.valueSummary}</span>
        <span>{result.provenance}</span>
      </span>
    </button>
  );
}

export function SearchView({ schema, loadResult, query, onOpenResult }: SearchViewProps) {
  const groups = buildSearchResults(schema, loadResult, query);
  const count = groups.reduce((sum, group) => sum + group.results.length, 0);

  return (
    <div className="gsd-search-view" role="region" aria-label="Search results">
      <div className="gsd-search-view__header">
        <h2 className="gsd-chapter-view__title">Search results</h2>
        <p className="gsd-preview">
          {count === 0 ? 'No settings match this query.' : `${count} setting${count === 1 ? '' : 's'} found.`}
          {' '}Current values are displayed for context but are not searched by default.
        </p>
      </div>

      {count === 0 ? (
        <div className="gsd-placeholder">No settings match “{query}”. Try a key path, title, or plain-language concept.</div>
      ) : (
        <div className="gsd-search-view__groups">
          {groups.map((group) => (
            <section key={group.chapter} className="gsd-search-group" aria-labelledby={`search-group-${group.chapter}`}>
              <h3 id={`search-group-${group.chapter}`} className="gsd-search-group__title">{group.chapter}</h3>
              <div className="gsd-search-group__results">
                {group.results.map((result) => (
                  <ResultRow
                    key={result.field.path}
                    result={result}
                    query={query}
                    onOpen={() => onOpenResult(result.chapter, result.field.path)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
