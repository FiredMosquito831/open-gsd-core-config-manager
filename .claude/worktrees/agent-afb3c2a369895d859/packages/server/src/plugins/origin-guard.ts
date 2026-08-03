/**
 * `/api`-scoped Origin guard (SEC-01, D-06; T-02-02 in 02-04-PLAN.md's
 * threat model). Read the plan's `<cors_correction>` before touching this
 * file — it corrects 02-RESEARCH.md.
 *
 * `@fastify/cors` alone cannot make this a real rejection: when its
 * `origin` callback answers `false`, the plugin only OMITS the
 * `Access-Control-Allow-Origin` header — the request still reaches the
 * handler and still returns 200; it is the *browser* that then withholds
 * the response from the calling page. `fastify.inject()` has no browser,
 * and the success criterion requires the request be "rejected by the
 * server" itself. This hook is what actually returns 403.
 *
 * A request with NO `Origin` header is passed through here — same-origin
 * navigations and non-browser callers (curl, other local processes)
 * legitimately omit it, and the token guard (D-04) is what covers that
 * caller class instead. An unsealed context (`ctx.corsOrigin === null`)
 * fails CLOSED: any *present* Origin is rejected until `sealLaunchContext`
 * has run, never accepted by default.
 *
 * Registered inside the `/api` plugin scope only (`app.ts`) — never at the
 * root, so it never touches static-asset routes.
 */
import type { FastifyInstance } from 'fastify';
import type { LaunchContext } from '../context.js';

export function registerOriginGuard(app: FastifyInstance, ctx: LaunchContext): void {
  app.addHook('onRequest', async (req, reply) => {
    const origin = req.headers.origin;
    if (origin !== undefined && origin !== ctx.corsOrigin) {
      return reply.code(403).send({ ok: false, errors: [{ message: 'Origin not allowed' }] });
    }
  });
}
