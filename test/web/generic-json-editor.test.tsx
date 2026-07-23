// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GenericJsonEditor } from '../../web/src/components/specialized/GenericJsonEditor';
import type { IndexedField } from '../../web/src/schema/indexSchema';
import type { LoadResult } from '../../packages/config-io/src/types';

afterEach(() => cleanup());

const loadResult: LoadResult = {
  raw: { project: {}, global: null },
  effective: {
    integrations: {
      providers: { path: 'integrations.providers', value: { existing: { enabled: true } }, from: 'canonical' },
    },
  },
  unknown: [],
  meta: { globalDefaultsPath: '', globalDefaultsFound: false },
};

const objectField: IndexedField = {
  path: 'integrations.providers',
  entry: {
    type: 'object',
    title: 'Providers',
    'x-category': 'Integrations',
    'x-description': 'Provider settings.',
    'x-provenance': 'config-defaults',
  },
  category: 'Integrations',
  title: 'Providers',
  description: 'Provider settings.',
  optionMeanings: {},
  isHandoff: true,
  handoffReason: 'object',
  searchableText: 'providers',
};

function renderEditor(overrides: Partial<React.ComponentProps<typeof GenericJsonEditor>> = {}) {
  const onChange = vi.fn();
  const onBack = vi.fn();
  render(
    <GenericJsonEditor
      field={objectField}
      loadResult={loadResult}
      chapter="Integrations"
      value={{ 'provider.with.dot': { enabled: true }, unchanged: ['one'] }}
      onChange={onChange}
      onBack={onBack}
      {...overrides}
    />,
  );
  return { onChange, onBack };
}

describe('GenericJsonEditor', () => {
  it('pretty-prints and applies a complete object without rewriting dynamic keys', () => {
    const { onChange } = renderEditor();
    const editor = screen.getByRole('textbox', { name: 'Providers JSON' }) as HTMLTextAreaElement;
    expect(editor.value).toContain('"provider.with.dot"');

    fireEvent.change(editor, { target: { value: '{\n  "provider.with.dot": { "enabled": false },\n  "unchanged": ["one"]\n}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply JSON' }));

    expect(onChange).toHaveBeenCalledWith({ 'provider.with.dot': { enabled: false }, unchanged: ['one'] });
  });

  it('rejects malformed JSON without changing the draft', () => {
    const { onChange } = renderEditor();
    fireEvent.change(screen.getByRole('textbox', { name: 'Providers JSON' }), { target: { value: '{not valid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply JSON' }));

    expect(screen.getByRole('alert').textContent).toContain('Enter valid JSON');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects a value with the wrong container type', () => {
    const { onChange } = renderEditor();
    fireEvent.change(screen.getByRole('textbox', { name: 'Providers JSON' }), { target: { value: '[]' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply JSON' }));

    expect(screen.getByRole('alert').textContent).toContain('must be a JSON object');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('accepts null when the schema permits it', () => {
    const { onChange } = renderEditor({
      field: {
        ...objectField,
        entry: { ...objectField.entry, type: ['object', 'null'] },
      },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Providers JSON' }), { target: { value: 'null' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply JSON' }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('keeps an un-applied draft when the parent rerenders with an equivalent field', () => {
    const { rerender } = render(
      <GenericJsonEditor
        field={objectField}
        loadResult={loadResult}
        chapter="Integrations"
        value={{ existing: true }}
        onChange={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    const editor = screen.getByRole('textbox', { name: 'Providers JSON' }) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: '{\n  "draft": true\n}' } });
    rerender(
      <GenericJsonEditor
        field={{ ...objectField }}
        loadResult={loadResult}
        chapter="Integrations"
        value={{ existing: true }}
        onChange={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(editor.value).toContain('"draft"');
  });

  it('returns to the chapter without applying a change', () => {
    const { onBack, onChange } = renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Integrations' }));

    expect(onBack).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });
});
