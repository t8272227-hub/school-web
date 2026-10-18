// Раздел «Наглядно» (VisualScreen, Screens2.kt + Draw.kt) и рукописный ввод Kid.hand (Handwriting.kt).
// Вся математика считается в visual-lib.js, ИИ тут нужен только для распознавания рукописи.
(function () {
  'use strict';
  var Kid = window.Kid, L = window.Kid_visual, esc = Kid.esc;
  var GA = L.GraphAnalysis, fmt = GA.fmt;

  var BLUE = '#195ac8', RED = '#c82828', GREEN = '#14823c', ORANGE = '#c86e00', AXIS = '#282828', GRID = '#e0e0e0', DGRAY = '#444444';
  var PI = Math.PI;

  // ====================================================================== SVG-рисовалка (аналог Cv из Draw.kt)
  function n1(v) { return (Math.round(v * 10) / 10).toString(); }
  function Svg(w, h, bg) {
    this.w = w; this.h = h; this.o = [];
    this.o.push('<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="' + (bg || '#fff') + '"/>');
  }
  Svg.prototype = {
    st: function (stroke, width) { return stroke ? ' stroke="' + stroke + '" stroke-width="' + n1(width || 3) + '" stroke-linecap="round" stroke-linejoin="round"' : ''; },
    line: function (x1, y1, x2, y2, color, width) {
      this.o.push('<line x1="' + n1(x1) + '" y1="' + n1(y1) + '" x2="' + n1(x2) + '" y2="' + n1(y2) + '"' + this.st(color || '#000', width || 3) + '/>');
    },
    rect: function (l, t, r, b, fill, stroke, width, radius) {
      this.o.push('<rect x="' + n1(l) + '" y="' + n1(t) + '" width="' + n1(r - l) + '" height="' + n1(b - t) + '"' + (radius ? ' rx="' + radius + '"' : '') + ' fill="' + (fill || 'none') + '"' + this.st(stroke, width) + '/>');
    },
    circle: function (x, y, r, fill, stroke, width) {
      this.o.push('<circle cx="' + n1(x) + '" cy="' + n1(y) + '" r="' + n1(r) + '" fill="' + (fill || 'none') + '"' + this.st(stroke, width) + '/>');
    },
    oval: function (cx, cy, rx, ry, fill, stroke, width) {
      this.o.push('<ellipse cx="' + n1(cx) + '" cy="' + n1(cy) + '" rx="' + n1(rx) + '" ry="' + n1(ry) + '" fill="' + (fill || 'none') + '"' + this.st(stroke, width) + '/>');
    },
    polygon: function (pts, fill, stroke, width) {
      this.o.push('<polygon points="' + pts.map(function (p) { return n1(p[0]) + ',' + n1(p[1]); }).join(' ') + '" fill="' + (fill || 'none') + '"' + this.st(stroke, width) + '/>');
    },
    path: function (d, color, width) { this.o.push('<path d="' + d + '" fill="none"' + this.st(color, width) + '/>'); },
    arrow: function (x1, y1, x2, y2, color, width) {
      width = width || 5; this.line(x1, y1, x2, y2, color, width);
      var ang = Math.atan2(y2 - y1, x2 - x1), len = width * 3.2;
      var self = this;
      [0.5, -0.5].forEach(function (d) { var a = ang + PI - d; self.line(x2, y2, x2 + len * Math.cos(a), y2 + len * Math.sin(a), color, width); });
    },
    text: function (s, x, y, size, color, bold, anchor) {
      this.o.push('<text x="' + n1(x) + '" y="' + n1(y) + '" font-size="' + size + '" fill="' + (color || '#000') + '"' + (bold ? ' font-weight="700"' : '') +
        (anchor ? ' text-anchor="' + anchor + '"' : '') + ' font-family="Roboto, Arial, sans-serif" style="white-space:pre">' + esc(s) + '</text>');
    },
    raw: function (s) { this.o.push(s); },
    toString: function () {
      return '<svg class="fig" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + this.w + ' ' + this.h + '" width="' + this.w + '" height="' + this.h + '" role="img">' + this.o.join('') + '</svg>';
    },
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ------------------------------------------------------------ график
  function graphSvg(info, formula) {
    var w = 1000, h = 820, cv = new Svg(w, h);
    var left = 70, right = w - 40, top = 70, bottom = h - 60;
    var xs = (right - left) / (info.xMax - info.xMin), ys = (bottom - top) / (info.yMax - info.yMin);
    function px(x) { return left + (x - info.xMin) * xs; }
    function py(y) { return bottom - (y - info.yMin) * ys; }
    cv.text('y = ' + String(formula).trim(), w / 2, 42, 34, AXIS, true, 'middle');
    var sx = GA.niceStep(info.xMax - info.xMin), sy = GA.niceStep(info.yMax - info.yMin);
    var gx = Math.ceil(info.xMin / sx) * sx;
    while (gx <= info.xMax + 1e-9) {
      cv.line(px(gx), top, px(gx), bottom, GRID, 2);
      if (Math.abs(gx) > 1e-9) cv.text(fmt(gx), px(gx), clamp(py(0), top, bottom - 6) + 26, 22, DGRAY, false, 'middle');
      gx += sx;
    }
    var gy = Math.ceil(info.yMin / sy) * sy;
    while (gy <= info.yMax + 1e-9) {
      cv.line(left, py(gy), right, py(gy), GRID, 2);
      if (Math.abs(gy) > 1e-9) cv.text(fmt(gy), clamp(px(0), left + 8, right) - 8, py(gy) + 8, 22, DGRAY, false, 'end');
      gy += sy;
    }
    var ax = clamp(py(0), top, bottom), ay = clamp(px(0), left, right);
    cv.arrow(left, ax, right, ax, AXIS, 4);
    cv.arrow(ay, bottom, ay, top, AXIS, 4);
    cv.text('x', right - 4, ax - 12, 28, AXIS, true, 'end');
    cv.text('y', ay + 14, top + 14, 28, AXIS, true);
    cv.text('0', ay - 8, ax + 26, 22, DGRAY, false, 'end');
    // кривая (обрезаем по рамке графика)
    var d = '';
    L.GraphAnalysis.curveSegments(info, 900).forEach(function (seg) {
      if (seg.length < 2) return;
      d += seg.map(function (p, i) { return (i ? 'L' : 'M') + n1(px(p[0])) + ' ' + n1(py(p[1])); }).join('');
    });
    cv.raw('<clipPath id="vclip"><rect x="' + left + '" y="' + top + '" width="' + (right - left) + '" height="' + (bottom - top) + '"/></clipPath><g clip-path="url(#vclip)">');
    cv.path(d, BLUE, 6);
    cv.raw('</g>');
    // особые точки
    info.zeros.forEach(function (z) { cv.circle(px(z), py(0), 9, RED); cv.text('(' + fmt(z) + '; 0)', px(z), py(0) - 18, 22, RED, true, 'middle'); });
    if (info.yIntercept !== null && info.yIntercept >= info.yMin && info.yIntercept <= info.yMax) {
      cv.circle(px(0), py(info.yIntercept), 9, GREEN); cv.text('(0; ' + fmt(info.yIntercept) + ')', px(0) + 14, py(info.yIntercept) - 12, 22, GREEN, true);
    }
    if (info.vertex && info.vertex[1] >= info.yMin && info.vertex[1] <= info.yMax) {
      var v = info.vertex, pc = '#963cbe';
      cv.circle(px(v[0]), py(v[1]), 9, pc);
      cv.text('вершина (' + fmt(v[0]) + '; ' + fmt(v[1]) + ')', px(v[0]) + 14, py(v[1]) + (info.a > 0 ? 34 : -14), 22, pc, true);
    }
    return cv.toString();
  }

  // ------------------------------------------------------------ треугольник
  function triangleSvg(t) {
    var w = 1000, h = 820, cv = new Svg(w, h), pts = [t.A, t.B, t.C];
    var xsA = pts.map(function (p) { return p.x; }), ysA = pts.map(function (p) { return p.y; });
    var minX = Math.min.apply(null, xsA), maxX = Math.max.apply(null, xsA), minY = Math.min.apply(null, ysA), maxY = Math.max.apply(null, ysA);
    var margin = 150;
    var scale = Math.min((w - 2 * margin) / Math.max(maxX - minX, 1e-9), (h - 2 * margin) / Math.max(maxY - minY, 1e-9));
    var ox = (w - (maxX - minX) * scale) / 2, oy = (h - (maxY - minY) * scale) / 2 + 10;
    function sx(p) { return ox + (p.x - minX) * scale; }
    function sy(p) { return h - oy - (p.y - minY) * scale; }
    var a = [sx(t.A), sy(t.A)], b = [sx(t.B), sy(t.B)], c = [sx(t.C), sy(t.C)];
    cv.polygon([a, b, c], '#e8f0fe', BLUE, 6);
    var cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3;
    function outside(p, d) {
      var dx = p[0] - cx, dy = p[1] - cy, l = Math.max(Math.hypot(dx, dy), 1);
      return [p[0] + dx / l * d, p[1] + dy / l * d];
    }
    [['A', a], ['B', b], ['C', c]].forEach(function (n) { var o = outside(n[1], 38); cv.text(n[0], o[0], o[1] + 12, 38, AXIS, true, 'middle'); });
    function side(p, q, label) {
      var o = outside([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], 34);
      cv.text(label, o[0], o[1] + 9, 28, RED, true, 'middle');
    }
    side(b, c, 'a = ' + fmt(t.a)); side(a, c, 'b = ' + fmt(t.b)); side(a, b, 'c = ' + fmt(t.c));
    function angle(p, q, r, deg, isRight) {
      var v1 = Math.atan2(q[1] - p[1], q[0] - p[0]), v2 = Math.atan2(r[1] - p[1], r[0] - p[0]);
      var mid = (v1 + v2) / 2 + (Math.abs(v1 - v2) > PI ? PI : 0), rad = 56;
      if (isRight) {
        var d1x = Math.cos(v1) * 36, d1y = Math.sin(v1) * 36, d2x = Math.cos(v2) * 36, d2y = Math.sin(v2) * 36;
        cv.polygon([p, [p[0] + d1x, p[1] + d1y], [p[0] + d1x + d2x, p[1] + d1y + d2y], [p[0] + d2x, p[1] + d2y]], null, GREEN, 4);
      } else {
        var sweep = (v2 - v1) * 180 / PI;
        while (sweep > 180) sweep -= 360;
        while (sweep < -180) sweep += 360;
        var e = v1 + sweep * PI / 180;
        cv.path('M' + n1(p[0] + rad * Math.cos(v1)) + ' ' + n1(p[1] + rad * Math.sin(v1)) + ' A' + rad + ' ' + rad + ' 0 0 ' + (sweep > 0 ? 1 : 0) + ' ' + n1(p[0] + rad * Math.cos(e)) + ' ' + n1(p[1] + rad * Math.sin(e)), GREEN, 4);
      }
      cv.text(fmt(deg) + '°', p[0] + Math.cos(mid) * (rad + 40), p[1] + Math.sin(mid) * (rad + 40) + 9, 26, GREEN, true, 'middle');
    }
    angle(a, b, c, t.angleA, t.rightAt === 'A'); angle(b, a, c, t.angleB, t.rightAt === 'B'); angle(c, a, b, t.angleC, t.rightAt === 'C');
    cv.text('S = ' + fmt(t.area) + '    P = ' + fmt(t.perimeter) + '    ' + t.kind, w / 2, h - 30, 28, AXIS, false, 'middle');
    return cv.toString();
  }

  // ------------------------------------------------------------ схемы
  function waterSvg() {
    var w = 1000, h = 760, cv = new Svg(w, h, '#d6ecff');
    cv.text('Круговорот воды в природе', w / 2, 52, 38, AXIS, true, 'middle');
    cv.circle(120, 140, 50, '#ffcd28');
    for (var i = 0; i < 12; i++) { var a = i * PI / 6; cv.line(120 + 66 * Math.cos(a), 140 + 66 * Math.sin(a), 120 + 88 * Math.cos(a), 140 + 88 * Math.sin(a), '#ffbe00', 5); }
    cv.polygon([[560, 640], [800, 300], [1000, 640]], '#8c8c96');
    cv.polygon([[740, 380], [800, 300], [860, 380], [820, 360], [800, 385], [770, 360]], '#fff');
    cv.rect(0, 590, w, h, '#2878c8');
    for (i = 0; i < 8; i++) cv.text('~  ~  ~', 60 + i * 125, 640 + (i % 2) * 40, 30, '#a0cdf5');
    [[330, 190, 55], [400, 160, 70], [480, 190, 55], [400, 210, 55]].forEach(function (c) { cv.circle(c[0], c[1], c[2], '#f5f5fa', '#aab4c8', 3); });
    cv.text('Облако', 400, 270, 26, AXIS, true, 'middle');
    for (i = 0; i < 6; i++) cv.line(350 + i * 24, 280, 335 + i * 24, 345, '#1e5abe', 5);
    cv.arrow(200, 580, 270, 340, RED, 7);
    cv.text('Испарение', 80, 470, 28, RED, true);
    cv.arrow(470, 255, 640, 300, '#783ca0', 7);
    cv.text('Ветер переносит облака', 560, 250, 24, '#783ca0', true);
    cv.text('Осадки: дождь, снег', 330, 395, 28, '#1e5abe', true);
    cv.text('Конденсация', 300, 120, 28, '#5a5a6e', true);
    cv.path('M810 400 Q760 480 800 540 Q830 580 780 600', '#5aaaf0', 9);
    cv.text('Реки и ручьи', 835, 520, 24, '#fff', true);
    cv.text('Море, океан', 380, 715, 30, '#fff', true, 'middle');
    return cv.toString();
  }

  function cellSvg() {
    var w = 1000, h = 760, cv = new Svg(w, h);
    cv.text('Растительная клетка', w / 2, 50, 38, AXIS, true, 'middle');
    cv.rect(40, 90, 640, 710, '#c8e6be', '#1e7832', 12, 40);
    cv.rect(62, 112, 618, 688, '#e8f5de', '#78a078', 4, 30);
    cv.rect(190, 270, 520, 600, '#bee1fa', '#5a8cbe', 4, 80);
    cv.circle(150, 200, 62, '#e6bedc', '#8c4678', 5);
    cv.circle(150, 200, 22, '#8c4678');
    [[560, 170], [100, 520], [570, 640]].forEach(function (p) { cv.oval(p[0], p[1], 48, 26, '#3caa46', '#146428', 4); });
    [[330, 160], [110, 360]].forEach(function (p) { cv.oval(p[0], p[1], 44, 24, '#fabe78', '#be641e', 4); cv.line(p[0] - 30, p[1], p[0] + 30, p[1], '#be641e', 3); });
    function label(text, fromX, fromY, ty) { cv.line(fromX, fromY, 700, ty, DGRAY, 3); cv.text(text, 710, ty + 9, 28, AXIS, true); }
    label('Клеточная стенка', 40, 400, 130); label('Мембрана', 618, 300, 230); label('Ядро', 190, 190, 330); label('Вакуоль', 520, 430, 430);
    label('Хлоропласт', 608, 170, 530); label('Митохондрия', 374, 160, 630); label('Цитоплазма', 600, 520, 700);
    return cv.toString();
  }

  function atomSvg(idx) {
    var at = L.atomInfo(idx), w = 900, h = 900, cv = new Svg(w, h), cx = w / 2, cy = 470, sh = at.shells;
    cv.text('Атом: ' + at.name + ' (' + at.sym + ')', cx, 56, 38, AXIS, true, 'middle');
    var step = 330 / (sh.length + 0.5);
    var outer = 80 + step * (sh.length - 0.5) + (sh.length - 1) * 10, shrink = Math.min(1, 295 / outer);   // крупные атомы не налезают на подписи
    sh.forEach(function (count, i) {
      var r = (80 + step * (i + 0.5) + i * 10) * shrink;
      cv.circle(cx, cy, r, null, '#787896', 4);
      for (var k = 0; k < count; k++) {
        var ang = 2 * PI * k / count - PI / 2;
        cv.circle(cx + r * Math.cos(ang), cy + r * Math.sin(ang), 14, '#1e5ac8', '#0a2878', 3);
      }
    });
    cv.circle(cx, cy, 52, '#e65050', '#8c1414', 4);
    cv.text(at.z + ' p⁺', cx, cy - 4, 24, '#fff', true, 'middle');
    cv.text(at.n + ' n', cx, cy + 26, 24, '#fff', true, 'middle');
    cv.text('Протонов: ' + at.z + '   Нейтронов: ' + at.n + '   Электронов: ' + at.z, cx, h - 90, 28, AXIS, false, 'middle');
    cv.text('Электроны по слоям: ' + at.shellText, cx, h - 48, 28, AXIS, false, 'middle');
    return { svg: cv.toString(), facts: at.facts };
  }

  function timelineSvg(title, items) {
    var n = Math.max(items.length, 1), w = Math.max(1000, 220 * n + 120), h = 640, cv = new Svg(w, h);
    cv.text(String(title).trim() ? title : 'Лента времени', w / 2, 54, 38, AXIS, true, 'middle');
    var y0 = h / 2;
    cv.arrow(40, y0, w - 30, y0, AXIS, 7);
    var gap = (w - 160) / n;
    items.forEach(function (it, i) {
      var x = 100 + gap * (i + 0.5);
      cv.circle(x, y0, 15, BLUE, '#fff', 4);
      var up = i % 2 === 0;
      cv.line(x, y0 + (up ? -15 : 15), x, y0 + (up ? -80 : 80), '#888', 3);
      var ty = up ? y0 - 100 : y0 + 112, lines = L.wrapText(it[1], gap * 1.7, 26, false);
      cv.text(it[0], x, up ? y0 - 100 - 36 * lines.length - 8 : y0 + 106, 32, RED, true, 'middle');
      var yy = up ? y0 - 100 - 36 * lines.length + 28 : ty + 36;
      lines.forEach(function (l) { cv.text(l, x, yy, 26, AXIS, false, 'middle'); yy += 32; });
    });
    return cv.toString();
  }

  // ====================================================================== состояние раздела
  if (!document.getElementById('visual-style')) {
    var vs = document.createElement('style'); vs.id = 'visual-style'; vs.textContent = 'svg.fig{width:100%;height:auto;display:block}'; document.head.appendChild(vs);
  }
  var m = Kid.mod('visual', {
    mode: 'График', formula: 'x^2-4x+3', tri: '6, 8, 10', col: '1248:12',
    scheme: L.SCHEME_NAMES[0], element: L.ELEMENT_NAMES[5], title: 'Великая Отечественная война',
    events: '1941 — Начало войны\n1942 — Сталинградская битва\n1943 — Курская битва\n1945 — Победа',
    graph: null, triangle: null, column: null, pic: null, errG: '', errT: '', errC: '', msg: '',
  });
  var MODES = ['График', 'Чертёж', 'Столбик', 'Картинка'];

  function picView(p, key) {
    var h = '<div class="card" style="background:#fff;padding:8px">' + p.svg + '</div>';
    if (p.facts && p.facts.trim()) h += '<div class="card"><pre>' + esc(p.facts) + '</pre></div>';
    return h + exportBar(key);
  }
  function exportBar(key) {
    return '<div class="row"><button class="b t" data-act="vWord" data-v="' + key + '">Word</button><button class="b t" data-act="vPrint" data-v="' + key + '">PDF / печать</button></div>' +
      (m.msg ? '<p class="mut">' + esc(m.msg) + '</p>' : '');
  }
  function pane() {
    if (m.mode === 'График') {
      return Kid.input('visual.formula', m.formula, 'Формула: y =') + '<p class="mut">x^2-4x+3, 2x-1, sin(x), 1/x</p>' +
        '<button class="b" data-act="vGraph">Построить график</button>' + Kid.err(m.errG) + (m.graph ? picView(m.graph, 'graph') : '');
    }
    if (m.mode === 'Чертёж') {
      return Kid.input('visual.tri', m.tri, 'Стороны или катеты') + '<p class="mut">6, 8, 10   или   катеты 3 и 4</p>' +
        '<button class="b" data-act="vTri">Построить чертёж</button>' + Kid.err(m.errT) + (m.triangle ? picView(m.triangle, 'triangle') : '');
    }
    if (m.mode === 'Столбик') {
      var h = Kid.input('visual.col', m.col, 'Пример') + '<p class="mut">2345+678, 5002−1789, 357×24, 1248:12</p>' +
        '<button class="b" data-act="vCol">Решить столбиком</button>' + Kid.err(m.errC), r = m.column;
      if (r) {
        h += '<div class="card" style="background:#fff"><b>' + esc(r.title) + '</b><pre style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:18px;white-space:pre;overflow-x:auto;line-height:1.35">' + esc(r.lines.join('\n')) + '</pre></div>';
        h += '<div class="card"><b>По шагам</b>' + r.steps.map(function (s, i) { return '<p style="margin:6px 0">' + (i + 1) + '. ' + esc(s) + '</p>'; }).join('') + '</div>';
        h += '<div class="card good"><b style="font-size:18px">Ответ: ' + esc(r.answer) + '</b>' + (r.estimate ? '<div class="mut">' + esc(r.estimate) + '</div>' : '') + '</div>';
        h += exportBar('column');
      }
      return h;
    }
    // Картинка
    var s = m.scheme, h2 = Kid.chips(L.SCHEME_NAMES, s, 'vScheme');
    if (s === 'Атом') h2 += '<label>Элемент</label>' + Kid.chips(L.ELEMENT_NAMES, m.element, 'vElement');
    if (s === 'Лента времени') h2 += Kid.input('visual.title', m.title, 'Название') + Kid.textarea('visual.events', m.events, 'События (по строке: «год — событие»)');
    return h2 + '<button class="b" data-act="vDraw">Нарисовать</button>' + (m.pic ? picView(m.pic, 'pic') : '');
  }
  function view() {
    return Kid.head('Наглядно', 'Рисую точно: считает приложение, а не ИИ') + Kid.chips(MODES, m.mode, 'vMode') + pane();
  }

  // ====================================================================== экспорт
  function svgToPng(svg, w, h) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        var g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
        try { resolve(cv.toDataURL('image/png')); } catch (e) { reject(e); }
      };
      img.onerror = function () { reject(new Error('Не удалось подготовить картинку.')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  function svgSize(svg) { var r = /viewBox="0 0 (\d+) (\d+)"/.exec(svg); return [+r[1], +r[2]]; }
  function fileTitle(key) {
    if (key === 'graph') return 'График y = ' + String(m.formula).trim();
    if (key === 'triangle') return 'Чертёж треугольника';
    if (key === 'column') return 'Столбик ' + String(m.col).replace(/\s/g, '').slice(0, 20);
    return (m.pic && m.pic.title) || 'Картинка';
  }
  function paragraphs(text) { return String(text).split('\n').map(function (l) { return '<p>' + esc(l) + '</p>'; }).join(''); }
  // HTML для Word и печати; asImg: для Word вставляем PNG, для печати оставляем SVG
  function docBody(key, imgHtml) {
    var t = fileTitle(key), h = '<h1>' + esc(t) + '</h1>';
    if (key === 'column') {
      var r = m.column;
      return h + '<pre style="font-family:Courier New,monospace;font-size:16pt">' + esc(r.lines.join('\n')) + '</pre>' +
        r.steps.map(function (s, i) { return '<p>' + (i + 1) + '. ' + esc(s) + '</p>'; }).join('') + '<p><b>Ответ: ' + esc(r.answer) + '</b></p>';
    }
    var p = key === 'graph' ? m.graph : key === 'triangle' ? m.triangle : m.pic;
    h += imgHtml + (p.facts && p.facts.trim() ? paragraphs(p.facts) : '');
    if (p.extra && p.extra.length) h += '<pre style="font-family:Courier New,monospace">' + esc(p.extra.join('\n')) + '</pre>';
    return h;
  }
  function picOf(key) { return key === 'graph' ? m.graph : key === 'triangle' ? m.triangle : key === 'pic' ? m.pic : m.column; }

  // ====================================================================== действия
  function cleanErr(e) { return e && e.message ? e.message : 'Не получилось построить график.'; }
  Kid.register({ key: 'visual', title: 'Наглядно', subtitle: 'График, чертёж, столбик, схемы', view: view, acts: {
    vMode: function (v) { m.mode = v; m.msg = ''; },
    vGraph: function () {
      m.errG = ''; m.msg = '';
      try {
        var info = GA.analyze(L.MathExpr.parse(m.formula));
        m.graph = { svg: graphSvg(info, m.formula), title: 'График y = ' + String(m.formula).trim(), facts: GA.describe(info),
          extra: info.table.map(function (r) { return 'x = ' + fmt(r[0]) + '   y = ' + (r[1] === null ? 'нет' : fmt(r[1])); }) };
      } catch (e) {
        m.graph = null;
        m.errG = e instanceof L.MathParseError ? (e.message || 'Не получилось разобрать формулу.') : 'Не получилось построить график.';
      }
    },
    vTri: function () {
      m.msg = '';
      var t = L.TriangleGeometry.fromText(m.tri);
      if (!t) { m.triangle = null; m.errT = L.TriangleGeometry.problemMessage(m.tri); return; }
      m.errT = '';
      var facts = 'Стороны: a = ' + fmt(t.a) + ', b = ' + fmt(t.b) + ', c = ' + fmt(t.c) + '.\n' +
        'Углы: A = ' + fmt(t.angleA) + '°, B = ' + fmt(t.angleB) + '°, C = ' + fmt(t.angleC) + '°.\n' +
        'Периметр P = ' + fmt(t.perimeter) + ', площадь S = ' + fmt(t.area) + '.\nВид: ' + t.kind + '.';
      m.triangle = { svg: triangleSvg(t), title: 'Чертёж треугольника', facts: facts };
    },
    vCol: function () {
      m.msg = '';
      var r = L.ColumnMath.solve(m.col);
      m.column = r;
      m.errC = r ? '' : 'Запиши пример так: 2345+678, 5002−1789, 357×24 или 1248:12.';
    },
    vScheme: function (v) { m.scheme = v; m.pic = null; m.msg = ''; },
    vElement: function (v) { m.element = v; },
    vDraw: function () {
      m.msg = '';
      if (m.scheme === 'Круговорот воды') m.pic = { svg: waterSvg(), title: 'Круговорот воды в природе', facts: L.WATER_FACTS };
      else if (m.scheme === 'Растительная клетка') m.pic = { svg: cellSvg(), title: 'Растительная клетка', facts: L.CELL_FACTS };
      else if (m.scheme === 'Атом') {
        var a = atomSvg(Math.max(0, L.ELEMENT_NAMES.indexOf(m.element)));
        m.pic = { svg: a.svg, title: 'Атом: ' + m.element, facts: a.facts };
      } else {
        var items = L.parseTimeline(m.events);
        m.pic = { svg: timelineSvg(m.title, items), title: String(m.title).trim() || 'Лента времени', facts: items.map(function (i) { return i[0] + ' — ' + i[1]; }).join('\n') };
      }
    },
    vWord: function (key) {
      var p = picOf(key); if (!p) return;
      m.msg = '';
      if (key === 'column') { Kid.saveWord(fileTitle(key), docBody(key, '')); m.msg = 'Файл Word сохранён.'; return; }
      var sz = svgSize(p.svg);
      return svgToPng(p.svg, sz[0], sz[1]).then(function (png) {
        Kid.saveWord(fileTitle(key), docBody(key, '<p><img src="' + png + '" width="620" alt="' + esc(p.title) + '"></p>')); m.msg = 'Файл Word сохранён.';
      }, function (e) { m.msg = e.message; });
    },
    vPrint: function (key) {
      var p = picOf(key); if (!p) return;
      var ok = Kid.printHtml(fileTitle(key), docBody(key, '<div style="max-width:100%">' + (key === 'column' ? '' : p.svg.replace(/width="\d+" height="\d+"/, 'style="width:100%;height:auto"')) + '</div>'));
      m.msg = ok ? '' : 'Браузер заблокировал окно печати. Разреши всплывающие окна для этой страницы.';
    },
  } });

  // Enter в полях раздела = нажатие главной кнопки
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.isComposing) return;
    var b = e.target && e.target.getAttribute && e.target.getAttribute('data-bind');
    var map = { 'visual.formula': 'vGraph', 'visual.tri': 'vTri', 'visual.col': 'vCol' };
    if (b && map[b]) { var btn = document.querySelector('[data-act="' + map[b] + '"]'); if (btn) btn.click(); }
  });

  // ====================================================================== Рукописный ввод: Kid.hand
  var HW_CSS = '#hw-overlay{position:fixed;inset:0;z-index:30;background:#fff;display:flex;flex-direction:column;color:#1d1b26;font:16px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
    '#hw-overlay .hw-bar{flex:none;display:flex;align-items:center;gap:6px;padding:6px 8px;overflow-x:auto;border-bottom:1px solid #ddd6ee;min-height:56px}' +
    '#hw-overlay .hw-bar button{flex:none;font:inherit;border:1px solid #ddd6ee;background:#fff;color:#625d72;border-radius:999px;padding:8px 12px;cursor:pointer;white-space:nowrap}' +
    '#hw-overlay .hw-bar button.on{background:#6a4fc2;border-color:#6a4fc2;color:#fff}' +
    '#hw-overlay .hw-bar .hw-x{font-size:20px;line-height:1;padding:6px 12px}' +
    '#hw-overlay .hw-bar .sw{width:30px;height:30px;padding:0;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 1px #ddd6ee}' +
    '#hw-overlay .hw-bar .sw.on{box-shadow:0 0 0 3px #6a4fc2;background-clip:padding-box}' +
    '#hw-overlay .hw-bar .sep{flex:none;width:1px;height:26px;background:#ddd6ee;margin:0 2px}' +
    '#hw-overlay .hw-main{flex:1 1 auto;overflow-y:auto;min-height:0;-webkit-overflow-scrolling:touch}' +
    '#hw-overlay canvas{display:block;width:100%;background:#fff;touch-action:none;cursor:crosshair}' +
    '#hw-overlay .hw-res{padding:16px;max-width:820px;margin:0 auto}' +
    '#hw-overlay .hw-res textarea{width:100%;min-height:110px;font:inherit;padding:10px 12px;border:1px solid #ddd6ee;border-radius:12px}' +
    '#hw-overlay .hw-res button{font:inherit;font-weight:600;border:0;border-radius:999px;padding:11px 18px;background:#6a4fc2;color:#fff;cursor:pointer;margin:8px 8px 0 0;max-width:100%}' +
    '#hw-overlay .hw-res button.t{background:#ece6fb;color:#6a4fc2}' +
    '#hw-overlay .hw-res .e{color:#b3261e;margin:8px 0}#hw-overlay .hw-res .mut{color:#625d72;font-size:14px}' +
    '#hw-overlay .hw-foot{flex:none;padding:12px 16px;border-top:1px solid #ddd6ee}' +
    '#hw-overlay .hw-foot button{width:100%;font:inherit;font-weight:600;border:0;border-radius:999px;padding:12px 18px;background:#6a4fc2;color:#fff;cursor:pointer}' +
    '#hw-overlay .hw-foot button:disabled{opacity:.5;cursor:default}';
  var COLORS = ['#111111', '#195ac8', '#c82828', '#14823c'], WIDTHS = [[1.5, 'Тонкая'], [2, 'Средняя'], [3.5, 'Толстая']];

  var hw = null;   // состояние открытого окна; null, когда закрыто
  function hwOpen(onDone) {
    if (hw) hwClose();
    if (!document.getElementById('hw-style')) { var st = document.createElement('style'); st.id = 'hw-style'; st.textContent = HW_CSS; document.head.appendChild(st); }
    var stylusOnly = false; try { stylusOnly = !!Kid.store('hw.stylusOnly', false); } catch (e) { /* без настроек */ }
    hw = { cb: typeof onDone === 'function' ? onDone : function () {}, strokes: [], live: null, eraser: false, color: COLORS[0], base: 2, stylusOnly: stylusOnly,
      result: '', busy: false, error: '', token: {}, cssW: 0, cssH: 0, prevOverflow: document.body.style.overflow };
    var el = hw.el = document.createElement('div');
    el.id = 'hw-overlay'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Рукописный ввод');
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    hwBuild();
    window.addEventListener('resize', hwResize);
    document.addEventListener('keydown', hwKey, true);
  }
  function hwKey(e) { if (hw && e.key === 'Escape') { e.preventDefault(); hwClose(); } }
  function hwClose() {
    if (!hw) return;
    window.removeEventListener('resize', hwResize); document.removeEventListener('keydown', hwKey, true);
    document.body.style.overflow = hw.prevOverflow || '';
    hw.token = null;   // ответ ИИ, пришедший позже, игнорируем
    if (hw.el.parentNode) hw.el.parentNode.removeChild(hw.el);
    hw = null;
  }
  function btn(id, label, on, extra) { return '<button type="button" data-hw="' + id + '"' + (on ? ' class="on"' : '') + (extra || '') + '>' + label + '</button>'; }
  function hwBuild() {
    var h = '<div class="hw-bar"><button type="button" class="hw-x" data-hw="close" aria-label="Закрыть">✕</button>' +
      btn('stylus', 'Только стилус', hw.stylusOnly) + btn('touch', 'Стилус, палец, мышь', !hw.stylusOnly) + '<span class="sep"></span>' +
      btn('pen', 'Ручка', !hw.eraser) + btn('eraser', 'Ластик', hw.eraser) + '<span class="sep"></span>' +
      COLORS.map(function (c) { return '<button type="button" class="sw' + (hw.color === c && !hw.eraser ? ' on' : '') + '" data-hw="color" data-c="' + c + '" style="background:' + c + '" aria-label="Цвет"></button>'; }).join('') +
      '<span class="sep"></span>' + WIDTHS.map(function (w) { return btn('width', w[1], hw.base === w[0], ' data-w="' + w[0] + '"'); }).join('') +
      '<span class="sep"></span>' + btn('undo', 'Отменить', false) + btn('clear', 'Очистить', false) + '</div>' +
      '<div class="hw-main"><canvas></canvas><div class="hw-res"></div></div>' +
      '<div class="hw-foot"><button type="button" data-hw="recognize">Распознать запись</button></div>';
    hw.el.innerHTML = h;
    hw.cv = hw.el.querySelector('canvas');
    hw.res = hw.el.querySelector('.hw-res');
    hw.main = hw.el.querySelector('.hw-main');
    hw.bar = hw.el.querySelector('.hw-bar');
    hw.foot = hw.el.querySelector('.hw-foot');
    hw.el.onclick = hwClick;
    hwSizeCanvas(); hwBindCanvas(); hwResult();
  }
  function hwRefreshBar() {
    // обновляем только подсветку кнопок: рисунок и прокрутка панели не сбрасываются
    hw.bar.querySelectorAll('[data-hw]').forEach(function (b) {
      var id = b.getAttribute('data-hw'), on;
      if (id === 'stylus') on = hw.stylusOnly; else if (id === 'touch') on = !hw.stylusOnly;
      else if (id === 'pen') on = !hw.eraser; else if (id === 'eraser') on = hw.eraser;
      else if (id === 'color') on = hw.color === b.getAttribute('data-c') && !hw.eraser;
      else if (id === 'width') on = hw.base === parseFloat(b.getAttribute('data-w'));
      else return;
      b.classList.toggle('on', on);
    });
  }
  function hwSizeCanvas() {
    var w = Math.max(200, Math.floor(hw.main.clientWidth)), h = Math.max(260, Math.floor(hw.el.clientHeight - hw.bar.offsetHeight - hw.foot.offsetHeight - 8));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    hw.cssW = w; hw.cssH = h; hw.dpr = dpr;
    hw.cv.width = Math.round(w * dpr); hw.cv.height = Math.round(h * dpr);
    hw.cv.style.height = h + 'px';
    hwRedraw();
  }
  function hwResize() { if (hw) hwSizeCanvas(); }
  function hwSeg(g, s, i) {
    g.strokeStyle = s.color; g.fillStyle = s.color; g.lineWidth = s.widths[i]; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(s.pts[i - 1].x, s.pts[i - 1].y); g.lineTo(s.pts[i].x, s.pts[i].y); g.stroke();
  }
  function hwDrawStroke(g, s) {
    if (s.pts.length === 1) { g.fillStyle = s.color; g.beginPath(); g.arc(s.pts[0].x, s.pts[0].y, s.widths[0] / 2, 0, 2 * PI); g.fill(); }
    for (var i = 1; i < s.pts.length; i++) hwSeg(g, s, i);
  }
  function hwRedraw() {
    var g = hw.cv.getContext('2d');
    g.setTransform(hw.dpr, 0, 0, hw.dpr, 0, 0);
    g.fillStyle = '#fff'; g.fillRect(0, 0, hw.cssW, hw.cssH);
    g.strokeStyle = '#e3e8f0'; g.lineWidth = 1;
    for (var y = 56; y < hw.cssH; y += 56) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(hw.cssW, y + 0.5); g.stroke(); }
    hw.strokes.forEach(function (s) { hwDrawStroke(g, s); });
    if (hw.live) hwDrawStroke(g, hw.live);
  }
  function hwBindCanvas() {
    var cv = hw.cv, active = null;
    function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function widthFor(e) {
      var pr = (e.pointerType === 'pen' && e.pressure > 0) ? e.pressure : 0.5;
      return hw.base + hw.base * 1.6 * pr;
    }
    function eraseAt(p) {
      var before = hw.strokes.length, reach = 22;
      hw.strokes = hw.strokes.filter(function (s) { return !s.pts.some(function (q) { return Math.hypot(q.x - p.x, q.y - p.y) < reach; }); });
      if (hw.strokes.length !== before) hwRedraw();
    }
    cv.addEventListener('pointerdown', function (e) {
      if (!hw || active !== null) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var isStylus = e.pointerType === 'pen';
      if (hw.stylusOnly && !isStylus) return;
      var erasing = hw.eraser || (e.pointerType === 'pen' && (e.buttons & 32) === 32);
      active = { id: e.pointerId, erasing: erasing };
      try { cv.setPointerCapture(e.pointerId); } catch (x) { /* не критично */ }
      e.preventDefault();
      var p = pos(e);
      if (erasing) eraseAt(p);
      else { hw.live = { pts: [p], widths: [widthFor(e)], color: hw.color }; hwRedraw(); }
    });
    cv.addEventListener('pointermove', function (e) {
      if (!hw || !active || e.pointerId !== active.id) return;
      e.preventDefault();
      var evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [e];
      if (!evs.length) evs = [e];
      evs.forEach(function (ev) {
        var p = pos(ev);
        if (active.erasing) eraseAt(p);
        else if (hw.live) {
          hw.live.pts.push(p); hw.live.widths.push(widthFor(ev));
          var g = cv.getContext('2d'); g.setTransform(hw.dpr, 0, 0, hw.dpr, 0, 0); hwSeg(g, hw.live, hw.live.pts.length - 1);
        }
      });
    });
    function end(e) {
      if (!hw || !active || e.pointerId !== active.id) return;
      if (!active.erasing && hw.live) { hw.strokes.push(hw.live); }
      hw.live = null; active = null; hwRedraw();
    }
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }
  function hwResult() {
    var h = '';
    if (hw.busy) h += '<p class="mut">Читаю запись…</p>';
    if (hw.error) h += '<p class="e">' + esc(hw.error) + '</p>';
    if (hw.result) {
      h += '<p class="mut">Распознанная запись (можно править)</p><textarea data-hw-text>' + esc(hw.result) + '</textarea>' +
        '<button type="button" data-hw="done">Вставить в задание</button><button type="button" class="t" data-hw="solve">Вставить и решить по шагам</button>';
    }
    hw.res.innerHTML = h;
    var ta = hw.res.querySelector('textarea');
    if (ta) ta.addEventListener('input', function () { hw.result = ta.value; });
    var rb = hw.el.querySelector('[data-hw="recognize"]'); if (rb) rb.disabled = hw.busy;
  }
  // Картинка для ИИ: белый фон, чёрные штрихи, как в Kotlin
  function hwImage() {
    var cv = document.createElement('canvas'); cv.width = hw.cssW; cv.height = hw.cssH;
    var g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    hw.strokes.forEach(function (s) { hwDrawStroke(g, { pts: s.pts, widths: s.widths, color: '#000' }); });
    return cv.toDataURL('image/jpeg', 0.85);
  }
  function hwRecognize() {
    if (hw.busy) return;
    if (!hw.strokes.length || !hw.cssW || !hw.cssH) { hw.error = 'Сначала напиши что-нибудь.'; hwResult(); return; }
    var data = hwImage(), tok = hw.token;
    hw.busy = true; hw.error = ''; hwResult();
    Kid.askAI(HAND_PROMPT, 'Перепиши эту запись.', data, 1500, 0).then(function (text) {
      if (!hw || hw.token !== tok) return;
      Kid.touchToday(); hw.busy = false; hw.result = String(text).trim(); if (!hw.result) hw.error = 'ИИ вернул пустой ответ. Попробуй ещё раз.';
      hwResult(); hw.main.scrollTop = hw.main.scrollHeight;
    }, function (err) {
      if (!hw || hw.token !== tok) return;
      hw.busy = false; hw.error = (err && err.message) || 'Не получилось распознать.'; hwResult();
    });
  }
  // Prompts.handwriting()
  var HAND_PROMPT = 'Это рукописная запись школьника. Перепиши текст в точности как написано, ничего не решай и не исправляй, ' +
    'даже ошибки. Каждую строку записи выводи с новой строки. Формулы пиши в одну строку. Если слово неразборчиво, поставь [?]. ' +
    'Выводи только перепечатанный текст.';

  function hwClick(e) {
    var b = e.target.closest && e.target.closest('[data-hw]'); if (!b || !hw) return;
    var id = b.getAttribute('data-hw');
    if (id === 'close') hwClose();
    else if (id === 'stylus' || id === 'touch') { hw.stylusOnly = id === 'stylus'; try { Kid.saveStore('hw.stylusOnly', hw.stylusOnly); } catch (x) { /* ок */ } hwRefreshBar(); }
    else if (id === 'pen') { hw.eraser = false; hwRefreshBar(); }
    else if (id === 'eraser') { hw.eraser = true; hwRefreshBar(); }
    else if (id === 'color') { hw.color = b.getAttribute('data-c'); hw.eraser = false; hwRefreshBar(); }
    else if (id === 'width') { hw.base = parseFloat(b.getAttribute('data-w')); hwRefreshBar(); }
    else if (id === 'undo') { if (hw.strokes.length) { hw.strokes.pop(); hwRedraw(); } }
    else if (id === 'clear') { hw.strokes = []; hw.result = ''; hw.error = ''; hwRedraw(); hwResult(); }
    else if (id === 'recognize') hwRecognize();
    else if (id === 'done' || id === 'solve') {
      var text = hw.result, cb = hw.cb, solve = id === 'solve';
      hwClose();
      try { cb(text, solve); } catch (err) { console.error(err); }
    }
  }

  Kid.hand = { open: hwOpen, close: hwClose, isOpen: function () { return !!hw; } };
})();
