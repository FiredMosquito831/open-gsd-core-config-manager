import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useForm, type FieldErrors, type Resolver, type UseFormReturn } from 'react-hook-form';
import { ApiError } from '../api/client';
import { loadConfig, saveConfig } from '../api/configs';
import { getEffectiveLeaf } from '../schema/effective';
import { indexSchema } from '../schema/indexSchema';
import { buildProjectSaveCandidate, type ProjectChange } from '../schema/patchProject';
import { createClientValidator, type ClientValidationError } from '../schema/validation';
import type { LoadResult, SchemaEntry } from '../../../packages/config-io/src/types';
import type { ValidationSummaryError } from '../components/editor/ValidationSummary';

type RuntimeNotice = { runtime: 'codex' | 'opencode'; settings: string[] } | null;

type DraftEntry = {
  changes: Record<string, unknown>;
  resets: Set<string>;
  serverErrors: ValidationSummaryError[];
  snapshotId?: string;
  runtimeNotice: RuntimeNotice;
  revision: number;
};

const entries = new Map<string, DraftEntry>();
const listeners = new Set<() => void>();

function notify() { listeners.forEach((listener) => listener()); }
function subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
function entryFor(id: string): DraftEntry {
  const existing = entries.get(id);
  if (existing) return existing;
  const entry: DraftEntry = { changes: {}, resets: new Set(), serverErrors: [], runtimeNotice: null, revision: 0 };
  entries.set(id, entry);
  return entry;
}
function update(id: string, mutate: (entry: DraftEntry) => void) { const entry = entryFor(id); mutate(entry); entry.revision += 1; notify(); }

