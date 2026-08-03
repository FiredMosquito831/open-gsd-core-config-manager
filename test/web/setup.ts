/**
 * jsdom does not implement ResizeObserver, which CodeMirror 6's EditorView
 * requires in order to mount. A no-op stub is sufficient for rendering the
 * editor and driving it programmatically (via EditorView.findFromDOM + dispatch)
 * in component tests. Node-environment tests are unaffected.
 */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const g = globalThis as Record<string, unknown>;
if (!g.ResizeObserver) g.ResizeObserver = ResizeObserverStub;
