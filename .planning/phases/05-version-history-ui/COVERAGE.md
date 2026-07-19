# API Coverage — Local Version History API

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
>
> The deterministic gate detected the words “integration” and “API” in Phase 5 artifacts. This phase does not integrate an external service, SDK, REST API, or GraphQL API; it extends the application's authenticated loopback helper. The complete Phase 5 loopback surface is nevertheless enumerated below so the coverage decision remains explicit and auditable.

| capability | decision | reason |
|---|---|---|
| list configuration snapshot history | INTEGRATE | |
| read a trusted configuration snapshot | INTEGRATE | |
| compare a snapshot with the current configuration | INTEGRATE | |
| restore a trusted snapshot through the validated save pipeline | INTEGRATE | |
| report restore conflicts and failures without losing the selected outcome | INTEGRATE | |

There are no Phase 5 API capabilities opted out and no external API capabilities in scope.
