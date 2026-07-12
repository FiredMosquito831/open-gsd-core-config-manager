/**
 * Constant-time per-launch token guard (SEC-02, D-04, D-05; T-02-03/T-02-18
 * in 02-04-PLAN.md's threat model).
 *
 * Guards reads as well as writes: an unauthenticated `GET` would leak the
 * user's entire config to any other browser tab or local process on the
 * machine (D-04 is stricter than the literal SEC-02 wording, which only
 * mentions mutations). Registered ONLY inside the `/api` plugin scope
 * (`app.ts`) — registering this hook at the Fastify root is
 * 02-RESEARCH.md Pitfall 1 and bricks the SPA bootstrap, because the
 * browser has no token until it has already loaded `index.html` and parsed
 * the `?t=` query param out of its own URL.
 *
 * `OPTIONS` requests (CORS preflights) are let through untouched: they
 * carry no custom headers by definition, so guarding them would break
 * every legitimate preflight (T-02-21). `@fastify/cors` is registered
 * before this hook in `app.ts`'s `/api` plugin, so its own preflight
 * handling short-circuits before a real API handler ever runs.
 *
 * Comparison uses `crypto.timingSafeEqual` over UTF-8 buffers, with a
 * length check first — `timingSafeEqual` throws on unequal-length buffers,
 * so a length mismatch is treated as an immediate reject rather than a
 * thrown error. The rejection body never echoes the supplied token value
 * (T-02-19).
 */
import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { LaunchContext } from '../context.js';

function tokensMatch(supplied: string, expected: string): boolean {
  const suppliedBuf = Buffer.from(supplied, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (suppliedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(suppliedBuf, expectedBuf);
}

export function registerTokenGuard(app: FastifyInstance, ctx: LaunchContext): void {
  app.addHook('onRequest', async (req, reply) => {
    if (req.method === 'OPTIONS') return;

    const supplied = req.headers['x-gsd-token'];
    if (typeof supplied !== 'string' || !tokensMatch(supplied, ctx.token)) {
      return reply.code(403).send({ ok: false, errors: [{ message: 'Missing or invalid launch token' }] });
    }
  });
}
