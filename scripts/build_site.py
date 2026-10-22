#!/usr/bin/env python3
"""Build the static documentation site in docs/ from real repository data.

The key reference is generated from docs/canonical-schema.json — the same
machine-readable schema the desktop editor renders. Nothing about a config
key (type, default, allowed values, description) is hand-written here; the
only editorial text is page copy and category grouping labels.

Usage:
    python scripts/build_site.py           # generate docs/
    python scripts/build_site.py --check   # verify docs/ is up to date

Deterministic: repeated builds from the same inputs produce identical bytes.
No network access, no timestamps.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup, escape

ROOT = Path(__file__).resolve().parent.parent
SITE_DIR = ROOT / "site"
TEMPLATES = SITE_DIR / "templates"
STATIC = SITE_DIR / "static"
DOCS = ROOT / "docs"
SCHEMA_PATH = DOCS / "canonical-schema.json"
PACKAGE_PATH = ROOT / "package.json"

# The one place the public origin is defined. Used by canonical links,
# Open Graph/Twitter meta, JSON-LD, sitemap.xml and the CNAME file.
SITE_URL = "https://gsd.danubelabs.net"
SITE_NAME = "GSD Config Manager"
REPO_URL = "https://github.com/FiredMosquito831/open-gsd-core-config-manager"
UPSTREAM_URL = "https://github.com/open-gsd/gsd-core"
NPM_URL = "https://www.npmjs.com/package/open-gsd-core-config-manager"

PAGES = [
    ("index.html", "", "GSD Config Manager — every config key, explained and validated"),
    ("schema.html", "schema.html", "Schema explorer — every GSD config key"),
    ("cli.html", "cli.html", "CLI reference — flags, installs and exit codes"),
    ("history.html", "history.html", "Atomic writes and version history"),
    ("faq.html", "faq.html", "FAQ — GSD Config Manager"),
    ("about.html", "about.html", "About and security model"),
]

# Category blurbs are editorial framing for groups that already exist in the
# canonical schema. Key facts always come from the schema itself.
CATEGORY_BLURBS = {
    "Capabilities": "Capability registries, agent skill assignments and update policy.",
    "Claude Orchestration": "How GSD drives the Claude agent runtime.",
    "Code Quality": "Static analysis and the Fallow code-quality integration.",
    "Discovery": "Optional web-search providers used by the research phase.",
    "Effort": "Reasoning-effort defaults, per-agent overrides and fast mode.",
    "External Job": "Timeouts and storage for work handed to an external backend.",
    "Features": "Opt-in capability flags layered over the core workflow.",
    "Gates": "Human confirmation checkpoints and test/build command gates.",
    "General": "Project identity, response behavior, CLAUDE.md assembly and refactor triggers.",
    "Git": "Branching, tags, worktrees and integration with git history.",
    "Graphify": "The optional Graphify codebase-graph integration.",
    "Hooks": "Runtime guard rails around workflow commands and context usage.",
    "Intel": "The codebase intelligence index.",
    "Learnings": "How many persisted learnings may be injected into a prompt.",
    "Manager": "Per-phase flags for the manager workflow.",
    "Mempalace": "Memory capture, recall and cross-project tunnels.",
    "Model & Routing": "Model profiles, per-agent overrides, runtime tiers and budgets.",
    "Planning": "Roadmap, discussion and research depth for the planning phase.",
    "Profile Pipeline": "The profile pipeline feature toggle.",
    "Review": "Reviewer instances, model routing, prompt budgets and source grounding.",
    "Security": "Injection blocking, ASVS levels and enforcement strictness.",
    "Ship": "Pull-request body composition for the ship phase.",
    "Statusline": "What the GSD statusline displays and how it is formatted.",
    "Workflow": "The execution loop: parallelism, reviews, drift, TDD, UI checks and automation.",
}


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def json_default(value: Any) -> str:
    """Render a canonical default for display without losing its type."""
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    return json.dumps(value, ensure_ascii=False, separators=(", ", ": "))


def json_scalar(value: Any) -> str:
    """Render an enum value the way it appears in JSON (null, true, false)."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def display_type(raw: str) -> str:
    return raw.replace(" | ", " · ")


def type_group(raw: str) -> str:
    if "null" in raw:
        return "nullable"
    if raw == "object":
        return "object"
    if raw == "array":
        return "array"
    if raw == "boolean":
        return "boolean"
    if raw == "number":
        return "number"
    if raw == "string":
        return "string"
    return "other"


INLINE_CODE = re.compile(r"`([^`]+)`")


