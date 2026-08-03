/**
 * Exact-string CORS lock (D-06, 02-RESEARCH.md Pattern 3; T-02-07 in
 * 02-04-PLAN.md's threat model).
 *
 * `origin` is a function that answers `true` ONLY on an exact string
 * equality against `ctx.corsOrigin` (computed once, after `listen()`
 * resolves the ephemeral port — see `context.ts`). This is intentionally
 * NEVER a pattern match: Fastify's own docs warn that a carelessly crafted
 * RegExp/function origin check "may enable Denial of Service attacks"
 * (ReDoS). The loopback origin is a single known value computed once after
 * bind, so pattern matching buys nothing here and only adds risk.
 *
 * `credentials: false` — the token travels as a header (`x-gsd-token`),
 * never a cookie, so this model has no CSRF-via-cookie surface to protect
 * at all.
 *
 * This plugin alone does NOT make the server reject a cross-origin
 * request (see `<cors_correction>` in 02-04-PLAN.md and `origin-guard.ts`)
 * — it only handles preflight `OPTIONS` / `Vary` / allowed-headers
 * negotiation correctly. The actual 403 rejection is `origin-guard.ts`'s
 * `onRequest` hook.
 */
import type { FastifyCorsOptions } from '@fastify/cors';
import type { LaunchContext } from '../context.js';

export function buildCorsOptions(ctx: LaunchContext): FastifyCorsOptions {
  return {
    origin(origin, cb) {
      // No Origin header at all (same-origin navigation, curl, etc.) — let
      // it through; the token guard (D-04) is what covers that caller
      // class, CORS is a browser-enforced control only.
      if (origin === undefined) {
        cb(null, true);
        return;
      }
      // Exact string equality only. `ctx.corsOrigin === null` (unsealed
      // context) always fails this comparison — fail closed, never open.
      cb(null, ctx.corsOrigin !== null && origin === ctx.corsOrigin);
    },
    credentials: false,
    methods: ['GET', 'PUT', 'POST'],
    allowedHeaders: ['content-type', 'x-gsd-token'],
  };
}
