import { useMemo, useState } from 'react';
import { FormProvider, useForm, type FieldErrors, type Resolver } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import { loadConfig, saveConfig } from '../../api/configs';
import { getSchema } from '../../api/schema';
import { buildProjectSaveCandidate, type ProjectChange } from '../../schema/patchProject';
import { createClientValidator, type ClientValidationError } from '../../schema/validation';
import { getEffectiveLeaf } from '../../schema/effective';
import { indexSchema } from '../../schema/indexSchema';
import { useUiStore } from '../../state/uiStore';
import { EmptyState } from '../common/EmptyState';
import { ChapterView } from '../chapters/ChapterView';
import { SaveBar } from './SaveBar';
import { ValidationSummary, type ValidationSummaryError } from './ValidationSummary';
import type { LoadResult, SchemaEntry } from '../../../../packages/config-io/src/types';

function collectEffectiveDefaults(loadResult: LoadResult, schema: Record<string, SchemaEntry>) {
  const values: Record<string, unknown> = {};
  const indexed = indexSchema(schema);
  for (const field of indexed.searchable) {
    if (field.isHandoff) continue;
    const leaf = getEffectiveLeaf(loadResult.effective, field.path);
    values[field.path] = leaf?.value;
  }
  return values;
}

function toFormErrors(errors: ClientValidationError[]): FieldErrors<Record<string, unknown>> {
  return errors.reduce<FieldErrors<Record<string, unknown>>>((acc, err) => {
    const path = err.path === '/' ? 'config' : err.path.replace(/^\//, '').replace(/\//g, '.');
    acc[path] = { type: 'schema', message: err.message };
    return acc;
  }, {});
}

function normalizeServerErrors(error: unknown): ValidationSummaryError[] {
  if (!(error instanceof ApiError)) {
    return [{ message: 'Save failed', instancePath: '/', keyword: 'request' }];
  }

  return error.errors.map((err) => ({
    message: typeof err.message === 'string' ? err.message : 'invalid',
    instancePath: typeof err.instancePath === 'string' ? err.instancePath : '/',
    keyword: typeof err.keyword === 'string' ? err.keyword : undefined,
  }));
}

export function ConfigEditor() {
  const { activeConfigId } = useUiStore();
  const queryClient = useQueryClient();
  const [changes, setChanges] = useState<Record<string, unknown>>({});
  const [resets, setResets] = useState<Set<string>>(() => new Set());
  const [serverErrors, setServerErrors] = useState<ValidationSummaryError[]>([]);
  const [snapshotId, setSnapshotId] = useState<string | undefined>();

  const { data: loadResult, isLoading: isLoadingConfig, error: configError } = useQuery({
    queryKey: ['config', activeConfigId],
    queryFn: () => loadConfig(activeConfigId!),
    enabled: !!activeConfigId,
  });
  const { data: schema, isLoading: isLoadingSchema, error: schemaError } = useQuery({
    queryKey: ['schema'],
    queryFn: getSchema,
  });

  const validator = useMemo(() => (schema ? createClientValidator(schema) : null), [schema]);
  const defaultValues = useMemo(() => {
    if (!loadResult || !schema) return {};
    return collectEffectiveDefaults(loadResult, schema);
  }, [loadResult, schema]);

  const resolver: Resolver<Record<string, unknown>> = async (values) => {
    if (!loadResult || !validator) return { values, errors: {} };
    const changeList: ProjectChange[] = Object.entries(changes).map(([path, value]) => ({ path, value }));
    const candidate = buildProjectSaveCandidate(loadResult, changeList, Array.from(resets));
    const result = validator(candidate);
    return result.valid ? { values, errors: {} } : { values: {}, errors: toFormErrors(result.errors) };
  };

  const form = useForm<Record<string, unknown>>({
    defaultValues,
    values: defaultValues,
    resolver,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!activeConfigId || !loadResult || !validator) return undefined;
      setServerErrors([]);
      setSnapshotId(undefined);
      const changeList: ProjectChange[] = Object.entries(changes).map(([path, value]) => ({ path, value }));
      const candidate = buildProjectSaveCandidate(loadResult, changeList, Array.from(resets));
      const clientResult = validator(candidate);
      if (!clientResult.valid) {
        for (const err of clientResult.errors) {
          const path = err.path === '/' ? 'config' : err.path.replace(/^\//, '').replace(/\//g, '.');
          form.setError(path, { type: 'schema', message: err.message });
        }
        throw new Error('Client validation failed');
      }
      return saveConfig(activeConfigId, candidate);
    },
    onSuccess: async (result) => {
      setSnapshotId(result?.snapshotId);
      setChanges({});
      setResets(new Set());
      form.reset(defaultValues);
      if (activeConfigId) {
        const refreshed = await loadConfig(activeConfigId);
        queryClient.setQueryData(['config', activeConfigId], refreshed);
      }
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setServerErrors(normalizeServerErrors(error));
      }
    },
  });

  if (!activeConfigId) {
    return (
      <EmptyState
        title="Select a configuration"
        description="Choose a tracked config from the sidebar to begin editing."
      />
    );
  }

  if (isLoadingConfig || isLoadingSchema) return <div className="gsd-sidebar__loading">Loading config...</div>;
  if (configError || schemaError) return <div className="gsd-sidebar__error">Failed to load config.</div>;
  if (!loadResult || !schema) return <div className="gsd-sidebar__error">Config data unavailable.</div>;

  const isDirty = Object.keys(changes).length > 0 || resets.size > 0;
  const hasClientErrors = Object.keys(form.formState.errors).length > 0;

  return (
    <FormProvider {...form}>
      <div className="gsd-config-editor">
        <div className="gsd-config-editor__header">
          <h2 className="gsd-sidebar__heading">Config editor</h2>
          {loadResult.meta.globalDefaultsFound && (
            <p className="gsd-preview">Global defaults loaded from {loadResult.meta.globalDefaultsPath}</p>
          )}
        </div>
        <ValidationSummary errors={serverErrors} kind="server" />
        <ChapterView
          loadResult={loadResult}
          schema={schema}
          control={form.control}
          onFieldChange={(path, value) => {
            setServerErrors([]);
            setSnapshotId(undefined);
            setResets((prev) => {
              const next = new Set(prev);
              next.delete(path);
              return next;
            });
            setChanges((prev) => ({ ...prev, [path]: value }));
          }}
          onResetField={(path) => {
            setServerErrors([]);
            setSnapshotId(undefined);
            setChanges((prev) => {
              const next = { ...prev };
              delete next[path];
              return next;
            });
            setResets((prev) => new Set(prev).add(path));
            form.setValue(path, undefined, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
          }}
        />
        <SaveBar
          dirty={isDirty}
          disabled={!isDirty || hasClientErrors}
          isSaving={saveMutation.isPending}
          snapshotId={snapshotId}
          onSave={() => void form.handleSubmit(() => saveMutation.mutate())()}
        />
      </div>
    </FormProvider>
  );
}
