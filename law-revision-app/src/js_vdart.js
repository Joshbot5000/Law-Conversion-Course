  /* ------------------------------------------------------------------
     U12b. EXPLAINER VIDEO ART — six drawing styles, all drawn by the
           page itself (no extra requests): whiteboard, watercolour,
           papercraft, anime, retro print and chalkboard. One script,
           any style: the style can be switched while watching.
     ------------------------------------------------------------------ */
  // fill: how shapes are coloured in. cw / tcw: how wide the body / title font runs (for wrapping).
  var VD_STYLES = {
    whiteboard: { label: 'Whiteboard', bg: '#fffdf7', ink: '#23314f', pens: ['#d2453a', '#2f6fb3', '#2a8a52', '#d98a1c', '#7b4bb3'], fill: 'hatch', w: 1, jit: 1, dbl: true,
      font: "'Patrick Hand', 'Segoe Print', cursive", title: "'Caveat', 'Segoe Print', cursive", tw: 700, cw: 1, tcw: 0.85, mark: '#fde68a', note: '#fff3a8', sub: '#55607a' },
    watercolour: { label: 'Watercolour', bg: '#fbf6ec', ink: '#4a3b2c', pens: ['#e07a5f', '#3d85c6', '#81b29a', '#e9b44c', '#9d79bc'], fill: 'wash', w: 0.8, jit: 0.8,
      font: "'Kalam', 'Segoe Print', cursive", title: "'Caveat', 'Segoe Print', cursive", tw: 700, cw: 1.1, tcw: 0.85, mark: 'rgba(233,180,76,.45)', note: '#fff6df', sub: '#7a6a58' },
    papercraft: { label: 'Papercraft', bg: '#e8d5b5', ink: '#3a2e22', pens: ['#f28482', '#5e9c8f', '#f6bd60', '#7b9acc', '#b08fd9'], fill: 'paper', w: 0.9, jit: 0.45,
      font: "'Fredoka', 'Trebuchet MS', sans-serif", title: "'Fredoka', 'Trebuchet MS', sans-serif", tw: 600, cw: 1.15, tcw: 1.15, mark: '#fffaf0', note: '#fffaf0', sub: '#6b5a46' },
    anime: { label: 'Anime', bg: 'sky', ink: '#16141f', pens: ['#ff4f8b', '#3d7bff', '#ffb000', '#14b8a6', '#8b5cf6'], fill: 'cel', w: 1.3, jit: 0.35, chibi: true,
      font: "'Zen Maru Gothic', 'Trebuchet MS', sans-serif", title: "'Bangers', Impact, sans-serif", tw: 400, cw: 1.1, tcw: 0.95, mark: '#fff1a8', note: '#ffffff', sub: '#4b4766' },
    retro: { label: 'Retro print', bg: '#f2e4c4', ink: '#1d2b53', pens: ['#e63946', '#2a9d8f', '#e9a03b', '#1d3557', '#c2185b'], fill: 'halftone', w: 1.2, jit: 0.55, misreg: true,
      font: "'Courier Prime', 'Courier New', monospace", title: "'Alfa Slab One', Georgia, serif", tw: 400, cw: 1.25, tcw: 1.3, mark: 'rgba(233,160,59,.5)', note: '#fbf3dd', sub: '#4a4a5a' },
    chalkboard: { label: 'Chalkboard', bg: '#22382d', ink: '#f3f0e6', pens: ['#ffc9a0', '#a0e7e5', '#ffadad', '#caffbf', '#cdb4ff'], fill: 'hatch', w: 1.15, jit: 1.1, dbl: true, chalk: true,
      font: "'Patrick Hand', 'Segoe Print', cursive", title: "'Caveat', 'Segoe Print', cursive", tw: 700, cw: 1, tcw: 0.85, mark: 'rgba(255,255,255,.16)', note: 'rgba(255,255,255,.08)', sub: '#cfd8d0' }
  };
  var VD_STYLE_ORDER = ['whiteboard', 'watercolour', 'papercraft', 'anime', 'retro', 'chalkboard'];
  var VD_FONTS = 'https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Patrick+Hand&family=Kalam:wght@400;700&family=Fredoka:wght@400;600&family=Zen+Maru+Gothic:wght@500;700&family=Bangers&family=Courier+Prime:wght@400;700&family=Alfa+Slab+One&display=swap';
  var VD_MOODS = ['happy', 'sad', 'surprised', 'thinking', 'worried', 'angry'];

  function vdRng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
  // Mix a #rrggbb colour towards white (or another #rrggbb) by t (0 = unchanged, 1 = the other colour).
  function vdMix(c, t, to) {
    var h = function (x) { x = String(x || '').replace('#', ''); return x.length === 6 ? [0, 2, 4].map(function (i) { return parseInt(x.slice(i, i + 2), 16); }) : null; };
    var a = h(c), b = h(to || '#ffffff'); if (!a || !b) return c;
    return '#' + a.map(function (v, i) { return ('0' + Math.round(v + (b[i] - v) * t).toString(16)).slice(-2); }).join('');
  }

  // Icons in a 100×100 box: c circle, e ellipse, r rectangle, l line through points, p closed shape.
  var VD_ICONS = {
    person: [['c', 50, 22, 12], ['l', 50, 34, 50, 66], ['l', 30, 50, 50, 42, 70, 50], ['l', 50, 66, 36, 92], ['l', 50, 66, 64, 92]],
    child: [['c', 50, 38, 10], ['l', 50, 48, 50, 70], ['l', 36, 58, 50, 54, 64, 58], ['l', 50, 70, 40, 90], ['l', 50, 70, 60, 90]],
    people: [['c', 32, 26, 10], ['l', 32, 36, 32, 62], ['l', 18, 48, 46, 48], ['l', 32, 62, 22, 88], ['l', 32, 62, 42, 88], ['c', 68, 26, 10], ['l', 68, 36, 68, 62], ['l', 54, 48, 82, 48], ['l', 68, 62, 58, 88], ['l', 68, 62, 78, 88]],
    worker: [['c', 50, 28, 11], ['p', 36, 24, 40, 12, 60, 12, 64, 24], ['l', 30, 25, 70, 25], ['l', 50, 39, 50, 66], ['l', 30, 52, 50, 44, 70, 52], ['l', 50, 66, 36, 92], ['l', 50, 66, 64, 92]],
    doctor: [['c', 50, 22, 12], ['l', 50, 34, 50, 66], ['l', 30, 50, 50, 42, 70, 50], ['l', 50, 66, 36, 92], ['l', 50, 66, 64, 92], ['l', 57, 52, 67, 52], ['l', 62, 47, 62, 57]],
    police: [['c', 50, 27, 11], ['p', 36, 18, 50, 8, 64, 18, 62, 21, 38, 21], ['l', 50, 38, 50, 66], ['l', 30, 52, 50, 44, 70, 52], ['l', 50, 66, 36, 92], ['l', 50, 66, 64, 92]],
    judge: [['c', 50, 24, 11], ['l', 38, 20, 34, 40], ['l', 62, 20, 66, 40], ['p', 32, 44, 68, 44, 74, 92, 26, 92], ['l', 50, 44, 50, 92]],
    dog: [['e', 46, 56, 24, 13], ['c', 74, 42, 10], ['l', 30, 66, 28, 84], ['l', 40, 68, 40, 84], ['l', 54, 68, 54, 84], ['l', 64, 66, 66, 84], ['l', 22, 52, 12, 42], ['l', 78, 34, 84, 26]],
    car: [['r', 12, 46, 76, 24], ['p', 26, 46, 36, 30, 64, 30, 74, 46], ['c', 30, 72, 8], ['c', 70, 72, 8]],
    road: [['l', 30, 92, 44, 8], ['l', 70, 92, 56, 8], ['l', 50, 86, 50, 74], ['l', 50, 58, 50, 46], ['l', 50, 32, 50, 22]],
    ambulance: [['r', 8, 40, 60, 30], ['p', 68, 48, 84, 48, 92, 60, 92, 70, 68, 70], ['c', 26, 74, 7], ['c', 76, 74, 7], ['l', 38, 48, 38, 62], ['l', 31, 55, 45, 55]],
    ship: [['p', 12, 60, 88, 60, 76, 80, 24, 80], ['l', 50, 60, 50, 16], ['p', 53, 20, 78, 52, 53, 52]],
    house: [['p', 18, 48, 50, 18, 82, 48], ['r', 26, 48, 48, 40], ['r', 44, 66, 12, 22]],
    shop: [['r', 16, 40, 68, 48], ['p', 12, 40, 22, 20, 78, 20, 88, 40], ['r', 42, 62, 16, 26], ['l', 22, 40, 22, 30]],
    factory: [['p', 10, 88, 10, 52, 30, 62, 30, 52, 50, 62, 50, 52, 70, 62, 70, 26, 84, 26, 84, 88], ['l', 74, 18, 78, 10]],
    hospital: [['r', 20, 22, 60, 66], ['l', 50, 34, 50, 60], ['l', 38, 47, 62, 47], ['r', 42, 70, 16, 18]],
    court: [['p', 14, 34, 50, 12, 86, 34], ['r', 18, 34, 64, 6], ['l', 26, 42, 26, 78], ['l', 42, 42, 42, 78], ['l', 58, 42, 58, 78], ['l', 74, 42, 74, 78], ['r', 14, 80, 72, 8]],
    fire: [['p', 50, 10, 70, 42, 68, 70, 50, 88, 32, 70, 30, 42, 42, 54], ['l', 50, 50, 57, 66, 50, 78, 43, 66, 50, 50]],
    ball: [['c', 50, 50, 24], ['l', 30, 38, 50, 48, 70, 38], ['l', 30, 62, 50, 52, 70, 62]],
    money: [['r', 12, 30, 76, 40], ['c', 50, 50, 11], ['l', 20, 38, 28, 38], ['l', 72, 62, 80, 62]],
    contract: [['r', 24, 10, 52, 76], ['l', 32, 24, 68, 24], ['l', 32, 34, 68, 34], ['l', 32, 44, 62, 44], ['l', 32, 70, 40, 62, 48, 70, 56, 62, 64, 68]],
    letter: [['r', 12, 26, 76, 48], ['l', 12, 26, 50, 56, 88, 26]],
    phone: [['r', 34, 12, 32, 76], ['l', 46, 78, 54, 78], ['l', 44, 18, 56, 18]],
    computer: [['r', 14, 18, 72, 46], ['l', 42, 64, 38, 80], ['l', 58, 64, 62, 80], ['l', 26, 82, 74, 82]],
    book: [['p', 50, 24, 16, 16, 16, 80, 50, 88, 84, 80, 84, 16], ['l', 50, 24, 50, 88]],
    gavel: [['p', 22, 30, 46, 14, 58, 32, 34, 48], ['l', 46, 40, 76, 74], ['r', 14, 82, 44, 8]],
    scales: [['l', 50, 14, 50, 84], ['l', 20, 26, 80, 26], ['l', 32, 86, 68, 86], ['l', 20, 26, 10, 54], ['l', 20, 26, 30, 54], ['e', 20, 56, 12, 4], ['l', 80, 26, 70, 54], ['l', 80, 26, 90, 54], ['e', 80, 56, 12, 4]],
    clock: [['c', 50, 50, 34], ['l', 50, 50, 50, 26], ['l', 50, 50, 66, 58]],
    calendar: [['r', 16, 22, 68, 62], ['l', 16, 38, 84, 38], ['l', 34, 14, 34, 28], ['l', 66, 14, 66, 28], ['l', 30, 52, 40, 52], ['l', 48, 52, 58, 52], ['l', 30, 66, 40, 66]],
    warning: [['p', 50, 12, 90, 84, 10, 84], ['l', 50, 36, 50, 62], ['c', 50, 73, 2]],
    bottle: [['p', 42, 10, 58, 10, 58, 28, 68, 42, 68, 90, 32, 90, 32, 42, 42, 28], ['r', 36, 54, 28, 18]],
    snail: [['l', 12, 80, 86, 80], ['p', 20, 80, 26, 66, 70, 66, 82, 80], ['c', 52, 52, 18], ['c', 52, 52, 8], ['l', 26, 68, 16, 48], ['l', 30, 68, 26, 46]],
    food: [['e', 50, 70, 38, 10], ['p', 20, 66, 26, 42, 50, 30, 74, 42, 80, 66], ['l', 50, 30, 50, 22]],
    tree: [['c', 50, 34, 24], ['l', 44, 56, 44, 90], ['l', 56, 56, 56, 90]],
    water: [['l', 8, 40, 20, 34, 32, 40, 44, 34, 56, 40, 68, 34, 80, 40, 92, 34], ['l', 8, 58, 20, 52, 32, 58, 44, 52, 56, 58, 68, 52, 80, 58, 92, 52], ['l', 8, 76, 20, 70, 32, 76, 44, 70, 56, 76, 68, 70, 80, 76, 92, 70]],
    stairs: [['l', 10, 90, 10, 72, 30, 72, 30, 54, 50, 54, 50, 36, 70, 36, 70, 18, 90, 18]],
    ladder: [['l', 34, 8, 30, 92], ['l', 66, 8, 70, 92], ['l', 33, 24, 67, 24], ['l', 32, 44, 68, 44], ['l', 31, 64, 69, 64], ['l', 31, 82, 69, 82]],
    injury: [['r', 14, 38, 72, 24], ['l', 40, 38, 40, 62], ['l', 60, 38, 60, 62], ['c', 50, 46, 1.5], ['c', 50, 54, 1.5]],
    eye: [['e', 50, 50, 38, 18], ['c', 50, 50, 10], ['c', 50, 50, 3]],
    heart: [['p', 50, 86, 16, 52, 18, 30, 34, 20, 50, 32, 66, 20, 82, 30, 84, 52]],
    lightbulb: [['c', 50, 38, 22], ['r', 41, 60, 18, 16], ['l', 44, 84, 56, 84], ['l', 44, 38, 50, 46, 56, 38]],
    question: [['l', 34, 34, 38, 20, 52, 14, 64, 20, 66, 34, 52, 46, 50, 62], ['c', 50, 78, 3]],
    tick: [['l', 18, 54, 42, 78, 84, 24]],
    cross: [['l', 24, 24, 76, 76], ['l', 76, 24, 24, 76]],
    key: [['c', 28, 50, 14], ['l', 42, 50, 88, 50], ['l', 74, 50, 74, 64], ['l', 84, 50, 84, 60]],
    lock: [['r', 26, 46, 48, 40], ['l', 36, 46, 36, 30, 44, 20, 56, 20, 64, 30, 64, 46], ['c', 50, 64, 4]],
    crown: [['p', 16, 74, 16, 30, 34, 50, 50, 22, 66, 50, 84, 30, 84, 74], ['l', 16, 84, 84, 84]],
    chain: [['e', 26, 50, 16, 9], ['e', 50, 50, 16, 9], ['e', 74, 50, 16, 9]],
    chainbreak: [['e', 22, 50, 16, 9], ['e', 78, 50, 16, 9], ['l', 44, 38, 50, 50, 46, 62], ['l', 56, 38, 50, 50, 54, 62]],
    handshake: [['l', 6, 46, 26, 46, 40, 38, 56, 44, 66, 40, 94, 40], ['l', 6, 66, 30, 66, 44, 74, 60, 70, 70, 62, 94, 62], ['l', 40, 52, 54, 60], ['l', 48, 48, 62, 56]],
    umbrella: [['p', 10, 50, 22, 30, 50, 20, 78, 30, 90, 50], ['l', 50, 50, 50, 84, 44, 90, 38, 84]],
    cake: [['r', 22, 50, 56, 34], ['r', 30, 34, 40, 16], ['l', 50, 34, 50, 22], ['c', 50, 17, 4]],
    train: [['r', 12, 30, 62, 40], ['r', 74, 44, 14, 26], ['c', 30, 76, 7], ['c', 62, 76, 7], ['r', 20, 38, 16, 12], ['r', 44, 38, 16, 12]],
    bike: [['c', 26, 66, 16], ['c', 74, 66, 16], ['l', 26, 66, 44, 40, 64, 40, 74, 66], ['l', 44, 40, 50, 66, 26, 66], ['l', 40, 32, 50, 32]],
    plane: [['p', 8, 50, 70, 46, 92, 50, 70, 56, 8, 54], ['p', 40, 50, 58, 20, 66, 20, 56, 50], ['p', 40, 54, 58, 84, 66, 84, 56, 54], ['l', 14, 50, 8, 36, 18, 36, 26, 50]],
    pen: [['p', 20, 80, 70, 30, 78, 38, 28, 88, 18, 90], ['l', 64, 36, 72, 44]],
    briefcase: [['r', 14, 34, 72, 48], ['r', 38, 22, 24, 12], ['l', 14, 52, 86, 52]],
    magnifier: [['c', 42, 42, 24], ['l', 60, 60, 86, 86]],
    megaphone: [['p', 18, 40, 30, 40, 76, 18, 76, 82, 30, 60, 18, 60], ['l', 30, 60, 36, 82]],
    puzzle: [['p', 20, 22, 44, 22, 44, 14, 56, 14, 56, 22, 80, 22, 80, 44, 88, 44, 88, 56, 80, 56, 80, 80, 20, 80]],
    target: [['c', 50, 50, 34], ['c', 50, 50, 22], ['c', 50, 50, 9]],
    trophy: [['p', 30, 16, 70, 16, 66, 48, 50, 58, 34, 48], ['l', 50, 58, 50, 74], ['r', 34, 74, 32, 10], ['l', 30, 24, 16, 26, 20, 40, 32, 42], ['l', 70, 24, 84, 26, 80, 40, 68, 42]],
    bell: [['p', 24, 72, 28, 40, 40, 24, 60, 24, 72, 40, 76, 72], ['c', 50, 80, 5], ['l', 50, 24, 50, 16]],
    sun: [['c', 50, 50, 18], ['l', 50, 12, 50, 24], ['l', 50, 76, 50, 88], ['l', 12, 50, 24, 50], ['l', 76, 50, 88, 50], ['l', 23, 23, 31, 31], ['l', 69, 69, 77, 77], ['l', 77, 23, 69, 31], ['l', 23, 77, 31, 69]],
    cloud: [['p', 22, 70, 14, 58, 22, 46, 36, 46, 42, 32, 60, 30, 70, 42, 84, 44, 90, 58, 82, 70]],
    star: [['p', 50, 10, 61, 38, 92, 38, 67, 56, 76, 86, 50, 68, 24, 86, 33, 56, 8, 38, 39, 38]],
    flag: [['p', 24, 14, 76, 20, 64, 34, 78, 48, 24, 44], ['l', 24, 92, 24, 12]],
    parcel: [['p', 16, 36, 50, 22, 84, 36, 84, 74, 50, 88, 16, 74], ['l', 16, 36, 50, 50, 84, 36], ['l', 50, 50, 50, 88]]
  };
  // Where each person icon's head is, so a face can be drawn on it.
  var VD_PEOPLE = { person: [50, 22, 12], child: [50, 38, 10], worker: [50, 28, 11], doctor: [50, 22, 12], police: [50, 27, 11], judge: [50, 24, 11] };

  function Sketch(seed, T) {
    var R = vdRng(seed), parts = [], clip = 0;
    var j = function (a) { return (R() - 0.5) * 2 * a * T.jit; };
    var seg = function (x1, y1, x2, y2) {
      var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1, bow = j(Math.min(6, len * 0.03));
      var mx = (x1 + x2) / 2 - dy / len * bow + j(1), my = (y1 + y2) / 2 + dx / len * bow + j(1);
      return 'M' + (x1 + j(1.2)).toFixed(1) + ' ' + (y1 + j(1.2)).toFixed(1) + ' Q' + mx.toFixed(1) + ' ' + my.toFixed(1) + ' ' + (x2 + j(1.2)).toFixed(1) + ' ' + (y2 + j(1.2)).toFixed(1);
    };
    var ell = function (cx, cy, rx, ry, closed) {
      var a0 = R() * Math.PI * 2, n = 44, d = '', over = closed ? 0 : 0.2 + R() * 0.3, wob = [j(0.05), j(0.05)];
      for (var i = 0; i <= n; i++) { var a = a0 + (Math.PI * 2 + over) * i / n, k = 1 + wob[0] * Math.sin(a * 2 + wob[1] * 9) + j(0.008); d += (i ? ' L' : 'M') + (cx + Math.cos(a) * rx * k).toFixed(1) + ' ' + (cy + Math.sin(a) * ry * k).toFixed(1); }
      return d + (closed ? 'Z' : '');
    };
    var polyD = function (pts) { var d = ''; for (var i = 0; i < pts.length; i += 2) d += (i ? ' L' : 'M') + (pts[i] + j(1)).toFixed(1) + ' ' + (pts[i + 1] + j(1)).toFixed(1); return d + 'Z'; };
    // The --d place in the drawing order, or "late" for things revealed towards the end of a scene (quiz answers).
    var when = function (o) { return o && o.at === 'late' ? ' vd-late" style="--d:0' : '" style="--d:' + ((o && o.at) || 0); };
    var api = {
      R: R,
      path: function (d, o) {
        o = o || {};
        var w = (o.w || 3.2) * T.w, col = o.color || T.ink;
        if (T.misreg && !o.noMis) parts.push('<path class="vd-ink' + when(o) + '" pathLength="1" d="' + d + '" stroke="' + T.pens[1] + '" stroke-opacity=".55" stroke-width="' + w + '" fill="none" transform="translate(3 2)"/>');
        parts.push('<path class="vd-ink' + when(o) + '" pathLength="1" d="' + d + '" stroke="' + col + '" stroke-width="' + w + '" fill="none"/>');
      },
      // Colour a closed shape in this style's way. box = [x, y, w, h] for hatching.
      fill: function (d, color, o) {
        o = o || {}; color = color || T.pens[0];
        var m = T.fill, tw = when(o);
        if (m === 'hatch') {
          var b = o.box; if (!b) return;
          var id = 'vc' + seed + '_' + (clip++), h = '';
          for (var t = -b[3]; t < b[2]; t += 13) h += seg(b[0] + t, b[1] + b[3], b[0] + t + b[3], b[1]) + ' ';
          parts.push('<clipPath id="' + id + '"><path d="' + d + '"/></clipPath><path class="vd-ink' + tw + '" pathLength="1" clip-path="url(#' + id + ')" d="' + h + '" stroke="' + color + '" stroke-opacity="' + (T.chalk ? 0.35 : 0.42) + '" stroke-width="2.2" fill="none"/>');
        } else if (m === 'wash') {
          parts.push('<path class="vd-fade' + tw + '" d="' + d + '" fill="' + color + '" fill-opacity=".38" filter="url(#vdWash)"/>');
        } else if (m === 'paper') {
          parts.push('<path class="vd-pop' + tw + '" d="' + d + '" fill="' + vdMix(color, o.light == null ? 0.35 : o.light) + '" filter="url(#vdSh)"/>');
        } else if (m === 'cel') {
          parts.push('<path class="vd-pop' + tw + '" d="' + d + '" fill="' + vdMix(color, 0.35, '#000000') + '" fill-opacity=".35" transform="translate(5 6)"/>');
          parts.push('<path class="vd-pop' + tw + '" d="' + d + '" fill="' + vdMix(color, o.light == null ? 0.45 : o.light) + '"/>');
        } else if (m === 'halftone') {
          var k = T.pens.indexOf(color); if (k < 0) k = 0;
          parts.push('<path class="vd-fade' + tw + '" d="' + d + '" fill="' + vdMix(color, 0.82) + '"/><path class="vd-fade' + tw + '" d="' + d + '" fill="url(#vdHt' + k + ')"/>');
        }
      },
      solid: function (d, color, o) { parts.push('<path class="vd-pop' + when(o) + '" d="' + d + '" fill="' + color + '"' + (o && o.opacity ? ' fill-opacity="' + o.opacity + '"' : '') + '/>'); },
      line: function (x1, y1, x2, y2, o) { api.path(seg(x1, y1, x2, y2), o); if (T.dbl && (!o || !o.once)) api.path(seg(x1, y1, x2, y2), Object.assign({}, o, { w: ((o && o.w) || 3.2) * 0.55, noMis: true })); },
      curve: function (x1, y1, cx, cy, x2, y2, o) { api.path('M' + x1 + ' ' + y1 + ' Q' + (cx + j(4)).toFixed(1) + ' ' + (cy + j(4)).toFixed(1) + ' ' + x2 + ' ' + y2, o); },
      poly: function (pts, closed, o) {
        o = o || {};
        if (closed && o.fill) { var xs = pts.filter(function (v, i) { return !(i % 2); }), ys = pts.filter(function (v, i) { return i % 2; }); api.fill(polyD(pts), o.fill, Object.assign({}, o, { box: [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs) - Math.min.apply(null, xs), Math.max.apply(null, ys) - Math.min.apply(null, ys)] })); }
        if (o.noLine) return;
        var d = '', n = pts.length / 2; for (var i = 0; i < n - 1 + (closed ? 1 : 0); i++) { var a = i * 2, b = ((i + 1) % n) * 2; d += seg(pts[a], pts[a + 1], pts[b], pts[b + 1]) + ' '; } api.path(d, o);
      },
      rect: function (x, y, w, h, o) {
        o = o || {};
        if (o.fill) api.fill(polyD([x, y, x + w, y, x + w, y + h, x, y + h]), o.fill, Object.assign({}, o, { box: [x, y, w, h] }));
        if (o.noLine) return;
        api.poly([x, y, x + w, y, x + w, y + h, x, y + h], true, Object.assign({}, o, { fill: null }));
        if (T.dbl && !o.once) api.poly([x, y, x + w, y, x + w, y + h, x, y + h], true, Object.assign({}, o, { fill: null, w: (o.w || 3.2) * 0.5, noMis: true }));
      },
      ellipse: function (cx, cy, rx, ry, o) {
        o = o || {};
        if (o.fill) api.fill(ell(cx, cy, rx, ry, true), o.fill, Object.assign({}, o, { box: [cx - rx, cy - ry, rx * 2, ry * 2] }));
        if (!o.noLine) api.path(ell(cx, cy, rx, ry), o);
      },
      mark: function (x, y, w, h, color, at) { var d = 'M' + x + ' ' + (y + j(2)) + ' L' + (x + w) + ' ' + (y + j(3)) + ' L' + (x + w + j(3)) + ' ' + (y + h) + ' L' + (x + j(3)) + ' ' + (y + h + j(2)) + 'Z'; parts.push('<path class="vd-mark" d="' + d + '" fill="' + (color || T.mark) + '" style="--d:' + (at || 0) + '"/>'); },
      icon: function (name, x, y, size, o) {
        if (VD_PEOPLE[name]) return api.person(name, x, y, size, o);
        var ops = VD_ICONS[name] || VD_ICONS.question, s = size / 100, X = function (v) { return x + v * s; }, Y = function (v) { return y + v * s; };
        o = Object.assign({ w: Math.max(2.4, size / 34) }, o, { once: true });
        var tint = T.fill !== 'hatch' || size >= 130 ? (o.color || T.pens[0]) : null;
        ops.forEach(function (op, i) {
          var fo = Object.assign({}, o, { fill: tint && i < 3 ? tint : null, light: 0.5 });
          if (op[0] === 'c') api.ellipse(X(op[1]), Y(op[2]), op[3] * s, op[3] * s, fo);
          else if (op[0] === 'e') api.ellipse(X(op[1]), Y(op[2]), op[3] * s, op[4] * s, fo);
          else if (op[0] === 'r') api.poly([X(op[1]), Y(op[2]), X(op[1] + op[3]), Y(op[2]), X(op[1] + op[3]), Y(op[2] + op[4]), X(op[1]), Y(op[2] + op[4])], true, fo);
          else { var pts = []; for (var k = 1; k < op.length; k += 2) pts.push(X(op[k]), Y(op[k + 1])); api.poly(pts, op[0] === 'p', op[0] === 'p' ? fo : o); }
        });
      },
      // A person with a face (or, in the anime style, a big-eyed chibi character). mood: happy, sad, surprised, thinking, worried, angry.
      person: function (name, x, y, size, o) {
        o = o || {};
        var s = size / 100, X = function (v) { return x + v * s; }, Y = function (v) { return y + v * s; }, col = o.color || T.pens[1], mood = o.mood || 'happy', ink = T.ink;
        var face = function (cx, cy, r, big) {
          var e = big ? 0 : r * 0.13;
          if (big) {
            [-1, 1].forEach(function (sd) { api.solid(ell(cx + sd * r * 0.38, cy + r * 0.05, r * 0.17, r * 0.25, true), ink, o); api.solid(ell(cx + sd * r * 0.38 - r * 0.05, cy - r * 0.05, r * 0.07, r * 0.07, true), '#ffffff', o); });
            api.solid(ell(cx - r * 0.62, cy + r * 0.35, r * 0.16, r * 0.08, true), '#ff8fab', Object.assign({}, o, { opacity: 0.55 })); api.solid(ell(cx + r * 0.62, cy + r * 0.35, r * 0.16, r * 0.08, true), '#ff8fab', Object.assign({}, o, { opacity: 0.55 }));
          } else [-1, 1].forEach(function (sd) { api.solid(ell(cx + sd * r * 0.38, cy - r * 0.1, e, e, true), ink, o); });
          var mw = r * 0.38, my = cy + r * (big ? 0.55 : 0.42), mo = Object.assign({}, o, { color: ink, w: Math.max(1.6, r / (big ? 9 : 7)), once: true, noMis: true });
          if (mood === 'sad') api.path('M' + (cx - mw) + ' ' + (my + mw * 0.4) + ' Q' + cx + ' ' + (my - mw * 0.4) + ' ' + (cx + mw) + ' ' + (my + mw * 0.4), mo);
          else if (mood === 'surprised') api.path(ell(cx, my, mw * 0.4, mw * 0.5, true), mo);
          else if (mood === 'thinking') api.path('M' + (cx - mw * 0.6) + ' ' + my + ' L' + (cx + mw * 0.7) + ' ' + (my - mw * 0.3), mo);
          else if (mood === 'worried') api.path('M' + (cx - mw) + ' ' + my + ' Q' + (cx - mw / 2) + ' ' + (my - mw * 0.4) + ' ' + cx + ' ' + my + ' Q' + (cx + mw / 2) + ' ' + (my + mw * 0.4) + ' ' + (cx + mw) + ' ' + my, mo);
          else if (mood === 'angry') { api.path('M' + (cx - mw) + ' ' + my + ' L' + (cx + mw) + ' ' + my, mo); api.path('M' + (cx - r * 0.6) + ' ' + (cy - r * 0.45) + ' L' + (cx - r * 0.15) + ' ' + (cy - r * 0.25) + ' M' + (cx + r * 0.6) + ' ' + (cy - r * 0.45) + ' L' + (cx + r * 0.15) + ' ' + (cy - r * 0.25), mo); }
          else api.path('M' + (cx - mw) + ' ' + my + ' Q' + cx + ' ' + (my + mw * 0.9) + ' ' + (cx + mw) + ' ' + my, mo);
        };
        var w = Math.max(2.4, size / 34);
        if (T.chibi) {
          var kid = name === 'child' ? 0.82 : 1, off = name === 'child' ? 14 : 0, K = function (v) { return 50 + (v - 50) * kid; };
          var hx = X(50), hy = Y(30 * kid + off + 4), hr = 21 * kid * s, hair = ['#2b2b3a', '#7a4b2a', '#d9a441', '#3a2f6b'][(o.idx || 0) % 4];
          // body: a little filled top, arms and legs
          api.poly([X(K(40)), Y(54 * kid + off + 4), X(K(60)), Y(54 * kid + off + 4), X(K(64)), Y(78 * kid + off + 4), X(K(36)), Y(78 * kid + off + 4)], true, Object.assign({}, o, { fill: col, w: w }));
          api.line(X(K(41)), Y(58 * kid + off + 4), X(K(30)), Y(72 * kid + off + 4), { w: w, once: true, at: o.at }); api.line(X(K(59)), Y(58 * kid + off + 4), X(K(70)), Y(72 * kid + off + 4), { w: w, once: true, at: o.at });
          api.line(X(K(45)), Y(78 * kid + off + 4), X(K(43)), Y(96), { w: w, once: true, at: o.at }); api.line(X(K(55)), Y(78 * kid + off + 4), X(K(57)), Y(96), { w: w, once: true, at: o.at });
          api.solid(ell(hx, hy, hr, hr * 0.98, true), '#ffe8d6', o); api.path(ell(hx, hy, hr, hr * 0.98), Object.assign({}, o, { color: ink, w: w * 0.8 }));
          api.solid(polyD([hx - hr * 1.08, hy + hr * 0.25, hx - hr * 1.12, hy - hr * 0.45, hx - hr * 0.75, hy - hr * 1.0, hx - hr * 0.1, hy - hr * 1.18, hx + hr * 0.6, hy - hr * 1.05, hx + hr * 1.12, hy - hr * 0.5, hx + hr * 1.08, hy + hr * 0.25, hx + hr * 0.85, hy - hr * 0.3, hx + hr * 0.45, hy - hr * 0.12, hx + hr * 0.15, hy - hr * 0.42, hx - hr * 0.2, hy - hr * 0.1, hx - hr * 0.55, hy - hr * 0.4, hx - hr * 0.85, hy - hr * 0.15]), hair, o);
          face(hx, hy + hr * 0.12, hr, true);
          if (name === 'worker') api.solid(polyD([hx - hr * 1.1, hy - hr * 0.55, hx - hr * 0.8, hy - hr * 1.3, hx + hr * 0.8, hy - hr * 1.3, hx + hr * 1.1, hy - hr * 0.55]), '#ffb000', o);
          if (name === 'police') api.solid(polyD([hx - hr * 1.1, hy - hr * 0.6, hx - hr * 0.7, hy - hr * 1.35, hx + hr * 0.7, hy - hr * 1.35, hx + hr * 1.1, hy - hr * 0.6]), '#1d3557', o);
          if (name === 'judge') { api.ellipse(hx - hr * 1.05, hy + hr * 0.2, hr * 0.32, hr * 0.7, Object.assign({}, o, { fill: '#f4f4f4' })); api.ellipse(hx + hr * 1.05, hy + hr * 0.2, hr * 0.32, hr * 0.7, Object.assign({}, o, { fill: '#f4f4f4' })); }
          if (name === 'doctor') { api.line(X(50), Y(60 + off), X(50), Y(70 + off), { color: '#e63946', w: w, once: true, at: o.at }); api.line(X(45), Y(65 + off), X(55), Y(65 + off), { color: '#e63946', w: w, once: true, at: o.at }); }
          return;
        }
        var head = VD_PEOPLE[name];
        if (T.fill !== 'hatch') api.solid(ell(X(head[0]), Y(head[1]), head[2] * s, head[2] * s, true), T.fill === 'paper' || T.fill === 'cel' ? '#ffe2c6' : vdMix(col, 0.7), o);
        var ops = VD_ICONS[name];
        ops.forEach(function (op) {
          if (op[0] === 'c') api.ellipse(X(op[1]), Y(op[2]), op[3] * s, op[3] * s, Object.assign({}, o, { w: w, once: true }));
          else { var pts = []; for (var k = 1; k < op.length; k += 2) pts.push(X(op[k]), Y(op[k + 1])); api.poly(pts, op[0] === 'p', Object.assign({}, o, { w: w, once: true, fill: op[0] === 'p' ? col : null })); }
        });
        if (size >= 90) face(X(head[0]), Y(head[1]), head[2] * s, false);
      },
      text: function (str, x, y, o) {
        o = o || {};
        var size = o.size || 40, lines = vdWrap(str, Math.max(6, Math.round((o.chars || 30) / (o.title ? T.tcw : T.cw)))), lh = size * (o.lh || 1.14), anchor = o.anchor || 'start';
        if (o.mid) y -= (lines.length - 1) * lh / 2;
        var tw = when(o).replace('" style="', '');
        parts.push('<text class="vd-text' + (o.title ? ' vd-title' : '') + tw.split('--d:')[0] + '" style="font-family:' + (o.title ? T.title : T.font).replace(/"/g, "'") + ';font-weight:' + (o.title ? T.tw : 400) + ';--d:' + (o.at === 'late' ? 0 : (o.at || 0)) + '" x="' + x + '" y="' + y + '" font-size="' + size + '" fill="' + (o.color || T.ink) + '" text-anchor="' + anchor + '"' + (o.rot ? ' transform="rotate(' + o.rot + ' ' + x + ' ' + y + ')"' : '') + '>' +
          lines.map(function (l, i) { return '<tspan x="' + x + '" dy="' + (i ? lh : 0) + '">' + esc(l) + '</tspan>'; }).join('') + '</text>');
        return lines.length * lh;
      },
      // Little doodles in the margins, in this style's mood.
      deco: function (x, y, sz, color, at) {
        var kind = Math.floor(R() * 4), o = { color: color, w: 2.6, once: true, at: at, noMis: true };
        if (T.fill === 'paper') { for (var i = 0; i < 4; i++) api.solid(polyD([x + j(30), y + j(30), x + j(30) + 10, y + j(30), x + j(30) + 10, y + j(30) + 6, x + j(30), y + j(30) + 6]), T.pens[i % T.pens.length], { at: at }); return; }
        if (T.fill === 'wash') { api.fill(ell(x, y, sz * 0.7, sz * 0.55, true), color, { at: at }); return; }
        if (kind === 0 || T.chibi) { // sparkle
          api.path('M' + x + ' ' + (y - sz) + ' Q' + x + ' ' + y + ' ' + (x + sz) + ' ' + y + ' Q' + x + ' ' + y + ' ' + x + ' ' + (y + sz) + ' Q' + x + ' ' + y + ' ' + (x - sz) + ' ' + y + ' Q' + x + ' ' + y + ' ' + x + ' ' + (y - sz), o);
        } else if (kind === 1) { // star
          var pts = []; for (var a = 0; a < 10; a++) { var r = a % 2 ? sz * 0.45 : sz, an = -Math.PI / 2 + a * Math.PI / 5; pts.push(x + Math.cos(an) * r, y + Math.sin(an) * r); }
          api.poly(pts, true, Object.assign({}, o, { fill: T.fill === 'hatch' ? null : color }));
        } else if (kind === 2) { // swirl
          var d = ''; for (var t = 0; t < 26; t++) { var rr = sz * t / 26, ang = t * 0.55; d += (t ? ' L' : 'M') + (x + Math.cos(ang) * rr).toFixed(1) + ' ' + (y + Math.sin(ang) * rr).toFixed(1); } api.path(d, o);
        } else { // burst
          for (var b = 0; b < 8; b++) { var an2 = b * Math.PI / 4; api.line(x + Math.cos(an2) * sz * 0.45, y + Math.sin(an2) * sz * 0.45, x + Math.cos(an2) * sz, y + Math.sin(an2) * sz, o); }
        }
      },
      svg: function () { return parts.join(''); }
    };
    return api;
  }
  function vdWrap(str, n) {
    var words = String(str || '').split(/\s+/).filter(Boolean), lines = [], cur = '';
    words.forEach(function (w) { if ((cur + ' ' + w).trim().length > n && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
    if (cur) lines.push(cur);
    return lines.slice(0, 6);
  }
  function vdArrow(S, x1, y1, x2, y2, o, bend) {
    var cx = (x1 + x2) / 2 + (bend || 0), cy = (y1 + y2) / 2 - Math.abs(bend || 0) * 0.3;
    if (bend) S.curve(x1, y1, cx, cy, x2, y2, o); else S.line(x1, y1, x2, y2, o);
    var a = Math.atan2(y2 - (bend ? cy : y1), x2 - (bend ? cx : x1)), L = 16;
    S.line(x2, y2, x2 - L * Math.cos(a - 0.45), y2 - L * Math.sin(a - 0.45), Object.assign({}, o, { once: true }));
    S.line(x2, y2, x2 - L * Math.cos(a + 0.45), y2 - L * Math.sin(a + 0.45), Object.assign({}, o, { once: true }));
  }
  // Backgrounds, paper textures and the patterns/filters a style needs.
  function vdDefs(T, seed) {
    var d = '<filter id="vdSh" x="-10%" y="-10%" width="125%" height="130%"><feDropShadow dx="3" dy="5" stdDeviation="2.5" flood-color="#3a2a14" flood-opacity=".3"/></filter>' +
      '<filter id="vdWash" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="' + (seed % 97) + '"/><feDisplacementMap in="SourceGraphic" scale="24"/><feGaussianBlur stdDeviation="2"/></filter>' +
      '<filter id="vdGrain"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .28  0 0 0 0 .2  0 0 0 .09 0"/></filter>' +
      '<filter id="vdChalk"><feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="1" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4"/></filter>' +
      '<pattern id="vdGrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#e6ecf5" stroke-width="1"/></pattern>' +
      '<linearGradient id="vdSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe6ff"/><stop offset=".65" stop-color="#fdf2ff"/><stop offset="1" stop-color="#fff8ee"/></linearGradient>';
    if (T.fill === 'halftone') T.pens.forEach(function (c, i) { d += '<pattern id="vdHt' + i + '" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="4.5" cy="4.5" r="1.5" fill="' + c + '" fill-opacity=".55"/></pattern>'; });
    d += '<pattern id="vdDots" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="1.4" fill="#1d2b53" fill-opacity=".07"/></pattern>';
    return d;
  }
  function vdBg(T) {
    if (T.bg === 'sky') {
      var lines = ''; for (var i = 0; i < 14; i++) { var a = i * Math.PI / 7; lines += 'M' + (1280 + Math.cos(a) * 120).toFixed(0) + ' ' + (0 + Math.sin(a) * 120).toFixed(0) + ' L' + (1280 + Math.cos(a) * 900).toFixed(0) + ' ' + (Math.sin(a) * 900).toFixed(0) + ' '; }
      return '<rect width="1280" height="720" fill="url(#vdSky)"/><path d="' + lines + '" stroke="#ffffff" stroke-opacity=".45" stroke-width="10"/>';
    }
    var r = '<rect width="1280" height="720" fill="' + T.bg + '"/>';
    if (T.fill === 'hatch' && !T.chalk) r += '<rect width="1280" height="720" fill="url(#vdGrid)" opacity=".7"/>';
    if (T.fill === 'wash' || T.fill === 'paper') r += '<rect width="1280" height="720" filter="url(#vdGrain)"/>';
    if (T.fill === 'halftone') r += '<rect width="1280" height="720" fill="url(#vdDots)"/><rect x="18" y="18" width="1244" height="684" fill="none" stroke="#1d2b53" stroke-width="3" stroke-opacity=".5"/>';
    if (T.chalk) r += '<rect width="1280" height="720" filter="url(#vdGrain)" opacity=".6"/><rect x="0" y="0" width="1280" height="720" fill="none" stroke="#6b4f2a" stroke-width="22"/>';
    return r;
  }

  // Draw one scene (1280×720). Every stroke and word gets a place in the drawing order.
  function vdSceneSVG(v, sc, n, styleKey) {
    var T = VD_STYLES[styleKey] || VD_STYLES.whiteboard, P = T.pens;
    var S = Sketch((v.seed || 7) * 31 + n * 7, T), V = sc.visual, k = 0, pen = P[n % P.length];
    var at = function () { return k++; }, pc = function (i) { return P[(n + i) % P.length]; };
    var tx = function (s, x, y, o) { return S.text(s, x, y, o); };
    if (sc.kind !== 'title') {
      tx(sc.heading, 70, 92, { size: 58, chars: 40, title: true, at: at() });
      S.line(66, 112, 66 + Math.min(1000, Math.max(220, sc.heading.length * 25)), 116, { color: pen, w: 5, at: at() });
    }
    var K = sc.kind;
    if (K === 'title') {
      if (T.fill !== 'hatch') S.ellipse(640, 300, 470, 170, { fill: pc(1), noLine: true, at: at(), light: 0.6 });
      var h = tx(V.title, 640, 290, { size: 96, chars: 22, anchor: 'middle', title: true, mid: true, at: at() });
      S.line(380, 300 + h / 2, 900, 306 + h / 2, { color: pen, w: 6, at: at() });
      if (V.subtitle) tx(V.subtitle, 640, 372 + h / 2, { size: 40, chars: 46, anchor: 'middle', color: T.sub, at: at() });
      var ic = V.icons.length ? V.icons : ['scales'];
      ic.forEach(function (name, i) { S.icon(name, 640 - ic.length * 90 + i * 180 + 15, 490, 150, { color: pc(i), at: at(), idx: i }); });
    } else if (K === 'hypo' || K === 'apply') {
      var ch = V.characters, w = ch.length > 2 ? 205 : 255;
      S.path('M50 640 Q 320 ' + (626 + S.R() * 20).toFixed(0) + ' 640 640 T 1230 638', { color: T.sub, w: 2.4, at: at() });
      ch.forEach(function (c, i) {
        var x = 80 + i * (w + 30), mood = c.mood || (K === 'apply' ? (V.good ? 'happy' : 'sad') : 'happy');
        S.icon(c.icon, x, 630 - w - 40, w, { color: pc(i + 1), mood: mood, at: at(), idx: i });
        if (c.name) tx(c.name, x + w / 2, 630 - 18, { size: 40, anchor: 'middle', color: pc(i + 1), title: true, at: at() });
      });
      var bx = Math.max(560, 90 + ch.length * (w + 30)), bw = 1200 - bx;
      if (K === 'hypo') {
        if (V.bubble) {
          S.ellipse(bx + bw / 2, 240, bw / 2, 100, { fill: T.note === '#ffffff' ? pc(3) : pc(3), light: 0.78, at: at() });
          [[bx + 30, 352, 16], [bx - 10, 388, 11], [bx - 40, 414, 7]].forEach(function (b) { S.ellipse(b[0], b[1], b[2], b[2], { fill: pc(3), light: 0.78, at: k - 1, once: true }); });
          tx('“' + V.bubble + '”', bx + bw / 2, 240, { size: 36, chars: Math.round(bw / 19), anchor: 'middle', mid: true, at: at() });
        }
        V.props.forEach(function (p, i) { S.icon(p, bx + 20 + i * 180, 400, 150, { color: pc(i + 2), at: at() }); });
        if (V.label) { S.rect(1000, 30, 230, 64, { fill: T.note === '#ffffff' ? pc(2) : P[3], light: 0.7, once: true, noLine: T.fill !== 'hatch', at: at() }); tx(V.label, 1115, 72, { size: 34, anchor: 'middle', chars: 14, at: k - 1 }); }
      } else {
        var good = V.good !== false, col = T.chalk ? (good ? '#caffbf' : '#ffadad') : (good ? '#2a8a52' : '#d2453a');
        S.ellipse(bx + bw / 2, 330, Math.min(250, bw / 2 - 10), 170, { color: col, w: 6, fill: col, light: 0.85, at: at() });
        S.ellipse(bx + bw / 2, 330, Math.min(250, bw / 2 - 10) - 14, 156, { color: col, w: 2.5, once: true, at: k - 1 });
        tx(V.verdict || (good ? 'Yes' : 'No'), bx + bw / 2, 320, { size: 50, chars: 16, anchor: 'middle', mid: true, color: col, rot: -6, title: true, at: at() });
        S.icon(good ? 'tick' : 'cross', bx + bw / 2 - 50, 520, 100, { color: col, w: 7, at: at() });
      }
    } else if (K === 'principle') {
      S.icon(V.icon, 60, 160, 180, { color: pen, at: at() });
      S.rect(270, 150, 940, 230, { fill: T.fill === 'hatch' ? null : (T.note.charAt(0) === '#' ? P[3] : pen), light: 0.8, at: at() });
      if (T.fill !== 'hatch') S.solid('M' + 740 + ' 150 m-11 0 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0', P[0], { at: k - 1 });
      tx(V.rule, 300, 265, { size: 46, chars: 40, mid: true, at: at() });
      var pts = V.points, pw = pts.length ? Math.min(330, (1140 - (pts.length - 1) * 30) / pts.length) : 0;
      pts.forEach(function (p, i) {
        var x = 70 + i * (pw + 30) + (1140 - pts.length * pw - (pts.length - 1) * 30) / 2;
        vdArrow(S, 740, 392, x + pw / 2, 466, { color: T.sub, w: 2.6, at: at() }, (x + pw / 2 - 740) * 0.25);
        S.ellipse(x + pw / 2, 560, pw / 2, 86, { color: pc(i + 1), fill: pc(i + 1), light: 0.7, at: at() });
        tx(p, x + pw / 2, 560, { size: 33, chars: Math.max(10, Math.round(pw / 18)), anchor: 'middle', mid: true, at: at() });
      });
    } else if (K === 'steps') {
      var st = V.steps, sw = (1140 - (st.length - 1) * 50) / st.length;
      S.path('M70 640 ' + st.map(function (s, i) { var x = 70 + i * (sw + 50) + sw / 2; return 'Q ' + (x - sw / 2).toFixed(0) + ' ' + (i % 2 ? 600 : 680) + ' ' + x.toFixed(0) + ' 640'; }).join(' '), { color: T.sub, w: 2.4, at: at() });
      st.forEach(function (s, i) {
        var x = 70 + i * (sw + 50), col = pc(i);
        S.ellipse(x + 34, 214, 30, 30, { color: col, fill: col, light: 0.55, at: at() });
        tx(String(i + 1), x + 34, 232, { size: 48, anchor: 'middle', color: T.ink, title: true, at: k - 1 });
        S.icon(s.icon, x + sw / 2 - 40, 170, 110, { color: col, at: k - 1 });
        S.rect(x, 330, sw, 240, { color: col, fill: col, light: 0.82, at: at() });
        tx(s.label, x + sw / 2, 450, { size: 36, chars: Math.max(9, Math.round(sw / 18)), anchor: 'middle', mid: true, at: at() });
        if (i < st.length - 1) vdArrow(S, x + sw + 6, 450, x + sw + 44, 450, { color: T.ink, w: 3, at: at() });
      });
    } else if (K === 'case') {
      var nm = V.name + (V.year ? ' (' + V.year + ')' : '');
      S.poly([64, 150, 300, 150, 330, 128, 520, 128, 540, 150], false, { color: pen, w: 2.6, at: at() });
      S.mark(64, 146, Math.min(1150, nm.length * 24 + 60), 64, T.mark, k - 1);
      tx(nm, 84, 192, { size: 46, chars: 48, title: true, at: k - 1 });
      var heads = ['What happened', 'Decided', 'The rule'], pn = V.panels.length || 1, pw2 = (1140 - (pn - 1) * 50) / pn;
      V.panels.forEach(function (p, i) {
        var x = 70 + i * (pw2 + 50), col = pc(i);
        S.rect(x, 232, pw2, 420, { fill: col, light: 0.85, at: at() });
        S.ellipse(x + 28, 268, 20, 20, { color: col, fill: col, light: 0.5, once: true, at: k - 1 });
        tx(String(i + 1), x + 28, 281, { size: 30, anchor: 'middle', title: true, at: k - 1 });
        tx(heads[i] || '', x + 58, 280, { size: 30, color: col, at: at() });
        S.icon(p.icon, x + pw2 / 2 - 75, 304, 150, { color: col, at: at() });
        tx(p.label, x + pw2 / 2, 548, { size: 34, chars: Math.max(12, Math.round(pw2 / 18)), anchor: 'middle', mid: true, at: at() });
        if (i < pn - 1) vdArrow(S, x + pw2 + 6, 440, x + pw2 + 44, 440, { w: 3, at: at() });
      });
    } else if (K === 'roundup') {
      var cs = V.cases, two = cs.length > 2;
      cs.forEach(function (c, i) {
        var col = pc(i), x = two ? 70 + (i % 2) * 580 : 70, y = two ? 160 + Math.floor(i / 2) * 260 : 160 + i * 250, w2 = two ? 560 : 1140;
        S.rect(x, y, w2, 230, { color: col, fill: col, light: 0.85, at: at() });
        S.rect(x + w2 / 2 - 50, y - 14, 100, 28, { fill: '#ffffff', noLine: true, light: 0.2, once: true, at: k - 1 });
        S.icon(c.icon, x + 20, y + 45, 130, { color: col, at: at() });
        tx(c.name, x + 170, y + 70, { size: 34, chars: two ? 20 : 48, title: true, at: at() });
        tx(c.label, x + 170, y + 150, { size: 30, chars: two ? 22 : 52, color: T.sub, at: at() });
      });
    } else if (K === 'compare') {
      [V.left, V.right].forEach(function (s, i) {
        var x = i ? 690 : 70, col = pc(i * 2);
        S.rect(x, 150, 520, 500, { color: col, fill: col, light: 0.86, at: at() });
        S.icon(s.icon, x + 20, 170, 110, { color: col, at: at() });
        tx(s.title, x + 150, 230, { size: 40, chars: 16, title: true, color: col, mid: true, at: at() });
        s.points.forEach(function (p, j2) { tx('• ' + p, x + 30, 350 + j2 * 75, { size: 32, chars: 28, at: at() }); });
      });
      var vs = []; for (var a = 0; a < 16; a++) { var rr = a % 2 ? 30 : 56, an = a * Math.PI / 8; vs.push(640 + Math.cos(an) * rr, 400 + Math.sin(an) * rr); }
      S.poly(vs, true, { color: pc(3), fill: pc(3), light: 0.4, at: at() }); tx('vs', 640, 414, { size: 40, anchor: 'middle', title: true, at: k - 1 });
    } else if (K === 'quiz') {
      S.ellipse(640, 330, 470, 190, { fill: pc(1), light: 0.82, at: at() });
      [[260, 545, 22], [220, 590, 14], [190, 622, 9]].forEach(function (b) { S.ellipse(b[0], b[1], b[2], b[2], { fill: pc(1), light: 0.82, once: true, at: k - 1 }); });
      S.icon('person', 90, 500, 170, { color: pc(2), mood: 'thinking', at: at() });
      tx('?', 1150, 260, { size: 150, anchor: 'middle', title: true, color: pc(0), at: at() });
      tx(V.question, 640, 330, { size: 42, chars: 36, anchor: 'middle', mid: true, at: at() });
      tx('Pause and think…', 1150, 360, { size: 28, anchor: 'middle', color: T.sub, at: at() });
      S.rect(380, 560, 840, 120, { color: '#2a8a52', fill: '#2a8a52', light: 0.82, at: 'late' });
      tx(V.answer, 800, 620, { size: 34, chars: 46, anchor: 'middle', mid: true, at: 'late' });
    } else if (K === 'recap') {
      var rp = V.points, cols = rp.length > 3 ? 2 : 1;
      rp.forEach(function (p, i) {
        var x = 80 + (cols === 2 ? (i % 2) * 580 : 0), y = 170 + Math.floor(cols === 2 ? i / 2 : i) * 158, col = pc(i);
        S.rect(x - 14, y - 22, cols === 2 ? 540 : 1100, 118, { fill: col, light: 0.86, noLine: T.fill === 'hatch', once: true, at: at() });
        S.rect(x, y, 56, 56, { at: k - 1, once: true });
        S.icon('tick', x - 4, y - 14, 76, { color: '#2a8a52', w: 6, at: at() });
        tx(p, x + 80, y + 40, { size: 36, chars: cols === 2 ? 24 : 50, mid: true, at: at() });
      });
    }
    // A couple of doodles in the free top-right corner.
    if (K !== 'hypo') { S.deco(1180, 62, 22, pc(2), at()); S.deco(1232, 118, 14, pc(4), k - 1); }
    return { svg: S.svg(), steps: k };
  }
