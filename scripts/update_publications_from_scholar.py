#!/usr/bin/env python3
"""Collect 2026 Scholar candidates for manual review, then import only approvals.

Collect: python3 scripts/update_publications_from_scholar.py --year 2026
Review: edit status (pending/approved/rejected) in the JSON.
Approved entries use candidate_author_tags; confirmed_author_tags optionally overrides them.
Import: python3 scripts/update_publications_from_scholar.py --year 2026 --apply

Requires Node.js and the site's installed yaml dependency to read YAML reliably.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
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
DEFAULT_PEOPLE = ROOT / "src" / "data" / "people.yml"
DEFAULT_PUBLICATIONS = ROOT / "src" / "data" / "publications.yml"
DEFAULT_PUBLICATION_AUTHORS = ROOT / "src" / "data" / "publication_authors.yml"


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


def fetch_scholar_page(profile: ScholarProfile, max_per_author: int, timeout: int, start: int = 0) -> list[ScholarWork]:
    query = urllib.parse.urlencode(
        {
            "user": profile.user_id,
            "hl": "en",
            "pagesize": min(max_per_author, 100),
            "cstart": start,
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
    if not parser.rows:
        raise RuntimeError("No publication rows returned; profile may be empty, blocked, or markup changed")

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
            text = year_pattern.sub(lambda match: match.group(1) + items, text, count=1)
        else:
            block = f"- year: {year}\n  items:\n{items}\n"
            if text.startswith("#"):
                first_newline = text.find("\n")
                text = text[: first_newline + 1] + block + text[first_newline + 1 :]
            else:
                text = block + text
    return text


def load_yaml(path: Path):
    result = subprocess.run(
        ["node", "--input-type=module", "-e",
         "import fs from 'node:fs'; import {parse} from 'yaml'; console.log(JSON.stringify(parse(fs.readFileSync(process.argv[1], 'utf8'))));",
         str(path.resolve())], cwd=ROOT, text=True, capture_output=True, check=True,
    )
    return json.loads(result.stdout)


def confirmed_profiles(author_file: Path) -> tuple[list[ScholarProfile], set[str]]:
    authors = load_yaml(author_file)
    by_slug = {a["profile_slug"]: a["key"] for a in authors if a.get("profile_slug")}
    profiles = []
    for path in sorted((ROOT / "src/content/people").glob("*.md")):
        match = re.match(r"\A---\s*\n(.*?)\n---", path.read_text(encoding="utf-8"), re.S)
        if not match:
            continue
        # Parse front matter as YAML instead of inferring identities from surnames.
        result = subprocess.run(
            ["node", "--input-type=module", "-e",
             "import {parse} from 'yaml'; let text=''; for await (const c of process.stdin) text+=c; console.log(JSON.stringify(parse(text)));"],
            input=match.group(1), cwd=ROOT, text=True, capture_output=True, check=True,
        )
        person = json.loads(result.stdout)
        for link in person.get("links", []):
            url = link.get("url", "")
            parsed = urllib.parse.urlparse(url)
            if not re.fullmatch(r"scholar\.google\.[a-z.]+", parsed.hostname or ""):
                continue
            user_id = urllib.parse.parse_qs(parsed.query).get("user", [""])[0]
            if user_id:
                profiles.append(ScholarProfile(person["title"], user_id, url, by_slug.get(person.get("person_slug", path.stem))))
    return profiles, {a["key"] for a in authors}


def fetch_scholar_works(profile: ScholarProfile, max_per_author: int, timeout: int, year: int = 2026, delay: float = 3) -> list[ScholarWork]:
    works = []
    for start in range(0, max_per_author, 100):
        page = fetch_scholar_page(profile, min(max_per_author - start, 100), timeout, start)
        works.extend(page)
        # Profiles are requested in publication-date order. Stop after crossing the year boundary.
        if len(page) < min(max_per_author - start, 100) or any(w.year and w.year < year for w in page):
            break
        if start + 100 < max_per_author:
            time.sleep(delay)
    return works


def reviewed_titles(groups) -> set[str]:
    return {normalize_title(title) for group in groups for item in group.get("items", [])
            for title in re.findall(r"\*\*(.+?)\*\*", item.get("citation", ""))}


def candidate_id(work: ScholarWork) -> str:
    return hashlib.sha256(f"{work.year}:{normalize_title(work.title)}".encode()).hexdigest()[:16]


def atomic_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temp.replace(path)


def write_report(path: Path, review) -> None:
    lines = [f"# Publications to review — {review['year']}", "",
             "Existing website publications are unchanged. Scholar candidates may belong to namesakes.",
             "Edit the JSON: set `status` to `approved` or `rejected`. Approved entries use `candidate_author_tags` unless a nonempty `confirmed_author_tags` override is provided.",
             "Approving a paper accepts its candidate tags too. To correct or complete them, use `confirmed_author_tags`. Leave uncertain papers pending.", ""]
    for profile in review.get("profiles", []):
        lines += [f"## {profile['name']}", "", f"Profile: {profile['url']}", "", f"Collection: {profile['status']}", ""]
        if profile.get("limit_reached"):
            lines += ["Collection limit reached: increase --max-per-author; this profile may have more candidates.", ""]
        if profile.get("error"):
            lines += [f"Collection error: {profile['error']}", ""]
        entries = [c for c in review["candidates"] if profile["name"] in c["source_profiles"]]
        if not entries:
            lines += ["No new candidates collected for this profile. This does not prove that no new publications exist.", ""]
        for c in entries:
            lines += [f"### [{c['status']}] {c['title']}", "", f"Review ID: `{c['id']}` · Year: {c['year']}",
                      f"Authors reported by Scholar: {c['authors']}", f"Venue: {c['venue']}",
                      f"Source: {c['url']}", f"Candidate tags: {', '.join(c['candidate_author_tags']) or 'No explicit mapping'}"]
            if c.get("similar_existing_titles"):
                lines += ["Check possible duplicates: " + "; ".join(c["similar_existing_titles"])]
            lines += [""]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def apply_approved(review, path: Path, year: int, known_tags: set[str], dry_run: bool = False) -> int:
    if review.get("year") != year:
        raise ValueError("Review file year does not match --year")
    text = path.read_text(encoding="utf-8")
    existing = reviewed_titles(load_yaml(path))
    additions = []
    imported = []
    for c in review["candidates"]:
        if c["status"] not in {"pending", "approved", "rejected", "imported"}:
            raise ValueError(f"Unknown review status for {c['id']}")
        if c["status"] != "approved":
            continue
        if c["year"] != year:
            raise ValueError(f"Refusing publication outside {year}: {c['id']}")
        tags = c.get("confirmed_author_tags") or c.get("candidate_author_tags", [])
        if not isinstance(tags, list) or not tags or any(not isinstance(tag, str) or tag not in known_tags for tag in tags):
            raise ValueError(f"No valid author tags for {c['id']}: provide candidate_author_tags or confirmed_author_tags")
        work = ScholarWork(c["title"], c["authors"], c["venue"], c["year"], c["url"], set(c["source_profiles"]), set(tags))
        key = normalize_title(work.title)
        if key not in existing:
            additions.append(work)
            existing.add(key)
        imported.append(c)
    if additions and not dry_run:
        updated = insert_items(text, additions)
        # Validate the complete YAML before touching the reviewed catalogue.
        temp = path.with_suffix(path.suffix + ".tmp")
        try:
            temp.write_text(updated, encoding="utf-8")
            load_yaml(temp)
            shutil.copy2(path, path.with_suffix(path.suffix + ".bak"))
            temp.replace(path)
        finally:
            temp.unlink(missing_ok=True)
    if not dry_run:
        for c in imported:
            c["status"] = "imported"
    print(f"{'Would import' if dry_run else 'Imported'} {len(additions)} approved publication(s) from {year}.")
    return len(additions)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--publications", type=Path, default=DEFAULT_PUBLICATIONS)
    parser.add_argument("--publication-authors", type=Path, default=DEFAULT_PUBLICATION_AUTHORS)
    parser.add_argument("--year", type=int, default=2026, help="Exact publication year, not a minimum year.")
    parser.add_argument("--review-file", type=Path, default=ROOT / "reviews/scholar-2026.json")
    parser.add_argument("--max-per-author", type=int, default=1000)
    parser.add_argument("--author", help="Only collect people whose name contains this text.")
    parser.add_argument("--delay", type=float, default=3)
    parser.add_argument("--timeout", type=int, default=20)
    parser.add_argument("--apply", action="store_true", help="Import only approved entries from the review JSON; never fetch.")
    parser.add_argument("--dry-run", action="store_true", help="Show results without writing any file.")
    args = parser.parse_args()
    if args.max_per_author < 1 or args.delay < 0 or args.timeout <= 0:
        parser.error("Use positive --max-per-author and --timeout, and nonnegative --delay")
    profiles, known_tags = confirmed_profiles(args.publication_authors)
    review = json.loads(args.review_file.read_text(encoding="utf-8")) if args.review_file.exists() else {"version": 1, "year": args.year, "profiles": [], "candidates": []}
    if review["year"] != args.year:
        parser.error("Use a separate --review-file for each year")
    report = args.review_file.with_suffix(".md")
    if args.apply:
        apply_approved(review, args.publications, args.year, known_tags, args.dry_run)
        if not args.dry_run:
            atomic_json(args.review_file, review)
            write_report(report, review)
        return 0
    if args.author:
        profiles = [p for p in profiles if strip_accents(args.author).casefold() in strip_accents(p.name).casefold()]
    if not profiles:
        parser.error("No matching Scholar profiles found")
    groups = load_yaml(args.publications)
    existing = reviewed_titles(groups)
    titles = [title for group in groups for item in group.get("items", []) for title in re.findall(r"\*\*(.+?)\*\*", item.get("citation", ""))]
    old = {c["id"]: c for c in review["candidates"]}
    all_works = []
    results = {p["user_id"]: p for p in review.get("profiles", [])}
    for i, profile in enumerate(profiles):
        print(f"[{i+1}/{len(profiles)}] {profile.name}", flush=True)
        result = {"name": profile.name, "user_id": profile.user_id, "url": profile.scholar_url}
        try:
            works = fetch_scholar_works(profile, args.max_per_author, args.timeout, args.year, args.delay)
            all_works.extend(works)
            result.update(status="collected", fetched=len(works), limit_reached=len(works) >= args.max_per_author)
            print(f"  {len(works)} entries fetched", flush=True)
        except Exception as exc:
            result.update(status="failed", error=str(exc))
            print(f"  Failed: {exc}", flush=True)
        results[profile.user_id] = result
        if i < len(profiles)-1:
            time.sleep(args.delay)
    for work in merge_works(all_works):
        if work.year != args.year or normalize_title(work.title) in existing:
            continue
        key = candidate_id(work)
        if key in old:
            old[key]["source_profiles"] = sorted(set(old[key]["source_profiles"]) | work.source_profiles)
            old[key]["candidate_author_tags"] = sorted(set(old[key]["candidate_author_tags"]) | work.author_tags)
            continue
        old[key] = {"id": key, "status": "pending", "year": work.year, "title": work.title,
                    "authors": work.authors, "venue": work.venue, "url": work.url,
                    "source_profiles": sorted(work.source_profiles), "candidate_author_tags": sorted(work.author_tags),
                    "confirmed_author_tags": [], "notes": "",
                    "similar_existing_titles": [t for t in titles if SequenceMatcher(None, normalize_title(t), normalize_title(work.title)).ratio() >= .8]}
    review["profiles"] = list(results.values())
    review["candidates"] = sorted(old.values(), key=lambda c: (c["title"].casefold(), c["id"]))
    print(f"Review contains {len(review['candidates'])} candidate(s) for {args.year}; website unchanged.")
    if not args.dry_run:
        atomic_json(args.review_file, review)
        write_report(report, review)
        print(f"Review: {args.review_file}\nReadable report: {report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
