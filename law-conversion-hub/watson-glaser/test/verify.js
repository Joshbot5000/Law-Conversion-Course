/*
 * Independent checks on generated questions. Run: node test/verify.js [sets-per-section]
 *
 * - Deduction (all/no/some): re-decided by enumerating small worlds of
 *   individuals, a different method from the engine's region check.
 * - Deduction (if/then): re-decided with a separate truth-table evaluator.
 * - Interpretation (numbers): figures are parsed back out of the passage text
 *   and the statement re-judged from scratch.
 * - Everything: no unfilled {slots}, "undefined" or "NaN"; no duplicate
 *   statements in a set; every item has an explanation and a known pattern.
 */
'use strict';
require('../content.js');
require('../bank-inference.js');
require('../bank-reasoning.js');
require('../bank-logic.js');
require('../bank-test.js');
require('../engine.js');
const WG = globalThis.WG;
const N = Number(process.argv[2] || 6); // sets generated per scenario
let failures = 0;
const failMsgs = new Map();
const fail = (msg, it) => { failures++; const k = msg.replace(/: .*/, ''); if (!failMsgs.has(k)) failMsgs.set(k, msg); if (failures <= 0) console.error('FAIL:', msg, '\n  ', it ? JSON.stringify({ p: it.passage, s: it.statement, a: it.answer }) : ''); };

/* ---------- categorical: brute force over worlds of individuals ---------- */
function catByWorlds(premises, concl, k) {
  const types = 1 << k; // an individual's memberships, including "none"
  const maxInd = k + 2;
  const holds = (st, world) => {
    const xs = world.filter(t => t & (1 << st.x));
    if (st.f === 'A') return xs.every(t => t & (1 << st.y));
    if (st.f === 'E') return xs.every(t => !(t & (1 << st.y)));
    if (st.f === 'I') return xs.some(t => t & (1 << st.y));
    return xs.some(t => !(t & (1 << st.y)));
  };
  let valid = true;
  const world = [];
  (function rec(start, depth) {
    if (!valid) return;
    // Only judge worlds where every term has at least one member.
    let full = true;
    for (let t = 0; t < k; t++) if (!world.some(w => w & (1 << t))) full = false;
    if (full && premises.every(p => holds(p, world)) && !holds(concl, world)) valid = false;
    if (depth === maxInd) return;
    for (let t = start; t < types; t++) { world.push(t); rec(t, depth + 1); world.pop(); }
  })(1, 0);
  return valid;
}

/* ---------- if/then: separate truth-table evaluator ---------- */
function ev(f, row) {
  switch (f.t) {
    case 'lit': return row[f.a] === f.v;
    case 'imp': return !ev(f.l, row) || ev(f.r, row);
    case 'or': return ev(f.l, row) || ev(f.r, row);
  }
  throw new Error('bad formula');
}
function propByTable(prem, concl, n) {
  for (let s = 0; s < (1 << n); s++) {
    const row = []; for (let i = 0; i < n; i++) row.push(!!(s & (1 << i)));
    if (prem.every(p => ev(p, row)) && !ev(concl, row)) return false;
  }
  return true;
}

/* ---------- interpretation: re-derive from the passage text ---------- */
const num = s => Number(s.replace(/,/g, ''));
function checkTrend(it) {
  const m = it.passage.match(/In (\d{4}),[^.]*?(\d+) [a-z]+[^.]*?, (\d+) of wh[a-z]+ [^.]*\. In (\d{4}),[^.]*?(\d+) [a-z]+[^.]*?, (\d+) of wh/);
  if (!m) return null;
  const [, y1, N1, S1, y2, N2, S2] = m.map((x, i) => (i ? num(x) : x));
  const s = it.statement;
  let r;
  if ((r = s.match(/^The proportion of .* was (higher|lower) in (\d{4}) than in (\d{4})\./))) {
    const higher = S2 / N2 > S1 / N1;
    return (r[1] === 'higher') === higher ? 'follows' : 'not';
  }
  if ((r = s.match(/^There were (more|fewer) (.*) in (\d{4}) than in (\d{4})\./))) {
    const otherGroup = it.meta && it.meta.group === 'other';
    const a = otherGroup ? N1 - S1 : S1, b = otherGroup ? N2 - S2 : S2;
    return (r[1] === 'more') === (b > a) ? 'follows' : 'not';
  }
  if ((r = s.match(/^In (\d{4}), (\d+)% /))) {
    const yr = Number(r[1]), shown = Number(r[2]);
    const real = yr === y1 ? S1 * 100 / N1 : S2 * 100 / N2;
    return shown === real ? 'follows' : 'not';
  }
  return 'skip';
}
function checkChange(it) {
  const m = it.passage.match(/(rose|fell) from £?([\d.,]+)(?: million)? in \d{4} to £?([\d.,]+)(?: million)? in/);
  if (!m) return null;
  const a = num(m[2]), b = num(m[3]);
  const pct = Math.round(Math.abs(b - a) / a * 100 * 1000) / 1000;
  const s = it.statement;
  let r;
  if ((r = s.match(/by more than (\d+)%/))) return pct > Number(r[1]) ? 'follows' : 'not';
  if ((r = s.match(/by (\d+)% between/))) return pct === Number(r[1]) ? 'follows' : 'not';
  if (/exactly doubled/.test(s)) return b === 2 * a ? 'follows' : 'not';
  if (/more than doubled/.test(s)) return b > 2 * a ? 'follows' : 'not';
  return 'skip';
}
function checkSurvey(it) {
  const m = it.passage.match(/In a survey of (\d+) [^,]+, (\d+) said/);
  if (!m) return null;
  const n = Number(m[1]), k = Number(m[2]);
  const s = it.statement;
  const fr = { 'a quarter': 1 / 4, 'a third': 1 / 3, half: 1 / 2, 'two-thirds': 2 / 3, 'three-quarters': 3 / 4 };
  let r;
  if (/^Most of the .* surveyed/.test(s)) return k * 2 > n ? 'follows' : 'not';
  if ((r = s.match(/^More than (a quarter|a third|half|two-thirds|three-quarters) of/))) return k > n * fr[r[1]] + 1e-9 ? 'follows' : 'not';
  if ((r = s.match(/^(\d+)% of the/))) return Number(r[1]) === k * 100 / n ? 'follows' : 'not';
  if (/^At least one of .* did not say/.test(s)) return k < n ? 'follows' : 'not';
  if (/^Most /.test(s)) return 'not'; // whole-population claim
  return 'skip';
}

