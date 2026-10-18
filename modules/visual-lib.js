// Чистая логика раздела «Наглядно» (без DOM), проверяется в Node.
// Порт MathExpr.kt, GraphAnalysis.kt, TriangleGeometry.kt, ColumnMath.kt и данных схем из Draw.kt.
// Формат как в sync.js: module.exports или window.Kid_visual
(function (root) {
  'use strict';

  // kotlin.math.round: до ближайшего целого, половинки к чётному
  function rint(v) {
    var f = Math.floor(v), d = v - f;
    if (d < 0.5) return f;
    if (d > 0.5) return f + 1;
    return f % 2 === 0 ? f : f + 1;
  }
  function isFinite_(v) { return !isNaN(v) && v !== Infinity && v !== -Infinity; }
  function isDigit(c) { return c !== undefined && c >= '0' && c <= '9'; }
  function minOf(a) { return Math.min.apply(null, a); }
  function maxOf(a) { return Math.max.apply(null, a); }
  function numSort(a) { return a.slice().sort(function (p, q) { return p - q; }); }
  function cap1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ====================================================================== MathExpr
  function MathParseError(message) { this.name = 'MathParseError'; this.message = message; this.stack = (new Error(message)).stack; }
  MathParseError.prototype = Object.create(Error.prototype);
  MathParseError.prototype.constructor = MathParseError;

  var FUNCS = ['sqrt', 'sin', 'cos', 'tan', 'abs', 'exp', 'log', 'ln'];
  var SUPERS = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };

  function power(a, b) {
    if (a < 0 && b !== Math.floor(b)) return NaN;
    return Math.pow(a, b);
  }
  var E = {
    num: function (v) { return { eval: function () { return v; } }; },
    x: function () { return { eval: function (x) { return x; } }; },
    neg: function (e) { return { eval: function (x) { return -e.eval(x); } }; },
    bin: function (op, l, r) {
      return { eval: function (x) {
        var a = l.eval(x), b = r.eval(x);
        switch (op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': return b === 0 ? NaN : a / b;
          default: return power(a, b);
        }
      } };
    },
    fn: function (name, e) {
      return { eval: function (x) {
        var v = e.eval(x);
        switch (name) {
          case 'sqrt': return v < 0 ? NaN : Math.sqrt(v);
          case 'abs': return Math.abs(v);
          case 'sin': return Math.sin(v);
          case 'cos': return Math.cos(v);
          case 'tan': return Math.tan(v);
          case 'ln': return v <= 0 ? NaN : Math.log(v);
          case 'log': return v <= 0 ? NaN : Math.log10(v);
          default: return Math.exp(v);
        }
      } };
    },
  };

  /** Приводит запись к виду, который понимает разборщик. */
  function normalize(raw) {
    var s = String(raw).trim();
    s = s.replace(/−/g, '-').replace(/–/g, '-').replace(/—/g, '-')
      .replace(/·/g, '*').replace(/×/g, '*').replace(/÷/g, '/')
      .replace(/х/g, 'x').replace(/Х/g, 'x').replace(/X/g, 'x')
      .replace(/,/g, '.').replace(/\s+/g, '');
    s = s.replace(/√/g, 'sqrt');
    s = s.toLowerCase();
    var eq = s.indexOf('=');
    if (eq >= 0) {
      var left = s.substring(0, eq);
      if (left === 'y' || left === 'f(x)' || left === 'g(x)' || left === 'y(x)') s = s.substring(eq + 1);
    }
    return s;
  }

  function Parser(s) { this.s = s; this.pos = 0; }
  Parser.prototype.peek = function () { return this.pos < this.s.length ? this.s[this.pos] : undefined; };
  Parser.prototype.expression = function () {
    var left = this.term();
    for (;;) {
      var c = this.peek();
      if (c === '+' || c === '-') { this.pos++; left = E.bin(c, left, this.term()); } else return left;
    }
  };
  Parser.prototype.startsPrimary = function () {
    var c = this.peek();
    if (c === undefined) return false;
    if (isDigit(c) || c === '.' || c === 'x' || c === '(' || c === 'p') return true;
    var self = this;
    return FUNCS.some(function (f) { return self.s.indexOf(f, self.pos) === self.pos; });
  };
  Parser.prototype.term = function () {
    var left = this.unary();
    for (;;) {
      var c = this.peek();
      if (c === '*' || c === '/') { this.pos++; left = E.bin(c, left, this.unary()); }
      else if (this.startsPrimary()) left = E.bin('*', left, this.unary());   // неявное умножение: 2x, x(x+1)
      else return left;
    }
  };
  Parser.prototype.unary = function () {
    var c = this.peek();
    if (c === '-') { this.pos++; return E.neg(this.unary()); }
    if (c === '+') { this.pos++; return this.unary(); }
    return this.power();
  };
  Parser.prototype.power = function () {
    var base = this.primary();
    for (;;) {
      var c = this.peek();
      if (c === undefined || !SUPERS.hasOwnProperty(c)) break;
      this.pos++;
      var digits = SUPERS[c];
      while (this.peek() !== undefined && SUPERS.hasOwnProperty(this.peek())) { digits += SUPERS[this.peek()]; this.pos++; }
      base = E.bin('^', base, E.num(parseFloat(digits)));
    }
    if (this.peek() === '^') { this.pos++; return E.bin('^', base, this.unary()); }
    return base;
  };
  Parser.prototype.primary = function () {
    var c = this.peek();
    if (c === undefined) throw new MathParseError('Запись оборвалась, не хватает числа или x');
    if (isDigit(c) || c === '.') return this.number();
    if (c === '(') {
      this.pos++;
      var e = this.expression();
      if (this.peek() !== ')') throw new MathParseError('Не хватает закрывающей скобки');
      this.pos++;
      return e;
    }
    if (c === 'x') { this.pos++; return E.x(); }
    if (this.s.indexOf('pi', this.pos) === this.pos) { this.pos += 2; return E.num(Math.PI); }
    for (var i = 0; i < FUNCS.length; i++) {
      var f = FUNCS[i];
      if (this.s.indexOf(f, this.pos) === this.pos) {
        this.pos += f.length;
        if (this.peek() === '(') {
          this.pos++;
          var e2 = this.expression();
          if (this.peek() !== ')') throw new MathParseError('Не хватает закрывающей скобки после ' + f);
          this.pos++;
          return E.fn(f, e2);
        }
        return E.fn(f, this.power());   // sqrt x
      }
    }
    throw new MathParseError('Не понял символ «' + c + '»');
  };
  Parser.prototype.number = function () {
    var start = this.pos;
    while (this.pos < this.s.length && (isDigit(this.s[this.pos]) || this.s[this.pos] === '.')) this.pos++;
    var t = this.s.substring(start, this.pos);
    if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) throw new MathParseError('Неверное число «' + t + '»');
    return E.num(parseFloat(t));
  };

  function parse(raw) {
    var s = normalize(raw);
    if (s.length === 0) throw new MathParseError('Введите функцию, например y = x² − 4x + 3');
    var p = new Parser(s), e = p.expression();
    if (p.pos < s.length) throw new MathParseError('Не понял запись возле «' + s.substring(p.pos).slice(0, 8) + '»');
    return e;
  }
  function parseOrNull(raw) {
    try { return parse(raw); } catch (e) { if (e instanceof MathParseError) return null; throw e; }
  }
  var MathExpr = { normalize: normalize, parse: parse, parseOrNull: parseOrNull };

  // ====================================================================== GraphAnalysis
  function fmt(v) {
    var r = rint(v * 100) / 100;
    var s = (r === Math.floor(r) && Math.abs(r) < 1e9) ? String(Math.trunc(r)) : (function (t) { return t.indexOf('.') >= 0 ? t.replace(/0+$/, '').replace(/\.$/, '') : t; })(String(r));
    return s.replace(/\./g, ',').replace(/-/g, '−');
  }

  function findZeros(f, from, to, steps) {
    steps = steps || 2000;
    var out = [], prevX = from, prevY = f(prevX);
    for (var i = 1; i <= steps; i++) {
      var x = from + (to - from) * i / steps, y = f(x);
      if (isFinite_(prevY) && isFinite_(y)) {
        if (y === 0) out.push(x);
        else if (prevY * y < 0) {
          var l = prevX, r = x, fl = prevY;
          for (var k = 0; k < 60; k++) {
            var m = (l + r) / 2, fm = f(m);
            if (fl * fm <= 0) r = m; else { l = m; fl = fm; }
          }
          var root = (l + r) / 2;
          // разрыв вида 1/x даёт «ноль» там, где функция уходит в бесконечность
          if (Math.abs(f(root)) < 1e-3) out.push(root);
        }
      }
      prevX = x; prevY = y;
    }
    var dedup = [];
    numSort(out).forEach(function (z) { if (!dedup.length || Math.abs(z - dedup[dedup.length - 1]) > 1e-4) dedup.push(z); });
    return dedup.slice(0, 8);
  }

  function analyze(expr) {
    var f = function (x) { return expr.eval(x); };
    var f0 = f(0);
    var yIntercept = isFinite_(f0) ? f0 : null;

    var kind = 'other', qa = 0, qb = 0, qc = 0;
    var fm1 = f(-1), f1 = f(1);
    if (isFinite_(f0) && isFinite_(fm1) && isFinite_(f1)) {
      var a = (f1 + fm1) / 2 - f0, b = (f1 - fm1) / 2;
      var ok = [2, -2, 3.7, -5.3, 10].every(function (x) {
        var y = f(x);
        return isFinite_(y) && Math.abs(y - (a * x * x + b * x + f0)) <= 1e-7 * (1 + Math.abs(y));
      });
      if (ok) {
        qa = a; qb = b; qc = f0;
        kind = Math.abs(a) > 1e-9 ? 'quadratic' : Math.abs(b) > 1e-9 ? 'linear' : 'other';
      }
    }

    var zeros, vertex = null;
    if (kind === 'quadratic') {
      var d = qb * qb - 4 * qa * qc;
      if (d > 1e-12) zeros = numSort([(-qb - Math.sqrt(d)) / (2 * qa), (-qb + Math.sqrt(d)) / (2 * qa)]);
      else if (Math.abs(d) <= 1e-12) zeros = [-qb / (2 * qa)];
      else zeros = [];
      var vx = -qb / (2 * qa);
      vertex = [vx, f(vx)];
    } else if (kind === 'linear') zeros = [-qc / qb];
    else zeros = findZeros(f, -10, 10);

    // окно просмотра
    var key = [0].concat(zeros);
    if (vertex) key.push(vertex[0]);
    var lo = Math.min(minOf(key), -1), hi = Math.max(maxOf(key), 1);
    var span = Math.max(hi - lo, 4);
    lo -= span * 0.35; hi += span * 0.35;
    if (kind === 'other' && zeros.length === 0) { lo = -6; hi = 6; }
    var xMin = Math.floor(lo), xMax = Math.ceil(hi);

    var ys = [], n = 240;
    for (var i = 0; i <= n; i++) { var y = f(xMin + (xMax - xMin) * i / n); if (isFinite_(y)) ys.push(y); }
    var yLo = 0, yHi = 1;
    if (ys.length) { yLo = Math.min(minOf(ys), 0); yHi = Math.max(maxOf(ys), 0); }
    // слишком крутой рост: показываем часть, где видно важные точки
    var keyYs = [0];
    if (yIntercept !== null) keyYs.push(yIntercept);
    if (vertex) keyYs.push(vertex[1]);
    var keySpan = Math.max(maxOf(keyYs) - minOf(keyYs), 4);
    if (yHi - yLo > keySpan * 4) {
      yHi = Math.min(yHi, maxOf(keyYs) + keySpan * 1.2);
      yLo = Math.max(yLo, minOf(keyYs) - keySpan * 1.2);
    }
    var pad = Math.max(yHi - yLo, 2) * 0.12;
    var yMin = Math.floor(yLo - pad), yMax = Math.ceil(yHi + pad);

    // таблица значений
    var centre = vertex ? rint(vertex[0]) : 0;
    var table = [];
    for (var xi = centre - 2; xi <= centre + 2; xi++) {
      var yy = f(xi);
      table.push([xi, isFinite_(yy) ? yy : null]);
    }
    return { expr: expr, xMin: xMin, xMax: xMax, yMin: yMin, yMax: yMax, zeros: zeros, yIntercept: yIntercept, vertex: vertex, kind: kind, a: qa, b: qb, c: qc, table: table };
  }

  /** Шаг сетки: 1, 2 или 5 · 10^k, чтобы подписей было 4–10. */
  function niceStep(span) {
    if (span <= 0) return 1;
    var raw = span / 8, mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag;
    var step = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
    return step * mag;
  }

  /** Текст «что видно на графике» для ребёнка. */
  function describe(info) {
    var sb = '';
    if (info.kind === 'quadratic') {
      sb += info.a > 0 ? 'Это парабола, ветви направлены вверх (коэффициент при x² положительный). ' : 'Это парабола, ветви направлены вниз (коэффициент при x² отрицательный). ';
      if (info.vertex) sb += 'Вершина (' + fmt(info.vertex[0]) + '; ' + fmt(info.vertex[1]) + '). ';
    } else if (info.kind === 'linear') sb += info.b > 0 ? 'Это прямая, она идёт вверх. ' : 'Это прямая, она идёт вниз. ';
    else sb += 'График построен по точкам. ';
    if (info.zeros.length === 0) sb += 'С осью x график не пересекается. ';
    else if (info.zeros.length === 1) sb += 'С осью x график встречается в точке ' + fmt(info.zeros[0]) + '. ';
    else sb += 'С осью x график пересекается в точках ' + info.zeros.map(fmt).join(' и ') + '. ';
    if (info.yIntercept !== null) sb += 'С осью y — в точке ' + fmt(info.yIntercept) + '.';
    return sb.trim();
  }

  /** Кривая для рисования: список отрезков [[x, y], ...] (как путь Renderers.graph, с разрывами). */
  function curveSegments(info, n) {
    n = n || 900;
    var segs = [], cur = null, pen = false, prevY = 0, h = info.yMax - info.yMin;
    for (var i = 0; i <= n; i++) {
      var x = info.xMin + (info.xMax - info.xMin) * i / n, y = info.expr.eval(x);
      var ok = isFinite_(y) && y >= info.yMin - h && y <= info.yMax + h;
      if (!ok || (pen && Math.abs(y - prevY) > h * 0.8)) {
        pen = false;
        if (ok) { cur = [[x, y]]; segs.push(cur); pen = true; prevY = y; }
        continue;
      }
      if (!pen) { cur = [[x, y]]; segs.push(cur); pen = true; } else cur.push([x, y]);
      prevY = y;
    }
    return segs;
  }
  var GraphAnalysis = { fmt: fmt, analyze: analyze, findZeros: findZeros, niceStep: niceStep, describe: describe, curveSegments: curveSegments };

  // ====================================================================== TriangleGeometry
  var NUMBER_G = /\d+(?:[.,]\d+)?/g;
  function numbersIn(text) {
    var m = String(text).match(NUMBER_G) || [];
    return m.map(function (t) { return parseFloat(t.replace(',', '.')); }).filter(function (v) { return !isNaN(v); });
  }
  function toDeg(rad) { return rad * 180 / Math.PI; }

  /** null, если из таких сторон треугольник не получается. */
  function fromSides(a, b, c) {
    if (a <= 0 || b <= 0 || c <= 0) return null;
    if (a + b <= c + 1e-9 || a + c <= b + 1e-9 || b + c <= a + 1e-9) return null;
    function ang(opp, s1, s2) {
      var cs = (s1 * s1 + s2 * s2 - opp * opp) / (2 * s1 * s2);
      cs = Math.max(-1, Math.min(1, cs));
      return toDeg(Math.acos(cs));
    }
    var A = ang(a, b, c), B = ang(b, a, c), C = 180 - A - B;
    var p = (a + b + c) / 2;
    var area = Math.sqrt(Math.max(0, p * (p - a) * (p - b) * (p - c)));
    var mx = Math.max(a, b, c), tol = 1e-6 * (mx * mx);
    var right = Math.abs(a * a + b * b - c * c) <= tol ? 'C'
      : Math.abs(a * a + c * c - b * b) <= tol ? 'B'
      : Math.abs(b * b + c * c - a * a) <= tol ? 'A' : null;
    var kind = right !== null ? 'прямоугольный' : (A > 90 + 1e-9 || B > 90 + 1e-9 || C > 90 + 1e-9) ? 'тупоугольный' : 'остроугольный';
    function P(x, y) { return { x: x, y: y }; }
    var pts;   // координаты: прямой угол в начале координат, иначе сторона c лежит на оси x
    if (right === 'C') pts = [P(b, 0), P(0, a), P(0, 0)];
    else if (right === 'A') pts = [P(0, 0), P(c, 0), P(0, b)];
    else if (right === 'B') pts = [P(0, c), P(0, 0), P(a, 0)];
    else {
      var cx = (b * b + c * c - a * a) / (2 * c), cy = Math.sqrt(Math.max(0, b * b - cx * cx));
      pts = [P(0, 0), P(c, 0), P(cx, cy)];
    }
    return { a: a, b: b, c: c, angleA: A, angleB: B, angleC: C, area: area, perimeter: a + b + c, rightAt: right, kind: kind, A: pts[0], B: pts[1], C: pts[2] };
  }
  function rightFromLegs(leg1, leg2) {
    if (leg1 <= 0 || leg2 <= 0) return null;
    return fromSides(leg1, leg2, Math.sqrt(leg1 * leg1 + leg2 * leg2));
  }
  /** «Стороны 6, 8, 10» → треугольник; «катеты 3 и 4» → прямоугольный по двум катетам. */
  function fromText(text) {
    var nums = numbersIn(text), lower = String(text).toLowerCase();
    if (nums.length >= 3) return fromSides(nums[0], nums[1], nums[2]);
    if (nums.length === 2 && lower.indexOf('катет') >= 0) return rightFromLegs(nums[0], nums[1]);
    return null;
  }
  function problemMessage(text) {
    var nums = numbersIn(text);
    if (nums.length >= 3 && fromSides(nums[0], nums[1], nums[2]) === null)
      return 'Из сторон ' + fmt(nums[0]) + ', ' + fmt(nums[1]) + ', ' + fmt(nums[2]) + ' треугольник не получается: каждая сторона должна быть меньше суммы двух других.';
    return 'Укажите три стороны («6, 8, 10») или два катета («катеты 3 и 4»).';
  }
  var TriangleGeometry = { fromSides: fromSides, rightFromLegs: rightFromLegs, fromText: fromText, problemMessage: problemMessage };

  // ====================================================================== ColumnMath
  var NAMES = ['единицы', 'десятки', 'сотни', 'тысячи', 'десятки тысяч', 'сотни тысяч', 'миллионы', 'десятки миллионов', 'сотни миллионов', 'миллиарды'];
  function place(i) { return i < NAMES.length ? NAMES[i] : 'разряд ' + (i + 1); }
  var EXPR = /^\s*(\d[\d ]*)\s*([+\-−–×xXхХ*·:/÷])\s*(\d[\d ]*)\s*$/;
  function rep(ch, n) { return n > 0 ? new Array(n + 1).join(ch) : ''; }
  function rightAlign(s, width) { return String(s).padStart(width); }
  function grouped(n) { return String(n).split('').reverse().join('').replace(/(\d{3})(?=\d)/g, '$1 ').split('').reverse().join(''); }
  function dig(s, i) { var c = s.charAt(s.length - 1 - i); return c === '' ? 0 : parseInt(c, 10); }

  /** «2 345 + 678», «357×24», «1248:12» → столбик. null, если запись не похожа на пример. */
  function solve(text) {
    var m = EXPR.exec(String(text).replace(/[\u00a0\u202f]/g, ' '));
    if (!m) return null;
    var a = parseInt(m[1].replace(/ /g, ''), 10), b = parseInt(m[3].replace(/ /g, ''), 10);
    if (isNaN(a) || isNaN(b)) return null;
    if (a > 999999999999 || b > 999999999999) return null;
    var op = m[2];
    if (op === '+') return add(a, b);
    if (op === '-' || op === '−' || op === '–') return subtract(a, b);
    if (op === ':' || op === '/' || op === '÷') return divide(a, b);
    return multiply(a, b);
  }

  function add(a, b) {
    var sum = a + b, sa = String(a), sb = String(b);
    var w = Math.max(sa.length, sb.length, String(sum).length) + 2;
    var steps = [], carries = rep(' ', w).split(''), carry = 0, n = Math.max(sa.length, sb.length);
    for (var i = 0; i < n; i++) {
      var da = dig(sa, i), db = dig(sb, i), total = da + db + carry, write = total % 10, next = Math.floor(total / 10);
      var parts = da + ' + ' + db + (carry > 0 ? ' + ' + carry + ' (запомнили)' : '') + ' = ' + total + '.';
      steps.push(cap1(place(i)) + ': ' + parts + ' ' + (next > 0 && i === n - 1 ? 'Пишем ' + total + '.' : next > 0 ? 'Пишем ' + write + ', ' + next + ' запоминаем.' : 'Пишем ' + write + '.'));
      carry = next;
      if (next > 0 && i + 1 < n) carries[w - 1 - (i + 1)] = String(next);
    }
    var cl = carries.join('').replace(/\s+$/, '');
    var lines = [];
    if (cl.trim() !== '') lines.push(cl);
    lines.push(rightAlign(sa, w), '+' + rightAlign(sb, w - 1), rep('-', w), rightAlign(String(sum), w));
    return { title: 'Сложение столбиком: ' + grouped(a) + ' + ' + grouped(b), lines: lines, steps: steps, answer: grouped(a) + ' + ' + grouped(b) + ' = ' + grouped(sum), estimate: estimate(a, b, '+') };
  }

  function subtract(a, b) {
    if (a < b) {
      var inner = subtract(b, a);
      return {
        title: 'Вычитание столбиком: ' + grouped(a) + ' − ' + grouped(b), lines: inner.lines,
        steps: ['Вычитаемое больше уменьшаемого, поэтому из большего числа вычитаем меньшее и ставим минус.'].concat(inner.steps),
        answer: grouped(a) + ' − ' + grouped(b) + ' = −' + grouped(b - a), estimate: inner.estimate,
      };
    }
    var diff = a - b, sa = String(a), sb = String(b), w = Math.max(sa.length, sb.length) + 2, steps = [], borrow = 0;
    for (var i = 0; i < sa.length; i++) {
      var da = dig(sa, i), db = dig(sb, i), top = da - borrow, name = cap1(place(i));
      if (top < db) {
        var res = top + 10 - db;
        steps.push(name + ': ' + top + ' − ' + db + ' нельзя, занимаем 1 десяток у следующего разряда: ' + (top + 10) + ' − ' + db + ' = ' + res + '. Пишем ' + res + '.');
        borrow = 1;
      } else {
        var r2 = top - db, tail = borrow === 1 ? ' (было ' + da + ', но 1 заняли)' : '';
        steps.push(name + ': ' + top + ' − ' + db + ' = ' + r2 + tail + '. Пишем ' + r2 + '.');
        borrow = 0;
      }
    }
    var lines = [rightAlign(sa, w), '−' + rightAlign(sb, w - 1), rep('-', w), rightAlign(String(diff), w)];
    return { title: 'Вычитание столбиком: ' + grouped(a) + ' − ' + grouped(b), lines: lines, steps: steps, answer: grouped(a) + ' − ' + grouped(b) + ' = ' + grouped(diff), estimate: estimate(a, b, '-') };
  }

  // Умножение считаем BigInt'ом: в Kotlin Long здесь молча переполнялся бы на очень больших числах.
  function multiply(a, b) {
    var A = BigInt(a), product = A * BigInt(b), sa = String(a), sb = String(b), partials = [], steps = [];
    for (var i = 0; i < sb.length; i++) {
      var d = dig(sb, i), p = String(A * BigInt(d));
      var shiftNote = i === 0 ? '' : ' Пишем со сдвигом на ' + i + ' ' + (i === 1 ? 'клетку' : 'клетки') + ' влево.';
      if (d === 0) steps.push('Цифра 0 (' + place(i) + '): ' + sa + ' × 0 = 0, эту строку можно пропустить.');
      else { steps.push('Цифра ' + d + ' (' + place(i) + '): ' + sa + ' × ' + d + ' = ' + p + '.' + shiftNote); partials.push([p, i]); }
    }
    var ps = String(product), extents = [sa.length, sb.length + 1, ps.length];
    partials.forEach(function (pp) { extents.push(pp[0].length + pp[1]); });
    var width = maxOf(extents) + 1, lines = [];
    lines.push(rightAlign(sa, width), '×' + rightAlign(sb, width - 1), rep('-', width));
    if (sb.length > 1) {
      partials.forEach(function (pp) { lines.push(rightAlign(pp[0], width - pp[1])); });
      lines.push(rep('-', width));
      steps.push('Складываем строки: ' + partials.map(function (pp) { return pp[0] + rep('0', pp[1]); }).join(' + ') + ' = ' + ps + '.');
    }
    lines.push(rightAlign(ps, width));
    return { title: 'Умножение столбиком: ' + grouped(a) + ' × ' + grouped(b), lines: lines, steps: steps, answer: grouped(a) + ' × ' + grouped(b) + ' = ' + grouped(ps), estimate: estimate(a, b, '*') };
  }

  function divide(a, b) {
    if (b === 0) return { title: 'Деление', lines: [], steps: ['На ноль делить нельзя.'], answer: 'Деление на 0 не определено', estimate: null };
    var sa = String(a), sbs = String(b), w = sa.length;
    var title = 'Деление уголком: ' + grouped(a) + ' : ' + grouped(b);
    if (a < b) {
      return { title: title, lines: [sa + ' |' + sbs, rep(' ', w) + ' |' + rep('-', sbs.length), rep(' ', w) + ' |0'],
        steps: [a + ' меньше ' + b + ', поэтому в частном 0, остаток ' + a + '.'], answer: grouped(a) + ' : ' + grouped(b) + ' = 0 (ост. ' + a + ')', estimate: null };
    }
    var k = 1;
    while (parseInt(sa.substring(0, k), 10) < b) k++;
    var idx = k - 1, curShown = sa.substring(0, k), cur = parseInt(curShown, 10);
    var left = [], steps = [], quotient = '', rem;
    for (;;) {
      var q = Math.floor(cur / b), prod = q * b;
      rem = cur - prod;
      quotient += q;
      steps.push(cur + ' : ' + b + ' = ' + q + ', пишем ' + q + ' в частное. ' + q + ' · ' + b + ' = ' + prod + ', вычитаем: ' + cur + ' − ' + prod + ' = ' + rem + '.');
      left.push(rightAlign(String(prod), idx + 1));
      left.push(rightAlign(rep('-', Math.max(String(prod).length, curShown.length)), idx + 1));
      if (idx + 1 < w) {
        var nx = sa.charAt(idx + 1);
        curShown = (rem === 0 ? '0' : String(rem)) + nx;
        idx += 1;
        cur = parseInt(curShown, 10);
        steps.push('Сносим ' + nx + ': получаем ' + cur + '.');
        left.push(rightAlign(curShown, idx + 1));
      } else { left.push(rightAlign(String(rem), idx + 1)); break; }
    }
    var q2 = quotient.replace(/^0+/, '') || '0', rightCol = w + 1, rows = [];
    rows.push(sa.padEnd(rightCol) + '|' + sbs);
    rows.push(left[0].padEnd(rightCol) + '|' + rep('-', Math.max(sbs.length, q2.length)));
    rows.push(left[1].padEnd(rightCol) + '|' + q2);
    for (var i = 2; i < left.length; i++) rows.push(left[i]);
    var answer = rem === 0 ? grouped(a) + ' : ' + grouped(b) + ' = ' + grouped(q2) : grouped(a) + ' : ' + grouped(b) + ' = ' + grouped(q2) + ' (ост. ' + rem + ')';
    if (rem !== 0) steps.push('Остаток ' + rem + ' меньше делителя ' + b + ', значит деление закончено.');
    return { title: title, lines: rows.map(function (r) { return r.replace(/\s+$/, ''); }), steps: steps, answer: answer, estimate: estimate(a, b, ':') };
  }

  function roundNice(n) {
    if (n < 10) return n;
    var unit = Math.pow(10, String(n).length - 1);
    return Math.round(n / unit) * unit;
  }
  function estimate(a, b, op) {
    if (a < 10 && b < 10) return null;
    var ra = roundNice(a), rb = roundNice(b), T = ' Ответ должен быть близко к этому.';
    if (op === '+') return 'Прикидка: ' + grouped(ra) + ' + ' + grouped(rb) + ' = ' + grouped(ra + rb) + '.' + T;
    if (op === '-') return 'Прикидка: ' + grouped(ra) + ' − ' + grouped(rb) + ' = ' + grouped(ra - rb) + '.' + T;
    if (op === '*') return 'Прикидка: ' + grouped(ra) + ' × ' + grouped(rb) + ' = ' + grouped(BigInt(ra) * BigInt(rb)) + '.' + T;
    if (op === ':') return rb === 0 ? null : 'Прикидка: ' + grouped(ra) + ' : ' + grouped(rb) + ' ≈ ' + grouped(Math.floor(ra / rb)) + '.' + T;
    return null;
  }
  var ColumnMath = { solve: solve, add: add, subtract: subtract, multiply: multiply, divide: divide, estimate: estimate };

  // ====================================================================== Схемы (данные из Draw.kt)
  var SCHEME_NAMES = ['Круговорот воды', 'Растительная клетка', 'Атом', 'Лента времени'];
  var ELEMENTS = [
    ['H', 'Водород', 1, 1], ['He', 'Гелий', 2, 4], ['Li', 'Литий', 3, 7], ['Be', 'Бериллий', 4, 9],
    ['B', 'Бор', 5, 11], ['C', 'Углерод', 6, 12], ['N', 'Азот', 7, 14], ['O', 'Кислород', 8, 16],
    ['F', 'Фтор', 9, 19], ['Ne', 'Неон', 10, 20], ['Na', 'Натрий', 11, 23], ['Mg', 'Магний', 12, 24],
    ['Al', 'Алюминий', 13, 27], ['Si', 'Кремний', 14, 28], ['P', 'Фосфор', 15, 31], ['S', 'Сера', 16, 32],
    ['Cl', 'Хлор', 17, 35], ['Ar', 'Аргон', 18, 40], ['K', 'Калий', 19, 39], ['Ca', 'Кальций', 20, 40],
  ].map(function (e) { return { sym: e[0], name: e[1], z: e[2], a: e[3] }; });
  var ELEMENT_NAMES = ELEMENTS.map(function (e) { return e.name + ' (' + e.sym + ')'; });

  function shells(z) {
    if (z <= 2) return [z];
    if (z <= 10) return [2, z - 2];
    if (z <= 18) return [2, 8, z - 10];
    return [2, 8, 8, z - 18];
  }
  /** Данные атома по индексу в ELEMENTS (как Renderers.atom: подпись и текст фактов). */
  function atomInfo(index) {
    var e = ELEMENTS[Math.max(0, Math.min(ELEMENTS.length - 1, index))], sh = shells(e.z), st = sh.join(' + ');
    return { sym: e.sym, name: e.name, z: e.z, a: e.a, n: e.a - e.z, shells: sh, shellText: st,
      facts: e.name + ' (' + e.sym + '): ' + e.z + ' протонов, ' + (e.a - e.z) + ' нейтронов, ' + e.z + ' электронов; слои электронов: ' + st + '.' };
  }
  /** Разбор строк «дата — событие» (тире, двоеточие или дефис). */
  function parseTimeline(text) {
    var out = [];
    String(text).split(/\r\n|\r|\n/).forEach(function (line) {
      var l = line.trim();
      if (!l) return;
      var m = /^(.{1,20}?)\s*[—–\-:]\s*(.+)$/.exec(l);
      out.push(m ? [m[1].trim(), m[2].trim()] : [l.slice(0, 10), l]);
    });
    return out;
  }
  /** Перенос строки по ширине; ширина символа оценивается (в SVG нет измерителя текста без DOM). */
  function wrapText(s, maxW, size, bold) {
    var cw = size * (bold ? 0.62 : 0.56), out = [], cur = '';
    String(s).split(' ').forEach(function (word) {
      var t = cur === '' ? word : cur + ' ' + word;
      if (t.length * cw <= maxW || cur === '') cur = t; else { out.push(cur); cur = word; }
    });
    if (cur !== '') out.push(cur);
    return out;
  }
  var WATER_FACTS = 'Солнце нагревает воду, она испаряется и поднимается вверх. В облаках пар охлаждается и превращается в капли (конденсация). Капли выпадают дождём или снегом, стекают в реки и возвращаются в море.';
  var CELL_FACTS = 'Клеточная стенка защищает и держит форму. Ядро хранит наследственную информацию. В хлоропластах идёт фотосинтез, в митохондриях клетка получает энергию. Вакуоль запасает воду и вещества.';

  var api = {
    rint: rint, MathParseError: MathParseError, MathExpr: MathExpr, GraphAnalysis: GraphAnalysis, TriangleGeometry: TriangleGeometry, ColumnMath: ColumnMath,
    SCHEME_NAMES: SCHEME_NAMES, ELEMENTS: ELEMENTS, ELEMENT_NAMES: ELEMENT_NAMES, shells: shells, atomInfo: atomInfo, parseTimeline: parseTimeline, wrapText: wrapText,
    WATER_FACTS: WATER_FACTS, CELL_FACTS: CELL_FACTS,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Kid_visual = api;
})(typeof window !== 'undefined' ? window : globalThis);
