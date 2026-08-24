/**
 * jsdom does not implement ResizeObserver nor EventSource, both needed by
 * components that use them. Minimal no-op stubs are sufficient for rendering
 * and driving components programmatically in tests.
 */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

class EventSourceStub extends EventTarget {
  constructor(public url: string) {
    super();
    this.readyState = this.CONNECTING;
    setTimeout(() => { this.readyState = this.OPEN; this.dispatchEvent(new Event('open')); }, 0);
  }
  CLOSED = 2;
  CONNECTING = 0;
  OPEN = 1;
  readyState: number = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  close(): void {
    this.readyState = this.CLOSED;
    this.dispatchEvent(new Event('close'));
  }
  addEventListener(type: string, listener: EventListener): void {
    super.addEventListener(type, listener);
  }
  removeEventListener(type: string, listener: EventListener): void {
    super.removeEventListener(type, listener);
  }
  dispatchEvent(event: Event): boolean {
    if (event.type === 'open' && this.onopen) this.onopen(event);
    if (event.type === 'message' && this.onmessage) this.onmessage(event as MessageEvent);
    if (event.type === 'error' && this.onerror) this.onerror(event);
    return super.dispatchEvent(event);
  }
}

const g = globalThis as Record<string, unknown>;
if (!g.ResizeObserver) g.ResizeObserver = ResizeObserverStub;
if (!g.EventSource) g.EventSource = EventSourceStub;

// Desktop viewport for unit tests. jsdom's default innerWidth is 1024, which
// trips AppShell's responsive auto-collapse (<=1100px collapses the chapter
// pane and aria-hides it, dropping chapter tabs from the accessibility tree
// that testing-library queries). Unit tests exercise the desktop editor layout,
// so pin a wide viewport here; responsive behavior has its own dedicated tests.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 900 });
}
