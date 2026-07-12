/**
 * Prototype-pollution-safe dot-path patch utility.
 *
 * `safeSet()` is the only sanctioned mutation path for the original parsed
 * config object (SAVE-03 patch-in-place invariant, see types.ts LoadResult
 * doc comment) — bypassing it reintroduces both the pollution risk and the
 * unknown-key-drop risk (01-RESEARCH.md § Pitfall 1).
 *
 * The denylist is kept visible and auditable in this file rather than
 * delegated to a general-purpose library like lodash
 * (01-RESEARCH.md § Don't Hand-Roll).
 */

/** Path segments that must never be traversed or assigned — prototype-pollution guard. */
export const FORBIDDEN_SEGMENTS: Set<string> = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Sets `value` at `dotPath` inside `obj`, mutating `obj` in place and
 * creating intermediate plain objects as needed. Throws if any segment
 * (intermediate or final) is a forbidden prototype-pollution target.
 */
export function safeSet(obj: Record<string, unknown>, dotPath: string, value: unknown): void {
  const segments = dotPath.split('.');
  let cursor: Record<string, unknown> = obj;

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (FORBIDDEN_SEGMENTS.has(seg)) {
      throw new Error(`Refusing to patch unsafe path segment: ${seg}`);
    }
    if (typeof cursor[seg] !== 'object' || cursor[seg] === null) {
      cursor[seg] = {};
    }
    cursor = cursor[seg] as Record<string, unknown>;
  }

  const last = segments[segments.length - 1];
  if (FORBIDDEN_SEGMENTS.has(last)) {
    throw new Error(`Refusing to patch unsafe path segment: ${last}`);
  }
  cursor[last] = value;
}
