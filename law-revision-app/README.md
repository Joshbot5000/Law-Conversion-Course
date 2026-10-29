# Law Revision app

A single-page revision app for the law conversion course: flashcards with spaced repetition, sources you can search
and quote, lecture notes with automatic topic detection, Word-style formatting on cards, adaptive multi-topic quizzes,
mock exams, and study tools (check cards against sources, find duplicates, exam pacing).

- **Live app:** https://claude.ai/artifact/G4fkVJRbQpM1YVNqg5aAs3 (published on claude.ai)
- **Your data** (cards, sources, notes, progress) is stored in your claude.ai account, **not** in this repository.
  Nothing personal is kept here: the tests use a made-up sample library.

## Folders
| Path | What it is |
|---|---|
| `src/head.html`, `src/body.html` | Styles and page layout |
| `src/data.js`, `src/js_*.js` | The app's code, in parts (see `src/build.py` for the order) |
| `src/build.py` | Joins the parts into one page |
| `tests/` | Browser tests (Playwright) with a stand-in for claude.ai (`mockclaude.js`) |
| `tests/sample_seed.js` | A made-up 77-card sample library used by the tests |
| `tests/fixtures/` | Made-up import files, PDF and Word document, plus `make_fixtures.py` that generates them |
| `scripts/fetch_libs.sh` | Optional: saves pdf.js and mammoth locally so tests run offline |

## Build
```bash
python3 src/build.py      # writes law_revision_app.html (offline copy) and law-revision-online.html (for claude.ai)
```

## Test
Needs Node.js and Playwright with Chromium (`npm i playwright && npx playwright install chromium`).
```bash
python3 tests/wrap.py     # after every build: wraps the online page the way claude.ai shows it
node tests/rich.js        # or any other test: quiztest, notes, notesoff, tools, bulk, layers, offline, cloud, docx
```
Each test prints `ok:` / `FAIL:` lines. To change the sample data, edit and run `python3 tests/fixtures/make_fixtures.py`.

## Publishing
The page `law-revision-online.html` is published to the claude.ai link above with Claude's Artifact tool,
always to the **same URL** so the link and the stored library are kept.