function collectEffectiveDefaults(loadResult: LoadResult, schema: Record<string, SchemaEntry>) {
  const values: Record<string, unknown> = {};
  for (const field of indexSchema(schema).searchable) {
    if (!field.isHandoff) values[field.path] = getEffectiveLeaf(loadResult.effective, field.path)?.value;
  }
  return values;
}
function toFormErrors(errors: ClientValidationError[]): FieldErrors<Record<string, unknown>> {
  return errors.reduce<FieldErrors<Record<string, unknown>>>((acc, err) => {
    acc[err.path === '/' ? 'config' : err.path.replace(/^\//, '').replace(/\//g, '.')] = { type: 'schema', message: err.message };
    return acc;
  }, {});
}
function normalizeServerErrors(error: unknown): ValidationSummaryError[] {
  if (!(error instanceof ApiError)) return [{ message: 'Save failed', instancePath: '/', keyword: 'request' }];
  return error.errors.map((err) => ({ message: typeof err.message === 'string' ? err.message : 'invalid', instancePath: typeof err.instancePath === 'string' ? err.instancePath : '/', keyword: typeof err.keyword === 'string' ? err.keyword : undefined }));
}

export interface ConfigDraftController {
  isDirty: boolean;
  changes: Record<string, unknown>;
  resets: Set<string>;
  form: UseFormReturn<Record<string, unknown>>;
  serverErrors: ValidationSummaryError[];
  snapshotId?: string;
  runtimeNotice: RuntimeNotice;
  isSaving: boolean;
  dismissRuntimeNotice(): void;
  saveDraft(): Promise<'saved' | 'blocked'>;
  onFieldChange(path: string, value: unknown): void;
  onResetField(path: string): void;
  discardDraft(): void;
  resetFromServer(reloaded: LoadResult): void;
}

export function useConfigDraft(activeConfigId: string, loadResult: LoadResult, schema: Record<string, SchemaEntry>): ConfigDraftController {
  const validator = useMemo(() => createClientValidator(schema), [schema]);
  const defaults = useMemo(() => collectEffectiveDefaults(loadResult, schema), [loadResult, schema]);
  const getSnapshot = useCallback(() => entryFor(activeConfigId).revision, [activeConfigId]);
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const entry = entryFor(activeConfigId);
  const resolver: Resolver<Record<string, unknown>> = useCallback(async (values) => {
    const current = entryFor(activeConfigId);
    const candidate = buildProjectSaveCandidate(loadResult, Object.entries(current.changes).map(([path, value]) => ({ path, value })), Array.from(current.resets));
    const result = validator(candidate);
    return result.valid ? { values, errors: {} } : { values: {}, errors: toFormErrors(result.errors) };
  }, [activeConfigId, loadResult, validator]);
  const form = useForm<Record<string, unknown>>({ defaultValues: defaults, values: defaults, resolver, mode: 'onBlur', reValidateMode: 'onChange' });

  const clear = useCallback((reloaded: LoadResult) => {
    update(activeConfigId, (draft) => { draft.changes = {}; draft.resets = new Set(); draft.serverErrors = []; draft.snapshotId = undefined; });
    form.reset(collectEffectiveDefaults(reloaded, schema));
  }, [activeConfigId, form, schema]);
  const onFieldChange = useCallback((path: string, value: unknown) => {
    update(activeConfigId, (draft) => { draft.serverErrors = []; draft.snapshotId = undefined; draft.resets.delete(path); draft.changes = { ...draft.changes, [path]: value }; });
    form.setValue(path, value, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
  }, [activeConfigId, form]);
  const onResetField = useCallback((path: string) => {
    update(activeConfigId, (draft) => { draft.serverErrors = []; draft.snapshotId = undefined; const next = { ...draft.changes }; delete next[path]; draft.changes = next; draft.resets.add(path); });
    form.setValue(path, undefined, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
  }, [activeConfigId, form]);
  const discardDraft = useCallback(() => clear(loadResult), [clear, loadResult]);
  const resetFromServer = useCallback((reloaded: LoadResult) => clear(reloaded), [clear]);
  const [saving, setSaving] = useState(false);
  const dismissRuntimeNotice = useCallback(() => update(activeConfigId, (draft) => { draft.runtimeNotice = null; }), [activeConfigId]);
  const saveDraft = useCallback(async (): Promise<'saved' | 'blocked'> => {
    const current = entryFor(activeConfigId);
    const candidate = buildProjectSaveCandidate(loadResult, Object.entries(current.changes).map(([path, value]) => ({ path, value } as ProjectChange)), Array.from(current.resets));
    const clientResult = validator(candidate);
    update(activeConfigId, (draft) => { draft.serverErrors = []; draft.snapshotId = undefined; });
    if (!clientResult.valid) {
      for (const error of clientResult.errors) form.setError(error.path === '/' ? 'config' : error.path.replace(/^\//, '').replace(/\//g, '.'), { type: 'schema', message: error.message });
      return 'blocked';
    }
    setSaving(true);
    try {
      const result = await saveConfig(activeConfigId, candidate);
      const matching = Object.keys(current.changes).filter((path) => /^(?:model_overrides|model_profile_overrides)\.(codex|opencode)\.(?:opus|sonnet|haiku)$/.test(path));
      const runtime = matching.map((path) => path.match(/^(?:model_overrides|model_profile_overrides)\.(codex|opencode)\./)?.[1]).find((value): value is 'codex' | 'opencode' => value === 'codex' || value === 'opencode');
      const refreshed = await loadConfig(activeConfigId);
      update(activeConfigId, (draft) => { draft.snapshotId = result.snapshotId; draft.changes = {}; draft.resets = new Set(); if (runtime) draft.runtimeNotice = { runtime, settings: matching }; });
      form.reset(collectEffectiveDefaults(refreshed, schema));
      return 'saved';
    } catch (error) {
      update(activeConfigId, (draft) => { draft.serverErrors = normalizeServerErrors(error); });
      return 'blocked';
    } finally { setSaving(false); }
  }, [activeConfigId, form, loadResult, schema, validator]);
  return { isDirty: Object.keys(entry.changes).length > 0 || entry.resets.size > 0, changes: entry.changes, resets: entry.resets, form, serverErrors: entry.serverErrors, snapshotId: entry.snapshotId, runtimeNotice: entry.runtimeNotice, isSaving: saving, dismissRuntimeNotice, saveDraft, onFieldChange, onResetField, discardDraft, resetFromServer };
}
