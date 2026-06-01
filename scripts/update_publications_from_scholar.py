#!/usr/bin/env python3
"""Import missing publications from Google Scholar profiles.

This script reads Scholar profile links from _data/people.yml, compares the
fetched works with _data/publications.yml by normalized title, and appends new
entries grouped by year.

Examples:
  python3 scripts/update_publications_from_scholar.py --dry-run --max-per-author 20
  python3 scripts/update_publications_from_scholar.py --apply --max-per-author 50
"""

from __future__ import annotations

import argparse
import html
import re
import shutil
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PEOPLE = ROOT / "_data" / "people.yml"
DEFAULT_PUBLICATIONS = ROOT / "_data" / "publications.yml"
DEFAULT_PUBLICATION_AUTHORS = ROOT / "_data" / "publication_authors.yml"


@dataclass
class ScholarProfile:
    name: str
    user_id: str
    scholar_url: str
    tag: str | None = None


@dataclass
class ScholarWork:
    title: str
    authors: str = ""
    venue: str = ""
    year: int | None = None
    url: str = ""
    source_profiles: set[str] = field(default_factory=set)
    author_tags: set[str] = field(default_factory=set)


class ScholarProfileParser(HTMLParser):
    """Small parser for Google Scholar citation profile result rows."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[dict[str, str]] = []
        self._in_row = False
        self._row: dict[str, str] = {}
        self._classes: list[set[str]] = []
        self._capture: str | None = None
        self._text: list[str] = []
        self._gray_index = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = dict(attrs)
        classes = set((attr.get("class") or "").split())
        self._classes.append(classes)

        if tag == "tr" and "gsc_a_tr" in classes:
            self._in_row = True
            self._row = {"title": "", "authors": "", "venue": "", "year": "", "url": ""}
            self._gray_index = 0

        if not self._in_row:
            return

        if tag == "a" and "gsc_a_at" in classes:
            href = attr.get("href") or ""
            self._row["url"] = urllib.parse.urljoin("https://scholar.google.com", href)
            self._start_capture("title")
        elif tag == "div" and "gs_gray" in classes:
            field_name = "authors" if self._gray_index == 0 else "venue"
            self._gray_index += 1
            self._start_capture(field_name)
        elif tag == "span" and any("gsc_a_h" in c for c in classes):
            self._start_capture("year")

    def handle_endtag(self, tag: str) -> None:
        if self._capture and (
            (self._capture == "title" and tag == "a")
            or (self._capture in {"authors", "venue"} and tag == "div")
            or (self._capture == "year" and tag == "span")
        ):
            value = " ".join("".join(self._text).split())
            self._row[self._capture] = value
            self._capture = None
            self._text = []

        if tag == "tr" and self._in_row:
            if self._row.get("title"):
                self.rows.append(self._row)
            self._in_row = False
            self._row = {}

        if self._classes:
            self._classes.pop()

    def handle_data(self, data: str) -> None:
        if self._capture:
            self._text.append(data)

    def _start_capture(self, field_name: str) -> None:
        self._capture = field_name
        self._text = []


def strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def normalize_title(value: str) -> str:
    value = html.unescape(value)
    value = re.sub(r"<[^>]+>", " ", value)
    value = strip_accents(value).casefold()
    value = value.replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return " ".join(value.split())


def slugify(value: str) -> str:
    value = normalize_title(value)
    value = re.sub(r"\b(a|an|and|for|in|of|on|the|to|using|with)\b", " ", value)
    parts = value.split()[:8]
    return "-".join(parts) or "scholar-publication"


def yaml_double_quote(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def extract_people_profiles(path: Path, author_tags: dict[str, str], known_tags: set[str]) -> list[ScholarProfile]:
    profiles: list[ScholarProfile] = []
    current_name: str | None = None

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        name_match = re.match(r"\s*-\s+name:\s+[\"']?(.+?)[\"']?\s*$", raw_line)
        if name_match:
            current_name = name_match.group(1)
            continue

        url_match = re.match(r"\s*url:\s+[\"']?(https?://scholar\.google\.[^\"']+)[\"']?\s*$", raw_line)
        if current_name and url_match:
            scholar_url = url_match.group(1)
            parsed = urllib.parse.urlparse(scholar_url)
            user_id = urllib.parse.parse_qs(parsed.query).get("user", [""])[0]
            if user_id:
                profiles.append(
                    ScholarProfile(
                        name=current_name,
                        user_id=user_id,
                        scholar_url=scholar_url,
                        tag=match_person_to_tag(current_name, author_tags, known_tags),
                    )
                )

    return profiles


def extract_author_tags(path: Path) -> dict[str, str]:
    tags: dict[str, str] = {}
    current_key: str | None = None
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        key_match = re.match(r"\s*-\s+key:\s+(.+?)\s*$", raw_line)
        if key_match:
            current_key = key_match.group(1).strip()
            continue

        label_match = re.match(r"\s*label:\s+[\"']?(.+?)[\"']?\s*$", raw_line)
        if current_key and label_match:
            tags[current_key] = label_match.group(1).strip()
            current_key = None
    return tags


def surname_tokens(name: str) -> set[str]:
    particles = {"de", "del", "la", "las", "los", "y"}
    words = [w for w in re.findall(r"[A-Za-zÀ-ÿ]+", strip_accents(name).casefold()) if w not in particles]
    return {w for w in words if len(w) > 2}


def person_generated_tags(person_name: str) -> list[str]:
    words = [w for w in re.findall(r"[A-Za-zÀ-ÿ]+", strip_accents(person_name).casefold())]
    particles = {"de", "del", "la", "las", "los", "y"}
    useful = [w for w in words if w not in particles]
    candidates: list[str] = []
    if len(useful) >= 2:
        candidates.append(f"{useful[0]}-{useful[-1]}")
        candidates.append(f"{useful[0]}-{useful[1]}")
        candidates.append(useful[-1])
    return candidates


def match_person_to_tag(person_name: str, author_tags: dict[str, str], known_tags: set[str]) -> str | None:
    for candidate in person_generated_tags(person_name):
        if candidate in known_tags:
            return candidate

    person_tokens = surname_tokens(person_name)
    best_key: str | None = None
    best_score = 0
    for key, label in author_tags.items():
        label_tokens = surname_tokens(label)
        score = len(person_tokens & label_tokens)
        if score > best_score:
            best_score = score
            best_key = key
    return best_key if best_score else None


def existing_author_tags(publications_text: str) -> set[str]:
    tags: set[str] = set()
    for match in re.findall(r"authors_tags:\s*\[([^\]]+)\]", publications_text):
        tags.update(tag.strip() for tag in match.split(",") if tag.strip())
    return tags


def existing_titles(publications_text: str) -> list[str]:
    titles = []
    for title in re.findall(r"\*\*(.+?)\*\*", publications_text, flags=re.DOTALL):
        titles.append(normalize_title(title))
    for citation in re.findall(r"citation:\s+[\"'](.+?)[\"']\s*$", publications_text, flags=re.MULTILINE):
        titles.append(normalize_title(citation))
    return titles


def title_exists(title: str, existing: list[str], similarity_threshold: float) -> bool:
    normalized = normalize_title(title)
    if normalized in existing:
        return True
    return any(SequenceMatcher(None, normalized, known).ratio() >= similarity_threshold for known in existing)


def fetch_scholar_works(profile: ScholarProfile, max_per_author: int, timeout: int) -> list[ScholarWork]:
    query = urllib.parse.urlencode(
        {
            "user": profile.user_id,
            "hl": "en",
            "pagesize": min(max_per_author, 100),
            "sortby": "pubdate",
        }
    )
    url = f"https://scholar.google.com/citations?{query}"
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"
            )
        },
    )

    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read().decode("utf-8", errors="replace")

    if "unusual traffic" in body.casefold() or "captcha" in body.casefold():
        raise RuntimeError("Google Scholar returned a bot/captcha page")

    parser = ScholarProfileParser()
    parser.feed(body)

    works: list[ScholarWork] = []
    for row in parser.rows[:max_per_author]:
        year = int(row["year"]) if row.get("year", "").isdigit() else None
        works.append(
            ScholarWork(
                title=html.unescape(row.get("title", "")),
                authors=html.unescape(row.get("authors", "")),
                venue=html.unescape(row.get("venue", "")),
                year=year,
                url=row.get("url", ""),
                source_profiles={profile.name},
                author_tags={profile.tag} if profile.tag else set(),
            )
        )
    return works


def merge_works(works: list[ScholarWork]) -> list[ScholarWork]:
    merged: dict[str, ScholarWork] = {}
    for work in works:
        key = normalize_title(work.title)
        if not key:
            continue
        if key not in merged:
            merged[key] = work
        else:
            merged[key].source_profiles.update(work.source_profiles)
            merged[key].author_tags.update(work.author_tags)
            if not merged[key].authors and work.authors:
                merged[key].authors = work.authors
            if not merged[key].venue and work.venue:
                merged[key].venue = work.venue
            if not merged[key].year and work.year:
                merged[key].year = work.year
            if not merged[key].url and work.url:
                merged[key].url = work.url
    return sorted(merged.values(), key=lambda w: (w.year or 0, w.title), reverse=True)


def build_citation(work: ScholarWork) -> str:
    authors = work.authors.rstrip(".") or "Unknown authors"
    year = work.year or "n.d."
    venue = work.venue.rstrip(".") or "Google Scholar"
    title = work.title.rstrip(".")
    return f"{authors} ({year}). **{title}.** *{venue}.*"


def build_yaml_item(work: ScholarWork, used_ids: set[str]) -> str:
    base_id = slugify(work.title)
    item_id = base_id
    counter = 2
    while item_id in used_ids:
        item_id = f"{base_id}-{counter}"
        counter += 1
    used_ids.add(item_id)

    lines = [f"    - id: {item_id}"]
    if work.author_tags:
        tags = ", ".join(sorted(work.author_tags))
        lines.append(f"      authors_tags: [{tags}]")
    lines.append(f"      citation: {yaml_double_quote(build_citation(work))}")
    if work.url:
        lines.extend(
            [
                "      links:",
                "        - label: Scholar",
                f"          url: {work.url}",
            ]
        )
    return "\n".join(lines) + "\n"


def known_ids(publications_text: str) -> set[str]:
    return set(re.findall(r"^\s+-\s+id:\s+([A-Za-z0-9_.-]+)\s*$", publications_text, flags=re.MULTILINE))


def insert_items(publications_text: str, works: list[ScholarWork]) -> str:
    by_year: dict[int, list[ScholarWork]] = {}
    for work in works:
        if work.year:
            by_year.setdefault(work.year, []).append(work)

    used_ids = known_ids(publications_text)
    text = publications_text
    for year in sorted(by_year, reverse=True):
        items = "".join(build_yaml_item(work, used_ids) + "\n" for work in by_year[year])
        year_pattern = re.compile(rf"(^- year:\s+{year}\s*\n\s+items:\s*\n)", re.MULTILINE)
        if year_pattern.search(text):
            text = year_pattern.sub(r"\1" + items, text, count=1)
        else:
            block = f"- year: {year}\n  items:\n{items}\n"
            if text.startswith("#"):
                first_newline = text.find("\n")
                text = text[: first_newline + 1] + block + text[first_newline + 1 :]
            else:
                text = block + text
    return text


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--people", type=Path, default=DEFAULT_PEOPLE)
    parser.add_argument("--publications", type=Path, default=DEFAULT_PUBLICATIONS)
    parser.add_argument("--publication-authors", type=Path, default=DEFAULT_PUBLICATION_AUTHORS)
    parser.add_argument("--max-per-author", type=int, default=30)
    parser.add_argument("--author", help="Only fetch people whose name contains this text.")
    parser.add_argument("--since-year", type=int, default=None)
    parser.add_argument(
        "--similarity-threshold",
        type=float,
        default=0.68,
        help="Normalized-title similarity above this value is treated as already present.",
    )
    parser.add_argument("--delay", type=float, default=3.0, help="Seconds between Scholar profile requests.")
    parser.add_argument("--timeout", type=int, default=20)
    parser.add_argument("--apply", action="store_true", help="Write changes to publications.yml.")
    parser.add_argument("--dry-run", action="store_true", help="Print proposed additions without writing.")
    args = parser.parse_args()

    if args.max_per_author < 1:
        parser.error("--max-per-author must be greater than zero")

    publications_text = args.publications.read_text(encoding="utf-8")
    author_tags = extract_author_tags(args.publication_authors)
    known_tags = set(author_tags) | existing_author_tags(publications_text)
    profiles = extract_people_profiles(args.people, author_tags, known_tags)
    if args.author:
        needle = strip_accents(args.author).casefold()
        profiles = [p for p in profiles if needle in strip_accents(p.name).casefold()]
    if not profiles:
        print("No Google Scholar profiles found in people.yml.", file=sys.stderr)
        return 1

    all_works: list[ScholarWork] = []
    for index, profile in enumerate(profiles, start=1):
        tag_note = f", tag={profile.tag}" if profile.tag else ""
        print(f"[{index}/{len(profiles)}] Fetching {profile.name} ({profile.user_id}{tag_note})")
        try:
            all_works.extend(fetch_scholar_works(profile, args.max_per_author, args.timeout))
        except Exception as exc:  # noqa: BLE001 - keep import running for the other profiles.
            print(f"  warning: skipped {profile.name}: {exc}", file=sys.stderr)
        if index < len(profiles):
            time.sleep(args.delay)

    seen_titles = existing_titles(publications_text)
    missing = [
        work
        for work in merge_works(all_works)
        if not title_exists(work.title, seen_titles, args.similarity_threshold)
        and work.year
        and (args.since_year is None or work.year >= args.since_year)
    ]

    print(f"\nFound {len(missing)} missing publication(s).")
    for work in missing:
        tags = ", ".join(sorted(work.author_tags)) or "no matched website tag"
        print(f"- {work.year}: {work.title} [{tags}]")

    if not missing:
        return 0

    if not args.apply or args.dry_run:
        print("\nDry run only. Re-run with --apply to update _data/publications.yml.")
        return 0

    backup = args.publications.with_suffix(args.publications.suffix + ".bak")
    shutil.copy2(args.publications, backup)
    args.publications.write_text(insert_items(publications_text, missing), encoding="utf-8")
    print(f"\nUpdated {args.publications}")
    print(f"Backup written to {backup}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
