import type { SchemaEntry } from '../../../packages/config-io/src/types';

export interface IndexedField {
  path: string;
  entry: SchemaEntry;
  category: string;
  title: string;
  description: string;
  enumValues?: unknown[];
  optionMeanings: Record<string, string>;
  isHandoff: boolean;
  handoffReason?: 'array' | 'object' | 'dynamic-map';
  searchableText: string;
}

export interface ContentGap {
  path: string;
  enumValues: unknown[];
  missingOptions: unknown[];
}

export interface SchemaIndex {
  categories: string[];
  fieldsByCategory: Map<string, IndexedField[]>;
  fieldsByPath: Map<string, IndexedField>;
  searchable: IndexedField[];
  contentGaps: ContentGap[];
}

function isHandoffEntry(
  entry: SchemaEntry,
): { isHandoff: true; reason: 'array' | 'object' | 'dynamic-map' } | { isHandoff: false } {
  if (entry.type === 'array') return { isHandoff: true, reason: 'array' };
  if (entry.patternProperties && Object.keys(entry.patternProperties).length > 0) {
    return { isHandoff: true, reason: 'dynamic-map' };
  }
  if (entry.type === 'object') return { isHandoff: true, reason: 'object' };
  return { isHandoff: false };
}

function buildOptionMeanings(entry: SchemaEntry): Record<string, string> {
  const result: Record<string, string> = {};
  if (!entry.enum || !entry['x-options']) return result;
  for (const value of entry.enum) {
    const key = String(value);
    const option = entry['x-options'][key];
    if (option?.['x-description']) {
      result[key] = option['x-description'];
    }
  }
  return result;
}

function buildSearchableText(path: string, entry: SchemaEntry): string {
  const optionText = Object.entries(entry['x-options'] ?? {})
    .map(([value, meta]) => `${value} ${meta['x-description']}`)
    .join(' ');
  return `${path} ${entry.title} ${entry['x-description']} ${optionText}`.trim().toLowerCase();
}

export function indexSchema(schema: Record<string, SchemaEntry>): SchemaIndex {
  const fieldsByCategory = new Map<string, IndexedField[]>();
  const fieldsByPath = new Map<string, IndexedField>();
  const contentGaps: ContentGap[] = [];

  for (const [path, entry] of Object.entries(schema)) {
    const category = entry['x-category'] ?? 'Unrecognized';
    const handoff = isHandoffEntry(entry);

    const field: IndexedField = {
      path,
      entry,
      category,
      title: entry.title,
      description: entry['x-description'] ?? '',
      enumValues: entry.enum,
      optionMeanings: buildOptionMeanings(entry),
      isHandoff: handoff.isHandoff,
      handoffReason: handoff.isHandoff ? handoff.reason : undefined,
      searchableText: buildSearchableText(path, entry),
    };

    if (!fieldsByCategory.has(category)) {
      fieldsByCategory.set(category, []);
    }
    fieldsByCategory.get(category)!.push(field);
    fieldsByPath.set(path, field);

    if (entry.enum && entry.enum.length > 0) {
      const describedOptions = new Set(Object.keys(entry['x-options'] ?? {}));
      const missingOptions = entry.enum.filter((v) => !describedOptions.has(String(v)));
      if (missingOptions.length > 0) {
        contentGaps.push({ path, enumValues: entry.enum, missingOptions });
      }
    }
  }

  const categories = Array.from(fieldsByCategory.keys()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );

  for (const category of categories) {
    const fields = fieldsByCategory.get(category)!;
    fields.sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: 'base' }));
  }

  const searchable = Array.from(fieldsByPath.values()).sort((a, b) =>
    a.path.localeCompare(b.path, undefined, { sensitivity: 'base' }),
  );

  return { categories, fieldsByCategory, fieldsByPath, searchable, contentGaps };
}
