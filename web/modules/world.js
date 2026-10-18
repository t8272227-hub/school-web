// Разделы «Чтение», «Историческая справка», «Что задано», «Спроси друга», «AR-линза».
// Логика (разбор ответов, тексты для ИИ, адреса Викитеки и Википедии, тревога, коды) лежит в world-lib.js.
(function () {
  'use strict';
  var Kid = window.Kid, W = window.Kid_world, esc = Kid.esc;
  var P = W.Prompts, RL = W.ReaderLogic, WP = W.WikiParser, NA = W.NetAdvice, AP = W.AssignedParser, AR = W.ArParser, AD = W.AlertDetector, CI = W.CodeInfo, RLst = W.ReadingList;

  // ---------- стили этого модуля ----------
  (function () {
    var st = document.createElement('style');
    st.textContent =
      '.w-banner{background:#ffe9b8;color:#3d2e00;border-radius:16px;padding:12px 14px;margin:0 0 12px;font-weight:500}' +
      '.w-page{background:#fffbf2}.w-page pre{line-height:1.5}' +
      '.w-click{cursor:pointer}.w-click.on{background:var(--vl)}' +
      '.w-alert{border:3px solid #b25a00;background:#fff3e0;border-radius:16px;padding:16px;margin:0 0 12px}' +
      '.w-alert h3{margin:0 0 8px;font-size:21px}.w-alert p{margin:6px 0;font-size:17px}' +
      '.w-chat{max-height:340px;overflow-y:auto;padding:2px}' +
      '.w-sys{font-size:13px;font-style:italic;color:var(--mut);margin:6px 0}' +
      '.w-orb{display:block;margin:10px auto 4px;width:88px;height:88px;border-radius:50%;border:0;background:var(--v);color:#fff;font:inherit;font-weight:700;cursor:pointer}' +
      '.w-orb.l{background:var(--err)}.w-orb.t{background:#9a82db}.w-orb.s{background:var(--ok)}' +
      '.w-center{text-align:center}' +
      '.w-arwrap{position:relative;margin:0 0 12px}.w-arwrap canvas{display:block;width:100%;height:auto;border-radius:12px;cursor:pointer;background:#eee}' +
      '.w-bubble{position:absolute;width:260px;max-width:92%;background:rgba(255,255,255,.96);border:2px solid var(--v);border-radius:14px;padding:10px;font-size:13px;line-height:1.35;color:#000;box-shadow:0 2px 10px rgba(0,0,0,.25)}' +
      '.w-bubble b{display:block;font-size:15px;margin-bottom:2px}' +
      '.w-vslot video,.w-video{width:100%;max-height:420px;border-radius:12px;background:#000;display:block}' +
      '.w-num{display:inline-block;min-width:24px;height:24px;line-height:24px;text-align:center;border-radius:12px;color:#fff;font-size:13px;font-weight:700;margin-right:8px}' +
      '.w-hsrc{font-size:12px;color:var(--mut)}';
    document.head.appendChild(st);
  })();

  // ---------- общее ----------
  function getText(url) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
    return fetch(url, ctl ? { signal: ctl.signal } : undefined).then(function (r) {
      if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      return r.text();
    }).then(function (t) { clearTimeout(to); return t; }, function (e) { clearTimeout(to); throw e; });
  }
  function online() { return typeof navigator === 'undefined' || navigator.onLine !== false; }
  function banner(t) { return t ? '<div class="w-banner" role="alert">' + esc(t) + '</div>' : ''; }
  function small(t) { return '<p class="mut" style="font-size:13px">' + esc(t) + '</p>'; }
  function nowIso() { return Kid.today(); }
  function enterKey(act) { return ' data-enter="' + act + '"'; }
  function pre(t) { return '<pre>' + esc(t) + '</pre>'; }
  function sbook() { return Kid.store('tb', {}); }

  // Enter в поле запускает кнопку с нужным действием
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.shiftKey || !e.target.getAttribute) return;
    var a = e.target.getAttribute('data-enter'); if (!a) return;
    var b = document.querySelector('#view [data-act="' + a + '"]');
    if (b && !b.disabled) { e.preventDefault(); b.click(); }
  });

  // ============================================================ Историческая справка (и карточка для AR)
  var H = Kid.mod('historyCards', {});          // состояние по запросу: { loading, pages, net, error, simple, ai, aiErr }
  function hs(q) { if (!H[q]) H[q] = { loading: false, pages: null, net: '', error: '', simple: {}, ai: false, aiErr: '' }; return H[q]; }

  function histCard(q, withButton) {
    var s = hs(q), qa = ' data-q="' + esc(q) + '"', h = '';
    if (withButton) h += '<button class="b t" data-act="histGo"' + qa + (s.loading || !q.trim() ? ' disabled' : '') + '>Историческая справка</button>';
    if (s.loading) h += Kid.busy('Ищу в интернете…');
    h += banner(s.net) + Kid.err(s.error);
    (s.pages || []).forEach(function (p, i) {
      var shown = s.simple[p.title] != null ? s.simple[p.title] : p.extract;
      h += '<div class="card"><b>' + esc(p.title) + '</b>' + pre(shown) +
        (p.url ? '<div class="w-hsrc">Источник: Википедия, ' + (/^https:\/\//.test(p.url) ? '<a href="' + esc(p.url) + '" target="_blank" rel="noopener noreferrer">' + esc(p.url) + '</a>' : esc(p.url)) + '</div>' : '') +
        (s.simple[p.title] == null ? '<button class="b o" data-act="histSimple"' + qa + ' data-i="' + i + '"' + (s.ai ? ' disabled' : '') + '>Объяснить проще</button>' : '') + '</div>';
    });
    if (s.ai) h += Kid.busy('Пересказываю…');
    h += Kid.err(s.aiErr);
    if (s.pages && s.pages.length) h += small('Справка взята из Википедии. Сверь важное с учебником.');
    return h;
  }
  function histSearch(q) {
    q = String(q || '').trim(); var s = hs(q);
    if (s.loading || !q) return Promise.resolve();
    s.loading = true; s.net = ''; s.error = ''; s.pages = null; Kid.render();
    return getText(WP.searchUrl(q)).then(function (j) {
      s.pages = WP.parse(j);
      if (!s.pages.length) s.error = 'По запросу «' + q + '» ничего не нашлось. Попробуй назвать иначе.';
    }, function (e) { s.net = NA.adviceFor(e, online()) || ''; s.error = 'Справка не загрузилась.'; }).then(function () { s.loading = false; });
  }
  var hm = Kid.mod('history', { q: '', asked: '' });
  Kid.register({ key: 'history', title: 'Историческая справка', subtitle: 'Поиск в интернете', view: function () {
    var h = Kid.head('Историческая справка', 'Поиск в интернете');
    h += '<div class="card">' + '<label>О чём нужна справка? Например: Бородинское сражение</label><input data-bind="history.q"' + enterKey('hiFind') + ' value="' + esc(hm.q) + '">' +
      '<button class="b" data-act="hiFind">Найти</button></div>';
    if (hm.asked) h += histCard(hm.asked, false);
    return h + small('Нужен интернет. Если сайт не открывается, приложение подскажет, включить или выключить VPN.');
  }, acts: {
    hiFind: function () { hm.asked = hm.q.trim(); return histSearch(hm.asked); },
    histGo: function (v, el) { return histSearch(el.getAttribute('data-q')); },
    histSimple: function (v, el) {
      var q = el.getAttribute('data-q'), s = hs(q), p = s.pages && s.pages[parseInt(el.getAttribute('data-i'), 10)];
      if (!p || s.ai) return;
      s.ai = true; s.aiErr = ''; Kid.render();
      return Kid.askAI(P.historySimplify(Kid.grade()), p.extract).then(function (t) { s.simple[p.title] = t.trim(); }, function (e) { s.aiErr = e.message; }).then(function () { s.ai = false; });
    },
  } });

  // ============================================================ Чтение
  var DATA = (window.KidData && window.KidData.reading) || {};
  var R = Kid.mod('reading', { grade: null, filter: 'Все', interests: '', advice: '', adviceBusy: false, adviceErr: '',
    reader: false, rq: '', hits: null, chapters: [], title: '', pages: [], page: 0, fs: 18, loading: false, error: '', net: '', explain: '', exBusy: false, exErr: '', speaking: false });
  function doneSet() { var d = Kid.store('read_done', []); return Array.isArray(d) ? d : []; }
  function rdFail(e) { R.error = 'Не получилось загрузить.'; R.net = NA.adviceFor(e, online()) || ''; }

  function rdSearch() {
    var q = R.rq.trim(); if (!q || R.loading) return Promise.resolve();
    R.loading = true; R.error = ''; R.net = ''; R.hits = null; R.chapters = []; R.pages = []; R.title = ''; Kid.render();
    return getText(RL.searchUrl(q)).then(function (j) {
      R.hits = RL.parseSearch(j);
      if (!R.hits.length) R.error = 'Не нашлось. Попробуй ввести автора и название, например: Тургенев Муму. Книги современных авторов онлайн недоступны: ищи их в библиотеке.';
    }, rdFail).then(function () { R.loading = false; });
  }
  function rdOpen(t) {
    R.loading = true; R.error = ''; R.net = ''; R.explain = ''; R.exErr = ''; Kid.stopSpeak(); R.speaking = false; Kid.render();
    return getText(RL.textUrl(t)).then(function (j) {
      var parsed = RL.parseText(j);
      return getText(RL.linksUrl(t)).then(RL.parseLinks, function () { return []; }).then(function (links) {
        if (!parsed) { R.error = 'Текст этой страницы не нашёлся.'; return; }
        R.title = parsed.title; R.hits = null;
        if (RL.looksLikeToc(parsed.text, links)) { R.chapters = links; R.pages = []; }
        else {
          R.pages = RL.paginate(parsed.text); R.chapters = [];
          var bm = Kid.store('bm', {}); R.page = RL.clampPage(parseInt(bm[parsed.title], 10) || 0, R.pages.length);
        }
      });
    }, rdFail).then(function () { R.loading = false; });
  }
  function rdGoto(p) {
    R.page = RL.clampPage(p, R.pages.length);
    var bm = Kid.store('bm', {}); bm[R.title] = R.page; Kid.saveStore('bm', bm);
    R.explain = ''; R.exErr = ''; Kid.stopSpeak(); R.speaking = false; window.scrollTo(0, 0);
  }

  function vReader() {
    var h = '<div class="card"><label>Автор и название</label><input data-bind="reading.rq"' + enterKey('rdSearch') + ' value="' + esc(R.rq) + '">' +
      '<div class="row"><button class="b" data-act="rdSearch"' + (R.loading ? ' disabled' : '') + '>Найти</button><button class="b o" data-act="rdClose">Закрыть чтение</button></div></div>';
    if (R.loading) h += Kid.busy('Загружаю…');
    h += banner(R.net) + Kid.err(R.error);
    (R.hits || []).forEach(function (x, i) {
      h += '<div class="card w-click" data-act="rdPick" data-v="' + i + '"><b>' + esc(x.title) + '</b>' + (x.snippet ? '<div class="mut">' + esc(x.snippet) + '</div>' : '') + '</div>';
    });
    if (R.chapters.length) {
      h += '<b style="font-size:18px">' + esc(R.title) + '</b><p class="mut">Выбери главу:</p>';
      R.chapters.forEach(function (c, i) { h += '<div class="card w-click" data-act="rdChapter" data-v="' + i + '">' + esc(c.substring(c.lastIndexOf('/') + 1)) + '</div>'; });
    }
    if (R.pages.length) {
      var p = RL.clampPage(R.page, R.pages.length), text = R.pages[p];
      h += '<b>' + esc(R.title) + '</b><p class="mut">Страница ' + (p + 1) + ' из ' + R.pages.length + '</p>' +
        '<div class="card w-page" id="w-book"><pre style="font-size:' + R.fs + 'px">' + esc(text) + '</pre></div>' +
        '<div class="row"><button class="b t" data-act="rdPrev"' + (p > 0 ? '' : ' disabled') + '>← Назад</button><button class="b" data-act="rdNext"' + (p < R.pages.length - 1 ? '' : ' disabled') + '>Дальше →</button></div>' +
        '<div class="row"><button class="b o" data-act="rdFs" data-v="-2">A−</button><button class="b o" data-act="rdFs" data-v="2">A+</button><button class="b t" data-act="rdListen">' + (R.speaking ? 'Стоп' : 'Слушать') + '</button></div>' +
        '<button class="b o" data-act="rdExplain"' + (R.exBusy ? ' disabled' : '') + '>Объяснить страницу</button>';
      if (R.exBusy) h += Kid.busy('Объясняю…');
      h += Kid.err(R.exErr);
      if (R.explain) h += '<div class="card tint">' + pre(R.explain) + '</div>';
      if (!R.chapters.length && R.title.indexOf('/') >= 0) h += small('Глава закончилась? Вернись к поиску и выбери следующую.');
    }
    return h + small('Онлайн читаются книги, свободные от авторских прав: в основном классика. Текст берётся из Викитеки, закладка сохраняется сама.');
  }
  function vReadingList() {
    if (R.grade == null) R.grade = String(RLst.gradeNumber(Kid.grade()) || 5);
    var g = parseInt(R.grade, 10), all = RLst.forGrade(DATA, g), done = doneSet(), noGrade = !RLst.gradeNumber(Kid.grade());
    var shown = all.filter(function (b) { return R.filter === 'Программа' ? b.program : R.filter === 'Для души' ? !b.program : true; });
    var readCount = all.filter(function (b) { return done.indexOf(RLst.key(b)) >= 0; }).length;
    var h = Kid.head('Чтение', 'Книги по классу') + '<label>Класс</label>' + Kid.chips(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'], R.grade, 'rdGrade');
    if (noGrade) h += small('Укажи класс в профиле, и список откроется сразу для него.');
    h += '<div style="height:8px"></div>' + Kid.chips(['Все', 'Программа', 'Для души'], R.filter, 'rdFilter') + '<p><b>Прочитано: ' + readCount + ' из ' + all.length + '</b></p>';
    shown.forEach(function (b) {
      var k = RLst.key(b), isDone = done.indexOf(k) >= 0;
      h += '<div class="card w-click' + (isDone ? ' on' : '') + '" data-act="rdToggle" data-v="' + esc(k) + '"><b>' + (isDone ? '✓ ' : '') + esc(b.title) + '</b><div class="mut">' + esc(b.author + (b.program ? '' : ' · для души')) + '</div><div>' + esc(b.why) + '</div>' +
        '<button class="b t" data-act="rdRead" data-v="' + esc((b.author + ' ' + b.title).replace(/[.«»]/g, '')) + '">Читать онлайн</button></div>';
    });
    h += small('Список примерный, по школьной программе. Если учитель дал свой список, он главнее. Нажми на книгу, чтобы отметить прочитанной.');
    h += '<button class="b o" data-act="rdFind">Найти книгу и читать онлайн</button>';
    h += '<div class="card" style="margin-top:12px"><b>Подобрать по интересам</b><label>Что нравится? Например: приключения, животные, космос</label><input data-bind="reading.interests"' + enterKey('rdAdvice') + ' value="' + esc(R.interests) + '">' +
      '<button class="b" data-act="rdAdvice"' + (R.adviceBusy ? ' disabled' : '') + '>Посоветуй книги</button>';
    if (R.adviceBusy) h += Kid.busy('Подбираю книги…');
    h += Kid.err(R.adviceErr);
    if (R.advice) h += pre(R.advice) + small('Проверь название и автора в библиотеке или у родителей: ИИ может ошибиться.');
    h += '</div>';
    if (all.length) h += '<div class="row"><button class="b o" data-act="rdWord">Сохранить список в Word</button><button class="b o" data-act="rdPrint">Печать</button></div>';
    return h;
  }
  function readingExportHtml() {
    var g = parseInt(R.grade, 10), done = doneSet(), all = RLst.forGrade(DATA, g);
    var body = '<h1>Список чтения, ' + g + ' класс</h1>' + all.map(function (b) { return '<p>' + (done.indexOf(RLst.key(b)) >= 0 ? '[x] ' : '[ ] ') + esc(b.author) + ', «' + esc(b.title) + '»: ' + esc(b.why) + '</p>'; }).join('');
    if (R.advice) body += '<h2>Советы по интересам</h2>' + R.advice.split('\n').filter(function (l) { return l.trim(); }).map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('');
    return body;
  }
  Kid.register({ key: 'reading', title: 'Чтение', subtitle: 'Книги и чтение онлайн', view: function () { return R.reader ? Kid.head('Чтение', 'Читать онлайн') + vReader() : vReadingList(); }, acts: {
    rdGrade: function (v) { R.grade = v; },
    rdFilter: function (v) { R.filter = v; },
    rdToggle: function (k) {
      var d = doneSet(), i = d.indexOf(k);
      if (i >= 0) d.splice(i, 1); else d.push(k);
      Kid.saveStore('read_done', d);
    },
    rdRead: function (v) { R.reader = true; R.rq = v; return rdSearch(); },
    rdFind: function () { R.reader = true; R.rq = ''; R.hits = null; R.chapters = []; R.pages = []; R.title = ''; R.error = ''; R.net = ''; },
    rdClose: function () { Kid.stopSpeak(); R.speaking = false; R.reader = false; },
    rdSearch: rdSearch,
    rdPick: function (v) { var x = R.hits && R.hits[parseInt(v, 10)]; if (x) return rdOpen(x.title); },
    rdChapter: function (v) { var c = R.chapters[parseInt(v, 10)]; if (c) return rdOpen(c); },
    rdPrev: function () { rdGoto(R.page - 1); },
    rdNext: function () { rdGoto(R.page + 1); },
    rdFs: function (v) { R.fs = Math.min(30, Math.max(14, R.fs + parseInt(v, 10))); },
    rdListen: function () {
      if (R.speaking) { Kid.stopSpeak(); R.speaking = false; return; }
      var text = R.pages[RL.clampPage(R.page, R.pages.length)]; if (!text) return;
      R.speaking = true;
      Kid.speak(text, function () { if (R.speaking) { R.speaking = false; Kid.render(); } });
    },
    rdExplain: function () {
      var text = R.pages[RL.clampPage(R.page, R.pages.length)]; if (!text || R.exBusy) return;
      R.exBusy = true; R.exErr = ''; Kid.render();
      return Kid.askAI(P.readerExplain(Kid.grade()), text).then(function (t) { R.explain = t.trim(); }, function (e) { R.exErr = e.message; }).then(function () { R.exBusy = false; });
    },
    rdAdvice: function () {
      if (R.adviceBusy) return;
      var g = parseInt(R.grade, 10), done = doneSet(), all = RLst.forGrade(DATA, g).map(RLst.key).filter(function (k) { return done.indexOf(k) >= 0; });
      R.adviceBusy = true; R.adviceErr = ''; Kid.render();
      return Kid.askAI(P.readingAdvice(R.grade, R.interests, all), 'Посоветуй книги.', null, 800, 0.4).then(function (t) { R.advice = t.trim(); }, function (e) { R.adviceErr = e.message; }).then(function () { R.adviceBusy = false; });
    },
    rdWord: function () { Kid.saveWord('Чтение, ' + R.grade + ' класс', readingExportHtml()); },
    rdPrint: function () { Kid.printHtml('Чтение, ' + R.grade + ' класс', readingExportHtml()); },
  } });

  // ============================================================ Что задано
  var A = Kid.mod('assigned', { text: '', photo: null, busy: false, ocr: false, error: '', items: null, raw: '', showBooks: false, listening: false, info: '' });
  function booksFilled() { var b = sbook(), o = {}; Kid.SUBJECTS.forEach(function (s) { if (b[s] && String(b[s]).trim()) o[s] = String(b[s]).trim(); }); return o; }
  function subjectOf(name) { var l = String(name).toLowerCase(), r = null; Kid.SUBJECTS.forEach(function (s) { if (s.toLowerCase() === l) r = s; }); return r; }
  function assignedExportHtml() {
    return '<h1>Что задано</h1>' + AP.groupBySubject(A.items).map(function (g) {
      return '<h2>' + esc(g.subject) + '</h2>' + g.items.map(function (it) { return '<p>' + esc(it.task + (it.pages ? ' (' + it.pages + ')' : '') + (it.material ? '. Учебник: ' + it.material : '')) + '</p>'; }).join('');
    }).join('');
  }
  Kid.register({ key: 'assigned', title: 'Что задано', subtitle: 'Предметы и учебники по записи', view: function () {
    var books = booksFilled(), nb = Object.keys(books).length;
    var h = Kid.head('Что задано', 'Предметы и учебники по записи') + small('Сфотографируй запись из дневника, доску или страницу учебника. Определю предметы, что сделать и по какому учебнику.');
    h += '<div class="card"><label>Запись о домашнем задании</label><textarea data-bind="assigned.text" placeholder="Напиши, загрузи фото или надиктуй">' + esc(A.text) + '</textarea>' +
      Kid.photoBox(A.photo, 'asPhoto', 'Фото записи (текст с фото добавится в поле)') +
      (Kid.canListen() ? '<button class="b t" data-act="asVoice"' + (A.listening ? ' disabled' : '') + '>' + (A.listening ? 'Слушаю…' : 'Голос') + '</button>' : '') +
      '<div><button class="b" data-act="asGo"' + (A.busy || A.ocr ? ' disabled' : '') + '>Определить предметы и учебники</button></div></div>';
    if (A.ocr) h += Kid.busy('Читаю фото…');
    if (A.busy) h += Kid.busy('Разбираю запись…');
    h += Kid.err(A.error);
    if (A.raw) h += '<div class="card">' + pre(A.raw) + '</div>';
    if (A.items) {
      AP.groupBySubject(A.items).forEach(function (g) {
        h += '<div class="card"><b style="font-size:18px;color:var(--v)">' + esc(g.subject) + '</b>';
        g.items.forEach(function (it) { h += '<div style="margin-top:6px">' + esc(it.task) + '</div>' + (it.pages ? '<div class="mut">Где: ' + esc(it.pages) + '</div>' : ''); });
        var mat = g.items.filter(function (i) { return i.material; })[0], subj = subjectOf(g.subject);
        if (mat) {
          h += '<p><b>Учебник: ' + esc(mat.material) + (mat.fromPhoto ? ' (виден в записи)' : ' (из твоего списка)') + '</b></p>';
          if (mat.fromPhoto && subj && !books[subj]) h += '<button class="b t" data-act="asRemember" data-v="' + esc(subj) + '" data-m="' + esc(mat.material) + '">Запомнить этот учебник</button>';
        } else h += '<p style="color:var(--warn);font-size:14px">Учебник не указан. Добавь его в «Мои учебники» ниже, и в следующий раз он подставится сам.</p>';
        h += '</div>';
      });
      h += '<div class="row"><button class="b o" data-act="asWord">Сохранить в Word</button><button class="b o" data-act="asPrint">Печать</button></div>';
    }
    h += '<div class="card" style="margin-top:12px"><b>Мои учебники</b><p>' + (nb ? 'Заполнено предметов: <span id="w-tbcount">' + nb + '</span>' : 'Пока не заполнено.') + '</p>' +
      '<button class="b t" data-act="asBooks">' + (A.showBooks ? 'Свернуть' : 'Заполнить') + '</button>';
    if (A.showBooks) {
      var all = sbook();
      Kid.SUBJECTS.forEach(function (s) { h += '<label>' + esc(s) + ': автор и название учебника</label><input data-tb="' + esc(s) + '" value="' + esc(all[s] || '') + '">'; });
    }
    return h + '</div>';
  }, acts: {
    asPhoto: function (v, el) {
      return Kid.readPhoto(el.files[0]).then(function (d) {
        A.photo = d; A.ocr = true; A.error = ''; Kid.render();
        return Kid.askAI(P.photoOcr(), 'Перепиши задание с фото.', d).then(function (t) { A.text = A.text.trim() ? A.text.replace(/\s+$/, '') + '\n' + t : t; }, function (e) { A.error = e.message; });
      }, function (e) { A.error = e.message; }).then(function () { A.ocr = false; });
    },
    asPhotoClear: function () { A.photo = null; },
    asVoice: function () {
      A.listening = true; A.error = '';
      Kid.listen(function (t) { if (t) A.text = A.text.trim() ? A.text.replace(/\s+$/, '') + ' ' + t : t; Kid.render(); }, function (msg) { A.listening = false; if (msg) A.error = msg; Kid.render(); });
    },
    asGo: function () {
      if (A.busy || A.ocr) return;
      if (!A.text.trim()) { A.error = 'Напиши запись или загрузи фото.'; return; }
      A.items = null; A.raw = ''; A.error = ''; A.busy = true; Kid.render();
      return Kid.askAI(P.assigned(Kid.grade(), booksFilled()), A.text, null, 2000, 0.1).then(function (r) {
        var parsed = AP.parse(r); if (parsed) A.items = parsed; else A.raw = r;
      }, function (e) { A.error = e.message; }).then(function () { A.busy = false; });
    },
    asRemember: function (s, el) { var b = sbook(); b[s] = el.getAttribute('data-m'); Kid.saveStore('tb', b); },
    asBooks: function () { A.showBooks = !A.showBooks; },
    asWord: function () { if (A.items) Kid.saveWord('Что задано', assignedExportHtml()); },
    asPrint: function () { if (A.items) Kid.printHtml('Что задано', assignedExportHtml()); },
  } });
  // «Мои учебники»: сохраняем каждую правку сразу, как на телефоне
  document.addEventListener('input', function (e) {
    var s = e.target.getAttribute && e.target.getAttribute('data-tb'); if (!s) return;
    var b = sbook(); b[s] = e.target.value.trim(); Kid.saveStore('tb', b);
    var c = document.getElementById('w-tbcount'); if (c) c.textContent = Object.keys(booksFilled()).length;
  });

  // ============================================================ Спроси друга
  var F = Kid.mod('friend', { turns: [], input: '', state: 'idle', partial: '', info: '', alert: false, rec: null });
  function fVoiceOn() { return Kid.store('friend_voice', true) !== false; }
  function fChild() { return Kid.store('child_mode', true) !== false; }
  // Браузер не умеет отправлять SMS, поэтому ИИ не должен обещать, что родители уже знают
  var WEB_ALERT_NOTE = ' ВАЖНО: браузер сам родителям ничего не отправляет; если подключена синхронизация, телефон родителя пришлёт им SMS чуть позже. Не обещай, что родители уже знают: ' +
    'тёпло попроси ребёнка прямо сейчас сказать об этом взрослому, которому он доверяет, и назови телефон доверия 8-800-2000-122.';
  function friendSystem() { return P.friend(Kid.grade(), fChild()) + WEB_ALERT_NOTE; }
  var ALERT_NOTE_TURN = 'Родителям может прийти SMS через телефон (если подключена синхронизация), но надёжнее скажи взрослому сам: маме, папе, учителю или тому, кому доверяешь.';

  function recordAlert() {
    var list = Kid.store('alerts', []); if (!Array.isArray(list)) list = [];
    list.push(AD.record(Date.now(), nowIso(), 'friend'));      // только дата, текста разговора в записи нет
    Kid.saveStore('alerts', list.slice(-100));
    var id = 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    window.KidSync.put(Kid.state.alerts, { id: id, date: nowIso(), source: 'pc' }, Date.now());   // телефон отправит SMS при синхронизации
    Kid.syncSoon();
    F.alert = true;
  }
  function fDeliver(reply, note) {
    F.turns.push({ child: false, text: reply });
    if (note) F.turns.push({ child: false, text: note, system: true });
    if (fVoiceOn()) {
      F.state = 'speaking';
      Kid.speak(note ? reply + ' ' + note : reply, function () { if (F.state === 'speaking') { F.state = 'idle'; Kid.render(); } });
    } else F.state = 'idle';
  }
  function fSubmit(text) {
    var clean = String(text || '').trim();
    if (!clean || F.state === 'thinking') return Promise.resolve();
    F.turns.push({ child: true, text: clean });
    var msgs = F.turns.filter(function (t) { return !t.system; }).slice(0, -1).slice(-10).map(function (t) { return { role: t.child ? 'user' : 'assistant', content: t.text }; });
    msgs.push({ role: 'user', content: clean });
    F.state = 'thinking'; F.info = ''; Kid.render();
    var local = AD.userMessageNeedsAlert(clean), model = false;
    return Kid.chatAI(friendSystem(), msgs, 400, 0.6).then(function (r) {
      var s = AD.stripMarker(r); model = s.had; return s.text;
    }, function (e) {
      return local ? 'Мне важно, что ты это сказал. Поговори, пожалуйста, со взрослым, кто сейчас рядом.' : e.message;
    }).then(function (reply) {
      var note = null;
      if (local || model) { recordAlert(); note = ALERT_NOTE_TURN; }
      fDeliver(reply, note);
    });
  }
  function fAlertCard() {
    return '<div class="w-alert" role="alert"><h3>Скажи об этом взрослому прямо сейчас</h3>' +
      '<p>Мне важно, что ты это сказал. Ты не один. Подойди к человеку, которому доверяешь: маме, папе, бабушке, учителю. Если никого рядом нет, позвони на детский телефон доверия: <b>' + AD.HELPLINE + '</b>. Звонок бесплатный, он работает каждый день.</p>' +
      '<p><b>С компьютера родителям сообщение не уходит.</b> Они узнают об этом, только если ты сам им скажешь.</p>' +
      '<button class="b" data-act="frAlertOk">Понятно</button></div>';
  }
  var ORB = { idle: ['', 'Нажми и говори'], listening: ['l', 'Слушаю…'], thinking: ['t', 'Думаю…'], speaking: ['s', 'Отвечаю… (нажми, чтобы остановить)'] };
  function vFriend() {
    var h = Kid.head('Спроси друга', 'Говори голосом или пиши, друг ответит');
    if (F.alert) h += fAlertCard();
    if (F.turns.length) {
      h += '<div class="card"><div class="w-chat" id="w-chat">' + F.turns.map(function (t) {
        return t.system ? '<div class="w-sys">' + esc(t.text) + '</div>' : '<div class="msg ' + (t.child ? 'me' : 'ai') + '">' + esc(t.text) + '</div>';
      }).join('') + '</div></div>';
    } else h += '<div class="card"><p class="mut">Нажми на кружок и спроси о чём угодно, или напиши ниже.</p></div>';
    var can = Kid.canListen(), o = ORB[F.state] || ORB.idle;
    h += '<div class="card w-center">' + (can ? '<button class="w-orb ' + o[0] + '" data-act="frOrb" aria-label="Микрофон">' + (F.state === 'speaking' ? 'Стоп' : F.state === 'listening' ? 'Готово' : 'Говорить') + '</button>' : '') +
      '<div class="mut">' + esc(F.state === 'listening' && F.partial ? F.partial : (can ? o[1] : (F.state === 'thinking' ? 'Думаю…' : 'Голосовой ввод в этом браузере недоступен (нужен Chrome или Edge), печатай ниже.'))) + '</div>' + Kid.err(F.info) + '</div>';
    h += '<div class="card"><label>Написать другу</label><input data-bind="friend.input"' + enterKey('frSend') + ' value="' + esc(F.input) + '" autocomplete="off">' +
      '<div class="row"><button class="b" data-act="frSend"' + (F.state === 'thinking' ? ' disabled' : '') + '>Отправить</button><button class="b o" data-act="frClear">Начать заново</button></div>' +
      '<label class="swrow"><span>Отвечать вслух</span><input type="checkbox" data-act="frVoice" data-v="v"' + (fVoiceOn() ? ' checked' : '') + '></label>' +
      '<label class="swrow"><span>Детский режим (простые слова, без взрослых тем)</span><input type="checkbox" data-act="frChild" data-v="c"' + (fChild() ? ' checked' : '') + '></label></div>';
    var al = Kid.store('alerts', []); if (!Array.isArray(al)) al = [];
    h += '<div class="card tint"><b>Важно про безопасность</b><p>Друг знает много, но может ошибаться: важное проверяй. Если тебе станет совсем плохо, скажи ему, а потом обязательно скажи взрослому.</p>' +
      '<p><b>С компьютера SMS не уходит сразу.</b> Если подключена синхронизация, телефон родителя получит отметку и отправит SMS, когда откроется приложение.</p>' +
      '<p class="mut">Детский телефон доверия: ' + AD.HELPLINE + '.' + (al.length ? ' Записей «ребёнку было плохо» на этом компьютере: ' + al.length + ' (последняя: ' + esc(al[al.length - 1].date) + '). Текст разговора не сохраняется.' : '') + '</p></div>';
    return h;
  }
  Kid.register({ key: 'friend', title: 'Спроси друга', subtitle: 'Голос, ответы вслух', view: vFriend, acts: {
    frSend: function () { var t = F.input; F.input = ''; return fSubmit(t); },
    frClear: function () { Kid.stopSpeak(); if (F.rec && F.rec.abort) { try { F.rec.abort(); } catch (e) { /* уже остановлено */ } } F.rec = null; F.turns = []; F.state = 'idle'; F.partial = ''; F.info = ''; },
    frAlertOk: function () { F.alert = false; },
    frVoice: function (v, el) { Kid.saveStore('friend_voice', !!el.checked); if (!el.checked) { Kid.stopSpeak(); if (F.state === 'speaking') F.state = 'idle'; } },
    frChild: function (v, el) { Kid.saveStore('child_mode', !!el.checked); },
    frOrb: function () {
      if (F.state === 'listening') { if (F.rec && F.rec.stop) F.rec.stop(); F.state = 'idle'; return; }
      if (F.state === 'speaking') { Kid.stopSpeak(); F.state = 'idle'; return; }
      if (F.state === 'thinking') return;
      Kid.stopSpeak(); F.partial = ''; F.info = ''; F.state = 'listening';
      F.rec = Kid.listen(function (t) { if (t) fSubmit(t); }, function (msg) {
        if (msg) F.info = msg;
        if (F.state === 'listening') F.state = 'idle';
        Kid.render();
      });
      if (!F.rec && F.state === 'listening') F.state = 'idle';
    },
  } });

  // ============================================================ AR-линза
  var M = Kid.mod('ar', { mode: 'Всё вокруг', cam: 'idle', camMsg: '', shooting: false, stream: null, img: null, frozen: null, result: null, codeNotes: [], codesInfo: '', raw: '', selected: null, busy: false, error: '' });
  var MODES = ['Всё вокруг', 'Задание', 'Тетрадь'];
  var COLORS = { error: '#b3261e', answer: '#1b7f3b', place: '#b25a00', code: '#7b1fa2', text: '#00695c', info: '#6a4fc2' };
  var videoEl = null;
  function video() {
    if (!videoEl) { videoEl = document.createElement('video'); videoEl.autoplay = true; videoEl.muted = true; videoEl.setAttribute('playsinline', ''); videoEl.setAttribute('class', 'w-video'); }
    return videoEl;
  }
  function allNotes() { return M.codeNotes.concat(M.result ? M.result.notes : []); }
  function stopCamera() {
    if (M.stream) { M.stream.getTracks().forEach(function (t) { t.stop(); }); M.stream = null; }
    if (videoEl) videoEl.srcObject = null;
    if (M.cam === 'on' || M.cam === 'starting') M.cam = 'idle';
  }
  function startCamera() {
    if (M.cam === 'starting') return Promise.resolve();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      M.cam = 'error'; M.camMsg = 'Камера в этом браузере недоступна. Браузер даёт доступ к камере только на страницах https (или на этом компьютере через localhost). Загрузи фото вместо камеры.'; return Promise.resolve();
    }
    M.cam = 'starting'; M.camMsg = ''; Kid.render();
    return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }).then(function (s) {
      if (M.cam !== 'starting') { s.getTracks().forEach(function (t) { t.stop(); }); return; }   // камеру успели выключить или ушли из раздела
      M.stream = s; var v = video(); v.srcObject = s; var pl = v.play(); if (pl && pl.catch) pl.catch(function () { /* автозапуск */ });
      M.cam = 'on';
    }, function (e) {
      var n = e && e.name;
      M.cam = n === 'NotAllowedError' || n === 'SecurityError' ? 'denied' : 'error';
      M.camMsg = M.cam === 'denied' ? 'Доступ к камере не выдан. Нажми на значок камеры или замка рядом с адресом страницы, разреши доступ и нажми «Включить камеру» ещё раз. А пока можно загрузить фото.'
        : n === 'NotFoundError' || n === 'OverconstrainedError' ? 'Камера не найдена. Подключи камеру или загрузи фото.'
        : 'Не получилось включить камеру' + (n ? ' (' + n + ')' : '') + '. Её мог занять другой сайт или программа. Можно загрузить фото.';
    });
  }
  function loadImg(dataUrl) {
    return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { rej(new Error('Это не картинка.')); }; i.src = dataUrl; });
  }
  function resetAr() { M.frozen = null; M.img = null; M.result = null; M.codeNotes = []; M.codesInfo = ''; M.raw = ''; M.selected = null; M.error = ''; M.busy = false; }

  // QR и штрихкоды: только встроенный в браузер BarcodeDetector (Chrome, Edge, Android)
  function detectCodes(img) {
    if (typeof window.BarcodeDetector === 'undefined') return Promise.resolve({ supported: false, codes: [] });
    var det; try { det = new window.BarcodeDetector(); } catch (e) { return Promise.resolve({ supported: false, codes: [] }); }
    var w = img.naturalWidth, h = img.naturalHeight;
    return det.detect(img).then(function (list) {
      var seen = {}, out = [];
      (list || []).forEach(function (c) {
        var text = c.rawValue || ''; if (seen[text]) return; seen[text] = 1;
        var pts = c.cornerPoints && c.cornerPoints.length ? c.cornerPoints : (c.boundingBox ? [{ x: c.boundingBox.x, y: c.boundingBox.y }, { x: c.boundingBox.x + c.boundingBox.width, y: c.boundingBox.y + c.boundingBox.height }] : []);
        var b = CI.boxFromPoints(pts, w, h);
        out.push({ format: String(c.format || '').toUpperCase(), text: text, x: b.x, y: b.y, w: b.w, h: b.h });
      });
      return { supported: true, codes: out };
    }, function () { return { supported: true, codes: [], failed: true }; });
  }
  function analyze() {
    if (!M.img || M.busy) return Promise.resolve();
    M.selected = null; M.raw = ''; M.result = null; M.error = ''; M.busy = true; M.codesInfo = ''; Kid.render();
    var mode = M.mode, frozen = M.frozen, img = M.img;
    return detectCodes(img).then(function (cd) {
      M.codeNotes = CI.toNotes(cd.codes);
      M.codesInfo = !cd.supported ? 'QR-коды и штрихкоды в этом браузере не считываются (нет встроенного BarcodeDetector). Открой раздел в Chrome или Edge. Остальной разбор кадра работает.' : cd.failed ? 'Считать коды на этом снимке не получилось.' : '';
      var hint = Kid.hintOnly() && mode === 'Задание';
      var user = hint ? 'Разбери кадр. Не давай готовый ответ: в label напиши тему задания, в detail только подсказку, с чего начать.' : 'Разбери кадр.';
      if (cd.codes.length) user += ' Приложение уже считало коды: ' + cd.codes.map(function (c, i) { return (i + 1) + ') ' + c.format + ': ' + c.text.slice(0, 200); }).join('; ') + '.';
      return Kid.askAI(P.arLens(mode, Kid.grade()), user, frozen, 2800, 0.2);
    }).then(function (raw) {
      var r = AR.parse(raw); if (r) M.result = r; else M.raw = raw;
    }, function (e) { M.error = e.message; }).then(function () { M.busy = false; });
  }
  function freeze(dataUrl) {
    return loadImg(dataUrl).then(function (img) { stopCamera(); M.img = img; M.frozen = dataUrl; return analyze(); }, function (e) { M.error = e.message; });
  }
  function drawAr(cv) {
    var img = M.img; if (!img) return;
    var Wd = img.naturalWidth, Hd = img.naturalHeight;
    if (cv.width !== Wd || cv.height !== Hd) { cv.width = Wd; cv.height = Hd; }
    var ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, Wd, Hd);
    var fs = Math.max(12, Math.round(Wd / 55)), lw = Math.max(2, Wd / 320);
    ctx.font = 'bold ' + fs + 'px system-ui, sans-serif'; ctx.textBaseline = 'top';
    allNotes().forEach(function (n, i) {
      if (!n.hasBox) return;
      var col = COLORS[n.kind] || COLORS.info, x = n.x * Wd, y = n.y * Hd, w = n.w * Wd, h = n.h * Hd, sel = M.selected === i;
      ctx.lineWidth = sel ? lw * 2 : lw; ctx.strokeStyle = col; ctx.strokeRect(x, y, w, h);
      var label = (i + 1) + '. ' + n.label, maxW = Math.max(w, Wd * 0.3);
      while (label.length > 4 && ctx.measureText(label).width + 8 > maxW) label = label.slice(0, -2) + '…';
      var tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = col; ctx.fillRect(x, y, tw, fs + 4);
      ctx.fillStyle = '#fff'; ctx.fillText(label, x + 4, y + 2);
    });
  }
  function bubbleHtml() {
    var n = M.selected != null ? allNotes()[M.selected] : null; if (!n || !n.hasBox) return '';
    var below = n.y + n.h < 0.55, left = 'min(' + (n.x * 100).toFixed(2) + '%, calc(100% - 268px))';
    var pos = below ? 'top:calc(' + ((n.y + n.h) * 100).toFixed(2) + '% + 8px)' : 'bottom:calc(' + ((1 - n.y) * 100).toFixed(2) + '% + 8px)';
    return '<div class="w-bubble" id="w-bubble" data-act="arSel" data-v="' + M.selected + '" style="left:' + left + ';' + pos + ';border-color:' + (COLORS[n.kind] || COLORS.info) + '"><b>' + esc(n.label) + '</b>' + (n.detail ? esc(n.detail.length > 260 ? n.detail.slice(0, 260) + '…' : n.detail) : '') + '</div>';
  }
  var HINT = { 'Задание': 'Наведи на задание: решу и напишу ответ рядом', 'Тетрадь': 'Наведи на решение в тетради: отмечу строки с ошибками', 'Всё вокруг': 'Наведи на здание, предмет, текст, формулу, QR или штрихкод: объясню всё, что вижу' };
  function vAr() {
    var h = Kid.head('AR-линза', 'Камера или фото: подпишу всё, что вижу') + '<div class="card" style="padding:8px">' + Kid.chips(MODES, M.mode, 'arMode') + '</div>';
    if (!M.frozen) {
      h += small(HINT[M.mode]);
      h += '<div class="card">';
      if (M.cam === 'on') {
        h += '<div class="w-vslot" id="w-vslot"></div><div class="row"><button class="b" data-act="arShoot"' + (M.shooting ? ' disabled' : '') + '>Снять и разобрать</button><button class="b o" data-act="arCamOff">Выключить камеру</button></div>';
      } else {
        h += '<p>Для AR-линзы нужен доступ к камере. Браузер спросит разрешение.</p><button class="b" data-act="arCam"' + (M.cam === 'starting' ? ' disabled' : '') + '>Включить камеру</button>';
        if (M.cam === 'starting') h += Kid.busy('Запускаю камеру…');
      }
      h += Kid.err(M.camMsg) + '<label>Или загрузи фото</label><input type="file" accept="image/*" data-act="arFile"></div>';
      h += Kid.err(M.error);
      return h;
    }
    h += '<div class="w-arwrap"><canvas id="w-canvas" aria-label="Снимок с подписями"></canvas>' + bubbleHtml() + '</div>';
    if (M.busy) h += Kid.busy('Разглядываю кадр…');
    h += Kid.err(M.error);
    if (M.codesInfo) h += small(M.codesInfo);
    if (M.raw) h += '<div class="card">' + pre(M.raw) + '</div>';
    if (M.result && M.result.summary) h += '<div class="card tint">' + pre(M.result.summary) + '</div>';
    var notes = allNotes();
    notes.forEach(function (n, i) {
      var col = COLORS[n.kind] || COLORS.info, sel = M.selected === i;
      h += '<div class="card w-click' + (sel ? ' on' : '') + '" data-act="arSel" data-v="' + i + '"><div><span class="w-num" style="background:' + col + '">' + (i + 1) + '</span><b>' + esc(n.label) + '</b></div>' + (n.detail ? pre(n.detail) : '') +
        (n.kind === 'code' ? '<div class="mut" style="font-size:13px">Ссылки из кодов приложение само не открывает.</div>' : '') + '</div>';
      if (sel && (n.kind === 'place' || n.kind === 'info')) h += '<div style="margin:-6px 0 12px 8px">' + histCard(n.label, true) + '</div>';
    });
    if (!M.busy && !notes.length && !(M.result && M.result.summary) && !M.raw && !M.error) h += '<p>Ничего не нашлось. Попробуй снять ближе и при хорошем свете.</p>';
    return h + '<div class="row"><button class="b t" data-act="arAgain">Снять заново</button><button class="b o" data-act="arRetry"' + (M.busy ? ' disabled' : '') + '>Повторить</button></div>';
  }
  Kid.register({ key: 'ar', title: 'AR-линза', subtitle: 'Камера или фото с подписями', view: vAr, acts: {
    arMode: function (v) { if (!M.frozen) M.mode = v; },
    arCam: function () { return startCamera(); },
    arCamOff: function () { stopCamera(); },
    arShoot: function () {
      var v = video();
      if (!M.stream || !v.videoWidth) { M.camMsg = 'Камера ещё запускается, подожди секунду.'; return; }
      var k = Math.min(1, 1600 / Math.max(v.videoWidth, v.videoHeight)), cv = document.createElement('canvas');
      cv.width = Math.round(v.videoWidth * k); cv.height = Math.round(v.videoHeight * k);
      cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
      M.camMsg = ''; resetAr(); M.shooting = true;
      return freeze(cv.toDataURL('image/jpeg', 0.85)).then(function () { M.shooting = false; });
    },
    arFile: function (v, el) {
      stopCamera(); resetAr();
      return Kid.readPhoto(el.files[0]).then(freeze, function (e) { M.error = e.message; });
    },
    arSel: function (v) { var i = parseInt(v, 10); M.selected = M.selected === i ? null : i; },
    arAgain: function () { resetAr(); return startCamera(); },
    arRetry: function () { return analyze(); },
  } });
  // Нажатие на рамку на снимке выбирает подпись (самая маленькая из рамок под пальцем)
  document.addEventListener('click', function (e) {
    var cv = e.target; if (!cv || cv.id !== 'w-canvas') return;
    var r = cv.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height, best = null, area = 9;
    allNotes().forEach(function (n, i) { if (n.hasBox && fx >= n.x && fx <= n.x + n.w && fy >= n.y && fy <= n.y + n.h && n.w * n.h < area) { best = i; area = n.w * n.h; } });
    M.selected = best == null || M.selected === best ? null : best;
    Kid.render();
  });

  // ---------- после каждой перерисовки: видео, холст, прокрутка чата ----------
  function afterRender() {
    var slot = document.getElementById('w-vslot');
    if (slot && videoEl && videoEl.parentNode !== slot) { slot.appendChild(videoEl); var p = videoEl.play(); if (p && p.catch) p.catch(function () { /* пауза */ }); }
    if (M.stream && Kid.ui.view !== 'ar') stopCamera();         // ушли из раздела: камеру выключаем
    var cv = document.getElementById('w-canvas'); if (cv) drawAr(cv);
    var chat = document.getElementById('w-chat'); if (chat) chat.scrollTop = chat.scrollHeight;
  }
  var viewEl = document.getElementById('view');
  if (viewEl && typeof MutationObserver !== 'undefined') new MutationObserver(afterRender).observe(viewEl, { childList: true, subtree: true });
})();
