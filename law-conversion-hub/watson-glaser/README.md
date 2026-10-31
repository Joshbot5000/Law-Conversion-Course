# Watson Glaser Trainer

Practice app for the Watson-Glaser critical thinking test. Open `index.html` in a browser (it also publishes with the revision hub, and can be added to a phone's home screen).

- `content.js`: the original hand-checked scenarios, topics and term lists (all fictional).
- `bank-inference.js`: inference passage structures, each with many settings. A structure fixes the answers; a setting only changes the wording.
- `bank-reasoning.js`: extra assumption and argument scenarios.
- `bank-logic.js`: extra deduction wording packs and interpretation passages.
- `bank-test.js`: "Test level" questions, hand-written to match the CMS practice test: long news-style inference passages, one hedged statement with several abstract proposed assumptions, everyday deduction ending "Therefore:" with scope traps, and subtler interpretation and argument items. Deductions that can be written in formal logic carry a `logic` field so the test suite re-checks them.
- `engine.js`: builds question sets. Every scenario has a key; the app passes the keys you have seen so you never repeat one until the whole bank is used. Deduction answers come from a brute-force logic checker; number-based interpretation answers from exact arithmetic.
- `app.js`: practice sessions, 40-question / 30-minute mock, learn pages, progress (saved in the browser).
- `sw.js`: offline support. **Bump `VERSION` in this file whenever any app file changes**, so phones pick up the update.

Check the generator with `node test/verify.js`. It builds every scenario several times, re-decides every deduction answer with a separate method, re-does the interpretation arithmetic from the passage text, checks wording for gaps, and checks that a full round never repeats a scenario.
