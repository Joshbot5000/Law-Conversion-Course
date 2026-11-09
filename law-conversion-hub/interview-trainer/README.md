# Interview Trainer

Practice for law firm video and AI interviews. The interviewer asks a question, you answer out loud on camera, and it follows up on what you actually said: probing vague answers, testing claims and pivoting from your answer to the next theme (for example, a news story, then its effect on a client of the firm, then what it means for the firm's business development). At the end every answer is marked against a rubric calibrated to a competitive City firm, with a rewrite of your answer, a drill, and a plan for next time. Progress is saved on your device.

## Using it

Open it in **Chrome or Edge on your laptop** (from the published revision hub, or locally, see below). Those browsers can turn your speech into text; in other browsers you type your answers. Install it like the Watson Glaser trainer: the install icon at the right of the address bar.

1. **Settings**: paste a Claude API key from [console.anthropic.com](https://console.anthropic.com/settings/keys) (add a little credit under Billing first). The key stays in this browser. Without a key everything still works, but follow-ups come from the question bank and from keywords in your answer, and scores are estimates of what can be measured (structure, numbers, "I" versus "we", pace, fillers).
2. **Settings, About you**: fill in your application details so the interviewer can tailor questions, as Mishcon's AI interview does.
3. **Practise**: choose a firm and a format, then start. You check your camera and microphone first.

Formats: AI adaptive interview (Mishcon style), one-way video (HireVue style), partner interview, commercial awareness grill, quick-fire pressure round, and a replay of the Mishcon AI interview of 9 November 2026. Pressure can be Standard, Tough or Brutal.

## Files

- `data/bank.js`: 268 questions in 44 competencies. Each competency has what assessors credit, red flags, the strong answer shape and the follow-ups interviewers use.
- `data/firms.js`: 25 firm briefings the interviewer plays. Press-reported facts say "reported"; anything still developing is under "check". Your own research notes (Firms page) are added to the briefing.
- `js/interview.js`: runs an interview: plans questions (least-practised first), asks follow-ups (AI, scripted or offline), saves after every answer, and falls back to offline follow-ups if the AI is slow or fails.
- `js/ai.js`: Claude calls through the official SDK (`vendor/anthropic-sdk-1.3.0.js`, bundled from `@anthropic-ai/sdk` 1.3.0): the interviewer's next move (low effort, fast), fact checks of news claims with live web search, marking (high effort) and the debrief. All return JSON matching a schema.
- `js/coach.js`: delivery metrics, offline follow-ups and offline estimated marks.
- `js/media.js`: camera, microphone level, recording (stored in IndexedDB on this device), speech-to-text (restarts itself when Chrome stops listening) and the interviewer's voice.
- `js/app.js`, `js/app-pages.js`: the screens.
- `sw.js`: offline support. **Bump `VERSION` whenever any app file changes.**

## Testing

From `law-conversion-hub`, serve the folder: `python3 -m http.server 8765`. Then, in `interview-trainer`:

- `node test/verify.js`: the bank, firm briefings, offline coach and interview engine, including AI failure, timeouts and the exact Mishcon replay order (15,000+ checks).
- `node test/smoke.js`: every page in light and dark mode at laptop and phone widths, with no console errors or horizontal scrolling.
- `node test/e2e.js`: full interviews in Chromium with a fake camera and microphone, simulated speech recognition and a simulated Claude API.

The browser tests need Playwright.
