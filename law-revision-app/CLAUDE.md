# Law Revision app — notes for Claude

The owner's live app is at https://claude.ai/artifact/G4fkVJRbQpM1YVNqg5aAs3. Their whole library (cards, sources,
lecture notes, review progress, quiz levels) lives in that artifact's claude.ai database, not in this repo.

## Golden rules
- **Publish updates to the same URL** (Artifact publish with `url` = the link above). Never create a new artifact for
  the app and never delete it. Capabilities (sample, db with an owner-only rule, downloads, tts) carry forward; leave them alone (omit `capabilities` on publish).
- **Never delete, overwrite or "reset" the owner's cards**, and never write to the artifact database unless asked.
  Any change to how entries are stored must keep old entries loading (see `sanitizeEntry` in `src/js_core.js`).
- **This repo is public.** Never commit the owner's library, exports, textbook text or lecture notes. Tests use only
  the made-up data in `tests/sample_seed.js` and `tests/fixtures/`.
- Accuracy matters more than anything: the app must only present law from the owner's own cards and sources
  (the notes-only rules in `src/js_ask.js` and the quiz prompt in `src/js_quiz.js`).
- The owner is not a programmer: explain changes in plain English, and send them the rebuilt offline copy
  (`law_revision_app.html`) after each published update.

## Friends' edition
- A second artifact, https://claude.ai/artifact/MQEG6zDGu7GzNpf1HoJUCd, for the owner's friends. Same code with
  `EDITION = 'friends'`: each friend's library is saved in their own browser (IndexedDB, `src/js_friends.js`),
  seeded on first open from a STARTER copy of the owner's library built into the page. It never declares or uses `db`;
  it declares only `sample`, `downloads` and `tts`, so Claude features run on each friend's own claude.ai account.
- Build: `python3 src/build.py --friends /path/outside/repo/starter.json /path/outside/repo/law-revision-friends.html`.
  starter.json is `{entries, sources:{meta, text}}` read from the owner's artifact database (lib, src, srctext;
  not progress, prefs or notes). **Never commit starter.json or a friends build** (both are gitignored).
- Republishing it (same URL) updates the app for everyone but never resets anyone's library: the starter is only used
  the first time a browser opens it. A new starter only reaches friends who haven't opened it yet.

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
- Study memory (`src/js_memory.js`): `memory/perf` = `{c: {cardId: [quizN, quizRight, flashN, flashScore, lastWrongMs, lastMs]}, s: [recent sessions]}`;
  `mistakes/<id>` = every wrong quiz answer with the full question, `resolved` once got right twice in practice (or ticked off).
  Local/friends: one kv key `lawRevisionApp.v1.memory`. Topic quiz levels stay in `meta/prefs.qstats`. Both go in backups.
- Suggestions (`topicInsights`/`suggestions` in js_memory.js, UI in `src/js_progress.js`) combine quiz accuracy, open mistakes,
  quick-test misses, review lapses and exam dates. Quick test (`src/js_flash.js`) only shows the owner's own cards — never invented law.
- Quizzes (`src/js_quiz.js`): practice mode aims slots at mistakes (`qz.targets`), and `qz.sources` limits the pool to cards linked to or
  named in chosen sources, passing source extracts into the prompt. `qz.timed` = timed exam (102 s a question, clock pauses while
  questions are written, results recorded only on submit).
