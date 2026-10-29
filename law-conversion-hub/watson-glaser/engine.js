/*
 * engine.js: builds question sets for the five Watson Glaser sections.
 *
 * How answers are guaranteed:
 *  - Deduction: answers come from a brute-force logic checker. Every possible
 *    situation is tested, and a conclusion "follows" only if it is true in all
 *    situations where the statements are true. Each explanation is built from
 *    the same check: a step-by-step chain for "follows", a concrete
 *    counter-example for "does not follow".
 *  - Interpretation (numbers): answers come from exact integer arithmetic on
 *    the figures shown.
 *  - Inference, assumptions, arguments and the worded interpretation passages
 *    use hand-checked patterns whose answer depends only on their structure.
 */
(function (root) {
  'use strict';
  const C = root.WG_CONTENT;
  const BK = root.WG_BANK || {};
  const cat = (...lists) => [].concat(...lists.map(l => l || []));

  /* ---------- randomness (seedable so the test suite can replay) ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  let rnd = Math.random;
  function setSeed(s) { rnd = s == null ? Math.random : mulberry32(s); }
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  // {name} inserts a slot; {^name} inserts it with a capital first letter. Slot
  // values may themselves contain slots, so two passes are made.
  const fill1 = (str, v) => str.replace(/\{(\^?)(\w+)\}/g, (m, up, k) => (k in v ? (up ? cap(String(v[k])) : String(v[k])) : m));
  const fill = (str, v) => fill1(fill1(str, v), v);
  const helpers = { ri, pick, firm: () => pick(C.FIRMS), city: () => pick(C.CITIES), name: () => pick(C.NAMES) };
  const popcount = n => { let c = 0; while (n) { n &= n - 1; c++; } return c; };
  const joinList = (arr, word) => arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ' ' + word + ' ' + arr[arr.length - 1];
  const q = s => '“' + s + '”';

  /* ---------- answer options ---------- */
  const OPTIONS = {
    inference: [
      { k: 'T', label: 'True' }, { k: 'PT', label: 'Probably true' }, { k: 'ID', label: 'Insufficient data' },
      { k: 'PF', label: 'Probably false' }, { k: 'F', label: 'False' }
    ],
    assumptions: [{ k: 'made', label: 'Assumption made' }, { k: 'not', label: 'Assumption not made' }],
    deduction: [{ k: 'follows', label: 'Conclusion follows' }, { k: 'not', label: 'Conclusion does not follow' }],
    interpretation: [{ k: 'follows', label: 'Conclusion follows' }, { k: 'not', label: 'Conclusion does not follow' }],
    arguments: [{ k: 'strong', label: 'Argument strong' }, { k: 'weak', label: 'Argument weak' }]
  };
  const labelOf = (section, k) => (OPTIONS[section].find(o => o.k === k) || {}).label;

  /* ---------- pattern names, used for weak-spot tracking ---------- */
  const PATTERNS = {
    'inf-T': 'Inference: spotting what is definitely true',
    'inf-PT': 'Inference: probably true vs certain',
    'inf-ID': 'Inference: when the passage gives no clue',
    'inf-PF': 'Inference: probably false vs false',
    'inf-F': 'Inference: spotting contradictions',
    'asm-means': 'Assumptions: the plan will actually help',
    'asm-goal': 'Assumptions: the goal is worth pursuing',
    'asm-feasible': 'Assumptions: the plan is possible',
    'asm-only': 'Assumptions: "the only way" traps',
    'asm-over': 'Assumptions: overstated outcomes',
    'asm-compare': 'Assumptions: comparisons never made',
    'asm-priority': 'Assumptions: "most important issue" traps',
    'asm-tried': 'Assumptions: "tried everything else" traps',
    'asm-made': 'Assumptions: what the reasoning relies on',
    'asm-not': 'Assumptions: extra details not needed',
    'ded-chain': 'Deduction: following a chain to a sure conclusion',
    'ded-some-follow': 'Deduction: what "some" does guarantee',
    'ded-convert': 'Deduction: flipping "No" and "Some" statements',
    'ded-conversion': 'Deduction: "All A are B" is one-way',
    'ded-some-notall': 'Deduction: "some" can mean "all"',
    'ded-some-all': 'Deduction: "some" never gives "all"',
    'ded-notall-none': 'Deduction: "some are not" is not "none"',
    'ded-nolink': 'Deduction: no guaranteed link',
    'prop-mp': 'If/then: the rule is triggered',
    'prop-mt': 'If/then: working backwards (the result did not happen)',
    'prop-ac': 'If/then: the result happened, so the cause did? (trap)',
    'prop-da': 'If/then: the cause did not happen, so the result did not? (trap)',
    'prop-chain': 'If/then: chained rules',
    'prop-onlyif': 'If/then: "only if"',
    'prop-unless': 'If/then: "unless"',
    'prop-or': 'If/then: "either ... or"',
    'prop-other': 'If/then: checking every possibility',
    'int-prop': 'Interpretation: proportions vs numbers',
    'int-num': 'Interpretation: reading the numbers',
    'int-pct': 'Interpretation: working out percentages',
    'int-cause': 'Interpretation: the reason fallacy (a cause the passage never gives)',
    'int-corr': 'Interpretation: the correlation-causation fallacy',
    'int-predict': 'Interpretation: predictions about the future',
    'int-scope': 'Interpretation: jumping to conclusions beyond the evidence',
    'int-sample': 'Interpretation: jumping from a survey to everyone',
    'int-flip': 'Interpretation: same fact, other direction',
    'int-exists': 'Interpretation: what a comparison guarantees',
    'int-average': 'Interpretation: the "all / none" fallacy (averages are not "every")',
    'int-restate': 'Interpretation: what the passage directly gives',
    'int-gap': 'Interpretation: jumping to conclusions (filling gaps)',
    'arg-strong': 'Arguments: recognising a strong argument',
    'arg-trivial': 'Arguments: true but trivial',
    'arg-irrelevant': 'Arguments: not about the question',
    'arg-person': 'Arguments: attacking people, not the idea',
    'arg-tradition': 'Arguments: "we have always done it this way"',
    'arg-circular': 'Arguments: no actual reason given',
    'arg-mismatch': 'Arguments: the reason points the other way'
  };

  const SECTIONS = ['inference', 'assumptions', 'deduction', 'interpretation', 'arguments'];
  let uid = 0;
  function item(section, fields) {
    return Object.assign({ id: 'q' + (++uid) + '-' + Math.floor(rnd() * 1e6), section }, fields);
  }

  /* ======================================================================
   * INFERENCE
   * ==================================================================== */
  const INF_MEANING = {
    T: 'True means the facts make it certain. If the passage is true, this has to be true.',
    PT: 'Probably true means the facts make it more likely true than false, but not certain.',
    ID: 'Insufficient data means the passage gives no clue either way. It might sound plausible in real life, but nothing in the passage tips the balance.',
    PF: 'Probably false means the facts make it more likely false than true, but they do not completely rule it out.',
    F: 'False means it contradicts the passage, or contradicts something that must follow from it.'
  };
  // What to say when someone picks X but the answer is Y.
  function infContrast(chosen, correct) {
    const pair = chosen + '>' + correct;
    const m = {
      'T>PT': 'You treated this as certain. Ask: could the facts all be true and this still be false? Here they could, so the most you can say is "probably".',
      'PT>T': 'You were too cautious. Nothing could make this false if the facts are true, so it is certain, not just likely.',
      'ID>PT': 'The passage does give you a clue here. Something in it makes this more likely than not. "Insufficient data" is only for when nothing points either way.',
      'PT>ID': 'You used a guess from outside the passage. Ask: which fact in the passage makes this more likely? If you cannot point to one, it is insufficient data.',
      'ID>PF': 'The passage does point against this. That clue makes it "probably false", not "insufficient data".',
      'PF>ID': 'Nothing in the passage points against this. A statement that just sounds unlikely to you is not enough. With no clue either way, it is insufficient data.',
      'F>PF': 'You treated this as a flat contradiction. But the facts only make it unlikely; they do not rule it out completely. So "probably false".',
      'PF>F': 'This one directly contradicts the passage, so it is definitely false, not just probably false.',
      'T>ID': 'The passage does not actually say this. Check whether you added your own assumptions.',
      'ID>T': 'This does follow from the facts. Re-read the passage: it gives you exactly what you need.',
      'F>ID': 'The passage does not contradict this; it simply does not cover it.',
      'ID>F': 'The passage directly contradicts this. Look for the fact that rules it out.',
      'PT>PF': 'The facts point the other way. Re-read which way the evidence leans.',
      'PF>PT': 'The facts actually support this. Re-read which way the evidence leans.'
    };
    return m[pair] || ('You chose "' + labelOf('inference', chosen) + '". The best answer is "' + labelOf('inference', correct) + '". ' + INF_MEANING[correct]);
  }

  function baseVars() { return { firm: helpers.firm(), city: helpers.city(), name: helpers.name() }; }
  function genInference(t) {
    const v = t.frame ? Object.assign(baseVars(), t.fill, t.frame.nums(helpers)) : Object.assign(baseVars(), t.vars(helpers));
    if (t.frame) t = { passage: t.frame.passage, statements: t.frame.statements };
    Object.keys(v).forEach(k => { if (typeof v[k] === 'number' && v[k] >= 1000 && !/^y\d?$/.test(k)) v[k] = v[k].toLocaleString('en-GB'); });
    // Use every category the passage offers once, then fill up to five.
    const byCat = {};
    t.statements.forEach(s => { (byCat[s.a] = byCat[s.a] || []).push(s); });
    let chosen = Object.keys(byCat).map(k => pick(byCat[k]));
    const rest = shuffle(t.statements.filter(s => !chosen.includes(s)));
    while (chosen.length < 5 && rest.length) chosen.push(rest.pop());
    chosen = shuffle(chosen);
    const passage = fill(t.passage, v);
    const items = chosen.map(s => item('inference', {
      passage, statement: fill(s.text, v), answer: s.a, pattern: 'inf-' + s.a,
      expl: {
        plain: fill(s.why, v),
        rule: INF_MEANING[s.a],
        contrast: chosen2 => infContrast(chosen2, s.a)
      }
    }));
    return { section: 'inference', passage, items };
  }

  /* ======================================================================
   * ASSUMPTIONS
   * ==================================================================== */
  function genAssumptionRec(t) {
    const v = baseVars();
    const who = fill(t.who, v);
    const Who = cap(who);
    const forms = [
      '"' + Who + ' should ' + t.action + ' in order to ' + t.goal + '."',
      '"To ' + t.goal + ', ' + who + ' should ' + t.action + '."',
      '"If ' + who + ' wants to ' + t.goal + ', it should ' + t.action + '."'
    ];
    const passage = pick(forms);
    const A = cap(t.actionIng), G = cap(t.goalIng);
    const flip = s => 'Flip it: "' + s + '"';
    const all = [
      { a: 'made', p: 'asm-means', text: A + ' would help to ' + t.goal + '.',
        why: 'The speaker recommends this action in order to ' + t.goal + '. That only makes sense if they believe it would help. ' + flip(A + ' would NOT help to ' + t.goal + '.') + ' If that were true, the recommendation would collapse. So the speaker must be taking it for granted.' },
      { a: 'made', p: 'asm-goal', text: G + ' is a worthwhile aim.',
        why: 'People only recommend action to achieve a goal they think is worth achieving. ' + flip(G + ' is NOT worthwhile.') + ' Then there would be no reason to act. Assumed.' },
      { a: 'made', p: 'asm-feasible', text: 'It is possible for ' + who + ' to ' + t.action + '.',
        why: 'Nobody seriously recommends something they think cannot be done. Saying "' + who + ' should do this" takes for granted that it can. Assumed.' },
      { a: 'not', p: 'asm-only', text: A + ' is the only way to ' + t.goal + '.',
        why: 'The speaker says this action would help. That does not mean nothing else would. ' + flip(A + ' is NOT the only way.') + ' The recommendation still makes perfect sense. Not assumed.' },
      { a: 'not', p: 'asm-over', text: A + ' would mean that ' + t.over + '.',
        why: 'The speaker only needs to believe the action would help, not that it would solve the problem completely. Words like "every", "never" and "completely" are a warning sign. Not assumed.' },
      { a: 'not', p: 'asm-compare', text: A + ' would be more effective than ' + t.alt + '.',
        why: 'The speaker never compares this idea with ' + t.alt + '. You can recommend one idea without believing it beats every other. Not assumed.' },
      { a: 'not', p: 'asm-priority', text: G + ' is the most important issue facing ' + who + '.',
        why: 'Wanting to achieve something does not mean it is the top priority. The speaker could think other issues matter more. Not assumed.' },
      { a: 'not', p: 'asm-tried', text: Who + ' has already tried every other way to ' + t.goal + '.',
        why: 'You can recommend a new idea without having tried every alternative first. Not assumed.' }
    ];
    const made = shuffle(all.filter(s => s.a === 'made')).slice(0, ri(1, 2));
    const not = shuffle(all.filter(s => s.a === 'not')).slice(0, 4 - made.length);
    const chosen = shuffle(made.concat(not));
    return { section: 'assumptions', passage, items: chosen.map(s => asmItem(passage, s)) };
  }
  function asmItem(passage, s) {
    return item('assumptions', {
      passage, statement: s.text, answer: s.a, pattern: s.p,
      expl: {
        plain: s.why,
        rule: 'The flip test: make the statement false. If the speaker\'s reasoning falls apart, it was an assumption. If the reasoning still stands, it was not.'
      }
    });
  }
  function genAssumptionFixed(t) {
    const v = baseVars();
    const passage = fill(t.passage, v);
    const chosen = shuffle(t.statements);
    return { section: 'assumptions', passage, items: chosen.map(s => asmItem(passage, { a: s.a, p: s.a === 'made' ? 'asm-made' : 'asm-not', text: fill(s.text, v), why: fill(s.why, v) })) };
  }
  function genAssumptionCausal(t) {
    const st = t.made.map(m => ({ a: 'made', text: m[0], why: m[1] })).concat(t.not.map(m => ({ a: 'not', text: m[0], why: m[1] })));
    return genAssumptionFixed({ passage: t.passage, statements: st });
  }
  function genAssumptionEvidence(t) {
    const passage = '"{name} will make an excellent ' + t.role + '. After all, {name} ' + t.evidence + '."';
    return genAssumptionFixed({ passage, statements: [
      { a: 'made', text: t.link, why: 'The evidence is the speaker\'s only reason. It only supports the claim if it actually says something about being good in the role. Flip it ("this is NOT a sign of being a good ' + t.role + '") and the argument collapses. Assumed.' },
      { a: 'not', text: t.lack, why: 'The speaker says this evidence is a good sign. That does not mean everyone without it would be bad. This is far stronger than anything the speaker needs. Not assumed.' },
      { a: 'not', text: '{name} would be better in the role than anyone else who could be chosen.', why: 'The speaker says {name} would be excellent, not the best possible choice. Not assumed.' },
      { a: 'not', text: t.irrelevant, why: 'Nothing in the reasoning depends on this. Not assumed.' }
    ] });
  }
  function genAssumptionCapacity(t) {
    const passage = '"We should hold ' + t.event + ' in ' + t.venue + ', because more than ' + t.n + ' people have ' + t.done + '."';
    return genAssumptionFixed({ passage, statements: [
      { a: 'made', text: cap(t.venue) + ' can hold more than ' + t.n + ' people.', why: 'The speaker picks this venue because of the numbers. Flip it ("it cannot hold that many") and choosing it for that reason makes no sense. Assumed.' },
      { a: 'made', text: 'The number of people expected is relevant to choosing where to hold ' + t.event + '.', why: 'The only reason given for the choice is the number of people. If numbers did not matter, the reason would be pointless. Assumed.' },
      { a: 'not', text: 'Every person who has ' + t.done + ' will actually attend.', why: 'The speaker only needs to expect a large turnout. A few people dropping out would not undermine choosing a bigger venue. Not assumed.' },
      { a: 'not', text: cap(t.event) + ' will be a success.', why: 'Choosing a venue says nothing about whether the event will go well. Not assumed.' }
    ] });
  }

  /* ======================================================================
   * ARGUMENTS
   * ==================================================================== */
  const ARG_RULE = 'Treat every argument as true. Then ask two questions: is it important, and is it directly about this question? Strong needs both. If it fails either one, it is weak. Strong arguments can be on the Yes side or the No side.';
  function genArguments(t) {
    const pool = [];
    t.strongYes.forEach(x => pool.push({ side: 'Yes', text: x, a: 'strong', p: 'arg-strong',
      why: 'If this is true (and you must assume it is), it is a serious benefit that bears directly on whether the answer should be yes. Important and directly related, so it is strong. It does not matter whether you personally agree, or whether there are good arguments on the other side too.' }));
    t.strongNo.forEach(x => pool.push({ side: 'No', text: x, a: 'strong', p: 'arg-strong',
      why: 'If this is true (and you must assume it is), it is a serious drawback that bears directly on whether the answer should be no. Important and directly related, so it is strong, even if strong arguments exist for "yes" as well.' }));
    t.trivialYes.forEach(x => pool.push({ side: 'Yes', text: x, a: 'weak', p: 'arg-trivial',
      why: 'It is related to the question, but even if true it is a minor detail. Nobody sensible would decide this question because of it. Not important, so weak.' }));
    t.trivialNo.forEach(x => pool.push({ side: 'No', text: x, a: 'weak', p: 'arg-trivial',
      why: 'Even if true, this is a small inconvenience. It would not weigh seriously in deciding the question. Not important, so weak.' }));
    t.irrelevant.forEach(x => pool.push({ side: pick(['Yes', 'No']), text: x, a: 'weak', p: 'arg-irrelevant',
      why: 'This may well be true, but it is not about the question being asked. An argument that does not address the question cannot be strong.' }));
    // One generic weak argument at most, so topic-specific ones dominate.
    [pick(C.GENERIC_WEAK)].forEach(g => pool.push({ side: g.side, text: g.text, a: 'weak', p: 'arg-' + g.kind,
      why: g.kind === 'person' ? 'This attacks the people involved, not the idea. Whether a proposal is good does not depend on who supports or opposes it. Not directly related, so weak.'
        : g.kind === 'tradition' ? '"We have always done it differently" says nothing about whether the change would be good or bad. It gives no reason based on the merits, so it is weak.'
          : 'This just restates the answer without giving a reason. Saying "because it is right" (or "because it is bad") gives you nothing to weigh, so it is weak.' }));
    const strong = shuffle(pool.filter(x => x.a === 'strong'));
    const nStrong = ri(1, 2);
    const strongPicked = strong.slice(0, nStrong);
    // A strong reason given under the wrong answer, but never one already shown
    // as strong in this set (that would give the answer away).
    const unused = strong.slice(nStrong);
    if (unused.length && rnd() < 0.7) {
      const src = pick(unused), side = src.side === 'Yes' ? 'No' : 'Yes';
      pool.push({ side, text: src.text, a: 'weak', p: 'arg-mismatch',
        why: 'The point itself may be important, but it supports the opposite answer. As an argument for "' + side + '" it does not work, so it is weak. Always check that the reason really backs up the Yes or No in front of it.' });
    }
    const weak = shuffle(pool.filter(x => x.a === 'weak'));
    const chosen = shuffle(strongPicked.concat(weak.slice(0, 4 - nStrong)));
    return {
      section: 'arguments', passage: t.q, question: t.q,
      items: chosen.map(x => item('arguments', {
        passage: t.q, question: t.q, statement: x.side + '; ' + x.text, answer: x.a, pattern: x.p,
        expl: { plain: x.why, rule: ARG_RULE }
      }))
    };
  }

  /* ======================================================================
   * DEDUCTION (categorical): "All / No / Some / Some ... not"
   * ==================================================================== */
  // A statement is {f, x, y}: f is A (all), E (no), I (some), O (some not).
  // A situation ("model") says which combinations of terms have members.
  function catMask(st, k) {
    const R = (1 << k) - 1; let m = 0;
    for (let r = 1; r <= R; r++) {
      const inx = !!(r & (1 << st.x)), iny = !!(r & (1 << st.y));
      if ((st.f === 'A' || st.f === 'O') && inx && !iny) m |= 1 << (r - 1);
      if ((st.f === 'E' || st.f === 'I') && inx && iny) m |= 1 << (r - 1);
    }
    return m;
  }
  const catUniversal = st => st.f === 'A' || st.f === 'E';
  function catHolds(st, M, k) { const m = catMask(st, k); return catUniversal(st) ? (M & m) === 0 : (M & m) !== 0; }
  function termMasks(k) {
    const R = (1 << k) - 1, out = [];
    for (let t = 0; t < k; t++) { let m = 0; for (let r = 1; r <= R; r++) if (r & (1 << t)) m |= 1 << (r - 1); out.push(m); }
    return out;
  }
  // Checks every possible situation. "validNo": follows with no extra
  // assumptions. "validImp": follows if every term is assumed to have members.
  // Items are only used when both agree, so the answer never hinges on that.
  function catAnalyse(premises, concl, k) {
    const R = (1 << k) - 1, N = 1 << R, tm = termMasks(k);
    const pm = premises.map(p => ({ u: catUniversal(p), m: catMask(p, k) }));
    const cm = { u: catUniversal(concl), m: catMask(concl, k) };
    const h = (s, M) => (s.u ? (M & s.m) === 0 : (M & s.m) !== 0);
    let validNo = true, validImp = true, consImp = false, best = null, bestPop = 99;
    for (let M = 1; M < N; M++) {
      let ok = true;
      for (let i = 0; i < pm.length; i++) if (!h(pm[i], M)) { ok = false; break; }
      if (!ok) continue;
      const full = tm.every(t => (M & t) !== 0);
      if (full) consImp = true;
      if (!h(cm, M)) {
        validNo = false;
        if (full) { validImp = false; const pc = popcount(M); if (pc < bestPop) { bestPop = pc; best = M; } }
      }
    }
    // M = 0 (nothing exists) only matters for the no-assumption reading.
    if (pm.every(s => h(s, 0)) && !h(cm, 0)) validNo = false;
    return { validNo, validImp, consImp, counter: best };
  }
  function catSentence(st, T) {
    const x = T[st.x].pl, y = T[st.y].pl;
    if (st.f === 'A') return 'All ' + x + ' are ' + y + '.';
    if (st.f === 'E') return (st.alt ? 'None of the ' + x + ' are ' : 'No ' + x + ' are ') + y + '.';
    if (st.f === 'I') return 'Some ' + x + ' are ' + y + '.';
    return st.alt ? 'Not all ' + x + ' are ' + y + '.' : 'Some ' + x + ' are not ' + y + '.';
  }
  const sameSt = (a, b) => a.f === b.f && a.x === b.x && a.y === b.y;

  // Follow one member through the statements (used for "follows" explanations).
  function closure(start, premises) {
    const facts = new Map(start), steps = [];
    let changed = true;
    while (changed) {
      changed = false;
      premises.forEach((p, i) => {
        if (p.f === 'A') {
          if (facts.get(p.x) === true && !facts.has(p.y)) { facts.set(p.y, true); steps.push({ i, kind: 'A', from: p.x, to: p.y, val: true }); changed = true; }
          if (facts.get(p.y) === false && !facts.has(p.x)) { facts.set(p.x, false); steps.push({ i, kind: 'Ac', from: p.y, to: p.x, val: false }); changed = true; }
        } else if (p.f === 'E') {
          if (facts.get(p.x) === true && !facts.has(p.y)) { facts.set(p.y, false); steps.push({ i, kind: 'E', from: p.x, to: p.y, val: false }); changed = true; }
          if (facts.get(p.y) === true && !facts.has(p.x)) { facts.set(p.x, false); steps.push({ i, kind: 'E', from: p.y, to: p.x, val: false }); changed = true; }
        }
      });
    }
    return { facts, steps };
  }
  function catProof(premises, concl) {
    const { f, x, y } = concl;
    if (f === 'A' || f === 'E') {
      const want = f === 'A';
      let r = closure([[x, true]], premises);
      if (r.facts.get(y) === want) return { start: 'any', subject: x, steps: r.steps };
      if (f === 'E') { r = closure([[y, true]], premises); if (r.facts.get(x) === false) return { start: 'any', subject: y, steps: r.steps, swapped: true }; }
      return null;
    }
    for (let i = 0; i < premises.length; i++) {
      const p = premises[i];
      if (p.f !== 'I' && p.f !== 'O') continue;
      const r = closure([[p.x, true], [p.y, p.f === 'I']], premises);
      if (r.facts.get(x) === true && r.facts.get(y) === (f === 'I')) return { start: 'witness', from: i, steps: r.steps };
    }
    return null;
  }
  function catExplainFollows(premises, concl, T, E, proof) {
    const S = i => q(catSentence(premises[i], T).replace(/\.$/, ''));
    const steps = [];
    const the = 'this ' + E.word, isWord = 'is';
    if (proof.start === 'any') {
      steps.push('Pick any ' + E.word + ' ' + E.rel + ' is ' + T[proof.subject].sg + '. We don\'t know anything else about ' + (E.pron === 'they' ? 'them' : 'it') + ' yet.');
    } else {
      const p = premises[proof.from];
      steps.push(S(proof.from) + ' tells us there is at least one ' + E.word + ' ' + E.rel + ' is ' + T[p.x].sg + (p.f === 'I' ? ' and is also ' + T[p.y].sg : ' but is not ' + T[p.y].sg) + '. Let\'s follow that ' + E.word + '.');
    }
    proof.steps.forEach(s => {
      if (s.kind === 'A') steps.push(S(s.i) + ', and ' + the + ' ' + isWord + ' ' + T[s.from].sg + ', so ' + (E.pron === 'they' ? 'they are' : 'it is') + ' ' + T[s.to].sg + '.');
      else if (s.kind === 'Ac') steps.push(S(s.i) + '. ' + cap(the) + ' is not ' + T[s.from].sg + ', so ' + (E.pron === 'they' ? 'they' : 'it') + ' cannot be ' + T[s.to].sg + ' (if ' + (E.pron === 'they' ? 'they were' : 'it were') + ', ' + (E.pron === 'they' ? 'they' : 'it') + ' would have to be ' + T[s.from].sg + ').');
      else steps.push(S(s.i) + ', and ' + the + ' ' + isWord + ' ' + T[s.from].sg + ', so ' + (E.pron === 'they' ? 'they are' : 'it is') + ' not ' + T[s.to].sg + '.');
    });
    const c = q(catSentence(concl, T).replace(/\.$/, ''));
    if (proof.start === 'any') steps.push('That works for every ' + E.word + ' ' + E.rel + ' is ' + T[proof.subject].sg + ', with no exceptions possible. So ' + c + ' is guaranteed.');
    else steps.push('So at least one ' + E.word + ' fits the conclusion ' + c + '. In Watson Glaser, "some" just means "at least one", so the conclusion is guaranteed.');
    return steps;
  }
  function catDescribe(M, k, T, E) {
    const R = (1 << k) - 1, groups = [];
    for (let r = 1; r <= R; r++) if (M & (1 << (r - 1))) groups.push(r);
    const labels = {};
    const lines = groups.map((r, idx) => {
      const name = E.label + ' ' + (idx + 1);
      labels[r] = name;
      const pos = [], neg = [];
      for (let t = 0; t < k; t++) ((r & (1 << t)) ? pos : neg).push(T[t].sg);
      return name + ' is ' + joinList(pos, 'and') + (neg.length ? ', but is not ' + joinList(neg, 'or') : '') + '.';
    });
    return { groups, labels, lines };
  }
  function catCheck(st, d, T, E, isConcl) {
    const inX = d.groups.filter(r => r & (1 << st.x));
    const xy = inX.filter(r => r & (1 << st.y)), xNotY = inX.filter(r => !(r & (1 << st.y)));
    const names = rs => joinList(rs.map(r => d.labels[r]), 'and');
    const s = q(catSentence(st, T));
    const holds = (st.f === 'A' && !xNotY.length) || (st.f === 'E' && !xy.length) || (st.f === 'I' && xy.length) || (st.f === 'O' && xNotY.length);
    let why;
    if (st.f === 'A') why = holds ? 'every ' + E.word + ' here ' + E.rel + ' is ' + T[st.x].sg + ' (' + names(inX) + ') is also ' + T[st.y].sg + '.' : names(xNotY.slice(0, 1)) + ' is ' + T[st.x].sg + ' but is not ' + T[st.y].sg + '.';
    if (st.f === 'E') why = holds ? 'no ' + E.word + ' here is both ' + T[st.x].sg + ' and ' + T[st.y].sg + '.' : names(xy.slice(0, 1)) + ' is both ' + T[st.x].sg + ' and ' + T[st.y].sg + '.';
    if (st.f === 'I') why = holds ? names(xy.slice(0, 1)) + ' is both ' + T[st.x].sg + ' and ' + T[st.y].sg + '.' : 'no ' + E.word + ' here is both ' + T[st.x].sg + ' and ' + T[st.y].sg + '.';
    if (st.f === 'O') why = holds ? names(xNotY.slice(0, 1)) + ' is ' + T[st.x].sg + ' but is not ' + T[st.y].sg + '.' : 'every ' + E.word + ' here ' + E.rel + ' is ' + T[st.x].sg + ' is also ' + T[st.y].sg + '.';
    return { ok: holds, text: (holds ? '✔ ' : '✘ ') + s + (isConcl ? (holds ? ' is true: ' : ' is false: ') : ' is true: ') + why };
  }
  function catTrap(premises, concl) {
    const same = (p, f, x, y) => p.f === f && p.x === x && p.y === y;
    if (concl.f === 'A' && premises.some(p => same(p, 'A', concl.y, concl.x))) return 'ded-conversion';
    if (concl.f === 'O' && premises.some(p => same(p, 'I', concl.x, concl.y) || same(p, 'I', concl.y, concl.x))) return 'ded-some-notall';
    if (concl.f === 'I' && premises.some(p => same(p, 'O', concl.x, concl.y))) return 'ded-some-notall';
    if (concl.f === 'A' && premises.some(p => same(p, 'I', concl.x, concl.y) || same(p, 'I', concl.y, concl.x))) return 'ded-some-all';
    if (concl.f === 'E' && premises.some(p => same(p, 'O', concl.x, concl.y))) return 'ded-notall-none';
    return 'ded-nolink';
  }
  const CAT_RULES = {
    'ded-conversion': '"All A are B" only works one way. All judges are lawyers, but not all lawyers are judges.',
    'ded-some-notall': 'In Watson Glaser, "some" means "at least one, and possibly all". So "some X are Y" tells you nothing about whether any X are not Y, and "some X are not Y" tells you nothing about whether any X are Y.',
    'ded-some-all': '"Some" never lets you conclude "all". Knowing that at least one X is a Y tells you nothing about the rest.',
    'ded-notall-none': '"Some X are not Y" does not mean "no X are Y". Some X could still be Y.',
    'ded-nolink': 'A conclusion follows only if it is true in every situation the statements allow. If you can build even one situation where every statement is true and the conclusion is false, it does not follow.',
    'ded-chain': 'If the statements are true, the conclusion cannot be false. Follow one member through each statement and see where they must end up.',
    'ded-some-follow': '"Some" means "at least one". If you can prove that at least one member fits, a "some" conclusion follows.',
    'ded-convert': '"No A are B" means exactly the same as "No B are A", and "Some A are B" means exactly the same as "Some B are A". These two flip safely. "All" and "Some ... not" do not.'
  };

  function genCategorical(hard, fixedPack) {
    for (let attempt = 0; attempt < 400; attempt++) {
      const pack = fixedPack && attempt < 300 ? fixedPack : pick(CAT_PACKS);
      const k = hard ? 4 : 3;
      const v = { firm: helpers.firm(), city: helpers.city(), village: pick(C.VILLAGES) };
      const T = shuffle(pack.terms).slice(0, k).map(t => ({ pl: fill(t.pl, v), sg: fill(t.sg, v) }));
      const E = pack.ent;
      const forms = ['A', 'A', 'E', 'I', 'O'];
      const premises = [];
      for (let i = 0; i < k - 1; i++) {
        const f = pick(forms);
        const ord = rnd() < 0.5;
        premises.push({ f, x: ord ? i : i + 1, y: ord ? i + 1 : i, alt: rnd() < 0.25 });
      }
      // Premises must be possible together, even with every term having members.
      if (!catAnalyse(premises, premises[0], k).consImp) continue;
      const cands = [];
      for (let x = 0; x < k; x++) for (let y = 0; y < k; y++) {
        if (x === y) continue;
        ['A', 'E', 'I', 'O'].forEach(f => {
          const st = { f, x, y, alt: rnd() < 0.2 };
          if (premises.some(p => sameSt(p, st))) return;
          const r = catAnalyse(premises, st, k);
          if (r.validNo !== r.validImp) return; // never depends on whether a group is empty
          cands.push({ st, follows: r.validNo, counter: r.counter });
        });
      }
      const ends = (c) => (c.st.x === 0 && c.st.y === k - 1) || (c.st.x === k - 1 && c.st.y === 0);
      const fol = shuffle(cands.filter(c => c.follows));
      const nof = shuffle(cands.filter(c => !c.follows));
      if (!nof.length || !fol.length) continue;
      // Prefer conclusions linking the two end terms; they test the chain.
      fol.sort((a, b) => ends(b) - ends(a));
      nof.sort((a, b) => (ends(b) + (catTrap(premises, b.st) !== 'ded-nolink')) - (ends(a) + (catTrap(premises, a.st) !== 'ded-nolink')));
      const nF = Math.min(fol.length, ri(1, 2));
      const picked = shuffle(fol.slice(0, nF).concat(nof.slice(0, 4 - nF)));
      if (picked.length < 3) continue;
      const premText = premises.map(p => catSentence(p, T));
      const intro = fill(pack.intro, v);
      const passage = { intro, lines: premText };
      const items = [];
      let bad = false;
      picked.forEach(c => {
        const ct = catSentence(c.st, T);
        let expl, pattern;
        if (c.follows) {
          const proof = catProof(premises, c.st);
          if (!proof) { bad = true; return; }
          const converse = premises.some(p => p.f === c.st.f && p.x === c.st.y && p.y === c.st.x && (p.f === 'E' || p.f === 'I'));
          pattern = converse ? 'ded-convert' : (c.st.f === 'I' || c.st.f === 'O') ? 'ded-some-follow' : 'ded-chain';
          expl = {
            plain: converse
              ? 'It follows. ' + q(ct) + ' says exactly the same thing as ' + q(catSentence(premises.find(p => p.f === c.st.f && p.x === c.st.y && p.y === c.st.x), T)) + ', just in the other order.'
              : 'It follows. If the statements are true, there is no way for this conclusion to be false. Here is the chain:',
            steps: catExplainFollows(premises, c.st, T, E, proof),
            rule: CAT_RULES[pattern]
          };
        } else {
          const d = catDescribe(c.counter, k, T, E);
          pattern = catTrap(premises, c.st);
          const checks = premises.map(p => catCheck(p, d, T, E, false));
          const cc = catCheck(c.st, d, T, E, true);
          if (!checks.every(x => x.ok) || cc.ok) { bad = true; return; }
          expl = {
            plain: 'It does not follow. The conclusion might be true, but it is not guaranteed. To prove that, you only need ONE situation where every statement is true and the conclusion is false. Here is one:',
            steps: d.lines,
            checks: checks.map(x => x.text).concat([cc.text]),
            rule: CAT_RULES[pattern]
          };
        }
        items.push(item('deduction', { passage, statement: ct, answer: c.follows ? 'follows' : 'not', pattern, expl, logic: { kind: 'cat', k, premises, concl: c.st } }));
      });
      if (bad) continue;
      return { section: 'deduction', passage, items };
    }
    throw new Error('could not build categorical deduction');
  }

  /* ======================================================================
   * DEDUCTION (if / then)
   * ==================================================================== */
  const lit = (a, v) => ({ t: 'lit', a, v });
  const neg = l => lit(l.a, !l.v);
  function evalF(f, asg) {
    if (f.t === 'lit') return (((asg >> f.a) & 1) === 1) === f.v;
    if (f.t === 'imp') return !evalF(f.l, asg) || evalF(f.r, asg);
    return evalF(f.l, asg) || evalF(f.r, asg);
  }
  function propText(f, A) {
    const L = l => (l.v ? A[l.a].pos : A[l.a].neg);
    if (f.t === 'lit') return cap(L(f)) + '.';
    if (f.t === 'imp') return f.say === 'onlyif' ? cap(L(f.l)) + ' only if ' + L(f.r) + '.' : 'If ' + L(f.l) + ', then ' + L(f.r) + '.';
    if (f.say === 'unless') return cap(L(f.l)) + ' unless ' + L(f.r) + '.';
    return 'Either ' + L(f.l) + ', or ' + L(f.r) + ', or both.';
  }
  const litStr = (l, A) => (l.v ? A[l.a].pos : A[l.a].neg);
  const sameLit = (a, b) => a.a === b.a && a.v === b.v;
  function propAnalyse(prem, concl, n) {
    let valid = true, counter = null, anteOk = concl.t !== 'imp';
    for (let s = 0; s < (1 << n); s++) {
      if (!prem.every(p => evalF(p, s))) continue;
      if (concl.t === 'imp' && evalF(concl.l, s)) anteOk = true;
      if (!evalF(concl, s)) { valid = false; if (counter === null) counter = s; }
    }
    return { valid, counter, anteOk };
  }
  // Implication edges with the reasoning step each one represents.
  function propEdges(rules) {
    const e = [];
    rules.forEach((r, i) => {
      if (r.t === 'imp') { e.push({ i, from: r.l, to: r.r, how: 'mp' }); e.push({ i, from: neg(r.r), to: neg(r.l), how: 'mt' }); }
      if (r.t === 'or') { e.push({ i, from: neg(r.l), to: r.r, how: 'or' }); e.push({ i, from: neg(r.r), to: r.l, how: 'or' }); }
    });
    return e;
  }
  function propChain(rules, startLits) {
    const known = startLits.slice(), steps = [];
    const has = l => known.some(k => sameLit(k, l));
    let changed = true;
    while (changed) {
      changed = false;
      propEdges(rules).forEach(ed => { if (has(ed.from) && !has(ed.to)) { known.push(ed.to); steps.push(ed); changed = true; } });
    }
    return { known, steps };
  }
  function propStepText(ed, rules, A) {
    const r = rules[ed.i], R = q(propText(r, A).replace(/\.$/, ''));
    const f = litStr(ed.from, A), t = litStr(ed.to, A);
    if (r.say === 'onlyif') {
      return ed.how === 'mp'
        ? R + ' means that if ' + litStr(r.l, A) + ', then ' + litStr(r.r, A) + ' (it cannot happen without it). We know ' + f + ', so ' + t + '.'
        : R + ' means that if ' + litStr(r.l, A) + ', then ' + litStr(r.r, A) + '. We know ' + f + ', so ' + t + '.';
    }
    if (r.say === 'unless') return R + ' means: if ' + litStr(neg(r.r), A) + ', then ' + litStr(r.l, A) + '. In other words, at least one of the two must happen. We know ' + f + ', so ' + t + '.';
    if (r.t === 'or') return R + ' means at least one of the two must happen. We know ' + f + ', so ' + t + '.';
    if (ed.how === 'mp') return 'We know ' + f + '. ' + R + ' tells us that when that happens, ' + t + '. So ' + t + '.';
    return 'We know ' + f + '. ' + R + ' means that if it were true that ' + litStr(r.l, A) + ', it would also have to be true that ' + litStr(r.r, A) + '. But ' + f + '. So ' + t + '.';
  }
  function propCheckRule(r, s, A) {
    const L = l => litStr(l, A);
    const val = l => evalF(l, s);
    const R = q(propText(r, A));
    if (r.t === 'lit') return '✔ ' + R + ' is true here (it is given).';
    if (r.t === 'imp') {
      if (!val(r.l)) return '✔ ' + R + ' is not broken: ' + L(neg(r.l)) + ', so the rule never kicks in. An "if" rule is only broken when the "if" part happens and the "then" part does not.';
      return '✔ ' + R + ' is kept: ' + L(r.l) + ', and ' + L(r.r) + '.';
    }
    const both = val(r.l) && val(r.r);
    return '✔ ' + R + ' is kept: ' + (both ? 'both happen (which is allowed)' : val(r.l) ? L(r.l) : L(r.r)) + '.';
  }
  function propClassify(rules, fact, concl) {
    if (!fact || concl.t !== 'lit') return null;
    for (const r of rules) {
      const imps = r.t === 'imp' ? [{ a: r.l, b: r.r, say: r.say }] : [{ a: neg(r.r), b: r.l, say: r.say }, { a: neg(r.l), b: r.r, say: r.say }];
      for (const im of imps) {
        if (sameLit(fact, im.a) && sameLit(concl, im.b)) return { p: 'mp', say: im.say };
        if (sameLit(fact, neg(im.b)) && sameLit(concl, neg(im.a))) return { p: 'mt', say: im.say };
        if (sameLit(fact, im.b) && sameLit(concl, im.a)) return { p: 'ac', say: im.say };
        if (sameLit(fact, neg(im.a)) && sameLit(concl, neg(im.b))) return { p: 'da', say: im.say };
      }
    }
    return null;
  }
  const PROP_RULES = {
    'prop-mp': 'If the "if" part happens, the "then" part must happen. That is the only thing an "if" rule promises.',
    'prop-mt': 'If the "then" part did NOT happen, the "if" part cannot have happened either (otherwise the rule would have forced the "then" part).',
    'prop-ac': 'Trap: knowing the "then" part happened does NOT tell you the "if" part happened. Something else could have caused it. (If it rains, the grass gets wet. The grass is wet, but maybe the sprinkler was on.)',
    'prop-da': 'Trap: knowing the "if" part did NOT happen tells you nothing about the "then" part. The rule only covers what happens when the "if" part happens. (If it rains, the grass gets wet. It did not rain, but the grass could still be wet from a sprinkler.)',
    'prop-chain': 'Rules can be chained: if A leads to B, and B leads to C, then A leads to C. But a chain never runs backwards.',
    'prop-onlyif': '"A only if B" means "if A, then B". B is a must-have for A, but B does not guarantee A. (You can vote only if you are registered. Being registered does not mean you voted.)',
    'prop-unless': '"A unless B" means "if not B, then A". At least one of A or B happens. It does not tell you what happens to A if B does happen.',
    'prop-or': '"Either A or B, or both" means at least one happens. If one does not happen, the other must. But if one does happen, the other may or may not.',
    'prop-other': 'A conclusion follows only if no situation exists where every statement is true and the conclusion is false.'
  };

  function genProp(fixedPack) {
    for (let attempt = 0; attempt < 400; attempt++) {
      const pack = fixedPack && attempt < 300 ? fixedPack : pick(PROP_PACKS);
      const v = { firm: helpers.firm(), name: helpers.name() };
      // Keep the pack's cause-then-effect order so "if" rules read naturally.
      const idx = shuffle(pack.atoms.map((_, i) => i)).slice(0, 3).sort((x, y) => x - y);
      const A = idx.map(i => ({ pos: fill(pack.atoms[i].pos, v), neg: fill(pack.atoms[i].neg, v) }));
      const P = lit(0, true), Q = lit(1, true), R = lit(2, true);
      const kind = pick(['if', 'if', 'onlyif', 'unless', 'or', 'chain', 'chain']);
      let rules;
      if (kind === 'if') rules = [{ t: 'imp', l: P, r: Q, say: 'if' }];
      else if (kind === 'onlyif') rules = [{ t: 'imp', l: P, r: Q, say: 'onlyif' }];
      else if (kind === 'unless') rules = [{ t: 'or', l: P, r: Q, say: 'unless' }];
      else if (kind === 'or') rules = [{ t: 'or', l: P, r: Q, say: 'or' }];
      else rules = [{ t: 'imp', l: P, r: Q, say: 'if' }, { t: 'imp', l: Q, r: R, say: 'if' }];
      const atomsUsed = kind === 'chain' ? [0, 1, 2] : [0, 1];
      const useFact = kind !== 'chain' || rnd() < 0.5;
      const fact = useFact ? lit(pick(atomsUsed), rnd() < 0.5) : null;
      const prem = rules.concat(fact ? [fact] : []);
      const n = atomsUsed.length;
      let consistent = false;
      for (let s = 0; s < (1 << n); s++) if (prem.every(p => evalF(p, s))) consistent = true;
      if (!consistent) continue;
      const cands = [];
      atomsUsed.forEach(a => [true, false].forEach(val => {
        const c = lit(a, val);
        if (fact && (sameLit(c, fact) || sameLit(c, neg(fact)))) return;
        cands.push(c);
      }));
      if (!fact) {
        const pairs = kind === 'chain' ? [[0, 2], [2, 0], [0, 1], [1, 0], [1, 2]] : [[0, 1], [1, 0]];
        pairs.forEach(([x, y]) => [[true, true], [false, false]].forEach(([vx, vy]) => {
          const c = { t: 'imp', l: lit(x, vx), r: lit(y, vy), say: 'if' };
          if (rules.some(r => r.t === 'imp' && sameLit(r.l, c.l) && sameLit(r.r, c.r))) return;
          cands.push(c);
        }));
      }
      const analysed = cands.map(c => ({ c, r: propAnalyse(prem, c, n) })).filter(x => x.r.anteOk);
      const fol = shuffle(analysed.filter(x => x.r.valid)), nof = shuffle(analysed.filter(x => !x.r.valid));
      if (!fol.length || !nof.length) continue;
      const nF = Math.min(fol.length, ri(1, 2));
      const picked = shuffle(fol.slice(0, nF).concat(nof.slice(0, Math.min(nof.length, 4 - nF))));
      if (picked.length < 2) continue;
      const lines = prem.map(p => propText(p, A));
      const passage = { intro: fill(pack.intro, v), lines };
      const items = picked.map(({ c, r }) => {
        const ct = propText(c, A);
        const cls = propClassify(rules, fact, c);
        let pattern;
        if (kind === 'onlyif' || kind === 'unless' || kind === 'or') pattern = 'prop-' + kind;
        else if (cls) pattern = 'prop-' + cls.p;
        else if (kind === 'chain') pattern = 'prop-chain';
        else pattern = 'prop-other';
        let expl;
        if (r.valid) {
          const start = c.t === 'imp' ? [c.l] : (fact ? [fact] : []);
          const ch = propChain(rules, start);
          const target = c.t === 'imp' ? c.r : c;
          // Keep only the steps needed to reach the target.
          const need = [], want = [target];
          for (let i = ch.steps.length - 1; i >= 0; i--) {
            const s = ch.steps[i];
            if (want.some(w => sameLit(w, s.to))) { need.unshift(s); want.push(s.from); }
          }
          const steps = [];
          if (c.t === 'imp') steps.push('Suppose ' + litStr(c.l, A) + '. Let\'s see what must follow.');
          need.forEach(s => steps.push(propStepText(s, rules, A)));
          steps.push(c.t === 'imp' ? 'So whenever ' + litStr(c.l, A) + ', ' + litStr(c.r, A) + '. The conclusion is guaranteed.' : 'So the conclusion is guaranteed.');
          if (!need.length) return null;
          expl = { plain: 'It follows. If every statement is true, this conclusion cannot be false.', steps, rule: PROP_RULES[pattern] };
        } else {
          const s = r.counter;
          const opposite = c.t === 'lit' && propAnalyse(prem, neg(c), n).valid;
          const world = atomsUsed.map(a => cap(evalF(lit(a, true), s) ? A[a].pos : A[a].neg) + '.');
          const checks = prem.map(p => propCheckRule(p, s, A)).concat(['✘ But the conclusion ' + q(ct) + ' is false in this situation.']);
          expl = {
            plain: opposite
              ? 'It does not follow. In fact the statements guarantee the opposite: ' + litStr(neg(c), A) + '. So there is no situation where this conclusion is true. Here is a situation that fits every statement:'
              : 'It does not follow. To prove that, you only need ONE situation where every statement is true but the conclusion is false. Here is one:',
            steps: world, checks, rule: PROP_RULES[pattern]
          };
        }
        return item('deduction', { passage, statement: ct, answer: r.valid ? 'follows' : 'not', pattern, expl, logic: { kind: 'prop', n, prem, concl: c } });
      });
      if (items.some(x => !x)) continue;
      return { section: 'deduction', passage, items };
    }
    throw new Error('could not build if/then deduction');
  }

  /* ======================================================================
   * INTERPRETATION
   * ==================================================================== */
  const INT_RULE = 'Assume everything in the passage is true. A conclusion follows only if the passage establishes it beyond reasonable doubt. If you need information the passage does not give (a cause, a prediction, people outside the group studied), it does not follow.';
  const pctStr = (num, den) => { const p = (num * 100) / den; return (Number.isInteger(p) ? p : p.toFixed(1)) + '%'; };
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);

  function genTrend(ctx) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const y1 = ri(2018, 2024), y2 = y1 + 1;
      const N1 = ri(10, 40) * 20, N2 = ri(10, 40) * 20;
      const p1 = ri(3, 14) * 5, p2 = ri(3, 14) * 5;
      const S1 = N1 * p1 / 100, S2 = N2 * p2 / 100;
      if (Math.abs(p1 - p2) < 5 || S1 === S2 || (N1 - S1) === (N2 - S2) || 2 * S1 === N1 || 2 * S2 === N2) continue;
      const mixed = Math.sign(p2 - p1) !== Math.sign(S2 - S1);
      if (rnd() < 0.6 && !mixed) continue; // favour the trap where number and share move apart
      const v = { y1, y2, y3: y2 + 1, N1, N2, S1, S2, firm: helpers.firm(), city: helpers.city() };
      const passage = fill(ctx.setup, v);
      const calc1 = y1 + ': ' + S1 + ' out of ' + N1 + ' = ' + p1 + '%.';
      const calc2 = y2 + ': ' + S2 + ' out of ' + N2 + ' = ' + p2 + '%.';
      const out = [];
      // Proportion direction.
      const sayHigher = rnd() < 0.5;
      const propTrue = sayHigher === (p2 > p1);
      out.push({ text: 'The proportion of ' + ctx.propOf + ' was ' + (sayHigher ? 'higher' : 'lower') + ' in ' + y2 + ' than in ' + y1 + '.',
        a: propTrue ? 'follows' : 'not', p: 'int-prop',
        why: 'Work out each year\'s share: ' + calc1 + ' ' + calc2 + ' So the proportion was ' + (p2 > p1 ? 'higher' : 'lower') + ' in ' + y2 + '. The conclusion ' + (propTrue ? 'matches, so it follows.' : 'says the opposite, so it does not follow.') + (mixed ? ' Notice the number and the proportion moved in opposite directions. That is exactly the trap: always check which one the conclusion is about.' : '') });
      // Number direction.
      const sayMore = rnd() < 0.5;
      const numTrue = sayMore === (S2 > S1);
      out.push({ text: 'There were ' + (sayMore ? 'more' : 'fewer') + ' ' + ctx.sub + ' in ' + y2 + ' than in ' + y1 + '.',
        a: numTrue ? 'follows' : 'not', p: 'int-num', meta: { group: 'sub' },
        why: 'Compare the actual numbers: ' + S1 + ' in ' + y1 + ' and ' + S2 + ' in ' + y2 + '. That is ' + (S2 > S1 ? 'more' : 'fewer') + ' in ' + y2 + ', so the conclusion ' + (numTrue ? 'follows.' : 'does not follow.') + (mixed ? ' Careful: the proportion went the other way (' + p1 + '% to ' + p2 + '%). The number and the share are different things.' : '') });
      // The other group.
      const O1 = N1 - S1, O2 = N2 - S2;
      const sayMoreO = rnd() < 0.5;
      const oTrue = sayMoreO === (O2 > O1);
      out.push({ text: 'There were ' + (sayMoreO ? 'more' : 'fewer') + ' ' + ctx.other + ' in ' + y2 + ' than in ' + y1 + '.',
        a: oTrue ? 'follows' : 'not', p: 'int-num', meta: { group: 'other' },
        why: 'The passage does not state this directly, but you can work it out: ' + y1 + ': ' + N1 + ' − ' + S1 + ' = ' + O1 + '. ' + y2 + ': ' + N2 + ' − ' + S2 + ' = ' + O2 + '. That is ' + (O2 > O1 ? 'more' : 'fewer') + ' in ' + y2 + ', so the conclusion ' + (oTrue ? 'follows.' : 'does not follow.') });
      // Percentage claim.
      const yr = rnd() < 0.5 ? 1 : 2;
      const real = yr === 1 ? p1 : p2;
      const shown = rnd() < 0.5 ? real : (rnd() < 0.5 ? 100 - real : real + pick([-10, -5, 5, 10]));
      if (shown > 0 && shown < 100) {
        const S = yr === 1 ? S1 : S2, N = yr === 1 ? N1 : N2;
        out.push({ text: 'In ' + (yr === 1 ? y1 : y2) + ', ' + shown + '% ' + ctx.share + '.',
          a: shown === real ? 'follows' : 'not', p: 'int-pct',
          why: S + ' out of ' + N + ' = ' + S + ' ÷ ' + N + ' × 100 = ' + real + '%. ' + (shown === real ? 'That matches, so it follows.' : 'The conclusion says ' + shown + '%, so it does not follow.' + (shown === 100 - real ? ' (' + shown + '% is the share of the other group, a common slip.)' : '')) });
      }
      out.push({ text: 'The change between ' + y1 + ' and ' + y2 + ' was caused by ' + fill(ctx.cause, v) + '.', a: 'not', p: 'int-cause',
        why: 'The passage gives figures only. It never says why they changed. Any cause, however plausible, is your own guess, so it does not follow beyond reasonable doubt.' });
      out.push({ text: fill(ctx.predict, { dirVerb: p2 > p1 ? 'rise' : 'fall', y3: y2 + 1 }), a: 'not', p: 'int-predict',
        why: 'The passage only covers ' + y1 + ' and ' + y2 + '. A trend over two years does not guarantee what happens next. Predictions about the future do not follow.' });
      out.push({ text: fill(ctx.wider, v), a: 'not', p: 'int-scope',
        why: 'The passage gives figures for one organisation only. It tells you nothing about the wider picture, so this does not follow.' });
      const fol = shuffle(out.filter(o => o.a === 'follows')), nof = shuffle(out.filter(o => o.a === 'not'));
      if (!fol.length || nof.length < 2) continue;
      // Always include the proportion/number pair when they diverge.
      let chosen = [out[0], out[1]];
      const rest = shuffle(out.slice(2));
      while (chosen.length < 4 && rest.length) chosen.push(rest.pop());
      if (!chosen.some(o => o.a === 'follows') || !chosen.some(o => o.a === 'not')) continue;
      chosen = shuffle(chosen);
      return { section: 'interpretation', passage, items: chosen.map(o => interpItem(passage, o)) };
    }
    throw new Error('could not build trend interpretation');
  }
  function interpItem(passage, o) {
    return item('interpretation', { passage, statement: o.text, answer: o.a, pattern: o.p, meta: o.meta, expl: { plain: o.why, rule: INT_RULE } });
  }

  function fmtM(x) { return Number.isInteger(x) ? String(x) : x.toFixed(1); }
  const fmtN = x => x.toLocaleString('en-GB');
  function genChange(ctx) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const a = pick([4, 5, 6, 8, 10, 12, 15, 16, 20, 24, 25, 30, 40]);
      const rise = rnd() < 0.7;
      const pct = rise ? pick([10, 20, 25, 30, 40, 50, 60, 75, 80, 100, 120, 150]) : pick([10, 20, 25, 30, 40, 50, 60]);
      const b10 = a * (rise ? 100 + pct : 100 - pct) / 10; // b in tenths of a unit
      if (!Number.isInteger(b10)) continue;
      const b = b10 / 10, d = Math.abs(b - a);
      const sc = ctx.money ? 1 : ctx.scale;
      if (!ctx.money && !Number.isInteger(b * sc)) continue;
      // Shown figures: £ millions to one decimal, or whole numbers.
      const show = x => (ctx.money ? '£' + fmtM(x) + 'm' : fmtN(Math.round(x * sc)));
      const showRaw = x => (ctx.money ? fmtM(x) : fmtN(Math.round(x * sc)));
      const y1 = ri(2018, 2024), y2 = y1 + 1;
      const v = Object.assign(baseVars(), { area: ctx.areas ? pick(ctx.areas) : '', a: showRaw(a), b: showRaw(b), y1, y2, dirVerb: rise ? 'rose' : 'fell' });
      const passage = fill(ctx.setup, v);
      const subj = fill(ctx.subj, v);
      const calc = 'Change = ' + show(b) + ' − ' + show(a) + ' = ' + (rise ? '' : '−') + show(d) + '. Percentage change is always measured from the starting figure: ' + showRaw(d) + ' ÷ ' + showRaw(a) + ' × 100 = ' + pct + '%.';
      const out = [];
      const word = rise ? 'rose' : 'fell';
      const period = ' between ' + y1 + ' and ' + y2 + '.';
      const t = pick([10, 20, 25, 30, 40, 50, 60, 75, 100].filter(x => x !== pct));
      out.push({ text: subj + ' ' + word + ' by more than ' + t + '%' + period, a: pct > t ? 'follows' : 'not', p: 'int-pct',
        why: calc + ' Is ' + pct + '% more than ' + t + '%? ' + (pct > t ? 'Yes, so it follows.' : 'No, so it does not follow.') });
      out.push({ text: subj + ' ' + word + ' by ' + pct + '%' + period, a: 'follows', p: 'int-pct', why: calc + ' So it follows.' });
      const wrongPctNum = d * 100 / b;
      if (Number.isInteger(wrongPctNum) && wrongPctNum !== pct && wrongPctNum > 0 && wrongPctNum < 100) {
        out.push({ text: subj + ' ' + word + ' by ' + wrongPctNum + '%' + period, a: 'not', p: 'int-pct',
          why: calc + ' The ' + wrongPctNum + '% figure comes from dividing by the END figure (' + showRaw(d) + ' ÷ ' + showRaw(b) + '), which is the classic slip. It does not follow.' });
      }
      if (rise) {
        out.push({ text: subj + ' ' + (pct === 100 ? 'exactly doubled' : 'more than doubled') + period,
          a: pct >= 100 ? 'follows' : 'not', p: 'int-pct',
          why: 'Doubling means a 100% rise (the new figure is twice the old one: 2 × ' + show(a) + ' = ' + show(2 * a) + '). The actual figure is ' + show(b) + ', a ' + pct + '% rise. ' + (pct === 100 ? 'That is exactly double, so it follows.' : pct > 100 ? 'That is more than double, so it follows.' : 'That is less than double, so it does not follow.') });
      }
      out.push({ text: fill(ctx.gap, v), a: 'not', p: 'int-gap', why: fill(ctx.gapWhy, v) + ' It does not follow.' });
      out.push({ text: 'The ' + (rise ? 'rise' : 'fall') + ' was caused by ' + fill(rise ? ctx.cause.rise : ctx.cause.fall, v) + '.', a: 'not', p: 'int-cause',
        why: 'The passage gives the figures but no reasons. Any cause is a guess, so it does not follow beyond reasonable doubt.' });
      const fol = out.filter(o => o.a === 'follows'), nof = out.filter(o => o.a === 'not');
      if (!fol.length || !nof.length) continue;
      const f0 = pick(fol), n0 = pick(nof);
      const chosen = shuffle([f0, n0].concat(shuffle(out.filter(o => o !== f0 && o !== n0)).slice(0, 2)));
      return { section: 'interpretation', passage, items: chosen.map(o => interpItem(passage, o)) };
    }
    throw new Error('could not build change interpretation');
  }

  const FRACS = [{ n: 1, d: 4, w: 'a quarter' }, { n: 1, d: 3, w: 'a third' }, { n: 1, d: 2, w: 'half' }, { n: 2, d: 3, w: 'two-thirds' }, { n: 3, d: 4, w: 'three-quarters' }];
  function genSurvey(ctx) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const n = ri(2, 10) * 100, p = ri(20, 90);
      const k = n * p / 100;
      if (2 * k === n) continue;
      const v = Object.assign(baseVars(), { n, k });
      const passage = fill(ctx.setup, v);
      const said = fill(ctx.said, v);
      const out = [];
      out.push({ text: 'Most of the people surveyed ' + said + '.', a: 2 * k > n ? 'follows' : 'not', p: 'int-pct',
        why: '"Most" means more than half. ' + k + ' out of ' + n + ' is ' + p + '%, which is ' + (2 * k > n ? 'more than half, so it follows.' : 'not more than half, so it does not follow.') });
      const fr = pick(FRACS.filter(f => k * f.d !== n * f.n));
      const more = k * fr.d > n * fr.n;
      out.push({ text: 'More than ' + fr.w + ' of the people surveyed ' + said + '.', a: more ? 'follows' : 'not', p: 'int-pct',
        why: fr.w.charAt(0).toUpperCase() + fr.w.slice(1) + ' of ' + n + ' is ' + (n * fr.n / fr.d).toFixed(Number.isInteger(n * fr.n / fr.d) ? 0 : 1) + '. ' + k + ' people said so, which is ' + (more ? 'more' : 'not more') + ', so it ' + (more ? 'follows.' : 'does not follow.') });
      const shown = rnd() < 0.5 ? p : (rnd() < 0.5 ? 100 - p : Math.min(99, Math.max(1, p + pick([-10, -5, 5, 10]))));
      {
        out.push({ text: shown + '% of the people surveyed ' + said + '.', a: shown === p ? 'follows' : 'not', p: 'int-pct',
          why: k + ' ÷ ' + n + ' × 100 = ' + p + '%. ' + (shown === p ? 'That matches, so it follows.' : 'The conclusion says ' + shown + '%, so it does not follow.' + (shown === 100 - p ? ' (' + shown + '% is the share who did NOT say this.)' : '')) });
      }
      out.push({ text: 'At least one of the people surveyed ' + fill(ctx.notSaid, v) + '.', a: 'follows', p: 'int-restate',
        why: 'Only ' + k + ' of the ' + n + ' people surveyed said this, so ' + (n - k) + ' did not. It follows.' });
      out.push({ text: fill(ctx.general, v), a: 'not', p: 'int-sample',
        why: 'The survey only tells you about the ' + n + ' people who were asked, and only what they said. You do not know how they were chosen or whether they are typical of everyone else, so a claim about the whole group does not follow beyond reasonable doubt.' });
      const fol = shuffle(out.filter(o => o.a === 'follows')), nof = shuffle(out.filter(o => o.a === 'not'));
      if (!fol.length || !nof.length) continue;
      const chosen = shuffle([fol[0], nof[0]].concat(shuffle(out.filter(o => o !== fol[0] && o !== nof[0])).slice(0, ri(1, 2))));
      return { section: 'interpretation', passage, items: chosen.map(o => interpItem(passage, o)) };
    }
    throw new Error('could not build survey interpretation');
  }
  function pickQual(passage, statements, v) {
    const fol = shuffle(statements.filter(x => x.a === 'follows')), nof = shuffle(statements.filter(x => x.a === 'not'));
    const chosen = shuffle([fol[0], nof[0]].concat(shuffle(statements.filter(x => x !== fol[0] && x !== nof[0])).slice(0, ri(1, 2))));
    return { section: 'interpretation', passage, items: chosen.map(x => interpItem(passage, { text: fill(x.text, v), a: x.a, p: 'int-' + x.p, why: fill(x.why, v) })) };
  }
  function genInterpQual(t) {
    const v = Object.assign(baseVars(), t.vars(helpers));
    return pickQual(fill(t.passage, v), t.statements, v);
  }
  function genCorr(x) {
    const v = Object.assign(baseVars(), x, { n: fmtN(ri(2, 20) * 100) });
    const passage = fill('A study of {n} {subj} in {city} found that, on average, those ' + x.rel + ' {did} {better} than those ' + x.rel + ' {didnt}.', v);
    return pickQual(passage, [
      { a: 'follows', p: 'flip', text: 'On average, the {subj} in the study ' + x.rel + ' {didnt} {worse} than those ' + x.rel + ' {did}.',
        why: 'This is the same comparison seen from the other side. If one group was better on average, the other was worse on average. It follows.' },
      { a: 'follows', p: 'exists', text: 'At least one of the {subj} in the study {did}.',
        why: 'The study compared those ' + x.rel + ' {did} with those ' + x.rel + ' {didnt}. You cannot compare a group with nobody in it, so at least one must have. It follows.' },
      { a: 'not', p: 'corr', text: '{cause}',
        why: 'The study shows a link, not a cause. Something else could explain both, or it could work the other way round. A link alone does not prove beyond reasonable doubt that one thing causes the other.' },
      { a: 'not', p: 'average', text: 'Every {sg} in the study ' + x.rel + ' {did} {better} than every {sg} ' + x.rel + ' {didnt}.',
        why: 'The finding is about averages. An average can be higher even when some individuals in that group did worse than some in the other. "On average" does not mean "every one".' },
      { a: 'not', p: 'scope', text: 'On average, {wider} ' + x.rel + ' {did} {better} than those ' + x.rel + ' {didnt}.',
        why: 'The study only covered {n} {subj} in {city}. Extending it to {wider} goes beyond the evidence, so it does not follow.' }
    ], v);
  }
  function genTrial(x) {
    const v = Object.assign(baseVars(), { m: ri(3, 9) });
    const X = {}; Object.keys(x).forEach(k => { X[k] = fill(x[k], v); });
    Object.assign(v, X);
    v.whereThe = v.where.replace('one of its districts', 'that district').replace(/\bits\b/, 'the');
    const passage = fill('During a trial lasting {m} months, {org} {change} {where}. Over the trial period, {outcome} {whereThe} was the same as in the same months of the previous year.', v);
    return pickQual(passage, [
      { a: 'follows', p: 'restate', text: 'The trial lasted less than a year.', why: '{m} months is less than twelve months. It follows.' },
      { a: 'follows', p: 'restate', text: 'During the trial, {outcome} {whereThe} did not rise compared with the same months of the previous year.', why: 'The figure was the same, so it did not rise. It follows.' },
      { a: 'not', p: 'scope', text: '{changeNoun} would have no effect on {outcome} at any of {orgPoss} {sites}.', why: 'The trial covered one site for {m} months. Claiming what would happen everywhere goes beyond the evidence.' },
      { a: 'not', p: 'gap', text: '{noticed}', why: 'An unchanged figure does not mean nobody noticed. People can notice a change without it affecting {outcome}. The passage does not say what anyone noticed.' },
      { a: 'not', p: 'gap', text: '{pref}', why: 'The passage gives no information about anyone\'s preferences.' }
    ], v);
  }
  function genResp(x) {
    const v = Object.assign(baseVars(), { n: ri(15, 45), k: ri(3, 12) });
    const X = {}; Object.keys(x).forEach(k => { X[k] = fill(x[k], v); });
    Object.assign(v, X);
    const passage = fill('All {n} of the {members} at {org} who responded to a survey said they supported {proposal}. A further {k} {members} did not respond.', v);
    return pickQual(passage, [
      { a: 'follows', p: 'restate', text: 'At least one of {orgPoss} {members} said they supported {proposal}.', why: '{n} of them said so, so at least one did. It follows.' },
      { a: 'follows', p: 'restate', text: '{^orgThe} had more than {n} {members} at the time of the survey.', why: '{n} responded and {k} more did not, so there were at least {n} + {k}. It follows.' },
      { a: 'not', p: 'gap', text: 'All of {orgPoss} {members} said they supported {proposal}.', why: '{k} {members} did not respond, so you do not know what they think. "All who responded" is not "all".' },
      { a: 'not', p: 'gap', text: 'The {members} who did not respond opposed {proposal}.', why: 'Not responding tells you nothing about someone\'s view. They might support it, oppose it or have no view.' }
    ], v);
  }

  /* ======================================================================
   * SCENARIO POOLS
   * Every scenario has a key. The app passes the keys you have seen recently
   * as `avoid`, and a fresh scenario is picked until the pool runs out.
   * ==================================================================== */
  const CAT_PACKS = cat(C.CAT_PACKS, BK.CAT_PACKS);
  const PROP_PACKS = cat(C.PROP_PACKS, BK.PROP_PACKS);
  let POOLS = null;
  function buildPools() {
    const P = { inference: [], assumptions: [], deduction: [], interpretation: [], arguments: [] };
    C.INFERENCE.forEach(t => P.inference.push({ key: 'inf:' + t.id, gen: () => genInference(t) }));
    (BK.INF_FRAMES || []).forEach(f => f.fills.forEach(x => P.inference.push({ key: 'inf:' + f.id + ':' + x.id, gen: () => genInference({ frame: f, fill: x }) })));
    cat(C.REC_TOPICS, BK.REC_TOPICS).forEach((t, i) => P.assumptions.push({ key: 'asm:rec:' + i, gen: () => genAssumptionRec(t) }));
    C.ASSUMPTION_ITEMS.forEach(t => P.assumptions.push({ key: 'asm:fix:' + t.id, gen: () => genAssumptionFixed(t) }));
    (BK.ASM_CAUSAL || []).forEach(t => P.assumptions.push({ key: 'asm:cau:' + t.id, gen: () => genAssumptionCausal(t) }));
    (BK.ASM_EVIDENCE || []).forEach((t, i) => P.assumptions.push({ key: 'asm:evi:' + i, gen: () => genAssumptionEvidence(t) }));
    (BK.ASM_CAPACITY || []).forEach((t, i) => P.assumptions.push({ key: 'asm:cap:' + i, gen: () => genAssumptionCapacity(t) }));
    cat(C.ARG_TOPICS, BK.ARG_TOPICS).forEach((t, i) => P.arguments.push({ key: 'arg:' + i, gen: () => genArguments(t) }));
    CAT_PACKS.forEach((pk, i) => P.deduction.push({ key: 'ded:cat:' + i, gen: o => genCategorical(o.hard && rnd() < 0.7, pk) }));
    PROP_PACKS.forEach((pk, i) => P.deduction.push({ key: 'ded:prop:' + i, gen: () => genProp(pk) }));
    cat(C.TREND_CONTEXTS, BK.TREND_CONTEXTS).forEach((t, i) => P.interpretation.push({ key: 'int:trend:' + i, gen: () => genTrend(t) }));
    (BK.CHANGE_CONTEXTS || []).forEach((t, i) => P.interpretation.push({ key: 'int:chg:' + i, gen: () => genChange(t) }));
    cat(C.SURVEY_CONTEXTS, BK.SURVEY_CONTEXTS).forEach((t, i) => P.interpretation.push({ key: 'int:sur:' + i, gen: () => genSurvey(t) }));
    C.INTERP_QUAL.forEach(t => P.interpretation.push({ key: 'int:qual:' + t.id, gen: () => genInterpQual(t) }));
    (BK.CORR || []).forEach(t => P.interpretation.push({ key: 'int:corr:' + t.id, gen: () => genCorr(t) }));
    (BK.TRIAL || []).forEach((t, i) => P.interpretation.push({ key: 'int:trial:' + i, gen: () => genTrial(t) }));
    (BK.RESPONSE || []).forEach((t, i) => P.interpretation.push({ key: 'int:resp:' + i, gen: () => genResp(t) }));
    return P;
  }
  function pools() { return POOLS || (POOLS = buildPools()); }

  /* ---------- public API ---------- */
  // opts.avoid: keys to skip (recently seen). opts.key: build one exact scenario.
  // opts.filter: only use scenarios whose key passes this test (if any do).
  function generateSet(section, opts) {
    opts = opts || {};
    const pool = pools()[section];
    let choices = pool;
    if (opts.key) choices = pool.filter(p => p.key === opts.key);
    else {
      if (opts.filter) { const f = choices.filter(p => opts.filter(p.key)); if (f.length) choices = f; }
      if (opts.avoid) { const fresh = choices.filter(p => !opts.avoid.has(p.key)); if (fresh.length) choices = fresh; }
    }
    const sc = pick(choices);
    const set = sc.gen(opts);
    set.key = sc.key;
    return set;
  }
  const poolKeys = section => pools()[section].map(p => p.key);

  root.WG = {
    OPTIONS, PATTERNS, SECTIONS, labelOf, generateSet, setSeed, poolKeys,
    INF_MEANING,
    _internal: { catAnalyse, catHolds, catProof, propAnalyse, evalF, genCategorical, genProp, genTrend, genChange, genSurvey, genInterpQual, genCorr, genTrial, genResp }
  };
})(typeof window !== 'undefined' ? window : globalThis);
