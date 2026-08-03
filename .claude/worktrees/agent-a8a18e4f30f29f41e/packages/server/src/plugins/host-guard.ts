/**
 * Root-scope Host-header allowlist (SEC-01, D-06, 02-RESEARCH.md Pattern 1;
 * T-02-01 in 02-04-PLAN.md's threat model).
 *
 * Registered by `app.ts` at the ROOT scope — never inside the `/api`
 * plugin — so it also protects static-asset routes: a browser cannot forge
 * the `Host` header, so this single check defeats the entire DNS-rebinding
 * class regardless of what an attacker's domain resolves to, for every
 * route including `index.html`.
 *
 * The rejection body is a fixed, static message that never echoes the
 * received Host value back to the caller (T-02-19 Information Disclosure
 * guard, mirroring config-io's `ValidationError`, which never carries the
 * config body). Exact `Set` membership only — no pattern matching.
 */
import type { FastifyInstance } from 'fastify';
import type { LaunchContext } from '../context.js';

export function registerHostGuard(app: FastifyInstance, ctx: LaunchContext): void {
  app.addHook('onRequest', async (req, reply) => {
    const host = req.headers.host;
    if (!host || !ctx.allowedHosts.has(host)) {
      return reply.code(403).send({ ok: false, errors: [{ message: 'Host not allowed' }] });
    }
  });
}
