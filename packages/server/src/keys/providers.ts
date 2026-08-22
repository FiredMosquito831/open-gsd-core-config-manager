/**
 * Search-capability provider registry (env-var / API-key configuration).
 *
 * Seven `config.json` boolean toggles (brave_search, firecrawl, exa_search,
 * tavily_search, ref_search, perplexity, jina) only take effect when the
 * matching API key is present. Each key can arrive via TWO independent
 * channels, both honored at runtime by gsd-core's own loader:
 *
 *   1. Environment variable  <PREFIX>_API_KEY  (e.g. BRAVE_API_KEY)
 *   2. Key file              ~/.gsd/<prefix>_api_key
 *
 * The env-var channel is read from the live process env at request time, so a
 * key present there is detected immediately and a key written here takes effect
 * for the current server session. The key-file channel is the durable,
 * portable, tool-controlled one: this manager reads and writes it directly.
 *
 * Env var and file slug are both derived from a single canonical prefix per
 * provider, so the two channels can never drift apart.
 */

export interface SearchProvider {
  /** Dot-path config key, e.g. "brave_search". */
  key: string;
  /** Human-readable name, e.g. "Brave Search". */
  title: string;
  /** Key prefix, e.g. "brave". Drives BOTH the env var and the file slug. */
  prefix: string;
  /** Environment variable name, e.g. "BRAVE_API_KEY". */
  readonly envVar: string;
  /** Key filename (no dir), e.g. "brave_api_key". */
  readonly fileSlug: string;
  /** Where a user obtains this key, for the UI help line. */
  homepage?: string;
}

function channels(prefix: string) {
  return {
    envVar: `${prefix.toUpperCase()}_API_KEY`,
    fileSlug: `${prefix}_api_key`,
  };
}

export const SEARCH_PROVIDERS: readonly SearchProvider[] = [
  { key: 'brave_search', title: 'Brave Search', prefix: 'brave', homepage: 'https://brave.com/search/api/' },
  { key: 'firecrawl', title: 'Firecrawl', prefix: 'firecrawl', homepage: 'https://www.firecrawl.dev/' },
  { key: 'exa_search', title: 'Exa', prefix: 'exa', homepage: 'https://exa.ai/' },
  { key: 'tavily_search', title: 'Tavily', prefix: 'tavily', homepage: 'https://tavily.com/' },
  { key: 'ref_search', title: 'Ref', prefix: 'ref', homepage: 'https://ref.get/' },
  { key: 'perplexity', title: 'Perplexity', prefix: 'perplexity', homepage: 'https://www.perplexity.ai/' },
  { key: 'jina', title: 'Jina', prefix: 'jina', homepage: 'https://jina.ai/' },
].map((p) => ({ ...p, ...channels(p.prefix) }));

const BY_KEY = new Map(SEARCH_PROVIDERS.map((p) => [p.key, p]));

export function providerFor(key: string): SearchProvider | undefined {
  return BY_KEY.get(key);
}
