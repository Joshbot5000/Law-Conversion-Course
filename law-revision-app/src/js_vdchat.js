  /* ------------------------------------------------------------------
     U12d. ASK ABOUT THE VIDEO — a chat bar under the player.
           1. Free: searches every card in the library on this device
              (stemmed words, names and topics weighted, the video's
              own cards and the current scene boosted) and shows the
              cards that answer the question.
           2. Optional: "Explain it to me" sends ONE small request
              (quick model tier) with the question, what the tutor was
              saying, and only those cards — the answer may use nothing
              else — and can be read aloud.
     ------------------------------------------------------------------ */
  var vdChat = { q: '', hits: [], answer: '', busy: false, ctl: null };
  function vdToks(t) { return normText(t).split(' ').filter(function (w) { return w.length >= 3 && !VD_FILLER[w]; }).map(vdStem); }
  function vdSearch(q, boostIds, sceneIds) {
    var qs = vdToks(q); if (!qs.length) return [];
    var nq = ' ' + normText(q) + ' ', boost = {}, here = {};
    (boostIds || []).forEach(function (id) { boost[id] = true; }); (sceneIds || []).forEach(function (id) { here[id] = true; });
    var has = function (list, w) { for (var i = 0; i < list.length; i++) { var t = list[i]; if (t === w || (w.length >= 5 && t.indexOf(w) === 0) || (t.length >= 5 && w.indexOf(t) === 0)) return true; } return false; };
    var scored = state.entries.map(function (e) {
      var head = vdToks(e.name + ' ' + e.topic + ' ' + (e.tags || []).join(' ')), body = vdToks(e.ratio + ' ' + e.facts + ' ' + e.strategy);
      var sc = 0, hit = 0;
      qs.forEach(function (w) { var h = has(head, w), b = has(body, w); if (h || b) hit++; sc += (h ? 4 : 0) + (b ? 1 : 0); });
      var nm = normText(e.name.replace(/\s*[\[(].*$/, '')).trim();
      if (nm.length >= 6 && nq.indexOf(' ' + nm + ' ') !== -1) sc += 12;   // the question names this case or rule
      if (sc && boost[e.id]) sc *= 1.5;
      if (sc && here[e.id]) sc *= 1.3;
      return { e: e, sc: sc, hit: hit };
    }).filter(function (x) { return x.hit >= Math.ceil(qs.length / 2) && x.sc >= 2; });
    scored.sort(function (a, b) { return b.sc - a.sc; });
    var seen = {};
    return scored.filter(function (x) { var k = normText(x.e.name); if (seen[k]) return false; seen[k] = true; return true; }).slice(0, 5).map(function (x) { return x.e; });
  }
  function vdChatHTML() {
    return '<form class="vd-chat" id="vdChatForm" autocomplete="off"><input class="input" id="vdChatQ" maxlength="300" placeholder="Ask about something in this video… e.g. what makes a statement a representation?" value="' + esc(vdChat.q) + '">' +
      '<button type="submit" class="btn btn-sm">Search my cards</button></form><div class="vd-chat-out" id="vdChatOut">' + vdChatOutHTML() + '</div>';
  }
  function vdChatOutHTML() {
    if (!vdChat.q) return '';
    var h = vdChat.hits.length ? '<div class="vd-chat-lbl">From your cards <span class="muted">(free, instant)</span></div>' + vdChat.hits.map(function (e) {
      return '<div class="vd-chat-card"><b>' + esc(e.name) + '</b> <span class="muted">' + esc(MODULE_LABEL[e.module] + ' · ' + e.topic) + '</span>' + (e.ratio ? '<p>' + esc(vdClip(e.ratio, 320)) + '</p>' : '') + (e.facts ? '<p class="muted">' + esc(vdClip(e.facts, 200)) + '</p>' : '') + '</div>';
    }).join('') : '<div class="vd-chat-lbl">None of your cards match those words. Try different words, or ask the tutor below.</div>';
    h += vdChat.answer ? '<div class="vd-chat-ans"><div class="vd-chat-lbl">Your tutor</div><p>' + esc(vdChat.answer).replace(/\n+/g, '</p><p>') + '</p>' + (vd.tts ? '<button type="button" class="btn btn-sm" data-vd="chatsay">🔊 Read it out</button>' : '') + '</div>'
      : vdChat.busy ? '<p class="muted"><span class="spinner"></span>Thinking it through…</p>'
      : (claudeCaps.sample ? '<button type="button" class="btn btn-sm btn-primary" data-vd="chatask">✦ Explain it to me</button> <span class="muted vd-chat-note">One small request, using only your cards and what the video just said.</span>' : '');
    return h;
  }
  function vdChatRender() { var o = $('#vdChatOut'); if (o) o.innerHTML = vdChatOutHTML(); }
  function vdChatSearch(q) {
    vdChat.q = String(q || '').trim(); vdChat.answer = ''; vdChat.busy = false; if (vdChat.ctl) vdChat.ctl.abort();
    if (vd.playing && !vd.paused) vdPause();
    var sc = vd.cur && vd.cur.scenes[vd.scene];
    vdChat.hits = vdChat.q ? vdSearch(vdChat.q, vd.cur ? vd.cur.cardIds : [], sc ? sc.cards : []) : [];
    vdChatRender();
  }
  function vdChatPrompt() {
    var v = vd.cur, sc = v && v.scenes[vd.scene], ids = {}, cards = [];
    vdChat.hits.concat(state.entries.filter(function (e) { return sc && sc.cards.indexOf(e.id) !== -1; })).forEach(function (e) { if (!ids[e.id] && cards.length < 8) { ids[e.id] = 1; cards.push(e); } });
    return [
      'VIDEO TUTOR QUESTION',
      'You are the student\'s law tutor: an expert who explains simply and warmly (ELI5), like a teacher sitting beside them. They are watching your explainer video "' + (v ? v.title : '') + '" and paused to ask a question.',
      sc ? 'What you were just saying: "' + vdClip(sc.narration, 900) + '"' : '',
      'Their question: "' + vdChat.q + '"',
      'Answer it directly and clearly in at most 150 words, plain text, UK spelling. Use ONLY the cards below for the law and mention by name the cards you rely on. Use an everyday analogy if it helps. If the cards do not answer the question, say so honestly and point to the closest card. Never invent a case, section or rule.',
      '', 'CARDS:',
      cards.map(function (e) { return '- ' + e.name + (e.citation ? ' (' + e.citation + ')' : '') + ' [' + e.topic + ']: ' + vdClip(e.ratio, 500) + (e.facts ? ' Facts: ' + vdClip(e.facts, 300) : '') + (e.strategy ? ' Exam: ' + vdClip(e.strategy, 160) : ''); }).join('\n') || '(none matched)'
    ].filter(Boolean).join('\n');
  }
  function vdChatAsk() {
    if (!claudeCaps.sample || vdChat.busy || !vdChat.q) return;
    vdChat.busy = true; vdChat.ctl = new AbortController(); vdChatRender();
    claudeCaps.sample(vdChatPrompt(), { modelTier: 'quick', signal: vdChat.ctl.signal }).then(function (r) {
      vdChat.busy = false; vdChat.answer = String((r && r.text) || '').trim() || 'Sorry, I couldn\'t answer that just now.'; vdChatRender();
    }, function (err) {
      vdChat.busy = false; if (err && err.code === 'cancelled') return;
      vdChat.answer = ''; vdChatRender(); toast(sampleErrorText(err), { type: 'error' });
    });
  }
  function vdChatSay() { if (vd.tts && vdChat.answer) vd.tts.speak([{ text: vdChat.answer.slice(0, 1800), voice: vd.voice }], { rate: vd.rate, voice: vd.voice }).then(null, function () {}); }
