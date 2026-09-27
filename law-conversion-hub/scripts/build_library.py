"""Builds library.json: the index the revision hub website reads.

Runs automatically on GitHub every time you commit (see setup/).
You never need to run it yourself, but you can: `python3 scripts/build_library.py`.
"""
import csv
import html
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHAPTER = re.compile(r"ch(?:apter)?[\s_\-.]*0*(\d+)", re.I)


def chapter_of(name):
    m = CHAPTER.search(name)
    return int(m.group(1)) if m else None


def pretty(stem):
    stem = re.sub(r"[_\-]+", " ", stem).strip()
    return stem[:1].upper() + stem[1:]


def html_title(path):
    try:
        head = path.read_text(encoding="utf-8", errors="ignore")[:20000]
    except OSError:
        return None
    m = re.search(r"<title[^>]*>(.*?)</title>", head, re.I | re.S)
    return html.unescape(re.sub(r"\s+", " ", m.group(1))).strip() if m else None


def md_title(path):
    try:
        for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            if line.startswith("# "):
                return line[2:].strip()
    except OSError:
        pass
    return None


def rel(path):
    return path.relative_to(ROOT).as_posix()


def module_of(path, base):
    parts = path.relative_to(ROOT / base).parts
    return parts[0] if len(parts) > 1 else "general"


def main():
    posters, decks, notes = [], [], []

    for p in sorted((ROOT / "posters").rglob("*.htm*")):
        posters.append({
            "path": rel(p),
            "module": module_of(p, "posters"),
            "title": html_title(p) or pretty(p.stem),
            "chapter": chapter_of(p.stem),
        })

    for p in sorted((ROOT / "flashcards").rglob("*.csv")):
        try:
            with p.open(encoding="utf-8-sig", newline="") as f:
                count = max(sum(1 for row in csv.reader(f) if any(c.strip() for c in row)) - 1, 0)
        except (OSError, csv.Error):
            count = 0
        decks.append({
            "path": rel(p),
            "name": pretty(p.stem),
            "module": p.stem.split("-")[0].lower(),
            "count": count,
        })

    for base in ("notes", "templates", "career"):
        for p in sorted((ROOT / base).rglob("*.md")):
            notes.append({
                "path": rel(p),
                "section": base,
                "module": module_of(p, base) if base == "notes" else base,
                "title": md_title(p) or pretty(p.stem),
                "readme": p.name.lower() == "readme.md",
            })

    library = {
        "repo": os.environ.get("GITHUB_REPOSITORY", ""),
        "branch": os.environ.get("GITHUB_REF_NAME", "main"),
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "posters": posters,
        "decks": decks,
        "notes": notes,
    }
    (ROOT / "library.json").write_text(json.dumps(library, indent=2), encoding="utf-8")
    print(f"library.json: {len(posters)} posters, {len(decks)} decks, {len(notes)} notes")


if __name__ == "__main__":
    main()
