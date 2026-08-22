/**
 * Search-provider key routes (D-14 env-var / file API-key configuration).
 *
 * Exposes the two-channel key model for the seven search capabilities
 * (brave_search, firecrawl, exa_search, tavily_search, ref_search, perplexity,
 * jina): each key can be delivered via env var OR a `~/.gsd/<prefix>_api_key`
 * file, and `configured` is true when EITHER channel holds a non-empty key.
 *
 *   GET  /api/keys            -> detection state for every provider
 *   GET  /api/keys/:provider  -> detection state for one provider
 *   POST /api/keys            -> write (value non-empty) or clear (empty) a key
 *   DELETE /api/keys/:provider-> clear a key across both channels
 *
 * The POST body selects which channel(s) to write:
 *   { "provider": "brave_search", "value": "sk-...", "channel": "file"|"env"|"both" }
 *
 * Env-var writes affect the current server session immediately; key-file writes
 * are the durable, portable channel. Registered inside the `/api` plugin so it
 * inherits the Origin + token guards.
 */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiErr, KeyStatusDto, KeyWriteDto } from '../api-types.js';
import { providerFor } from '../keys/providers.js';
import { getKeyStatus, listKeyStatuses, writeKey } from '../keys/service.js';

const PROVIDER_ID = { type: 'string', minLength: 1, maxLength: 64 } as const;

function errBody(message: string): ApiErr {
  return { ok: false, errors: [{ message }] };
}

export const keysRoutes: FastifyPluginAsync = async (app) => {
  app.get('/keys', async () => ({ ok: true, keys: listKeyStatuses() satisfies KeyStatusDto[] }));

  app.get<{ Params: { provider: string } }>(
    '/keys/:provider',
    { schema: { params: { type: 'object', required: ['provider'], additionalProperties: false, properties: { provider: PROVIDER_ID } } } },
    async (req, reply) => {
      const status = getKeyStatus(req.params.provider);
      if (!status) return reply.code(404).send(errBody(`Unknown search provider: ${req.params.provider}`));
      return { ok: true, status };
    },
  );

  app.post<{ Body: KeyWriteDto }>(
    '/keys',
    {
      schema: {
        body: {
          type: 'object',
          required: ['provider', 'value', 'channel'],
          additionalProperties: false,
          properties: {
            provider: PROVIDER_ID,
            value: { type: 'string' },
            channel: { type: 'string', enum: ['file', 'env', 'both'] },
          },
        },
      },
    },
    async (req, reply) => {
      const { provider, value, channel } = req.body;
      if (!providerFor(provider)) return reply.code(404).send(errBody(`Unknown search provider: ${provider}`));
      return { ok: true, status: writeKey(provider, value, channel) };
    },
  );

  app.delete<{ Params: { provider: string } }>(
    '/keys/:provider',
    { schema: { params: { type: 'object', required: ['provider'], additionalProperties: false, properties: { provider: PROVIDER_ID } } } },
    async (req, reply) => {
      if (!providerFor(req.params.provider)) return reply.code(404).send(errBody(`Unknown search provider: ${req.params.provider}`));
      return { ok: true, status: writeKey(req.params.provider, '', 'both') };
    },
  );
};
