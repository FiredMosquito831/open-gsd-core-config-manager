// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EditorView } from 'codemirror';
import { GenericJsonEditor } from '../../web/src/components/specialized/GenericJsonEditor';
import type { IndexedField } from '../../web/src/schema/indexSchema';
import type { LoadResult } from '../../packages/config-io/src/types';

// CodeMirror 6 uses ResizeObserver to track content measurement; jsdom does not
// provide it (the global polyfill lives in test/web/setup.ts, but keep a local
// fallback so this file is self-contained).
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  if (!g.ResizeObserver) g.ResizeObserver = ResizeObserverStub;
});

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

function renderEditor(overrides: Partial<ComponentProps<typeof GenericJsonEditor>> = {}) {
  const onChange = vi.fn();
  const onBack = vi.fn();
  const utils = render(
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
  return { onChange, onBack, container: utils.container };
}

function getView(container: HTMLElement): EditorView {
  const editor = container.querySelector('.cm-editor');
  if (!editor) throw new Error('CodeMirror editor not rendered');
  const view = EditorView.findFromDOM(editor as HTMLElement);
  if (!view) throw new Error('CodeMirror view not found');
  return view;
}

function setEditorText(container: HTMLElement, text: string): void {
  const view = getView(container);
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
}

function editorText(container: HTMLElement): string {
  return getView(container).state.doc.toString();
}

describe('GenericJsonEditor', () => {
  it('pretty-prints and applies a complete object without rewriting dynamic keys', () => {
    const { onChange, container } = renderEditor();
    expect(editorText(container)).toContain('"provider.with.dot"');

    setEditorText(container, '{\n  "provider.with.dot": { "enabled": false },\n  "unchanged": ["one"]\n}');
    fireEvent.click(screen.getByRole('button', { name: 'Apply JSON' }));

    expect(onChange).toHaveBeenCalledWith({ 'provider.with.dot': { enabled: false }, unchanged: ['one'] });
  });

  it('rejects malformed JSON without changing the draft', () => {
    const { onChange, container } = renderEditor();
    setEditorText(container, '{not valid');
    fireEvent.click(screen.getByRole('button', { name: 'Apply JSON' }));

    expect(screen.getByRole('alert').textContent).toContain('Enter valid JSON');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects a value with the wrong container type', () => {
    const { onChange, container } = renderEditor();
    setEditorText(container, '[]');
    fireEvent.click(screen.getByRole('button', { name: 'Apply JSON' }));

    expect(screen.getByRole('alert').textContent).toContain('must be a JSON object');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('accepts null when the schema permits it', () => {
    const { onChange, container } = renderEditor({
      field: {
        ...objectField,
        entry: { ...objectField.entry, type: ['object', 'null'] },
      },
    });
    setEditorText(container, 'null');
    fireEvent.click(screen.getByRole('button', { name: 'Apply JSON' }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('keeps an un-applied draft when the parent rerenders with an equivalent field', () => {
    const utils = render(
      <GenericJsonEditor
        field={objectField}
        loadResult={loadResult}
        chapter="Integrations"
        value={{ existing: true }}
        onChange={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    const { container } = utils;
    setEditorText(container, '{\n  "draft": true\n}');
    utils.rerender(
      <GenericJsonEditor
        field={{ ...objectField }}
        loadResult={loadResult}
        chapter="Integrations"
        value={{ existing: true }}
        onChange={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(editorText(container)).toContain('"draft"');
  });

  it('returns to the chapter without applying a change', () => {
    const { onBack, onChange } = renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Integrations' }));

    expect(onBack).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });
});
