/*
 * coach.js: what the app can judge without AI.
 *
 * - metrics(): delivery numbers measured from your transcript and timings.
 * - probe(): a follow-up question chosen from your own answer, used when no AI
 *   key is set or the AI is unreachable mid-interview (the interview never stalls).
 * - grade(): an estimated score from observable features (structure words,
 *   numbers, "I" versus "we", stated results and lessons, pace, fillers). It
 *   cannot judge accuracy or insight; those criteria are left for your own
 *   self-check against the marking guide.
 */
(function (g) {
  'use strict';
  const IT = g.IT = g.IT || {};

  const FILLERS = [
    ['um', /\b(?:u+m+|e+r+m+)\b/gi], ['uh', /\b(?:u+h+|e+r+|a+h+)\b/gi], ['like', /\blike\b(?!\s+(?:to|a|the|this|that|it|when|how|what|i|we|you|they|he|she))/gi],
    ['you know', /\byou know\b(?!\s+(?:that|what|how|why|when|where|the|a))/gi], ['sort of', /\bsort of\b/gi], ['kind of', /\bkind of\b/gi],
    ['basically', /\bbasically\b/gi], ['literally', /\bliterally\b/gi], ['I mean', /\bi mean\b/gi], ['actually', /\bactually\b/gi]
  ];
  const HEDGES = /\b(?:i think|i guess|i suppose|maybe|perhaps|probably|i feel like|kind of|sort of|i\'m not sure|hopefully)\b/gi;

  const count = (text, re) => (String(text).match(re) || []).length;
  const words = text => (String(text).trim().match(/[A-Za-z0-9£$%'’.-]+/g) || []).length;

  function metrics(text, seconds, limit) {
    const t = String(text || '');
    const w = words(t);
    const secs = Math.max(1, Number(seconds) || 0);
    const fillers = {};
    let fillerCount = 0;
    FILLERS.forEach(([k, re]) => { const n = count(t, re); if (n) { fillers[k] = n; fillerCount += n; } });
    const iCount = count(t, /\b(?:i|i'm|i’ve|i've|i'd|me|my|myself)\b/gi);
    const weCount = count(t, /\b(?:we|we're|we've|our|us)\b/gi);
    return {
      words: w,
      seconds: Math.round(secs),
      limit: limit || null,
      wpm: Math.round(w / (secs / 60)),
      fillers, fillerCount,
      fillersPerMin: +(fillerCount / (secs / 60)).toFixed(1),
      hedges: count(t, HEDGES),
      iCount, weCount,
      numbers: count(t, /\b\d[\d,.]*\s*(?:%|per ?cent|percent|k|m|bn|million|billion|thousand|people|hours|weeks|months|years)?/gi) + count(t, /[£$€]\s?\d/g),
      structure: count(t, /\b(?:first(?:ly)?|second(?:ly)?|third(?:ly)?|finally|to start|the situation|my task|my role|as a result|the result|the outcome|in summary|to summarise|overall|three (?:things|reasons|points)|two (?:things|reasons|points))\b/gi),
      result: count(t, /\b(?:as a result|result(?:ed)?|outcome|achiev(?:ed|ing)|increas(?:ed|ing)|reduc(?:ed|ing)|improv(?:ed|ing)|saved|won|deliver(?:ed)|succeeded|which meant|led to|by \d)/gi),
      reflection: count(t, /\b(?:i learn(?:ed|t)|taught me|lesson|next time|in hindsight|looking back|i would (?:now|do)|differently|i realised|i now|since then)\b/gi),
      causal: count(t, /\b(?:because|which means|which meant|meaning that|as a result|therefore|so that|this means|that means|consequently|leading to|which would|knock-on)\b/gi),
      client: count(t, /\bclients?\b|\bcustomers?\b|\bbusiness(?:es)?\b|\bcompan(?:y|ies)\b/gi),
      bd: count(t, /\bbusiness development\b|\bpitch(?:ing)?\b|\bcross-?sell|\bnew work\b|\binstruct(?:ion|ed)?s?\b|\bpractice (?:area|group)s?\b|\brevenue\b|\bfees?\b|\bwin (?:work|clients)\b|\bclient relationships?\b/gi)
    };
  }

  /* The topic a commercial answer is about: the earliest known topic in the text (longer match wins a tie). */
  function findTopic(text) {
    const t = ' ' + String(text || '').toLowerCase() + ' ';
    let best = null;
    for (const [k, label] of IT.TOPICS) {
      const at = t.indexOf(k);
      if (at >= 0 && (!best || at < best.at || (at === best.at && k.length > best.k.length))) best = { at, k, label };
    }
    if (best) return best.label;
    const caps = String(text || '').match(/(?:^|[^.!?]\s)([A-Z][a-zA-Z&]+(?:\s[A-Z][a-zA-Z&]+){0,2})/g);
    if (caps) {
      const pick = caps.map(s => s.trim().replace(/^[^A-Z]+/, '')).find(s => !/^(I|The|A|An|In|At|On|My|We|It|This|That|So|And|But|When|Then)$/.test(s.split(' ')[0]));
      if (pick) return pick;
    }
    return 'that';
  }

  /* The word that shows a candidate named the firm: "Mishcon", "Baker", "Kirkland". */
  function firmKey(name) {
    const w = String(name || '').replace(/^A\s+/, '').split(/\s+/)[0] || '';
    if (!w || /^city$/i.test(w)) return '';
    return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* "Mishcon de Reya's", "Linklaters'", "CMS's". */
  const possessive = name => /[a-z]s$/.test(name) ? name + '\'' : name + '\'s';
  const fill = (s, firm, topic) => String(s).replace(/\{firm\}'s/g, possessive(firm)).replace(/\{firm\}/g, firm).replace(/\{topic\}/g, topic);

  /* Pick an offline follow-up. thread = { sub, cat, turns: [{q, transcript}] } */
  function probe(thread, firmName, rng, askedBefore) {
    const r = rng || Math.random;
    const sub = IT.SUBS[thread.sub] || {};
    const asked = new Set(thread.turns.map(t => t.q.toLowerCase()).concat((askedBefore || []).map(q => String(q).toLowerCase())));
    const last = thread.turns[thread.turns.length - 1] || {};
    const m = metrics(last.transcript || '', 60);
    const topic = findTopic(last.transcript);
    const firm = firmName || 'the firm';
    const depth = thread.turns.length - 1;
    const cands = [];
    if (m.words < 45) {
      const brief = { commercial: 'That was quite brief. Tell me more: why does that matter, and to whom?', firm: 'Could you expand on that, with specific examples?', motivation: 'Could you expand on that? What is your evidence?', ethics: 'Take me through exactly what you would do, step by step.', case: 'Take me through your thinking in more detail.' };
      cands.push(brief[thread.cat] || 'That was quite brief. Take me through it in more detail: what exactly did you do?');
    }
    if (thread.cat === 'commercial') {
      const chain = [
        'How is ' + (topic === 'that' ? 'that' : topic) + ' likely to affect a client of ' + firm + '?',
        'What would that mean for ' + possessive(firm) + ' business development?',
        'Which practice areas would be busiest as a result, and why?',
        'What is the strongest argument against your view?'
      ];
      // Walk the chain from this depth onwards; earlier questions may already have used some links.
      chain.slice(Math.min(depth, chain.length - 1)).forEach(c => cands.push(c));
    }
    if (['competency', 'strengths'].includes(thread.cat)) {
      if (m.weCount > m.iCount) cands.push('You said "we" quite a lot. What did you personally do?');
      if (!m.result) cands.push('What was the outcome, and how did you measure it?');
      if (!m.reflection) cands.push('What did you learn from that, and what would you do differently?');
      if (!m.numbers) cands.push('Can you give me something concrete: a number, a date or a measurable result?');
    }
    const key = firmKey(firmName);
    if (thread.cat === 'firm' && key && !new RegExp('\\b' + key, 'i').test(last.transcript || '')) cands.push('Most of that could apply to any firm. What is specific to ' + firm + '?');
    const pool = (thread.script || []).concat(cands, shuffle((sub.probes || []).map(p => fill(p, firm, topic)), r));
    for (const p of pool) { if (!asked.has(p.toLowerCase())) return p; }
    return 'Is there anything you would add to that answer?';
  }

  function shuffle(a, r) {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    return b;
  }

  const clamp = n => Math.max(1, Math.min(5, Math.round(n)));

  /* Estimated scores. Criteria the app cannot judge are returned with score null. */
  function grade(thread, firmName) {
    const text = thread.turns.map(t => t.transcript || '').join(' ');
    const secs = thread.turns.reduce((a, t) => a + (t.durationSec || 0), 0) || 60;
    const m = metrics(text, secs);
    const main = thread.turns[0] || {};
    const mm = metrics(main.transcript || '', main.durationSec || 60, main.limit);
    const crit = IT.RUBRICS[thread.cat] || IT.RUBRICS.competency;
    const lengthScore = mm.words < 40 ? 1 : mm.words < 90 ? 2 : mm.words < 160 ? 3 : mm.words <= 420 ? 4 : 3;
    const delivery = () => {
      let s = 4;
      if (m.wpm < 95 || m.wpm > 190) s--;
      if (m.fillersPerMin > 6) s -= 2; else if (m.fillersPerMin > 3) s--;
      if (m.hedges > 4) s--;
      if (mm.words < 40) s--;
      return clamp(s);
    };
    const firstWord = firmKey(firmName);
    const est = {
      'Structure': () => clamp(2 + Math.min(2, mm.structure) + (mm.result ? 0.5 : 0) + (mm.reflection ? 0.5 : 0) - (mm.words < 60 ? 1 : 0)),
      'Specific evidence': () => clamp(1.5 + Math.min(2, m.numbers) + (lengthScore >= 3 ? 1 : 0)),
      'Evidence from your own experience': () => clamp(1.5 + (m.iCount > 3 ? 1.5 : 0.5) + Math.min(1.5, m.numbers * 0.5) + (lengthScore >= 3 ? 0.5 : 0)),
      'Personal ownership': () => clamp(m.iCount === 0 ? 1 : m.weCount > m.iCount ? 2 : m.weCount * 2 > m.iCount ? 3 : 4),
      'Result and reflection': () => clamp(1 + Math.min(2, m.result) + Math.min(2, m.reflection)),
      'Delivery': delivery,
      'Depth of analysis': () => clamp(1.5 + Math.min(2.5, m.causal * 0.6) + (lengthScore >= 3 ? 0.5 : 0)),
      'Client impact': () => clamp(1 + Math.min(3, m.client * 0.6) + (m.causal ? 0.5 : 0)),
      'Law firm and business development insight': () => clamp(1 + Math.min(3, m.bd) + (firstWord && new RegExp('\\b' + firstWord, 'i').test(text) ? 0.5 : 0)),
      'Firm-specific research': () => clamp(firstWord && new RegExp('\\b' + firstWord, 'i').test(text) ? 2.5 + Math.min(1.5, m.numbers * 0.5) : 1.5)
    };
    const scores = crit.map(c => {
      const f = est[c];
      return f ? { criterion: c, score: f(), evidence: 'Estimated from your transcript without AI.' } : { criterion: c, score: null, evidence: 'Needs judgement: rate yourself against the guide below, or add an API key for AI marking.' };
    });
    const nums = scores.filter(s => s.score).map(s => s.score);
    const overall = nums.length ? clamp(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
    const tips = [];
    if (mm.words < 90) tips.push('Your main answer was short (' + mm.words + ' words). Aim for 180-300 words in two minutes.');
    if (m.weCount > m.iCount) tips.push('You used "we" more than "I". Assessors score your contribution, not your team\'s.');
    if (!m.result && ['competency', 'strengths'].includes(thread.cat)) tips.push('No clear result: end with what happened, ideally with a number.');
    if (!m.reflection && ['competency'].includes(thread.cat)) tips.push('No reflection: say what you learned and what you now do differently.');
    if (thread.cat === 'commercial' && !m.client) tips.push('You did not say who the story affects. Name a type of client and the effect on its business.');
    if (thread.cat === 'commercial' && !m.bd) tips.push('No law firm angle: which practice areas get work, and how would the firm win it?');
    if (m.fillersPerMin > 3) tips.push('About ' + m.fillersPerMin + ' filler words a minute. Pause silently instead.');
    if (m.wpm > 180) tips.push('Fast pace (' + m.wpm + ' words a minute). Slow to about 140-160.');
    if (m.wpm && m.wpm < 100 && mm.words > 30) tips.push('Slow pace (' + m.wpm + ' words a minute) or long pauses. Signpost your structure to keep momentum.');
    const verdicts = ['Reject', 'Reject', 'Borderline', 'Progress', 'Strong', 'Exceptional'];
    return {
      source: 'offline', overall, verdict: overall ? verdicts[overall] : 'Self-assess',
      headline: overall ? 'Estimated ' + overall + '/5 from observable features. Accuracy and insight need AI or your own judgement.' : 'Rate yourself against the guide.',
      scores, strengths: [], weaknesses: tips, turn_notes: [], model_answer: (IT.SUBS[thread.sub] || {}).shape || '', rewrite: '', fact_check: [], drill: tips[0] || 'Practise this question again with a timer.'
    };
  }

  IT.coach = { metrics, probe, grade, findTopic, fill, possessive };
})(typeof window !== 'undefined' ? window : globalThis);
