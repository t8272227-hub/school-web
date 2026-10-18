// Чистая логика разделов «ДЗ», «Реферат», «К контрольной», «Конспект», «Слова и диктант» (без DOM).
// Порт Prompts.kt, AiJson.kt и части Screens1/3/4.kt. Проверяется в Node. Формат как в sync.js: module.exports или window.Kid_study
(function (root) {
  'use strict';
  var C = root.KidCheck || (typeof require !== 'undefined' ? require('../check.js') : null);
  var api = {};

  // ---------- общее ----------
  api.LEVELS = [
    { name: 'FRIEND', label: 'Как другу', rule: 'Объясни как другу: очень просто, коротко, с примером из жизни.' },
    { name: 'BOOK', label: 'Как в учебнике', rule: 'Объясни как в учебнике: точно, с правилами и терминами, но понятно.' },
    { name: 'DETAILED', label: 'Подробно', rule: 'Объясни подробно: по шагам, с примерами и объяснением, почему так.' },
  ];
  api.levelByLabel = function (label) { return api.LEVELS.filter(function (l) { return l.label === label; })[0] || api.LEVELS[1]; };

  // ---------- промпты (Prompts.kt) ----------
  api.promptFormat = function (subject, grade) {
    return C.base(grade) + ' Оформи решение задания так, как его записывают в тетради по предмету «' + subject + '». ' +
      'Для математики и физики: номер задания, Дано, Найти, Решение (каждое действие с новой строки), Проверка, Ответ. ' +
      'Для русского языка: само упражнение с вставленными буквами и знаками и короткими пометками правил. ' +
      'Для остальных предметов: Дано, Решение, Ответ. Выводи только запись для тетради, без вступлений.';
  };
  api.promptSteps = function (subject, grade) {
    return C.base(grade) + ' Реши задание по предмету «' + subject + '» по шагам. Каждый шаг отдели от следующего строкой из трёх дефисов (---). ' +
      'В шаге одно действие и короткое пояснение, почему так. В последнем шаге напиши «Ответ: …». Проверь ответ подстановкой.';
  };
  api.promptExplain = function (subject, grade, levelLabel) {
    return C.base(grade) + ' Объясни тему или задание по предмету «' + subject + '». ' + api.levelByLabel(levelLabel).rule;
  };
  api.promptEssayPlan = function (subject, grade) {
    return C.base(grade) + ' Составь план реферата по предмету «' + subject + '»: 5–7 коротких пунктов, последний пункт «Вывод». Каждый пункт с новой строки, с номером.';
  };
  api.essayChars = function (pages) { return pages === 1 ? 1800 : pages === 2 ? 3600 : 6300; };
  api.promptEssayText = function (subject, grade, pages) {
    return C.base(grade) + ' Напиши текст реферата по предмету «' + subject + '» по плану ученика, объёмом около ' + api.essayChars(pages) + ' знаков. Пиши связно, по пунктам плана, ' +
      'заголовок каждого пункта отдельной строкой с номером. Не придумывай список литературы и ссылки, не приводи точные числа и даты, в которых не уверен. ' +
      'Если к пункту нужна схема или рисунок, в конце пункта напиши строку [СХЕМА: короткое название], не больше двух на весь текст.';
  };
  api.promptNotes = function (subject, grade) {
    return C.base(grade) + ' Сделай конспект параграфа по предмету «' + subject + '» по тексту или фото. Верни ТОЛЬКО JSON: ' +
      '{"short":"краткий пересказ 2–4 предложения","plan":["пункт"],"terms":[{"term":"","meaning":""}],' +
      '"questions":["вопрос для самопроверки"]}. Даты и имена указывай только если они есть в тексте.';
  };
  api.promptExamPlan = function (subject, grade) {
    return C.base(grade) + ' Составь план повторения к контрольной по предмету «' + subject + '». Верни ТОЛЬКО JSON: ' +
      '{"days":[{"day":"Сегодня","task":"что сделать","minutes":15}],"cheat":"короткая шпаргалка по теме"}. ' +
      'Дней столько, сколько указал ученик, на день не больше 30 минут.';
  };
  api.promptWords = function (grade) {
    return C.base(grade) + ' Подбери слова по теме для запоминания. Верни ТОЛЬКО JSON-массив: [{"front":"слово на языке изучения","back":"перевод или значение"}]. Ровно 10 слов.';
  };
  api.promptDictation = function (grade) {
    return C.base(grade) + ' Подбери слова для диктанта. Верни ТОЛЬКО JSON-массив из 10 слов: ["слово"]. Слова должны подходить по возрасту.';
  };
  api.promptPhotoOcr = function () {
    return 'Перепиши текст задания с фото точно, ничего не решай. Условие, номера и данные сохрани, формулы пиши в одну строку. ' +
      'Если часть неразборчива, поставь [?]. Выводи только текст задания.';
  };

  // ---------- разбор JSON (AiJson.kt) ----------
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function str(v) {
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return String(v);
    return null;
  }
  function parseOrNull(t) { try { return JSON.parse(t); } catch (e) { return null; } }
  function obj(raw) {
    var j = C.extractJson(raw || '');
    var v = j ? parseOrNull(j) : null;
    return isObj(v) ? v : null;
  }
  function array(raw) {
    raw = raw || '';
    var s = raw.indexOf('['), e = raw.lastIndexOf(']');
    if (s < 0 || e <= s) return null;
    var v = parseOrNull(raw.slice(s, e + 1));
    return Array.isArray(v) ? v : null;
  }
  function strings(v) {
    if (!Array.isArray(v)) return [];
    var out = [];
    v.forEach(function (x) { var s = str(x); if (s !== null && s.trim()) out.push(s.trim()); });
    return out;
  }
  function trimmed(v) { var s = str(v); return s === null ? '' : s.trim(); }

  api.parseNotes = function (raw) {
    var o = obj(raw); if (!o) return null;
    var short = trimmed(o.short); if (!short) return null;
    var terms = [];
    (Array.isArray(o.terms) ? o.terms : []).forEach(function (it) {
      if (!isObj(it)) return;
      var term = trimmed(it.term); if (!term) return;
      terms.push({ term: term, meaning: trimmed(it.meaning) });
    });
    return { short: short, plan: strings(o.plan), terms: terms, questions: strings(o.questions) };
  };

  api.parseExamPlan = function (raw) {
    var o = obj(raw); if (!o) return null;
    var days = [];
    (Array.isArray(o.days) ? o.days : []).forEach(function (d) {
      if (!isObj(d)) return;
      var task = trimmed(d.task); if (!task) return;
      var min;
      if (typeof d.minutes === 'number') min = Math.trunc(d.minutes);
      else {
        var s = str(d.minutes), digits = s === null ? '' : s.replace(/\D/g, '');
        min = digits && isFinite(parseInt(digits, 10)) ? parseInt(digits, 10) : 15;
      }
      days.push({ day: trimmed(d.day), task: task, minutes: min });
    });
    if (!days.length) return null;
    return { days: days, cheat: trimmed(o.cheat) };
  };

  api.parseWords = function (raw) {
    var arr = array(raw); if (!arr) return null;
    var out = [];
    arr.forEach(function (it) {
      if (!isObj(it)) return;
      var f = trimmed(it.front), b = trimmed(it.back);
      if (f && b) out.push({ front: f, back: b });
    });
    return out.length ? out : null;
  };

  api.parseDictation = function (raw) {
    var arr = array(raw); if (!arr) return null;
    var out = strings(arr);
    return out.length ? out : null;
  };

  // «apple - яблоко» построчно → пары слов
  api.parseWordLines = function (text) {
    var out = [];
    String(text || '').split(/\r\n|\r|\n/).forEach(function (line) {
      var m = /\s*[-–—=:]\s*/.exec(line);
      if (!m) return;
      var a = line.slice(0, m.index), b = line.slice(m.index + m[0].length);
      if (a.trim() && b.trim()) out.push({ front: a.trim(), back: b.trim() });
    });
    return out;
  };

  // Шаги решения, разделённые строкой --- (или ***)
  api.splitSteps = function (text) {
    return String(text || '').split(/^[ \t]*(?:-{3,}|\*{3,})[ \t]*$/m).map(function (s) { return s.trim(); }).filter(Boolean);
  };

  // ---------- колода слов (Store.cards) ----------
  // карточка: { f, b, k }. Новые слова добавляются в начало, повторы по слову заменяются новыми.
  api.mergeDeck = function (deck, words) {
    var fresh = words.map(function (w) { return { f: w.front, b: w.back, k: false }; });
    return fresh.concat(deck.filter(function (d) { return !words.some(function (w) { return w.front === d.f; }); }));
  };
  api.addOwn = function (deck, words) { return words.map(function (w) { return { f: w.front, b: w.back, k: false }; }).concat(deck); };
  api.queue = function (deck) { return deck.filter(function (c) { return !c.k; }); };
  function firstOpen(deck) { var i = -1; deck.forEach(function (c, k) { if (i < 0 && !c.k) i = k; }); return i; }
  // «Знаю»: первая невыученная карточка помечается
  api.markKnown = function (deck) {
    var i = firstOpen(deck);
    return deck.map(function (c, k) { return k === i ? { f: c.f, b: c.b, k: true } : c; });
  };
  // «Ещё раз»: первая невыученная карточка уходит в конец колоды
  api.repeatLater = function (deck) {
    var i = firstOpen(deck);
    if (i < 0) return deck.slice();
    return deck.filter(function (c, k) { return k !== i; }).concat([deck[i]]);
  };
  api.resetDeck = function (deck) { return deck.map(function (c) { return { f: c.f, b: c.b, k: false }; }); };

  // ---------- мои ДЗ (Store.homework) ----------
  api.addHomework = function (list, subject, task, result, id, date) {
    return [{ id: id, subject: subject, task: task, result: result, date: date }].concat(list).slice(0, 100);
  };
  api.deleteHomework = function (list, id) { return list.filter(function (h) { return h.id !== id; }); };

  // ---------- реферат ----------
  api.cleanEssay = function (text) { return String(text || '').replace(/\[СХЕМА:[^\]]*\]/g, '').replace(/\n{3,}/g, '\n\n').trim(); };
  api.schemeMarkers = function (text) {
    var out = [], re = /\[СХЕМА:([^\]]*)\]/g, m;
    while ((m = re.exec(String(text || '')))) { var n = m[1].trim(); if (n) out.push(n); }
    return out;
  };
  api.SCHEMES = ['Без схемы', 'Круговорот воды', 'Растительная клетка', 'Атом углерода'];
  // Блоки документа реферата: заголовок «1. Введение» (короче 90 знаков) идёт как подзаголовок
  api.essayBlocks = function (topicOrSubject, text) {
    var out = [{ t: 'h', text: 'Тема: ' + topicOrSubject }];
    api.cleanEssay(text).split('\n').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (par) {
      out.push({ t: /^\d+[.)]\s/.test(par) && par.length < 90 ? 'h' : 'p', text: par });
    });
    return out;
  };

  // ---------- документы для экспорта: блоки { t: 'h' | 'p' | 'm', text } ----------
  function lines(text) { return String(text || '').split(/\r\n|\r|\n/).filter(function (l) { return l.trim(); }).map(function (l) { return { t: 'p', text: l.replace(/\s+$/, '') }; }); }
  api.lineBlocks = lines;
  api.hwBlocks = function (subject, task, result) {
    return [{ t: 'h', text: 'Предмет: ' + subject }, { t: 'h', text: 'Задание' }].concat(lines(task), [{ t: 'h', text: 'Решение' }], lines(result));
  };
  api.examBlocks = function (subject, topic, plan) {
    var out = [{ t: 'h', text: subject + '. Тема: ' + topic }];
    plan.days.forEach(function (d, i) { out.push({ t: 'p', text: (d.day || 'День ' + (i + 1)) + ' (' + d.minutes + ' мин): ' + d.task }); });
    if (plan.cheat) { out.push({ t: 'h', text: 'Шпаргалка' }); out = out.concat(lines(plan.cheat).map(function (b) { return { t: 'm', text: b.text }; })); }
    return out;
  };
  api.notesBlocks = function (r) {
    var out = [{ t: 'h', text: 'Кратко' }, { t: 'p', text: r.short }];
    if (r.plan.length) { out.push({ t: 'h', text: 'План' }); r.plan.forEach(function (p, i) { out.push({ t: 'p', text: (i + 1) + '. ' + p }); }); }
    if (r.terms.length) { out.push({ t: 'h', text: 'Термины' }); r.terms.forEach(function (t) { out.push({ t: 'p', text: t.term + ' — ' + t.meaning }); }); }
    if (r.questions.length) { out.push({ t: 'h', text: 'Вопросы' }); r.questions.forEach(function (q, i) { out.push({ t: 'p', text: (i + 1) + '. ' + q }); }); }
    return out;
  };
  api.wordsBlocks = function (deck) { return deck.map(function (c) { return { t: 'p', text: c.f + ' — ' + c.b }; }); };
  api.dictationBlocks = function (words) { return words.map(function (w, i) { return { t: 'p', text: (i + 1) + '. ' + w }; }); };
  api.blocksToHtml = function (blocks, esc) {
    return blocks.map(function (b) {
      return b.t === 'h' ? '<h2>' + esc(b.text) + '</h2>' : b.t === 'm' ? '<p style="font-family:Courier New,monospace">' + esc(b.text) + '</p>' : '<p>' + esc(b.text) + '</p>';
    }).join('');
  };

  // ---------- схемы для реферата (Renderers.waterCycle / plantCell / atom) ----------
  function tx(txt, x, y, size, fill, bold, anchor) {
    return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" fill="' + fill + '"' + (bold ? ' font-weight="700"' : '') + (anchor ? ' text-anchor="' + anchor + '"' : '') + ' font-family="sans-serif">' + txt + '</text>';
  }
  function circ(x, y, r, fill, stroke, sw) {
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + (fill || 'none') + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="' + sw + '"' : '') + '/>';
  }
  function line(x1, y1, x2, y2, c, w) { return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + c + '" stroke-width="' + w + '"/>'; }
  function arrow(x1, y1, x2, y2, c, w) {
    var a = Math.atan2(y2 - y1, x2 - x1), h = 30, s = 0.45;
    var p = [[x2, y2], [x2 - h * Math.cos(a - s), y2 - h * Math.sin(a - s)], [x2 - h * Math.cos(a + s), y2 - h * Math.sin(a + s)]];
    return line(x1, y1, x2, y2, c, w) + '<polygon points="' + p.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ') + '" fill="' + c + '"/>';
  }
  function oval(cx, cy, rx, ry, fill, stroke, sw) { return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>'; }
  function rrect(x1, y1, x2, y2, fill, stroke, sw, r) {
    return '<rect x="' + x1 + '" y="' + y1 + '" width="' + (x2 - x1) + '" height="' + (y2 - y1) + '" rx="' + r + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
  }
  function svgWrap(w, h, bg, body) {
    return '<svg xmlns="http://www.w3.org/2000/svg" class="fig" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '"><rect width="' + w + '" height="' + h + '" fill="' + bg + '"/>' + body + '</svg>';
  }
  var AXIS = '#282828';
  api.waterCycleSvg = function () {
    var b = tx('Круговорот воды в природе', 500, 52, 38, AXIS, true, 'middle') + circ(120, 140, 50, '#ffcd28');
    for (var i = 0; i < 12; i++) { var a = i * Math.PI / 6; b += line((120 + 66 * Math.cos(a)).toFixed(1), (140 + 66 * Math.sin(a)).toFixed(1), (120 + 88 * Math.cos(a)).toFixed(1), (140 + 88 * Math.sin(a)).toFixed(1), '#ffbe00', 5); }
    b += '<polygon points="560,640 800,300 1000,640" fill="#8c8c96"/><polygon points="740,380 800,300 860,380 820,360 800,385 770,360" fill="#fff"/>';
    b += '<rect x="0" y="590" width="1000" height="170" fill="#2878c8"/>';
    for (i = 0; i < 8; i++) b += tx('~  ~  ~', 60 + i * 125, 640 + (i % 2) * 40, 30, '#a0cdf5');
    [[330, 190, 55], [400, 160, 70], [480, 190, 55], [400, 210, 55]].forEach(function (c) { b += circ(c[0], c[1], c[2], '#f5f5fa', '#aab4c8', 3); });
    b += tx('Облако', 400, 270, 26, AXIS, true, 'middle');
    for (i = 0; i < 6; i++) b += line(350 + i * 24, 280, 335 + i * 24, 345, '#1e5abe', 5);
    b += arrow(200, 580, 270, 340, '#c82828', 7) + tx('Испарение', 80, 470, 28, '#c82828', true);
    b += arrow(470, 255, 640, 300, '#783ca0', 7) + tx('Ветер переносит облака', 560, 250, 24, '#783ca0', true);
    b += tx('Осадки: дождь, снег', 330, 395, 28, '#1e5abe', true) + tx('Конденсация', 300, 120, 28, '#5a5a6e', true);
    b += '<path d="M810 400 Q760 480 800 540 Q830 580 780 600" fill="none" stroke="#5aaaf0" stroke-width="9"/>';
    b += tx('Реки и ручьи', 840, 520, 26, '#fff', true) + tx('Море, океан', 380, 715, 30, '#fff', true, 'middle');
    return svgWrap(1000, 760, '#d6ecff', b);
  };
  api.plantCellSvg = function () {
    var b = tx('Растительная клетка', 500, 50, 38, AXIS, true, 'middle');
    b += rrect(40, 90, 640, 710, '#c8e6be', '#1e7832', 12, 40) + rrect(62, 112, 618, 688, '#e8f5de', '#78a078', 4, 30) + rrect(190, 270, 520, 600, '#bee1fa', '#5a8cbe', 4, 80);
    b += circ(150, 200, 62, '#e6bedc', '#8c4678', 5) + circ(150, 200, 22, '#8c4678');
    [[560, 170], [100, 520], [570, 640]].forEach(function (p) { b += oval(p[0], p[1], 48, 26, '#3caa46', '#146428', 4); });
    [[330, 160], [110, 360]].forEach(function (p) { b += oval(p[0], p[1], 44, 24, '#fabe78', '#be641e', 4) + line(p[0] - 30, p[1], p[0] + 30, p[1], '#be641e', 3); });
    function label(text, fx, fy, ty) { b += line(fx, fy, 700, ty, '#444', 3) + tx(text, 710, ty + 9, 28, AXIS, true); }
    label('Клеточная стенка', 40, 400, 130); label('Мембрана', 618, 300, 230); label('Ядро', 190, 190, 330); label('Вакуоль', 520, 430, 430);
    label('Хлоропласт', 608, 170, 530); label('Митохондрия', 374, 160, 630); label('Цитоплазма', 600, 520, 700);
    return svgWrap(1000, 760, '#ffffff', b);
  };
  api.shells = function (z) { return z <= 2 ? [z] : z <= 10 ? [2, z - 2] : z <= 18 ? [2, 8, z - 10] : [2, 8, 8, z - 18]; };
  api.atomSvg = function (z, a, name, sym) {
    var sh = api.shells(z), w = 900, h = 900, cx = 450, cy = 470, step = 330 / (sh.length + 0.5);
    var b = tx('Атом: ' + name + ' (' + sym + ')', cx, 56, 38, AXIS, true, 'middle');
    sh.forEach(function (count, i) {
      var r = 80 + step * (i + 0.5) + i * 10;
      b += circ(cx, cy, r, null, '#787896', 4);
      for (var k = 0; k < count; k++) { var ang = 2 * Math.PI * k / count - Math.PI / 2; b += circ((cx + r * Math.cos(ang)).toFixed(1), (cy + r * Math.sin(ang)).toFixed(1), 14, '#1e5ac8', '#0a2878', 3); }
    });
    b += circ(cx, cy, 52, '#e65050', '#8c1414', 4) + tx(z + ' p⁺', cx, cy - 4, 24, '#fff', true, 'middle') + tx((a - z) + ' n', cx, cy + 26, 24, '#fff', true, 'middle');
    b += tx('Протонов: ' + z + '   Нейтронов: ' + (a - z) + '   Электронов: ' + z, cx, h - 90, 28, AXIS, false, 'middle');
    b += tx('Электроны по слоям: ' + sh.join(' + '), cx, h - 48, 28, AXIS, false, 'middle');
    return svgWrap(w, h, '#ffffff', b);
  };
  api.schemeSvg = function (name) {
    return name === 'Круговорот воды' ? api.waterCycleSvg() : name === 'Растительная клетка' ? api.plantCellSvg() : name === 'Атом углерода' ? api.atomSvg(6, 12, 'Углерод', 'C') : null;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Kid_study = api;
})(typeof window !== 'undefined' ? window : globalThis);
