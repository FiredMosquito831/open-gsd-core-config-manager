/**
 * Frozen Phase 1 data contracts for the Config I/O module.
 *
 * These types are the API surface that Phase 2 (loopback server) and
 * Phase 3 (schema-driven UI) build against. Changing their shape after
 * this plan lands is an architectural change (deviation Rule 4), not a
 * routine edit.
 *
 * Source: 01-RESEARCH.md § Decision: Effective-Value / Provenance Contract
 * and § Decision: Unknown-Key Representation.
 */

/**
 * Which config layer supplied a resolved effective value, in merge
 * precedence order: 'project' overrides 'global', which overrides the
 * bundled schema's own 'canonical' default.
 */
export type Provenance = 'canonical' | 'global' | 'project';

/**
 * A single resolved leaf value in the effective-value tree, tagged with
 * the layer ('canonical' | 'global' | 'project') that supplied it.
 */
export interface EffectiveLeaf {
  /** Dot-path, e.g. "workflow.tdd_mode". */
  path: string;
  value: unknown;
  from: Provenance;
}

/**
 * A recursive node in the effective-value tree: either a resolved leaf,
 * or a nested object of further EffectiveNodes. The schema descriptor's
 * own structure drives the tree walk (a generic renderer walks *schema*
 * nodes), so this type intentionally has no separate "container" variant.
 */
export type EffectiveNode = EffectiveLeaf | { [key: string]: EffectiveNode };

/**
 * A key-path found in a raw config file that the bundled schema does not
 * recognize (present in the schema's `additionalProperties`-open surface,
 * but not declared by any known key/pattern). Represented as a flat
 * bucket, not inline `isKnown`-tagged tree nodes — see 01-RESEARCH.md
 * § Decision: Unknown-Key Representation for the rationale.
 */
export interface UnknownKeyEntry {
  /** Dot-path as found in the raw object. */
  path: string;
  /** Raw value, for optional read-only display later. */
  value: unknown;
  /** Which raw layer(s) contain this path. */
  presentIn: Array<'project' | 'global'>;
}

/**
 * The full result of load(): the original raw parsed documents, the
 * merged effective-value tree, the unknown-key bucket, and discovery
 * metadata.
 */
export interface LoadResult {
  raw: {
    /**
     * The ORIGINAL parsed project object, exactly as read from disk.
     * `load()` never mutates this object in place, and no downstream
     * consumer should either — this is the SAVE-03 patch-in-place
     * invariant (01-RESEARCH.md § Pitfall 1: any key present in the real
     * file that the bundled schema doesn't yet recognize must never be
     * silently dropped on save, which requires save() to always patch a
     * copy of this exact object rather than reconstructing a write
     * payload from schema/form state).
     */
    project: Record<string, unknown>;
    global: Record<string, unknown> | null;
  };
  effective: Record<string, EffectiveNode>;
  unknown: UnknownKeyEntry[];
  meta: {
    globalDefaultsPath: string;
    globalDefaultsFound: boolean;
  };
}

/**
 * Result of validating a candidate raw config object against the bundled
 * Ajv schema. Never throws — callers branch on `valid`.
 */
export interface ValidationResult {
  valid: boolean;
  errors: object[];
}

/**
 * One flattened entry in the bundled canonical schema, describing a
 * single key (or dynamic key pattern) shared by Plans 02 (schema build)
 * and 05 (schema-driven UI rendering).
 */
export interface SchemaEntry {
  /**
   * A single JSON Schema type name, or a union array (e.g. `["object",
   * "null"]` for a nullable dynamic-map container) — widened from a bare
   * `string` in Plan 07 (Rule 1 — bug fix) once schema-convert.ts's
   * `buildAjvSchema` needed to compile the real bundled schema through Ajv
   * and several real entries carry a union `type` array.
   */
  type: string | string[];
  enum?: unknown[];
  default?: unknown;
  title: string;
  /** UI category grouping, e.g. "Workflow", "Model & Routing". */
  'x-category': string;
  /** One-line plain-language description of what this key does. */
  'x-description': string;
  /**
   * Which reconciled source justified this key's inclusion: 'manifest',
   * 'capability-registry', 'config-defaults', 'fixture-observed', or a
   * `dynamicKeyPattern:<name>` tag for dynamic-map container entries.
   */
  'x-provenance': string;
  /** Regex-keyed sub-schema for dynamic-map container keys (e.g. model_overrides.<agent-id>). */
  patternProperties?: Record<string, SchemaEntry>;
  /** Human-readable hint for what the dynamic pattern's key segment represents, e.g. "agent-id". */
  'x-dynamic-key-hint'?: string;
  /** Per-enum-option metadata slot, reserved for Phase 3's per-option beginner prose (D-01). */
  'x-options'?: Record<string, { 'x-description': string }>;
}
