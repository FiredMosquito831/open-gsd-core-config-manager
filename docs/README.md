# Documentation

This directory is the **generated static site** published at
<https://gsd.danubelabs.net> (GitHub Pages, served from `docs/`).

## What is generated, and from what

| Output | Source |
|---|---|
| `index.html`, `schema.html`, `cli.html`, `history.html`, `faq.html`, `about.html`, `404.html` | `site/templates/*.html` (Jinja2) + repository data |
| Schema explorer key list, types, defaults, allowed values, descriptions | [`canonical-schema.json`](canonical-schema.json), the same file the editor renders |
| Tool version in the header/footer and CLI page | `package.json` |
| `sitemap.xml`, `robots.txt`, `CNAME`, canonical/OG/Twitter tags | `scripts/build_site.py` (`SITE_URL` constant) |
| `assets/style.css`, `assets/site.js`, `assets/schema.js`, `favicon.svg` | `site/static/` |
| `assets/screenshots/*.png`, `og.png` | `scripts/capture_screenshots.mjs` (Playwright, real rendered pages) |

Nothing in the key reference is hand-typed. The build reads the canonical
schema and renders every key, including its default, allowed values and
option meanings. If a key is added to the schema, the explorer gains it on
the next build.

## Build

```bash
python -m pip install -r requirements-site.txt
python scripts/build_site.py          # write docs/
python scripts/build_site.py --check  # fail if docs/ is stale
node scripts/capture_screenshots.mjs  # refresh screenshots + og.png
```

The build is deterministic: same inputs produce byte-identical HTML. It
does not use timestamps and makes no network requests. Screenshot capture is
a separate, deliberate step because it needs a browser.

## Canonical schema

`canonical-schema.json` is the machine-readable reference for every known
GSD (`open-gsd/gsd-core`) `config.json` key. It tracks gsd-core **v1.11.0**
and contains **201 keys**, of which **192** carry a scalar default and **9**
are structural map keys (each with a `defaultNote`). **26** keys are enums
with per-option meanings.

Shape:

```jsonc
{
  "version": "1.11.0",              // gsd-core release this snapshot tracks
  "keys": {
    "<dot.path.key>": {
      "type": "string",             // JSON type (or union)
      "category": "General",        // chapter the key groups under
      "description": "…",           // plain-language: what it does, when to change it
      "default": "interactive",     // canonical default (when one exists)
      "allowedValues": [            // for enums
        { "value": "yolo", "meaning": "…" }
      ],
      "minimum": 0, "maximum": 10,  // numeric bounds, when declared
      "editor": { "editor": "agent-map", "editable": true }
    }
  }
}
```

The schema is produced by `packages/schema-data`'s reconciliation pipeline,
which compares a curated documentation layer against an upstream gsd-core
release. It is not edited by the site build.

## Site-only dependencies

`requirements-site.txt` pins Jinja2 and MarkupSafe. They are not part of the
npm package and are not needed to run the tool.

## Related

- The application can pull newer gsd-core release metadata at runtime via
  **Schema maintenance → Check for updates**, then activate a proposal.
- Upstream project: [open-gsd/gsd-core](https://github.com/open-gsd/gsd-core).
