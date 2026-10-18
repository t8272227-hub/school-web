// «Для родителя»: вход по PIN, разделы, режимы, время, отчёт. Правила подписываются PIN и доезжают до телефона.
(function () {
  'use strict';
  var Kid = window.Kid, P = window.KidParent, esc = Kid.esc, state = Kid.state;
  var m = Kid.mod('parentUi', { pin: '', error: '', info: '', from: '', to: '', limit: '', init: false });
  // Те же ключи и названия, что в Sections.kt на телефоне.
  var ALL = [['hw', 'ДЗ'], ['tutor', 'Помощь'], ['check', 'Проверка работы по фото'], ['visual', 'Наглядно'], ['friend', 'Спроси друга'], ['ar', 'AR-линза'], ['assigned', 'Что задано'], ['reading', 'Чтение'],
    ['history', 'Историческая справка'], ['essay', 'Реферат'], ['memos', 'Заметки'], ['reminders', 'Напоминания'], ['cheats', 'Шпаргалки'], ['mistakes', 'Тетрадь ошибок'], ['trainer', 'Тренажёр'],
    ['exam', 'К контрольной'], ['words', 'Слова и диктант'], ['notes', 'Конспект параграфа'], ['progress', 'Мой прогресс'], ['timer', 'Таймер учёбы']];
  var FOCUS = ['check', 'mistakes', 'trainer', 'progress'];   // режим «Только работа над ошибками»
  function core() { return Kid.parentCore() || Object.assign({}, P.DEFAULT); }
  function sw(label, key, on, act) { return '<label class="swrow"><span>' + esc(label) + '</span><input type="checkbox" data-act="' + act + '" data-v="' + key + '"' + (on ? ' checked' : '') + '></label>'; }

  function view() {
    var h = Kid.head('Для родителя', 'Разделы, режимы и время на компьютере');
    if (!Kid.parentLoggedIn()) {
      h += '<div class="card"><b>Вход</b><p class="mut">' + (Kid.parentHasPin() ? 'Введи PIN родителя, тот же, что на телефоне.' : 'Правила родителя ещё не пришли с телефона. На телефоне задай PIN («Ещё» → «Для родителя»), нажми «Сохранить и синхронизировать», затем обнови эту страницу.') + '</p>' +
        '<label>PIN</label><input id="ppin" type="password" inputmode="numeric" autocomplete="off" data-bind="parentUi.pin" value="' + esc(m.pin) + '"><button class="b" data-act="pLogin"' + (Kid.parentHasPin() ? '' : ' disabled') + '>Войти</button>' + Kid.err(m.error) + '</div>';
      return h;
    }
    var c = core(), blocked = {};
    c.blocked.forEach(function (k) { blocked[k] = 1; });
    if (!m.init) { m.from = P.fmt(c.fromMin); m.to = P.fmt(c.toMin); m.limit = c.limitMin ? String(c.limitMin) : ''; m.init = true; }
    h += '<div class="card tint row" style="justify-content:space-between;align-items:center"><span>Вы вошли как родитель. Через 15 минут без действий вход закроется.</span><button class="b o" data-act="pLogout">Выйти</button></div>';
    h += '<div class="card"><b>Разделы</b><p class="mut">Выключенный раздел исчезает у ребёнка на компьютере. Телефон получит те же правила после синхронизации.</p>' +
      '<div class="row"><button class="b t" data-act="pFocus">Только работа над ошибками</button><button class="b o" data-act="pAll">Включить все разделы</button></div>' +
      ALL.map(function (s) { return sw(s[1], s[0], !blocked[s[0]], 'pSec'); }).join('') + '<p class="mut">«Для родителя», «Как пользоваться» и «Настройки» выключить нельзя.</p></div>';
    h += '<div class="card"><b>Режим</b>' + sw('Только подсказки (без готовых решений)', 'hint', c.hintOnly, 'pFlag') + '</div>';
    h += '<div class="card"><b>Время</b>' + sw('Учебные часы (вне них приложение закрыто)', 'sched', c.scheduleOn, 'pFlag') +
      '<div class="row"><div style="flex:1">' + Kid.input('parentUi.from', m.from, 'С (ЧЧ:ММ)') + '</div><div style="flex:1">' + Kid.input('parentUi.to', m.to, 'До (ЧЧ:ММ)') + '</div><div style="flex:1">' + Kid.input('parentUi.limit', m.limit, 'Лимит в день, минут (пусто = без лимита)') + '</div></div>' +
      '<button class="b t" data-act="pTime">Сохранить время</button><p class="mut">Сегодня на этом компьютере: ' + Math.round(Kid.usedSec() / 60) + ' мин' + (c.limitMin ? ', осталось ' + P.minutesLeft(c, Kid.usedSec()) + ' мин' : '') + '. Когда время выйдет, ребёнок увидит экран отдыха, а родитель сможет разрешить ещё 30 минут по PIN.</p></div>';
    h += report();
    if (m.info) h += '<p class="okt">' + esc(m.info) + '</p>';
    h += Kid.err(m.error);
    return h;
  }
  function report() {
    var rows = '', u = state.usage || {};
    for (var i = 0; i < 7; i++) {
      var d = new Date(); d.setDate(d.getDate() - i); var iso = Kid.isoDate(d), pc = (u.pc || {})[iso] || 0, ph = (u.phone || {})[iso] || 0;
      rows += '<tr><td>' + iso.slice(8) + '.' + iso.slice(5, 7) + '</td><td>' + ph + '</td><td>' + pc + '</td></tr>';
    }
    return '<div class="card"><b>Отчёт за неделю, минут</b><table class="tbl"><tr><th>День</th><th>Телефон</th><th>Компьютер</th></tr>' + rows + '</table><p class="mut">Данные телефона появляются после синхронизации.</p></div>';
  }
  function save(next, info) {
    m.error = ''; m.info = '';
    return Kid.setParentCore(next).then(function () { m.info = info || 'Сохранено. Телефон применит правила при следующей синхронизации.'; }, function (e) { m.error = e.message; });
  }
  function keysFrom(c) { return c.blocked.filter(function (k) { return !ALL.some(function (s) { return s[0] === k; }); }); }  // чужие ключи сохраняем как есть

  Kid.register({ key: 'parent', title: 'Для родителя', subtitle: 'Разделы, режимы, время', always: true, view: view, acts: {
    pLogin: function () { m.error = ''; return Kid.parentLogin(m.pin).then(function () { m.pin = ''; m.init = false; }, function (e) { m.error = e.message; }); },
    pLogout: function () { Kid.parentLogout(); m.init = false; },
    pSec: function (key, el) {
      var c = core(), b = c.blocked.filter(function (k) { return k !== key; });
      if (!el.checked) b.push(key);
      return save(Object.assign({}, c, { blocked: b }));
    },
    pFocus: function () { var c = core(); return save(Object.assign({}, c, { blocked: ALL.map(function (s) { return s[0]; }).filter(function (k) { return FOCUS.indexOf(k) < 0; }).concat(keysFrom(c)) })); },
    pAll: function () { var c = core(); return save(Object.assign({}, c, { blocked: keysFrom(c) })); },
    pFlag: function (key, el) {
      var c = core();
      return save(key === 'hint' ? Object.assign({}, c, { hintOnly: el.checked }) : Object.assign({}, c, { scheduleOn: el.checked }));
    },
    pTime: function () {
      var f = P.parseTime(m.from), t = P.parseTime(m.to), l = m.limit.trim() === '' ? 0 : parseInt(m.limit, 10);
      if (f == null || t == null) { m.error = 'Время нужно писать так: 07:00.'; return; }
      if (!(l >= 0 && l <= 600)) { m.error = 'Лимит: число минут от 0 до 600.'; return; }
      return save(Object.assign({}, core(), { fromMin: f, toMin: t, limitMin: l }));
    },
  } });
})();
