# Law Revision app — notes for Claude

The owner's live app is at https://claude.ai/artifact/G4fkVJRbQpM1YVNqg5aAs3. Their whole library (cards, sources,
lecture notes, review progress, quiz levels) lives in that artifact's claude.ai database, not in this repo.

## Golden rules
- **Publish updates to the same URL** (Artifact publish with `url` = the link above). Never create a new artifact for
  the app and never delete it. Capabilities (sample, db with an owner-only rule, downloads) carry forward; leave them alone.
- **Never delete, overwrite or "reset" the owner's cards**, and never write to the artifact database unless asked.
  Any change to how entries are stored must keep old entries loading (see `sanitizeEntry` in `src/js_core.js`).
- **This repo is public.** Never commit the owner's library, exports, textbook text or lecture notes. Tests use only
  the made-up data in `tests/sample_seed.js` and `tests/fixtures/`.
- Accuracy matters more than anything: the app must only present law from the owner's own cards and sources
  (the notes-only rules in `src/js_ask.js` and the quiz prompt in `src/js_quiz.js`).
- The owner is not a programmer: explain changes in plain English, and send them the rebuilt offline copy
  (`law_revision_app.html`) after each published update.

## Workflow
1. Edit the parts in `src/` (match the existing style: plain ES5-style functions, `$()` helper, no frameworks).
2. `python3 src/build.py` then `python3 tests/wrap.py`.
3. Run the tests (`node tests/<name>.js`); all should print only `ok:` lines. Add or extend a test for new features.
4. Publish `law-revision-online.html` to the URL above.

## How it fits together
- Storage (`src/js_store.js`): cards are sharded into `lib/s00..s31 {e:{id: card}}` by an FNV-1a hash of the id;
  progress in `prog/p0..p7`; `meta/stats`, `meta/prefs`; sources in `src` + `srctext`; lecture notes in `notes/<id>`.
  Writes are merge-updates, so a removed nested key must be written explicitly (see `sanitizeFmt`).
- Offline copy uses localStorage instead (`lawRevisionApp.v1`).
- Claude calls go through `claudeCaps.sample` / `claudeCaps.sample.json` (no API keys; uses the owner's claude.ai usage).
- Card formatting (`src/js_richtext.js`): plain text stays in `facts/ratio/strategy`; sanitised HTML in `fmt`.
