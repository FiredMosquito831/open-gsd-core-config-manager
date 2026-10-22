# Contributing

Thanks for taking the time to contribute. This project is a local-first tool
that edits real configuration files, so changes are judged first on whether
they preserve data safety and truthful documentation.

## Set up

```bash
git clone https://github.com/FiredMosquito831/open-gsd-core-config-manager.git
cd open-gsd-core-config-manager
npm ci
npm run typecheck
npm test
```

Requirements: Node.js ≥ 20.19. The documentation site additionally needs
Python 3.10+.

## Run the tool from source

```bash
npm run build
npm run cli:start
```

The server prints a loopback URL. Use `--no-open` to skip launching a browser.

## Tests

```bash
npm run test:unit          # config I/O
npm run test:server        # Fastify routes
npm test                   # ordinary + integration suites
npx playwright test        # end-to-end, spawns the real server
```

Add tests for every behavior change. For changes to the save pipeline, include
a test that proves the failure path leaves the file untouched.

## Schema and documentation changes

- `packages/schema-data/bundled-schema.json` and `docs/canonical-schema.json`
  are generated/reconciled artifacts. Do not hand-add keys to the canonical
  schema to make the site list something: fix the schema pipeline or the
  curated documentation source instead.
- After changing the canonical schema, rebuild the site:

  ```bash
  python -m pip install -r requirements-site.txt
  python scripts/build_site.py
  node scripts/capture_screenshots.mjs
  python scripts/build_site.py
  ```

  The last build copies refreshed screenshots into `docs/assets/`.

- `python scripts/build_site.py --check` must pass; CI runs it.
- Screenshots in `site/static/screenshots/` are captured from the real,
  locally served site. Do not hand-edit them.

## Documentation site

The site is generated from `site/templates/` (Jinja2) and real repository data.
All key descriptions, types, defaults and allowed values come from
`docs/canonical-schema.json`. Keep the `SITE_URL` constant in
`scripts/build_site.py` as the single source of the public origin; canonical
links, Open Graph tags, JSON-LD, the sitemap and `CNAME` derive from it.

## Pull requests

- Keep each change focused. Explain the user-visible effect and the safety
  impact.
- Run `npm run typecheck`, `npm test`, and (if the site changed)
  `python scripts/build_site.py --check` before opening a PR.
- Do not commit build output from `dist/`, Playwright artifacts, or local
  editor files.
- Preserve the MIT license and existing attribution.

## Security

Do not report vulnerabilities in a public issue. See [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contribution is licensed under the MIT
License (see [LICENSE](LICENSE)).