/* ---------- run ---------- */
const BAD_TEXT = /\{\w+\}|undefined|NaN|null/;
const counts = {};
const patternsSeen = {};
let interpChecked = 0, dedChecked = 0;
const BAD_STYLE = /  |\s[,;:]|\s\.(?!\.\.)|(?<!\.)\.\.(?!\.)|\ba a\b|\bthe the\b|\b(a|an) (a|an|the)\b/;
const poolSizes = {};
let setsChecked = 0;
for (const section of WG.SECTIONS) {
  counts[section] = {};
  const keys = WG.poolKeys(section);
  poolSizes[section] = keys.length;
  if (new Set(keys).size !== keys.length) fail('duplicate scenario keys in ' + section);
  const reps = section === 'deduction' ? N * 4 : N;
  for (const key of keys) for (let i = 0; i < reps; i++) {
    WG.setSeed(i * 7919 + key.length * 31 + section.length);
    const opts = { key, hard: i % 3 === 0 };
    const set = WG.generateSet(section, opts);
    setsChecked++;
    if (set.key !== key) fail('wrong scenario returned for ' + key);
    const seen = new Set();
    if (set.items.length < 2) fail('set too small', set.items[0]);
    for (const it of set.items) {
      counts[section][it.answer] = (counts[section][it.answer] || 0) + 1;
      patternsSeen[it.pattern] = (patternsSeen[it.pattern] || 0) + 1;
      if (seen.has(it.statement)) fail('duplicate statement in set', it);
      seen.add(it.statement);
      if (!WG.OPTIONS[section].some(o => o.k === it.answer)) fail('answer not an option', it);
      if (!WG.PATTERNS[it.pattern]) fail('unknown pattern ' + it.pattern, it);
      const texts = [typeof it.passage === 'string' ? it.passage : it.passage.intro + ' ' + it.passage.lines.join(' '), it.statement, it.expl.plain, it.expl.rule]
        .concat(it.expl.steps || [], it.expl.checks || []);
      for (const t of texts) if (typeof t !== 'string' || !t.trim() || BAD_TEXT.test(t) || BAD_STYLE.test(t)) fail('bad text [' + set.key + ']: ' + t, it);
      if (it.logic && it.logic.kind === 'cat') {
        const ok = catByWorlds(it.logic.premises, it.logic.concl, it.logic.k);
        if ((ok ? 'follows' : 'not') !== it.answer) fail('categorical answer disagrees with world check', it);
        dedChecked++;
      }
      if (it.logic && it.logic.kind === 'prop') {
        const ok = propByTable(it.logic.prem, it.logic.concl, it.logic.n);
        if ((ok ? 'follows' : 'not') !== it.answer) fail('if/then answer disagrees with truth table', it);
        // A "does not follow" must come with a counter-example; "follows" with steps.
        if (it.level !== 'test' && (!it.expl.steps || !it.expl.steps.length)) fail('no explanation steps', it);
        dedChecked++;
      }
      if (section === 'interpretation') {
        const r = checkTrend(it) || checkChange(it) || checkSurvey(it);
        if (r && r !== 'skip') { interpChecked++; if (r !== it.answer) fail('interpretation arithmetic disagrees (' + r + ')', it); }
      }
      if (section === 'inference' && typeof it.expl.contrast !== 'function') fail('missing contrast', it);
    }
    if (section !== 'inference') {
      const ans = new Set(set.items.map(x => x.answer));
      if (ans.size < 2) fail('set has only one kind of answer', set.items[0]);
    }
  }
}
// A full round with the "avoid" list must visit every scenario exactly once.
for (const section of WG.SECTIONS) {
  const keys = WG.poolKeys(section), seen = [];
  WG.setSeed(4242);
  for (let i = 0; i < keys.length; i++) seen.push(WG.generateSet(section, { avoid: new Set(seen) }).key);
  if (new Set(seen).size !== keys.length) fail('a full round in ' + section + ' repeated a scenario before using them all');
}
console.log('Scenarios per section:', JSON.stringify(poolSizes), 'total', Object.values(poolSizes).reduce((a, b) => a + b, 0));
console.log('Sets generated and checked:', setsChecked);
console.log('Answer spread per section:', JSON.stringify(counts));
console.log('Deduction items independently re-checked:', dedChecked);
console.log('Interpretation items arithmetically re-checked:', interpChecked);
const unused = Object.keys(WG.PATTERNS).filter(p => !patternsSeen[p]);
console.log('Patterns never produced:', unused.join(', ') || 'none');
for (const [k, m] of failMsgs) console.error('FAIL ' + m.slice(0, 260));
console.log(failures ? failures + ' FAILURES' : 'ALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