- Quick test (`src/js_flash.js`) modes: principle / case / statute flashcards (typed answers checked by Claude against the card only),
  distinguish two cases (same topic), fill in the blank (local check with typo tolerance). `fl.limit` caps a run (Today's session uses 5).
- Weekly summary: `perf.w` / `perf.wPrev` = weekly snapshots of topic scores, rolled on the first visit of a week (`maybeWeeklyRoll`).
- Revision posters (`src/js_posters.js`, window + storage in `src/js_revnotes.js`): REPLACED the long "Standard" notes at the owner's
  request (a 62-page set was "worse than the textbook"). Up to 4 landscape A4 infographic pages per set, layouts mixed per page
  (tiles / flow / mindmap / cases), no flashcards. Pipeline: INVENTORY (every point in the sources per ~110k-char chunk, each with
  type + priority must/should/detail + page ref) → PLAN (assign every id to a page; unassigned ids are placed locally) → PAGE
  (one call per page, ~380-480 words, every id must be cited in `ids`) → CHECK (separate strict pass vs points + source) → FIX →
  CHECK again → anything still missing is put back word for word in that page's "Also know" strip (`restored`); points still
  "wrong" are flagged → OUTCOMES. Our own check (`psFind`: id present, and for cases/statutes the name too) runs alongside Claude's.
  Every case is checked against the sources (`rnInSources`). The coverage report (in the app and as its own PDF) lists every point,
  its priority, source page and where it is. PDFs are drawn with pdfmake; each page is shrunk/grown to fit exactly one page
  (`psFit`, binary search over `PS_SCALES`), and shown in the app via pdf.js. Stored as `rdoc` (`kind: 'poster'`) + `rdocpart`.
  Older long-form notes (v1, no kind) still list under "Older long-form notes" and open/download with the old code.
- Explainer videos (`src/js_video.js` player/script/storage, `src/js_vdart.js` drawing): an ELI5 animated "video" on a topic (cards with
  that topic) or a typed concept (best-matching cards, max 40). ONE `sample.json` call (modelTier default) writes the whole script:
  scenes of kind title / hypo / principle / steps / case / roundup / compare / quiz / apply / recap, each with spoken `narration`, a short
  `heading`, `cards` ids and a `visual` spec (fixed icon list; characters carry a `mood`). The prompt asks for a calm, warm tutor
  (signposting, check-ins), every principle in layers (rule, analogy, why, when, sum-up) and every case as a full story; Refresher vs
  Full lesson (adds quiz check-ins). Art is drawn by the page as SVG in six styles (`VD_STYLES`: whiteboard, watercolour, papercraft,
  anime (chibi characters), retro print (halftone + misregistration), chalkboard), switchable while watching for free; style + pace are
  remembered in localStorage `lawRevisionApp.v1.videoPrefs`. Voice = the platform `tts` capability ONLY (natural Claude voice); each
  scene is spoken in short "breaths" (`vdChunks`, ≤260 chars, line ids `s<i>_<j>`; `onLine` on `_0` switches scene), default pace 0.85.
  The voice is FED A SCENE OR TWO AT A TIME (`speak` then `add`, topped up by `vd.ttsFeed` as scenes start): one whole long video in
  a single call exceeds the voice allowance and is refused whole ("voice stopped unexpectedly"). Any other voice failure falls back
  to captions (`vdCaptionsFrom`). Length budgets in the prompt: Refresher 550-750 words total (~4-5 min), Full lesson 1,050-1,350 (≤10 min).
  No tts (Safari, mobile apps, outside-org viewers, offline copy) → a clear note and captions with timed auto-advance. The owner
  explicitly does NOT want the device/browser voice. Coverage check (free, local, `vdCoverage`): every card must appear — a case only
  counts if its name is said or shown; missing ones get scenes built from the card's facts/rule/exam use (`auto`), before the recap;
  "X v Y" names not in the library are flagged (`warn`). Stored as `video/<id>` or browser key `lawRevisionApp.v1.videos`; in backups.
- Phone voice (`src/js_pvoice.js`): where the Claude `tts` voice isn't offered (iPhone, Safari, phone apps), the owner can switch on a
  natural neural voice that runs ON THE DEVICE: Kokoro-82M int8 (Apache-2.0) via onnxruntime-web 1.20.1 (wasm, 1 thread) + phonemizer
  (eSpeak NG) in a blob module worker. The artifact CSP only lets the page fetch from its OWN address (connect-src 'self' blob:), so the
  model is published next to the page under `tts/` as files < 15 MB (`kokoro-int8-0..6.wasm`, `ort-wasm-1.20.1.wasm`, `voice-*.wasm` — the host only serves certain types, so data goes as .wasm;
  `manifest.json` with the phoneme vocab) — built by `scripts/make_phone_voice.py` into `libs/phone-voice` (never committed; ~105 MB;
  published in two Artifact publishes because one publish is capped at 64 MB; later page-only publishes keep them). The engine scripts
  load from jsDelivr (script-src allows it); the wasm binary is handed over as `wasmBinary`. Download kept in Cache Storage; made audio
  in IndexedDB `lr-phone-voice` per video/line/voice/pace; `pvPrepare` makes the whole video's voice in the background (priority from
  the current scene). Voices: Emma / George (British), Heart (American). Test: `tests/pvoice.js` (serves the app on https with the
  real CSP). The device's built-in voice is still never used.
- Today's session (`src/js_session.js`): reviews → topic quiz → mistakes → quick test; closing a step's window ends that step
  (hook `sessionModalClosed` in `closeModal`).
