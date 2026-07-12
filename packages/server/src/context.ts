/**
 * Per-launch security context (D-04, D-05, D-06; 02-RESEARCH.md Pattern 3's
 * "ordering gotcha").
 *
 * The ephemeral port is not known until `listen()` resolves, but Fastify
 * hooks must be registered before that call happens. So the four guard
 * plugins in `./plugins/*.ts` close over this MUTABLE context object and
 * read `ctx.allowedHosts` / `ctx.corsOrigin` at REQUEST time, never at
 * registration time. `sealLaunchContext()` is called exactly once, by the
 * CLI's bootstrap (Plan 06), immediately after `listen()` resolves — which
 * is strictly before any request can reach the server, so there is no
 * window in which a request could observe a stale/empty context.
 */
import { randomUUID } from 'node:crypto';

/** The per-launch security state every guard plugin reads at request time. */
export interface LaunchContext {
  /** Per-launch `crypto.randomUUID()` token (D-05). Never logged, never echoed back to a caller. */
  token: string;
  /** `127.0.0.1:<port>` and `localhost:<port>`, populated by `sealLaunchContext` (D-06). Empty until then — fails closed. */
  allowedHosts: Set<string>;
  /** `http://127.0.0.1:<port>`, populated by `sealLaunchContext` (D-06). `null` until then — fails closed. */
  corsOrigin: string | null;
}

/**
 * Mints the per-launch token. `allowedHosts`/`corsOrigin` start
 * empty/`null` — the port is not known yet — so every guard that reads
 * them must fail closed against this initial state, not assume it is
 * already sealed.
 */
export function createLaunchContext(): LaunchContext {
  return {
    token: randomUUID(),
    allowedHosts: new Set(),
    corsOrigin: null,
  };
}

/**
 * Derives `allowedHosts`/`corsOrigin` from the OS-assigned port and writes
 * them onto the existing context object (mutation is deliberate — see
 * module header). Call exactly once, immediately after `app.listen()`
 * resolves, so the port -> policy derivation lives in exactly one place and
 * tests can call it too instead of re-deriving the same strings ad hoc.
 */
export function sealLaunchContext(ctx: LaunchContext, port: number): void {
  ctx.allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  ctx.corsOrigin = `http://127.0.0.1:${port}`;
}
