import { getEffectiveLeaf, provenanceLabel } from '../../schema/effective';
import { indexSchema, type IndexedField } from '../../schema/indexSchema';
import type { LoadResult, SchemaEntry } from '../../../../packages/config-io/src/types';

export interface SearchResult {
  field: IndexedField;
  chapter: string;
  valueSummary: string;
  provenance: string;
  score: number;
  matchKind: 'key' | 'title' | 'description' | 'option';
  matchedText: string;
}

export interface GroupedSearchResults {
  chapter: string;
  results: SearchResult[];
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function summarizeValue(value: unknown): string {
  if (value === undefined) return 'not set';
  if (value === null) return 'null';
  if (typeof value === 'string') return value.length > 80 ? `${value.slice(0, 77)}...` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `Array with ${value.length} item${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'object') return 'Object value';
  return String(value);
}

function scoreField(field: IndexedField, rawQuery: string): Pick<SearchResult, 'score' | 'matchKind' | 'matchedText'> | null {
  const query = normalize(rawQuery);
  if (!query) return null;

  const candidates: Array<{ text: string; kind: SearchResult['matchKind']; exact: number; includes: number }> = [
    { text: field.path, kind: 'key', exact: 1000, includes: 800 },
    { text: field.title, kind: 'title', exact: 950, includes: 760 },
    { text: field.description, kind: 'description', exact: 500, includes: 420 },
    ...Object.entries(field.optionMeanings).map(([value, meaning]) => ({
      text: `${value} ${meaning}`,
      kind: 'option' as const,
      exact: 480,
      includes: 400,
    })),
  ];

  let best: Pick<SearchResult, 'score' | 'matchKind' | 'matchedText'> | null = null;
  for (const candidate of candidates) {
    const text = normalize(candidate.text);
    if (!text) continue;
    let score = 0;
    if (text === query) score = candidate.exact;
    else if (text.includes(query)) score = candidate.includes;
    else {
      const terms = query.split(' ').filter(Boolean);
      if (terms.length > 1 && terms.every((term) => text.includes(term))) {
        score = candidate.includes - 40;
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { score, matchKind: candidate.kind, matchedText: rawQuery };
    }
  }

  return best;
}

export function buildSearchResults(
  schema: Record<string, SchemaEntry>,
  loadResult: LoadResult,
  query: string,
): GroupedSearchResults[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const indexed = indexSchema(schema);
  const results: SearchResult[] = [];

  for (const field of indexed.searchable) {
    const score = scoreField(field, trimmed);
    if (!score) continue;
    const leaf = getEffectiveLeaf(loadResult.effective, field.path);
    results.push({
      field,
      chapter: field.category,
      valueSummary: summarizeValue(leaf?.value),
      provenance: leaf ? provenanceLabel(leaf.from) : 'No value',
      ...score,
    });
  }

  results.sort((a, b) => b.score - a.score || a.field.path.localeCompare(b.field.path));

  const groups = new Map<string, SearchResult[]>();
  for (const result of results) {
    if (!groups.has(result.chapter)) groups.set(result.chapter, []);
    groups.get(result.chapter)!.push(result);
  }

  return Array.from(groups.entries()).map(([chapter, groupResults]) => ({ chapter, results: groupResults }));
}
