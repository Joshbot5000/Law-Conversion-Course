# Watson Glaser Trainer

Practice app for the Watson-Glaser critical thinking test. Open `index.html` in a browser (it also publishes with the revision hub).

- `content.js`: hand-checked scenarios, topics and term lists (all fictional).
- `engine.js`: generates question sets. Deduction answers come from a brute-force logic checker; number-based interpretation answers from exact arithmetic.
- `app.js`: practice sessions, 40-question / 30-minute mock, learn pages, progress (saved in the browser).

Check the generator with `node test/verify.js 1500`. It re-decides every deduction answer with a separate method, re-does the interpretation arithmetic from the passage text, and checks every explanation for gaps.
