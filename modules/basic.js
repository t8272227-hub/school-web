// Проверка, Помощь, Тетрадь ошибок, Тренажёр, Прогресс, Настройки.
(function () {
  'use strict';
  var Kid = window.Kid, S = window.KidSync, C = window.KidCheck, esc = Kid.esc, ui = Kid.ui, state = Kid.state, settings = Kid.settings;
  var SUBJ = Kid.SUBJECTS;
  var c = Kid.mod('check', { subject: 'Математика', task: '', solution: '', photo: null, busy: false, error: '', raw: '', parsed: null, info: '' });
  var t = Kid.mod('tutor', { subject: 'Математика', q: '', photo: null, busy: false, error: '', answer: '' });
  var tr = Kid.mod('trainer', { idx: 0, answer: '', shown: false, verdict: '' });

  // Кнопка рукописного ввода появляется, если раздел «Наглядно» подключил Kid.hand
  function hand(act) { return Kid.hand ? '<button class="b o" data-act="' + act + '">✍ Написать от руки</button>' : ''; }
  function vCheck() {
    var p = c.parsed, h = Kid.head('Проверка', 'Найду ошибку и покажу, как исправить');
    h += '<div class="card">' + Kid.chips(SUBJ, c.subject, 'cSubject') + Kid.textarea('check.task', c.task, 'Задание (можно не заполнять)') + Kid.textarea('check.solution', c.solution, 'Моё решение') + hand('cHand') +
      Kid.photoBox(c.photo, 'cPhoto') + '<button class="b" data-act="cGo"' + (c.busy ? ' disabled' : '') + '>Проверить</button></div>';
    if (c.busy) h += Kid.busy('Проверяю…');
    h += Kid.err(c.error);
    if (c.raw && !p) h += '<div class="card"><pre>' + esc(c.raw) + '</pre></div>';
    if (p) {
      h += '<div class="card ' + (p.allCorrect ? 'good' : 'bad') + '"><b>' + (p.allCorrect ? 'Всё верно!' : 'Ошибок: ' + p.errorCount) + '</b>' + (p.summary ? '<p>' + esc(p.summary) + '</p>' : '') + '</div>';
      p.lines.forEach(function (l) {
        var cls = l.status === 'error' ? 'bad' : l.status === 'consequence' ? 'warn' : 'okl', tag = l.status === 'error' ? ['e', 'ОШИБКА'] : l.status === 'consequence' ? ['c', 'СЛЕДСТВИЕ'] : ['o', 'ВЕРНО'];
        h += '<div class="card ' + cls + '"><span class="tag ' + tag[0] + '">' + tag[1] + '</span><pre>' + esc(l.text) + '</pre>' + (l.why ? '<div>Что не так: ' + esc(l.why) + '</div>' : '') + (l.fix ? '<div><b>Как исправить: ' + esc(l.fix) + '</b></div>' : '') + '</div>';
      });
      if (p.correct && !Kid.hintOnly()) h += '<div class="card"><b>Верное решение</b><pre>' + esc(p.correct) + '</pre></div>';
      if (p.errorCount > 0) h += '<button class="b t" data-act="cSave">В тетрадь ошибок</button>';
      if (c.info) h += '<p class="okt">' + esc(c.info) + '</p>';
    }
    return h;
  }
  function vTutor() {
    var h = Kid.head('Помощь', 'Подскажу и объясню, но не решу за тебя'), d = t.busy ? ' disabled' : '';
    h += '<div class="card">' + Kid.chips(SUBJ, t.subject, 'tSubject') + Kid.textarea('tutor.q', t.q, 'Что непонятно?') + hand('tHand') + Kid.photoBox(t.photo, 'tPhoto') +
      '<div class="row"><button class="b" data-act="tGo" data-v="hint"' + d + '>Подсказка</button><button class="b t" data-act="tGo" data-v="forgot"' + d + '>Что вспомнить</button>' +
      (Kid.hintOnly() ? '' : '<button class="b t" data-act="tGo" data-v="explain"' + d + '>Объясни</button>') + '</div></div>';
    if (t.busy) h += Kid.busy('Думаю…');
    h += Kid.err(t.error);
    if (t.answer) h += '<div class="card tint"><pre>' + esc(t.answer) + '</pre></div>';
    return h;
  }
  function vMistakes() {
    var list = Kid.mistakes(), h = Kid.head('Тетрадь ошибок', 'Ошибки из проверки. Выученные ошибки отмечены.');
    if (!list.length) return h + '<div class="card">Пока пусто. Проверь решение, и ошибки появятся здесь.</div>';
    list.forEach(function (m) {
      var learned = (m.streak || 0) >= 3;
      h += '<div class="card ' + (learned ? 'okl' : '') + '"><span class="tag ' + (learned ? 'o' : 'e') + '">' + esc(m.subject) + (learned ? ' · ВЫУЧЕНО' : '') + '</span><pre>' + esc(m.wrong) + '</pre>' +
        (m.why ? '<div>Что не так: ' + esc(m.why) + '</div>' : '') + (m.right ? '<div><b>Как правильно: ' + esc(m.right) + '</b></div>' : '') +
        '<button class="b o" data-act="mDel" data-v="' + esc(m.id) + '">Удалить</button></div>';
    });
    return h;
  }
  function pool() { return Kid.mistakes().filter(function (m) { return (m.streak || 0) < 3; }); }
  function norm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[\s.,;:!?«»"'()]+/g, ' ').trim(); }
  function vTrainer() {
    var list = pool(), h = Kid.head('Тренажёр', 'Повтори ошибки, пока не запомнятся');
    if (!list.length) return h + '<div class="card">Нечего повторять. Все ошибки выучены или тетрадь пуста.</div>';
    if (tr.idx >= list.length) tr.idx = 0;
    var m = list[tr.idx];
    h += '<div class="card"><span class="tag e">' + esc(m.subject) + '</span><label>Ты записал так</label><pre>' + esc(m.wrong) + '</pre><label>Как правильно?</label>' + Kid.input('trainer.answer', tr.answer) +
      '<button class="b" data-act="trCheck">Проверить</button> <button class="b o" data-act="trNext">Дальше</button></div>';
    if (tr.shown) h += '<div class="card ' + (tr.verdict === 'ok' ? 'good' : 'bad') + '"><b>' + (tr.verdict === 'ok' ? 'Верно!' : 'Пока не так') + '</b>' + (m.right ? '<div>Правильно: ' + esc(m.right) + '</div>' : '') + (m.why ? '<div class="mut">' + esc(m.why) + '</div>' : '') + '</div>';
    return h + '<p class="mut">В очереди: ' + list.length + '. Ошибка считается выученной после трёх верных ответов подряд.</p>';
  }
  function vProgress() {
    var ms = Kid.mistakes(), learned = ms.filter(function (m) { return (m.streak || 0) >= 3; }).length, h = Kid.head('Мой прогресс', 'Серия занятий и успехи');
    h += '<div class="stat"><div><b>' + S.streak(state.days || []) + '</b>дней подряд</div><div><b>' + (state.tasks || 0) + '</b>заданий проверено</div><div><b>' + learned + '/' + ms.length + '</b>ошибок выучено</div></div>';
    var dots = '';
    for (var i = 6; i >= 0; i--) { var d = new Date(); d.setDate(d.getDate() - i); var iso = Kid.isoDate(d); dots += '<i class="' + ((state.days || []).indexOf(iso) >= 0 ? 'on' : '') + '" title="' + iso + '"></i>'; }
    return h + '<div class="card" style="margin-top:12px">Последние 7 дней<div class="dots">' + dots + '</div></div>';
  }
  function vSettings() {
    var p = Kid.profile(), pf = ui.pf || {}, s = ui.sync, h = Kid.head('Настройки', 'Профиль, общие данные с телефоном и ключ ИИ');
    h += '<div class="card"><b>Профиль</b>' + Kid.input('pf.name', pf.name != null ? pf.name : (p.name || ''), 'Фамилия и имя') + '<div class="row"><div style="flex:1">' + Kid.input('pf.grade', pf.grade != null ? pf.grade : (p.grade || ''), 'Класс') + '</div><div style="flex:1">' + Kid.input('pf.letter', pf.letter != null ? pf.letter : (p.letter || ''), 'Буква') + '</div></div><button class="b t" data-act="pSave">Сохранить профиль</button>' + (ui.setInfo ? '<p class="okt">' + esc(ui.setInfo) + '</p>' : '') + '</div>';
    h += '<div class="card"><b>Общие данные с телефоном (GitHub)</b><p class="mut">Репозиторий должен быть ЧАСТНЫМ, токен выдан только на него. Те же значения вводятся на телефоне: «Ещё» → «Для родителя».</p>' +
      Kid.input('s.repo', settings.repo, 'Репозиторий, например ivan/kid-sync') + Kid.input('s.token', settings.token, 'Токен GitHub', 'password') +
      '<button class="b" data-act="sSync"' + (s.busy ? ' disabled' : '') + '>Сохранить и синхронизировать</button>' + (s.busy ? Kid.busy('Синхронизирую…') : '') +
      (s.msg ? '<p class="' + (s.ok ? 'okt' : 'err') + '">' + esc(s.msg) + '</p>' : '') + (settings.last ? '<p class="mut">Последняя синхронизация: ' + new Date(settings.last).toLocaleString('ru-RU') + '</p>' : '') + '</div>';
    h += '<div class="card"><b>Ключ ИИ</b><p class="mut">Ключ хранится только в этом браузере и никуда не отправляется, кроме сервера ИИ.</p>' + Kid.input('s.aiKey', settings.aiKey, 'Ключ ZVENO AI', 'password') + Kid.input('s.model', settings.model, 'Модель') + Kid.input('s.aiBase', settings.aiBase, 'Адрес API') + '<button class="b t" data-act="aSave">Сохранить</button></div>';
    var cc = Kid.parentCore();
    h += '<div class="card tint"><b>Правила родителя</b><p>' + (cc ? 'Получены с телефона. Закрытых разделов: ' + cc.blocked.length + '. Режим «Только подсказки»: ' + (cc.hintOnly ? 'включён' : 'выключен') + '.' : 'Пока не получены. Они появятся после первой синхронизации с телефоном.') + '</p><p class="mut">Менять правила может только родитель по PIN: «Ещё» → «Для родителя».</p></div>';
    return h;
  }

  Kid.register({ key: 'check', title: 'Проверка', subtitle: 'Разбор ошибок по фото решения', view: vCheck, acts: {
    cSubject: function (v) { c.subject = v; },
    cPhoto: function (v, el) { return Kid.readPhoto(el.files[0]).then(function (d) { c.photo = d; }, function (e) { c.error = e.message; }); },
    cPhotoClear: function () { c.photo = null; },
    cHand: function () { Kid.hand.open(function (text) { c.solution = (c.solution ? c.solution + '\n' : '') + text; Kid.render(); }); },
    cGo: function () {
      c.info = '';
      if (!c.solution.trim() && !c.photo) { c.error = 'Добавь своё решение: текст или фото.'; return; }
      if (c.busy) return;
      c.busy = true; c.error = ''; c.raw = ''; c.parsed = null; Kid.render();
      var text = 'Задание:\n' + (c.task.trim() || '(не указано)') + '\n\nРешение ученика:\n' + (c.solution.trim() || '(решение на фото)');
      return Kid.askAI(C.check(c.subject, Kid.grade()), text, c.photo, 2200, 0.1).then(function (raw) {
        c.raw = raw; c.parsed = C.parseCheck(raw);
        if (c.parsed) Kid.recordTask();
        Kid.syncSoon();
      }, function (e) { c.error = e.message; }).then(function () { c.busy = false; });
    },
    cSave: function () {
      if (!c.parsed) return;
      c.parsed.lines.filter(function (l) { return l.status === 'error'; }).forEach(function (l) { Kid.addMistake(c.subject, l.text, l.fix, l.why); });
      c.info = 'Добавлено в «Тетрадь ошибок»: ' + c.parsed.errorCount + '.'; Kid.syncSoon();
    },
  } });
  Kid.register({ key: 'tutor', title: 'Помощь', subtitle: 'Подсказка и объяснение', view: vTutor, acts: {
    tSubject: function (v) { t.subject = v; },
    tPhoto: function (v, el) { return Kid.readPhoto(el.files[0]).then(function (d) { t.photo = d; }, function (e) { t.error = e.message; }); },
    tPhotoClear: function () { t.photo = null; },
    tHand: function () { Kid.hand.open(function (text) { t.q = (t.q ? t.q + '\n' : '') + text; Kid.render(); }); },
    tGo: function (mode) {
      if (!t.q.trim() && !t.photo) { t.error = 'Напиши вопрос или добавь фото.'; return; }
      if (t.busy) return;
      if (Kid.hintOnly() && mode === 'explain') mode = 'hint';
      t.busy = true; t.error = ''; t.answer = ''; Kid.render();
      return Kid.askAI(C.help(mode, t.subject, Kid.grade()), t.q.trim() || '(вопрос на фото)', t.photo, 1200, 0.3).then(function (a) { t.answer = a; Kid.touchToday(); Kid.syncSoon(); }, function (e) { t.error = e.message; }).then(function () { t.busy = false; });
    },
  } });
  Kid.register({ key: 'mistakes', title: 'Тетрадь ошибок', subtitle: 'Ошибки из проверки', view: vMistakes, acts: {
    mDel: function (id) { S.remove(state.mistakes, id, Date.now()); Kid.syncSoon(); },
  } });
  Kid.register({ key: 'trainer', title: 'Тренажёр', subtitle: 'Повтор ошибок', view: vTrainer, acts: {
    trCheck: function () {
      var m = pool()[tr.idx]; if (!m) return;
      var ok = !!m.right && norm(tr.answer) === norm(m.right);
      tr.shown = true; tr.verdict = ok ? 'ok' : 'no';
      S.put(state.mistakes, Object.assign({}, m, { streak: ok ? (m.streak || 0) + 1 : 0 }), Date.now()); Kid.touchToday(); Kid.syncSoon();
    },
    trNext: function () { tr.idx++; tr.answer = ''; tr.shown = false; tr.verdict = ''; },
  } });
  Kid.register({ key: 'progress', title: 'Мой прогресс', subtitle: 'Серия занятий и успехи', view: vProgress, acts: {} });
  Kid.register({ key: 'settings', title: 'Настройки', subtitle: 'Профиль, GitHub, ключ ИИ', always: true, view: vSettings, acts: {
    pSave: function () {
      var f = ui.pf || {}, p = Kid.profile();
      S.put(state.profile, { id: 'profile', name: f.name != null ? f.name : (p.name || ''), grade: f.grade != null ? f.grade : (p.grade || ''), letter: f.letter != null ? f.letter : (p.letter || '') }, Date.now());
      ui.pf = null; ui.setInfo = 'Сохранено.'; Kid.syncSoon();
    },
    aSave: function () { Kid.persistSettings(); ui.setInfo = 'Сохранено.'; },
    sSync: function () {
      settings.repo = String(settings.repo).trim(); settings.token = String(settings.token).trim(); Kid.persistSettings();
      if (!Kid.syncConfigured()) { ui.sync.ok = false; ui.sync.msg = 'Адрес должен быть вида имя/репозиторий, и нужен токен.'; return; }
      return Kid.syncNow(false);
    },
  } });
})();
