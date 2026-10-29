  /* ------------------------------------------------------------------
     U4. RICH TEXT ON CARDS — Word-style formatting for the three card
         fields (bold, italic, underline, strikethrough, highlighter and
         text colours, bullet and numbered lists).
         The plain text stays in e.facts / e.ratio / e.strategy, so search,
         Ask, quizzes and checks work exactly as before; the formatted
         version is kept beside it in e.fmt and only shown while it still
         matches the plain text.
     ------------------------------------------------------------------ */
  var RT_FIELDS = ['facts', 'ratio', 'strategy'];
  var RT_HL = [
    { id: 'yellow', label: 'Yellow', hex: '#fff176' },
    { id: 'green', label: 'Green', hex: '#a6e7a0' },
    { id: 'blue', label: 'Blue', hex: '#9fd3ff' },
    { id: 'pink', label: 'Pink', hex: '#ffb3d9' },
    { id: 'orange', label: 'Orange', hex: '#ffcc80' },
    { id: 'purple', label: 'Purple', hex: '#d7bdff' }
  ];
  var RT_TC = [
    { id: 'red', label: 'Red', hex: '#d0312d' },
    { id: 'blue', label: 'Blue', hex: '#2f6fd6' },
    { id: 'green', label: 'Green', hex: '#2e8b3e' },
    { id: 'purple', label: 'Purple', hex: '#8e44ad' },
    { id: 'orange', label: 'Orange', hex: '#d9730d' }
  ];
  var RT_INLINE = { B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u', INS: 'u', S: 's', STRIKE: 's', DEL: 's' };
  var RT_BLOCK = { DIV: 'div', P: 'div', H1: 'div', H2: 'div', H3: 'div', H4: 'div', H5: 'div', H6: 'div', BLOCKQUOTE: 'div', UL: 'ul', OL: 'ol', LI: 'li' };
  var rtHl = 'yellow', rtTc = 'red', rtActive = null;

  function rtParseColor(v) {
    v = String(v || '').trim().toLowerCase();
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
    if (m) {
      var h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
    }
    m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v);
    if (m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : /%$/.test(m[4]) ? parseFloat(m[4]) / 100 : +m[4]];
    var named = { yellow: '#ffff00', lime: '#00ff00', green: '#008000', aqua: '#00ffff', cyan: '#00ffff', blue: '#0000ff', red: '#ff0000', fuchsia: '#ff00ff', magenta: '#ff00ff', pink: '#ffc0cb', orange: '#ffa500', purple: '#800080', darkred: '#8b0000', darkblue: '#00008b', darkgreen: '#006400', teal: '#008080', navy: '#000080' };
    return named[v] ? rtParseColor(named[v]) : null;
  }
  function rtNearest(rgb, list) {
    var best = null, bd = Infinity;
    list.forEach(function (c) {
      var p = rtParseColor(c.hex), d = Math.pow(p[0] - rgb[0], 2) + Math.pow(p[1] - rgb[1], 2) + Math.pow(p[2] - rgb[2], 2);
      if (d < bd) { bd = d; best = c.id; }
    });
    return best;
  }
  // A highlight colour from a CSS value: none for transparent or white, else the closest highlighter pen.
  function rtHlFrom(v) {
    var c = rtParseColor(v);
    if (!c || c[3] < 0.2 || (c[0] > 235 && c[1] > 235 && c[2] > 235)) return null;
    return rtNearest(c, RT_HL);
  }
  // A text colour: none for black, white and greys (ordinary text), else the closest pen colour.
  function rtTcFrom(v) {
    var c = rtParseColor(v);
    if (!c || c[3] < 0.2 || Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) < 50) return null;
    return rtNearest(c, RT_TC);
  }
  function rtPick(list, id) { return list.filter(function (c) { return c.id === id; })[0]; }

  // Keep only simple formatting with palette classes, so stored formatting can never run code.
  function cleanCardHTML(html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = String(html || '').slice(0, 120000);
    var out = document.createElement('div');
    (function walk(src, dst) {
      Array.prototype.forEach.call(src.childNodes, function (n) {
        if (n.nodeType === 3) { dst.appendChild(document.createTextNode(n.nodeValue)); return; }
        if (n.nodeType !== 1 || NOTE_DROP[n.tagName]) return;
        if (n.tagName === 'BR') { dst.appendChild(document.createElement('br')); return; }
        var base = dst, tag = RT_BLOCK[n.tagName] || RT_INLINE[n.tagName];
        if (tag) { base = document.createElement(tag); dst.appendChild(base); }
        var st = n.style || {}, cls = n.classList || { contains: function () { return false; } };
        var wraps = [];
        var hl = rtHlFrom(st.backgroundColor);
        if (!hl && n.tagName === 'MARK') hl = RT_HL.filter(function (c) { return cls.contains('hl-' + c.id); }).map(function (c) { return c.id; })[0] || (st.backgroundColor ? null : 'yellow');
        if (hl) wraps.push(['mark', 'hl-' + hl]);
        var tc = rtTcFrom(st.color || (n.tagName === 'FONT' ? n.getAttribute('color') : ''));
        if (!tc && n.tagName === 'SPAN') tc = RT_TC.filter(function (c) { return cls.contains('tc-' + c.id); }).map(function (c) { return c.id; })[0] || null;
        if (tc) wraps.push(['span', 'tc-' + tc]);
        if (tag !== 'b' && (st.fontWeight === 'bold' || +st.fontWeight >= 600)) wraps.push(['b']);
        if (tag !== 'i' && st.fontStyle === 'italic') wraps.push(['i']);
        var deco = (st.textDecorationLine || st.textDecoration || '');
        if (tag !== 'u' && /underline/.test(deco)) wraps.push(['u']);
        if (tag !== 's' && /line-through/.test(deco)) wraps.push(['s']);
        wraps.forEach(function (w) { var el = document.createElement(w[0]); if (w[1]) el.className = w[1]; base.appendChild(el); base = el; });
        walk(n, base);
      });
    })(tpl.content, out);
    // Drop formatting wrappers left empty by editing.
    Array.prototype.slice.call(out.querySelectorAll('b,i,u,s,mark,span')).reverse().forEach(function (el) { if (!el.firstChild) el.remove(); });
    return out.innerHTML;
  }
  // The plain text version of formatted card text: line breaks for lines, bullets and numbers kept.
  function richToText(html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = String(html || '');
    var out = '';
    function nl() { if (out && out.charAt(out.length - 1) !== '\n') out += '\n'; }
    (function walk(node) {
      Array.prototype.forEach.call(node.childNodes, function (n) {
        if (n.nodeType === 3) { out += n.nodeValue; return; }
        if (n.nodeType !== 1) return;
        var t = n.tagName;
        if (t === 'BR') { out += '\n'; return; }
        if (t === 'DIV' || t === 'UL' || t === 'OL') { nl(); walk(n); nl(); return; }
        if (t === 'LI') {
          nl();
          var p = n.parentNode, k = 1;
          if (p && p.tagName === 'OL') { for (var s = n.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === 'LI') k++; out += k + '. '; }
          else out += '• ';
          walk(n); nl(); return;
        }
        walk(n);
      });
    })(tpl.content);
    return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function rtHasFormatting(html) { return /<(b|i|u|s|mark|span|ul|ol)\b/i.test(html || ''); }
  function rtNorm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  // Stored formatting for an entry, kept only where it adds something.
  function sanitizeFmt(raw, entry) {
    if (!raw || typeof raw !== 'object') return null;
    var out = null;
    RT_FIELDS.forEach(function (k) {
      if (typeof raw[k] !== 'string' || !raw[k] || !entry[k]) return;
      var h = cleanCardHTML(raw[k]);
      if (!rtHasFormatting(h)) return;
      (out = out || {})[k] = h;
    });
    // Saved changes are merged into the stored card, so always write every slot ('' = no formatting).
    if (out) RT_FIELDS.forEach(function (k) { if (!out[k]) out[k] = ''; });
    return out;
  }

  /* ---- showing a field ---- */
  // Formatted HTML for a field, or null if there is none (or the text has since been changed elsewhere).
  function richFieldHTML(e, k) {
    var h = e.fmt && e.fmt[k];
    if (!h) return null;
    var plain = richToText(h);
    if (rtNorm(plain) === rtNorm(e[k])) return h;
    // Text added on the end later (e.g. a clarification from Ask): keep the formatting, add the rest as plain text.
    var idx = e[k].indexOf(plain.slice(0, 40));
    if (idx === 0 && rtNorm(e[k].slice(0, plain.length)) === rtNorm(plain)) return h + esc(e[k].slice(plain.length));
    return null;
  }
  // Search-term highlighting inside formatted text.
  function highlightRich(html) {
    var terms = searchTerms().filter(function (t) { return t.charAt(0) !== '#'; }).sort(function (a, b) { return b.length - a.length; });
    if (!terms.length) return html;
    var re = new RegExp('(' + terms.map(regexEscape).join('|') + ')', 'gi');
    var tpl = document.createElement('template'); tpl.innerHTML = html;
    var w = document.createTreeWalker(tpl.content, 4), nodes = [], n;
    while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach(function (t) {
      var parts = t.nodeValue.split(re);
      if (parts.length < 2) return;
      var frag = document.createDocumentFragment();
      parts.forEach(function (p, i) {
        if (!p) return;
        if (i % 2) { var m = document.createElement('mark'); m.className = 'hit'; m.textContent = p; frag.appendChild(m); }
        else frag.appendChild(document.createTextNode(p));
      });
      t.parentNode.replaceChild(frag, t);
    });
    return tpl.innerHTML;
  }
  // The inner HTML for a card field: formatted if possible, otherwise plain text (with search highlights).
  function fieldTextHTML(e, k) {
    var h = richFieldHTML(e, k);
    return h ? highlightRich(h) : highlight(e[k]);
  }

  /* ---- the editor ---- */
  // Stored (class) form → inline styles, which the browser's editing commands understand.
  function rtToEditor(html) {
    var tpl = document.createElement('template'); tpl.innerHTML = html;
    Array.prototype.forEach.call(tpl.content.querySelectorAll('mark'), function (m) {
      var c = rtPick(RT_HL, (m.className || '').replace('hl-', '')) || RT_HL[0];
      var s = document.createElement('span'); s.style.backgroundColor = c.hex;
      while (m.firstChild) s.appendChild(m.firstChild);
      m.parentNode.replaceChild(s, m);
    });
    Array.prototype.forEach.call(tpl.content.querySelectorAll('span[class]'), function (sp) {
      var c = rtPick(RT_TC, (sp.className || '').replace('tc-', ''));
      sp.removeAttribute('class');
      if (c) sp.style.color = c.hex;
    });
    return tpl.innerHTML;
  }
  function textToRich(text) { return esc(text || '').replace(/\n/g, '<br>'); }
  function rtSet(el, text, html) {
    el.innerHTML = html && rtNorm(richToText(html)) === rtNorm(text) ? rtToEditor(html) : textToRich(text);
  }
  function rtGet(el) {
    var html = cleanCardHTML(el.innerHTML);
    return { text: richToText(html), html: rtHasFormatting(html) ? html : '' };
  }
  function rtEditors() { return [$('#fFacts'), $('#fRatio'), $('#fStrategy')]; }
  function rtTarget() {
    var sel = window.getSelection(), eds = rtEditors();
    var inside = sel && sel.rangeCount ? eds.filter(function (ed) { return ed.contains(sel.anchorNode); })[0] : null;
    return inside || rtActive || eds[0];
  }
  function rtExec(cmd, val) {
    var ed = rtTarget();
    if (document.activeElement !== ed) {
      // Focusing moves the caret, so put the selection back afterwards.
      var sel = window.getSelection(), range = sel.rangeCount && ed.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
      ed.focus();
      if (range) { sel.removeAllRanges(); sel.addRange(range); }
    }
    var css = cmd === 'hiliteColor' || cmd === 'foreColor';
    try {
      document.execCommand('styleWithCSS', false, css);
      document.execCommand(cmd, false, val == null ? null : val);
    } finally { document.execCommand('styleWithCSS', false, false); }
    rtState();
  }
  function rtCommand(c, v) {
    if (c === 'hl') { if (v) rtHl = v; rtExec('hiliteColor', rtPick(RT_HL, rtHl).hex); rtPaintSwatches(); }
    else if (c === 'hl-none') rtExec('hiliteColor', 'transparent');
    else if (c === 'tc') { if (v) rtTc = v; rtExec('foreColor', rtPick(RT_TC, rtTc).hex); rtPaintSwatches(); }
    else if (c === 'tc-none') rtExec('foreColor', getComputedStyle(rtTarget()).color);
    else if (c === 'clear') { rtExec('removeFormat'); rtExec('hiliteColor', 'transparent'); rtExec('foreColor', getComputedStyle(rtTarget()).color); }
    else rtExec(c);
    rtClosePalettes();
  }
  function rtState() {
    var bar = $('#rtBar'); if (!bar) return;
    ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList'].forEach(function (c) {
      var b = bar.querySelector('[data-rt="' + c + '"]'); if (!b) return;
      var on = false; try { on = document.queryCommandState(c); } catch (err) { /* ignore */ }
      b.classList.toggle('on', !!on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function rtPaintSwatches() {
    var h = $('#rtHlNow'), t = $('#rtTcNow');
    if (h) h.style.background = rtPick(RT_HL, rtHl).hex;
    if (t) t.style.background = rtPick(RT_TC, rtTc).hex;
  }
  function rtClosePalettes() { document.querySelectorAll('.rt-pal').forEach(function (p) { p.hidden = true; }); document.querySelectorAll('[data-rt-open]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); }); }
  function rtBarHTML() {
    var btn = function (cmd, label, inner, extra) { return '<button type="button" class="rt-btn" data-rt="' + cmd + '" title="' + label + '" aria-label="' + label + '"' + (extra || '') + '>' + inner + '</button>'; };
    return btn('bold', 'Bold (Ctrl+B)', '<b>B</b>', ' aria-pressed="false"') + btn('italic', 'Italic (Ctrl+I)', '<i>I</i>', ' aria-pressed="false"') +
      btn('underline', 'Underline (Ctrl+U)', '<u>U</u>', ' aria-pressed="false"') + btn('strikeThrough', 'Strikethrough', '<s>S</s>', ' aria-pressed="false"') +
      '<span class="rt-sep"></span>' +
      '<span class="rt-split">' + btn('hl', 'Highlight', '<span class="rt-ico">🖍</span><i class="rt-now" id="rtHlNow"></i>') +
        '<button type="button" class="rt-btn rt-more" data-rt-open="rtHlPal" aria-haspopup="true" aria-expanded="false" title="Highlight colour" aria-label="Choose highlight colour">▾</button>' +
        '<div class="rt-pal" id="rtHlPal" hidden role="menu">' + RT_HL.map(function (c) { return '<button type="button" class="rt-sw" role="menuitem" data-rt="hl" data-v="' + c.id + '" title="' + c.label + '" aria-label="' + c.label + ' highlight" style="background:' + c.hex + '"></button>'; }).join('') +
        '<button type="button" class="rt-none" role="menuitem" data-rt="hl-none">No highlight</button></div></span>' +
      '<span class="rt-split">' + btn('tc', 'Text colour', '<span class="rt-ico rt-a">A</span><i class="rt-now" id="rtTcNow"></i>') +
        '<button type="button" class="rt-btn rt-more" data-rt-open="rtTcPal" aria-haspopup="true" aria-expanded="false" title="Text colour" aria-label="Choose text colour">▾</button>' +
        '<div class="rt-pal" id="rtTcPal" hidden role="menu">' + RT_TC.map(function (c) { return '<button type="button" class="rt-sw" role="menuitem" data-rt="tc" data-v="' + c.id + '" title="' + c.label + '" aria-label="' + c.label + ' text" style="background:' + c.hex + '"></button>'; }).join('') +
        '<button type="button" class="rt-none" role="menuitem" data-rt="tc-none">Automatic</button></div></span>' +
      '<span class="rt-sep"></span>' +
      btn('insertUnorderedList', 'Bullet list', '•≡', ' aria-pressed="false"') + btn('insertOrderedList', 'Numbered list', '1.≡', ' aria-pressed="false"') +
      '<span class="rt-sep"></span>' + btn('clear', 'Clear formatting', '<span class="rt-ico">⌫</span><span class="rt-txt">Clear</span>');
  }
  function bindRichText() {
    var bar = $('#rtBar');
    bar.innerHTML = rtBarHTML();
    rtPaintSwatches();
    // Keep the text selection when a toolbar button is pressed.
    bar.addEventListener('mousedown', function (ev) { if (ev.target.closest('button')) ev.preventDefault(); });
    bar.addEventListener('click', function (ev) {
      var o = ev.target.closest('[data-rt-open]');
      if (o) {
        var pal = $('#' + o.getAttribute('data-rt-open')), was = !pal.hidden;
        rtClosePalettes();
        if (!was) {
          pal.hidden = false; pal.style.left = ''; o.setAttribute('aria-expanded', 'true');
          // Keep the palette on screen on narrow phones.
          var r = pal.getBoundingClientRect(), over = r.right - (document.documentElement.clientWidth - 8);
          if (over > 0) pal.style.left = (pal.offsetLeft - over) + 'px';
        }
        return;
      }
      var b = ev.target.closest('[data-rt]');
      if (b) rtCommand(b.getAttribute('data-rt'), b.getAttribute('data-v'));
    });
    document.addEventListener('click', function (ev) { if (!ev.target.closest('.rt-split')) rtClosePalettes(); });
    // Esc closes an open colour palette, not the whole edit form.
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape' || !document.querySelector('.rt-pal:not([hidden])')) return;
      ev.preventDefault(); ev.stopImmediatePropagation(); rtClosePalettes();
    }, true);
    rtEditors().forEach(function (ed) {
      ed.addEventListener('focus', function () { rtActive = ed; rtState(); });
      ed.addEventListener('keyup', rtState);
      ed.addEventListener('mouseup', rtState);
      // Pasted text keeps simple formatting (bold, highlights…) but nothing else.
      ed.addEventListener('paste', function (ev) {
        var cd = ev.clipboardData; if (!cd) return;
        ev.preventDefault();
        var html = cd.getData('text/html');
        var clean = html ? rtToEditor(cleanCardHTML(html.replace(/<!--[\s\S]*?-->/g, ''))) : textToRich(cd.getData('text/plain'));
        document.execCommand('insertHTML', false, clean);
      });
      ed.addEventListener('keydown', function (ev) {
        if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && ev.shiftKey && (ev.key === 'h' || ev.key === 'H')) { ev.preventDefault(); rtCommand('hl'); }
      });
    });
  }
