#!/usr/bin/env python3
"""Static checks for the generated documentation site in docs/.

Complements `build_site.py --check` (byte-for-byte freshness): this script
verifies the committed output is internally consistent and shippable.

    python scripts/check_site.py

Checks:
  - required pages and assets exist;
  - every local href/src resolves to a real file;
  - each page has title, description, canonical, OG/Twitter tags and a
    viewport meta;
  - one SITE_URL origin is used across canonical/CNAME/sitemap/robots;
  - sitemap.xml is well-formed and does not list 404;
  - og.png is a real 1200x630 PNG;
  - no unresolved template placeholders.

Exit code 0 on success, 1 on any failure. No network access.
"""

from __future__ import annotations

import struct
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
SITE_URL = "https://gsd.danubelabs.net"
PAGES = [
    "index.html",
    "schema.html",
    "cli.html",
    "history.html",
    "faq.html",
    "about.html",
    "404.html",
]
REQUIRED = PAGES + ["sitemap.xml", "robots.txt", "CNAME", ".nojekyll", "og.png", "favicon.svg"]


class RefCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.refs: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name in {"href", "src"} and value:
                self.refs.append(value)


def fail(message: str, failures: list[str]) -> None:
    failures.append(message)


def local_target(ref: str) -> str | None:
    parsed = urlparse(ref)
    if parsed.scheme or parsed.netloc or ref.startswith("#"):
        return None
    if not parsed.path or parsed.path == "/":
        return None
    return unquote(parsed.path)


def main() -> int:
    failures: list[str] = []

    for name in REQUIRED:
        if not (DOCS / name).is_file():
            fail(f"missing required file: docs/{name}", failures)
    if failures:
        for item in failures:
            print(f"FAIL  {item}", file=sys.stderr)
        return 1

    for name in PAGES:
        html = (DOCS / name).read_text(encoding="utf-8")
        for marker in ("{{", "__KEYS__", "__VERSION__", "__DEFAULTS__", "__ENUMS__"):
            if marker in html:
                fail(f"{name}: unresolved placeholder {marker}", failures)
        for needle in (
            "<title>",
            '<meta name="description" content="',
            'rel="canonical"',
            'property="og:image"',
            'name="twitter:card"',
            'name="viewport"',
            '<html lang="en">',
        ):
            if needle not in html:
                fail(f"{name}: missing {needle}", failures)
        if "/404.html" in html and name != "404.html":
            fail(f"{name}: links to 404.html", failures)

        collector = RefCollector()
        collector.feed(html)
        for ref in collector.refs:
            target = local_target(ref)
            if target is None:
                continue
            path = DOCS / target.lstrip("/")
            if not path.is_file():
                fail(f"{name}: broken local reference {ref}", failures)

    cname = (DOCS / "CNAME").read_text(encoding="utf-8").strip()
    if cname != SITE_URL.replace("https://", ""):
        fail(f"CNAME is {cname!r}, expected {SITE_URL}", failures)

    robots = (DOCS / "robots.txt").read_text(encoding="utf-8")
    if f"Sitemap: {SITE_URL}/sitemap.xml" not in robots:
        fail("robots.txt does not point at the sitemap", failures)

    try:
        tree = ET.parse(DOCS / "sitemap.xml")
    except ET.ParseError as error:
        fail(f"sitemap.xml is not well-formed: {error}", failures)
    else:
        namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        locs = [element.text for element in tree.getroot().findall("s:url/s:loc", namespace)]
        expected = [
            f"{SITE_URL}/" if page == "index.html" else f"{SITE_URL}/{page}"
            for page in PAGES
            if page != "404.html"
        ]
        if sorted(locs) != sorted(expected):
            fail(f"sitemap entries differ from expected pages: {locs}", failures)

    canonical_hosts = set()
    for name in PAGES:
        html = (DOCS / name).read_text(encoding="utf-8")
        marker = 'rel="canonical" href="'
        start = html.find(marker)
        if start != -1:
            start += len(marker)
            end = html.find('"', start)
            canonical_hosts.add(urlparse(html[start:end]).netloc)
    if canonical_hosts != {SITE_URL.replace("https://", "")}:
        fail(f"canonical origins are inconsistent: {sorted(canonical_hosts)}", failures)

    png = (DOCS / "og.png").read_bytes()
    if png[:8] != b"\x89PNG\r\n\x1a\n":
        fail("og.png is not a PNG", failures)
    else:
        width, height = struct.unpack(">II", png[16:24])
        if (width, height) != (1200, 630):
            fail(f"og.png is {width}x{height}, expected 1200x630", failures)
        if len(png) < 10_000:
            fail("og.png looks like a placeholder (too small)", failures)

    if failures:
        for item in failures:
            print(f"FAIL  {item}", file=sys.stderr)
        print(f"{len(failures)} site check(s) failed.", file=sys.stderr)
        return 1

    print(f"Site checks passed: {len(PAGES)} pages, {len(REQUIRED)} required files, origin {SITE_URL}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