def inline_md(text: str) -> Markup:
    """Escape untrusted schema text, then render `backticked` spans as code."""
    parts: list[str] = []
    cursor = 0
    for match in INLINE_CODE.finditer(text):
        parts.append(str(escape(text[cursor : match.start()])))
        parts.append(f"<code>{escape(match.group(1))}</code>")
        cursor = match.end()
    parts.append(str(escape(text[cursor:])))
    return Markup("".join(parts))


def slugify(key: str) -> str:
    out = []
    for char in key:
        if char.isalnum():
            out.append(char.lower())
        else:
            out.append("-")
    slug = "".join(out)
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-")


def build_records(schema: dict[str, Any]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    seen_slugs: dict[str, int] = {}
    for path, meta in schema["keys"].items():
        editor = meta.get("editor") or {}
        allowed = meta.get("allowedValues") or []
        default = meta.get("default", None)
        has_default = "default" in meta
        slug = slugify(path)
        if slug in seen_slugs:
            seen_slugs[slug] += 1
            slug = f"{slug}-{seen_slugs[slug]}"
        else:
            seen_slugs[slug] = 1

        search_parts = [path, meta.get("category", ""), meta.get("type", ""), meta.get("description", "")]
        if has_default:
            search_parts.append(json_default(default))
        if meta.get("defaultNote"):
            search_parts.append(meta["defaultNote"])
        for option in allowed:
            search_parts.append(str(option.get("value", "")))
            search_parts.append(str(option.get("meaning", "")))

        records.append(
            {
                "path": path,
                "slug": slug,
                "type": meta.get("type", ""),
                "type_display": display_type(meta.get("type", "")),
                "type_group": type_group(meta.get("type", "")),
                "category": meta.get("category", "Uncategorised"),
                "category_slug": slugify(meta.get("category", "Uncategorised")),
                "description": meta.get("description", ""),
                "default": default,
                "default_display": json_default(default) if has_default else None,
                "has_default": has_default,
                "default_note": meta.get("defaultNote"),
                "allowed": allowed,
                "minimum": meta.get("minimum"),
                "maximum": meta.get("maximum"),
                "editor": editor.get("editor"),
                "editable": editor.get("editable", True) if editor else True,
                "sensitive": bool(editor.get("sensitive", False)) if editor else False,
                "search": " ".join(search_parts).lower(),
            }
        )
    records.sort(key=lambda item: (item["category"].lower(), item["path"].lower()))
    return records


def build_categories(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        groups.setdefault(record["category"], []).append(record)
    categories = []
    for name in sorted(groups):
        entries = groups[name]
        categories.append(
            {
                "name": name,
                "slug": slugify(name),
                "count": len(entries),
                "blurb": CATEGORY_BLURBS.get(name, "Keys grouped under this category in the canonical schema."),
                "enums": sum(1 for entry in entries if entry["allowed"]),
                "keys": [entry["path"] for entry in entries],
            }
        )
    return categories


def compute_stats(records: list[dict[str, Any]], categories: list[dict[str, Any]]) -> dict[str, int]:
    return {
        "key_count": len(records),
        "defaults": sum(1 for record in records if record["has_default"]),
        "structural": sum(1 for record in records if not record["has_default"]),
        "enums": sum(1 for record in records if record["allowed"]),
        "categories": len(categories),
        "read_only": sum(1 for record in records if not record["editable"]),
    }


def page_context(page: str, title: str, description: str) -> dict[str, Any]:
    path = "" if page == "index.html" else page
    url = SITE_URL + ("/" if not path else f"/{path}")
    return {
        "page": page,
        "title": title,
        "description": description,
        "canonical": url,
        "site_url": SITE_URL,
        "site_name": SITE_NAME,
        "repo_url": REPO_URL,
        "upstream_url": UPSTREAM_URL,
        "npm_url": NPM_URL,
    }


def render(env: Environment, template: str, context: dict[str, Any]) -> str:
    rendered = env.get_template(template).render(**context)
    return rendered.rstrip() + "\n"


def sitemap_xml(entries: list[tuple[str, str]]) -> str:
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for loc, _ in entries:
        lines.append("  <url>")
        lines.append(f"    <loc>{SITE_URL}{loc}</loc>")
        lines.append("  </url>")
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def write_outputs(outputs: dict[str, str]) -> None:
    DOCS.mkdir(parents=True, exist_ok=True)
    for relative, content in outputs.items():
        target = DOCS / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("w", encoding="utf-8", newline="\n") as handle:
            handle.write(content)


def copy_static() -> None:
    assets = DOCS / "assets"
    if assets.exists():
        shutil.rmtree(assets)
    assets.mkdir(parents=True, exist_ok=True)
    for source in sorted(STATIC.glob("*")):
        if source.is_file() and source.name != "og-template.html":
            shutil.copy2(source, assets / source.name)
    screenshots = STATIC / "screenshots"
    if screenshots.is_dir():
        shutil.copytree(screenshots, assets / "screenshots")
    favicon = STATIC / "favicon.svg"
    if favicon.exists():
        shutil.copy2(favicon, DOCS / "favicon.svg")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if docs/ differs from a fresh build")
    args = parser.parse_args()

    schema = load_json(SCHEMA_PATH)
    package = load_json(PACKAGE_PATH)
    records = build_records(schema)
    categories = build_categories(records)
    stats = compute_stats(records, categories)

    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES)),
        autoescape=select_autoescape(["html", "xml"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.filters["json_default"] = json_default
    env.filters["inline_md"] = inline_md
    env.filters["json_scalar"] = json_scalar

    data = {
        "schema_version": schema.get("version", "unknown"),
        "generated_from": schema.get("generatedFrom", {}),
        "tool_version": package["version"],
        "node_engine": package.get("engines", {}).get("node", ">=20.19"),
        "records": records,
        "categories": categories,
        "stats": stats,
    }

    pages = {
        "index.html": (
            "GSD Config Manager — every config key, explained and validated",
            "Understand and safely edit any GSD (open-gsd/gsd-core) config.json. Every key documented in plain language, validated before write, atomic saves and full snapshot history. Run npx open-gsd-core-config-manager.",
            "index.html",
        ),
        "schema.html": (
            "GSD config schema explorer — 201 keys documented",
            "Search every known GSD config.json key: type, canonical default, allowed values with meanings, and plain-language documentation. Generated from the canonical schema.",
            "schema.html",
        ),
        "cli.html": (
            "CLI reference — open-gsd-core-config-manager",
            "Install and run the GSD Config Manager: npx, global and project installs, --port, --no-open, exit codes, environment variables and data locations.",
            "cli.html",
        ),
        "history.html": (
            "Atomic writes and version history — GSD Config Manager",
            "How GSD Config Manager protects your config: Ajv validation before write, same-directory atomic rename, stale-write rejection and 50-snapshot history with restore.",
            "history.html",
        ),
        "faq.html": (
            "FAQ — GSD Config Manager",
            "Answers about privacy, offline use, unknown keys, snapshot storage, gsd-core version tracking, headless use and uninstalling.",
            "faq.html",
        ),
        "about.html": (
            "About and security model — GSD Config Manager",
            "The local-only security model behind GSD Config Manager: loopback binding, host and origin guards, API-key handling, outbound requests and licensing.",
            "about.html",
        ),
    }

    outputs: dict[str, str] = {}
    for page, (title, description, active) in pages.items():
        context = page_context(page, title, description)
        context.update(data)
        context["active"] = active
        context["page"] = page
        outputs[page] = render(env, page, context)

    not_found = page_context("404.html", "Page not found — GSD Config Manager", "That page does not exist.")
    not_found.update(data)
    not_found["active"] = ""
    outputs["404.html"] = render(env, "404.html", not_found)

    outputs["sitemap.xml"] = sitemap_xml([("/", ""), ("/schema.html", ""), ("/cli.html", ""), ("/history.html", ""), ("/faq.html", ""), ("/about.html", "")])
    outputs["robots.txt"] = f"User-agent: *\nAllow: /\n\nSitemap: {SITE_URL}/sitemap.xml\n"
    outputs["CNAME"] = "gsd.danubelabs.net\n"
    outputs[".nojekyll"] = ""

    if args.check:
        failures = []
        for relative, content in outputs.items():
            target = DOCS / relative
            if not target.exists() or target.read_text(encoding="utf-8") != content:
                failures.append(relative)
        if failures:
            print("docs/ is stale; rebuild with: python scripts/build_site.py", file=sys.stderr)
            for failure in failures:
                print(f"  - {failure}", file=sys.stderr)
            return 1
        print(f"docs/ is up to date ({len(outputs)} generated files).")
        return 0

    write_outputs(outputs)
    copy_static()
    print(
        f"Built {len(outputs)} files in docs/ from {stats['key_count']} schema keys "
        f"(gsd-core v{data['schema_version']}, tool v{data['tool_version']})."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
