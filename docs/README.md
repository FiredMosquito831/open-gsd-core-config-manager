# Documentation

## Canonical schema — [`canonical-schema.json`](canonical-schema.json)

The single machine-readable reference for every known GSD (`open-gsd/gsd-core`) `config.json` key. This is the data the Config Manager's entire UI is generated from.

**Shape:**

```jsonc
{
  "version": "1.11.0",              // gsd-core release this snapshot tracks
  "keys": {
    "<dot.path.key>": {
      "type": "string",             // JSON type (or union)
      "category": "General",        // UI chapter the key groups under
      "description": "…",           // plain-language: what it does, when to change it
      "default": "interactive",     // canonical default value (when one exists)
      "allowedValues": [            // for enums
        { "value": "yolo", "meaning": "…" }
      ],
      "minimum": 0, "maximum": 10,  // numeric bounds, when declared
      "editor": "agent-map"         // specialized editor hint, when applicable
    }
  }
}
```

Notes:

- **192 of 201 keys carry a scalar default.** The remaining 9 are namespace/map keys (`model_overrides`, `features`, `granularities`, …) whose defaults are structural; each carries a `defaultNote` explaining that its sub-keys hold their own defaults.
- **26 keys are enums** with per-option meanings under `allowedValues[].meaning`.
- Regenerated per tracked gsd-core release by this repo's schema pipeline (`packages/schema-data`), which reconciles a curated doc layer against the upstream release.

## Related

- The app itself renders this data with richer prose via **Schema maintenance → Check for updates**, which can pull newer releases' metadata at runtime.
- Upstream project: [open-gsd/gsd-core](https://github.com/open-gsd/gsd-core).
