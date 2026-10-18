// Разделы «Заметки», «Напоминания», «Шпаргалки», «Таймер учёбы», «Как пользоваться». Логика без DOM лежит в memo-lib.js.
(function () {
  'use strict';
  var Kid = window.Kid, S = window.KidSync, C = window.KidCheck, L = window.Kid_memo, esc = Kid.esc, state = Kid.state;
  var NC = L.NoteCommand, RP = L.ReminderParser, RM = L.Reminders, TM = L.Timer, AG = L.AppGuide;

  // ---------- стили этого модуля ----------
  (function () {
    var st = document.createElement('style');
    st.textContent = '.mono{font-family:ui-monospace,Consolas,"Courier New",monospace;font-size:15px}' +
      '.tmclock{font-size:56px;font-weight:700;color:var(--v);text-align:center;line-height:1.2;font-variant-numeric:tabular-nums}' +
      '#memoBanner{position:fixed;left:0;right:0;bottom:0;z-index:60;display:flex;flex-direction:column;gap:6px;padding:10px 12px;max-width:640px;margin:0 auto}' +
      '#memoBanner .mb-item{background:#fff0d6;border:1px solid var(--warn);border-radius:16px;padding:12px 14px;box-shadow:0 4px 18px rgba(0,0,0,.18)}' +
      '#memoBanner b{display:block;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:var(--warn)}' +
      '#memoBanner span{display:block;font-size:18px;margin-top:2px}#memoBanner button{margin-top:6px}' +
      '.noteMeta{font-size:12px;color:var(--mut)}.stepsOl{margin:8px 0 0;padding-left:22px}.stepsOl li{margin:4px 0}';
    document.head.appendChild(st);
  })();

  // ---------- общее: баннер, звук, уведомления ----------
  function banner(title, text) {
    var box = document.getElementById('memoBanner');
    if (!box) { box = document.createElement('div'); box.id = 'memoBanner'; document.body.appendChild(box); }
    var it = document.createElement('div'); it.className = 'mb-item'; it.setAttribute('role', 'alert');
    var b = document.createElement('b'); b.textContent = title;
    var s = document.createElement('span'); s.textContent = text;
    var x = document.createElement('button'); x.className = 'b'; x.textContent = 'Закрыть';
    x.onclick = function () { it.remove(); if (!box.children.length) box.remove(); };
    it.appendChild(b); it.appendChild(s); it.appendChild(x); box.appendChild(it);
  }
  function beep() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      var c = new AC();
      [0, 0.35, 0.7].forEach(function (t) {
        var o = c.createOscillator(), g = c.createGain();
        o.frequency.value = 880; g.gain.value = 0.2; o.connect(g); g.connect(c.destination);
        o.start(c.currentTime + t); o.stop(c.currentTime + t + 0.2);
      });
      setTimeout(function () { try { c.close(); } catch (e) { /* уже закрыт */ } }, 1500);
    } catch (e) { /* звук недоступен */ }
  }
  function notifState() { return typeof window.Notification === 'undefined' ? 'unsupported' : window.Notification.permission; }
  function notify(title, body) {
    try { if (notifState() === 'granted') new window.Notification(title, { body: body, tag: 'kid-' + title + body }); } catch (e) { /* браузер не даёт показать */ }
  }
  function typing() { var a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); }
  function rerenderIf(view) { if (Kid.ui.view === view && !typing()) Kid.render(); }
  function dateLabel(ms) { return new Date(ms).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  function docHeader() {
    var p = Kid.profile(), parts = [];
    if (p.name && String(p.name).trim()) parts.push(String(p.name).trim());
    if (p.grade) parts.push(p.grade + (p.letter ? ' «' + p.letter + '»' : '') + ' класс');
    return parts.length ? '<p><b>' + esc(parts.join(', ')) + '</b></p>' : '';
  }
  // Кнопки выгрузки «Word» и «PDF» для заметок и шпаргалок
  function exportBar(kind, M) {
    return '<div class="row"><button class="b t" data-act="exWord" data-v="' + kind + '">Word</button><button class="b t" data-act="exPdf" data-v="' + kind + '">PDF</button></div>' +
      (M.exportMsg ? '<p class="' + (M.exportBad ? 'err' : 'okt') + '">' + esc(M.exportMsg) + '</p>' : '');
  }

  // ====================================================================== Заметки
  var mm = Kid.mod('memos', { filter: 'Все', text: '', editing: null, editText: '', error: '', listening: false, speaking: false, exportMsg: '', exportBad: false });
  function liveNotes() { return L.sortNotes(S.live(state.notes)); }
  function addNote(text, byVoice) {
    text = String(text).trim(); if (!text) return false;
    var now = Date.now(), id = String(now);
    while (state.notes[id]) id = String(Number(id) + 1);
    S.put(state.notes, { id: id, text: text, createdAt: now, byVoice: !!byVoice }, Date.now());
    liveNotes().slice(500).forEach(function (n) { S.remove(state.notes, n.id, Date.now()); });   // как на телефоне: не больше 500
    Kid.touchToday(); Kid.syncSoon();
    return true;
  }
  function speakNotes() {
    mm.speaking = true;
    var ok = Kid.speak(L.NoteFormat.readAloud(liveNotes()), function () { mm.speaking = false; if (Kid.ui.view === 'memos') Kid.render(); });
    if (!ok) { mm.speaking = false; mm.error = 'Этот браузер не умеет читать вслух.'; }
  }
  // Сказанное голосом: команды «запомни ...» и «покажи заметки» работают как у друга на телефоне; обычная фраза становится заметкой целиком.
  function handleSpoken(text) {
    var c = NC.parse(text);
    if (!c) { addNote(text, true); return; }
    if (c.type === 'save') {
      if (!c.text) mm.error = 'Что запомнить? Скажи «запомни» и сам текст.'; else addNote(c.text, true);
    } else speakNotes();
  }
  function vMemos() {
    var all = liveNotes(), shown = mm.filter === 'Голосом' ? all.filter(function (n) { return n.byVoice; }) : mm.filter === 'Написано' ? all.filter(function (n) { return !n.byVoice; }) : all;
    var h = Kid.head('Заметки', 'Всё, что ты просил запомнить') + Kid.chips(['Все', 'Голосом', 'Написано'], mm.filter, 'mmFilter');
    h += '<div class="card">' + Kid.textarea('memos.text', mm.text, 'Новая заметка') + '<div class="row">' +
      (Kid.canListen() ? '<button class="b t" data-act="mmListen"' + (mm.listening ? ' disabled' : '') + '>' + (mm.listening ? 'Слушаю…' : 'Надиктовать') + '</button>' : '') +
      '<button class="b" data-act="mmAdd">Добавить</button></div>' +
      (Kid.canListen() ? '<p class="mut">Можно сказать «Запомни, завтра взять форму» или «Покажи заметки».</p>' : '<p class="mut">Голосовой ввод работает в Chrome и Edge.</p>') + '</div>';
    h += Kid.err(mm.error);
    if (all.length) h += mm.speaking ? '<button class="b o" data-act="mmStop">Остановить чтение</button>' : '<button class="b o" data-act="mmRead">Прочитать вслух</button>';
    if (!shown.length) h += '<p class="mut">Здесь пока пусто. Напиши заметку выше' + (Kid.canListen() ? ' или надиктуй её' : '') + '.</p>';
    shown.forEach(function (n) {
      h += '<div class="card"><div class="noteMeta">' + esc(dateLabel(n.createdAt || 0)) + ' · ' + (n.byVoice ? 'голосом' : 'написано') + '</div>';
      if (mm.editing === n.id) {
        h += Kid.textarea('memos.editText', mm.editText, 'Текст заметки') + '<div class="row"><button class="b" data-act="mmSave" data-v="' + esc(n.id) + '">Сохранить</button><button class="b o" data-act="mmCancel">Отмена</button></div>';
      } else {
        h += '<pre style="font-size:17px">' + esc(n.text) + '</pre><div class="row"><button class="b t" data-act="mmEdit" data-v="' + esc(n.id) + '">Изменить</button><button class="b o" data-act="mmDel" data-v="' + esc(n.id) + '">Удалить</button></div>';
      }
      h += '</div>';
    });
    if (all.length) h += exportBar('memos', mm);
    return h;
  }
  Kid.register({ key: 'memos', title: 'Заметки', subtitle: 'Всё, что ты просил запомнить', view: vMemos, acts: {
    mmFilter: function (v) { mm.filter = v; },
    mmAdd: function () {
      mm.error = '';
      if (!mm.text.trim()) { mm.error = 'Напиши текст заметки.'; return; }
      addNote(mm.text, false); mm.text = '';
    },
    mmListen: function () {
      mm.error = ''; mm.listening = true;
      var r = Kid.listen(function (said) { if (said) handleSpoken(said); Kid.render(); }, function (err) { mm.listening = false; if (err) mm.error = err; Kid.render(); });
      if (!r) mm.listening = false;
    },
    mmRead: function () { mm.error = ''; speakNotes(); },
    mmStop: function () { Kid.stopSpeak(); mm.speaking = false; },
    mmEdit: function (id) { var n = state.notes[id]; if (n && !n.deleted) { mm.editing = id; mm.editText = n.text; mm.error = ''; } },
    mmCancel: function () { mm.editing = null; mm.error = ''; },
    mmSave: function (id) {
      var n = state.notes[id], t = mm.editText.trim();
      if (!n || n.deleted) { mm.editing = null; return; }
      if (!t) { mm.error = 'Текст заметки не может быть пустым. Чтобы убрать заметку, нажми «Удалить».'; return; }
      S.put(state.notes, Object.assign({}, n, { text: t }), Date.now()); mm.editing = null; mm.error = ''; Kid.syncSoon();
    },
    mmDel: function (id) { S.remove(state.notes, id, Date.now()); if (mm.editing === id) mm.editing = null; Kid.syncSoon(); },
  } });

  // ====================================================================== Напоминания
  var rm = Kid.mod('reminders', { tab: 'Скоро', text: '', phrase: '', pickedAt: null, dt: '', error: '', info: '', infoBad: false, listening: false });
  function remList() { return RM.normalize(Kid.store('reminders', [])); }
  function remSave(items) { Kid.saveStore('reminders', items.slice(-300)); }
  function remAdd(text, at, byVoice) {
    var item = { id: String(Date.now()) + Math.floor(Math.random() * 100), text: String(text).trim(), at: at, byVoice: !!byVoice, done: false };
    remSave(remList().concat([item]));
    Kid.touchToday(); Kid.syncSoon();
    return item;
  }
  function toLocalInput(ms) {
    var d = new Date(ms), p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function pick(ms) { rm.pickedAt = ms; rm.dt = ms ? toLocalInput(ms) : ''; rm.error = ''; }

  // Срабатывание: пока страница открыта, проверяем метки времени раз в секунду (не копим погрешность таймера).
  function checkDue() {
    var now = Date.now(), items = remList(), d = RM.due(items, now);
    if (!d.length) return;
    var ids = {}; d.forEach(function (r) { ids[r.id] = 1; });
    remSave(items.map(function (r) { return ids[r.id] ? Object.assign({}, r, { done: true }) : r; }));
    d.forEach(function (r) { banner('Напоминание', r.text); notify('Напоминание', r.text); });
    beep();
    rerenderIf('reminders');
  }
  setInterval(checkDue, 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { checkDue(); tickTimer(); } });
  setTimeout(checkDue, 300);

  function notifPanel() {
    var s = notifState(), h = '';
    if (s === 'default') h += '<div class="card warn"><p>Чтобы напоминания приходили уведомлением, разреши их в браузере.</p><button class="b" data-act="remNotif">Разрешить уведомления</button></div>';
    else if (s === 'denied') h += '<div class="card warn"><p>Уведомления запрещены. Напоминание всё равно появится плашкой на странице. Чтобы получать уведомления, разреши их для этого сайта в настройках браузера.</p></div>';
    else if (s === 'unsupported') h += '<div class="card warn"><p>Этот браузер не показывает уведомления. Напоминание появится плашкой на странице.</p></div>';
    return h;
  }
  function vReminders() {
    var now = Date.now(), all = remList(), items = rm.tab === 'Скоро' ? RM.upcoming(all, now) : RM.past(all, now);
    var h = Kid.head('Напоминания', 'Напомню вовремя') + Kid.chips(['Скоро', 'Прошедшие'], rm.tab, 'remTab');
    h += '<div class="card tint"><b>Важно на компьютере</b><p>Напоминание сработает, только пока эта вкладка браузера открыта. На телефоне напоминания приходят и при закрытом приложении, здесь так не получится: закрыл вкладку, и напоминание не прозвучит.</p></div>';
    h += notifPanel();
    h += '<div class="card"><b>Новое напоминание</b>' + Kid.input('reminders.text', rm.text, 'О чём напомнить') +
      '<p><b>Когда:</b> <span id="remWhen">' + (rm.pickedAt ? esc(RP.describe(rm.pickedAt, now)) : 'не выбрано') + '</span></p>' +
      '<div class="row"><button class="b t" data-act="remQuick" data-v="10m">+10 мин</button><button class="b t" data-act="remQuick" data-v="1h">+1 час</button><button class="b t" data-act="remQuick" data-v="t8">Завтра 8:00</button></div>' +
      '<label>Или выбери дату и время</label><input type="datetime-local" id="remDt" data-bind="reminders.dt" data-memo-dt="1" value="' + esc(rm.dt) + '">' +
      Kid.err(rm.error) + '<button class="b" data-act="remAdd">Добавить</button></div>';
    h += '<div class="card"><b>Или скажи фразой</b><label>Начни со слова «напомни»</label><input data-bind="reminders.phrase" placeholder="Напомни завтра в 8 утра взять форму" value="' + esc(rm.phrase) + '">' +
      '<div class="row">' + (Kid.canListen() ? '<button class="b t" data-act="remVoice"' + (rm.listening ? ' disabled' : '') + '>' + (rm.listening ? 'Слушаю…' : 'Надиктовать') + '</button>' : '') +
      '<button class="b" data-act="remPhrase">Поставить</button></div>' +
      (rm.info ? '<p class="' + (rm.infoBad ? 'err' : 'okt') + '">' + esc(rm.info) + '</p>' : '') + '</div>';
    if (!items.length) h += '<p class="mut">' + (rm.tab === 'Скоро' ? 'Напоминаний нет.' : 'Прошедших напоминаний нет.') + '</p>';
    items.forEach(function (r) {
      h += '<div class="card"><div class="row" style="justify-content:space-between"><b>' + esc(RP.describe(r.at, now)) + '</b><span class="noteMeta">' + (r.byVoice ? 'голосом' : 'написано') + '</span></div>' +
        '<pre style="font-size:18px">' + esc(r.text) + '</pre><button class="b o" data-act="remDel" data-v="' + esc(r.id) + '">Удалить</button></div>';
    });
    h += '<div class="card"><p>Как попросить фразой: «Напомни через 10 минут покормить кота» или «Напомни завтра в 8 утра взять форму».</p></div>';
    return h;
  }
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el && el.getAttribute && el.getAttribute('data-memo-dt')) {
      var ms = el.value ? new Date(el.value).getTime() : NaN;
      rm.pickedAt = isFinite(ms) ? ms : null;
      var w = document.getElementById('remWhen'); if (w) w.textContent = rm.pickedAt ? RP.describe(rm.pickedAt, Date.now()) : 'не выбрано';
    }
  });
  function phraseGo(byVoice) {
    var cmd = RP.parse(rm.phrase, Date.now()), now = Date.now();
    rm.info = ''; rm.infoBad = false;
    if (!cmd) { rm.info = 'Это не похоже на напоминание. Начни со слова «напомни», например: «Напомни завтра в 8 утра взять форму».'; rm.infoBad = true; return; }
    if (cmd.type === 'list') {
      rm.info = RM.readAloud(remList(), now); Kid.speak(rm.info); rm.phrase = ''; return;
    }
    if (cmd.type === 'needTime') {
      rm.info = 'Когда напомнить? Скажи, например: «напомни завтра в 8 утра ' + (cmd.text || 'взять форму').toLowerCase().replace(/[.!]+$/, '') + '».'; rm.infoBad = true; return;
    }
    if (cmd.at <= now) { rm.info = 'Это время уже прошло.'; rm.infoBad = true; return; }
    remAdd(cmd.text, cmd.at, byVoice);
    rm.info = 'Хорошо, напомню ' + RP.describe(cmd.at, now) + ': ' + cmd.text.replace(/[.!]+$/, '') + '.'; rm.phrase = ''; rm.tab = 'Скоро';
  }
  Kid.register({ key: 'reminders', title: 'Напоминания', subtitle: 'Напомню вовремя, пока открыта вкладка', view: vReminders, acts: {
    remTab: function (v) { rm.tab = v; },
    remQuick: function (v) {
      if (v === '10m') pick(Date.now() + 10 * 60000);
      else if (v === '1h') pick(Date.now() + 3600000);
      else { var d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); pick(d.getTime()); }
    },
    remAdd: function () {
      var ms = rm.dt ? new Date(rm.dt).getTime() : NaN; if (isFinite(ms)) rm.pickedAt = ms;
      if (!rm.text.trim()) rm.error = 'Напиши, о чём напомнить.';
      else if (!rm.pickedAt) rm.error = 'Выбери, когда напомнить.';
      else if (rm.pickedAt <= Date.now()) rm.error = 'Это время уже прошло.';
      else { remAdd(rm.text, rm.pickedAt, false); rm.text = ''; rm.pickedAt = null; rm.dt = ''; rm.error = ''; rm.tab = 'Скоро'; }
    },
    remPhrase: function () { phraseGo(false); },
    remVoice: function () {
      rm.listening = true; rm.info = '';
      var r = Kid.listen(function (said) { rm.phrase = said; phraseGo(true); Kid.render(); }, function (err) { rm.listening = false; if (err) { rm.info = err; rm.infoBad = true; } Kid.render(); });
      if (!r) rm.listening = false;
    },
    remDel: function (id) { remSave(remList().filter(function (r) { return r.id !== id; })); },
    remNotif: function () {
      if (notifState() !== 'default') return;
      try { return Promise.resolve(window.Notification.requestPermission()).catch(function () { /* отказ */ }); } catch (e) { /* не поддерживается */ }
    },
  } });

  // ====================================================================== Шпаргалки
  var DATA = (window.KidData && window.KidData.cheats) || { subjects: [], sheets: [] };
  var ch = Kid.mod('cheats', { subject: 'Все', q: '', picked: [], topic: '', custom: '', busy: false, error: '', exportMsg: '', exportBad: false });
  function cheatShown() { return L.Cheatsheets.search(DATA.sheets, ch.q, ch.subject); }
  function cheatForSheet() { var s = cheatShown(); return ch.picked.length ? s.filter(function (x) { return ch.picked.indexOf(x.id) >= 0; }) : s; }
  function cheatList() {
    var shown = cheatShown(), h = '';
    if (!shown.length) h += '<p class="mut">Ничего не найдено.</p>';
    shown.forEach(function (s) {
      var on = ch.picked.indexOf(s.id) >= 0;
      h += '<div class="card' + (on ? ' tint' : '') + '"><b>' + esc(s.title) + ' · ' + esc(s.subject) + '</b><pre class="mono">' + esc(s.text) + '</pre>' +
        '<button class="b t" data-act="chPick" data-v="' + esc(s.id) + '">' + (on ? 'Убрать из листа' : 'В лист А4') + '</button></div>';
    });
    if (cheatForSheet().length || ch.custom.trim()) {
      h += '<p class="mut">' + (ch.picked.length ? 'В лист попадёт выбранное: ' + ch.picked.length + '.' : 'В лист попадёт всё, что показано выше.') + '</p>' + exportBar('cheats', ch);
    }
    return h;
  }
  function vCheats() {
    var h = Kid.head('Шпаргалки', 'Формулы и правила') + Kid.chips(['Все'].concat(DATA.subjects), ch.subject, 'chSubject');
    h += '<label>Поиск</label><input data-bind="cheats.q" data-live="cheat" value="' + esc(ch.q) + '" autocomplete="off">';
    h += '<div id="cheatList" style="margin-top:12px">' + cheatList() + '</div>';
    h += '<div class="card"><b>Своя шпаргалка по теме</b>' + Kid.input('cheats.topic', ch.topic, 'Тема') +
      '<button class="b" data-act="chAi"' + (ch.busy ? ' disabled' : '') + '>Составить</button>' + (ch.busy ? Kid.busy('Составляю…') : '') + Kid.err(ch.error) +
      (ch.custom.trim() ? '<pre class="mono">' + esc(ch.custom) + '</pre>' : '') + '</div>';
    return h;
  }
  document.addEventListener('input', function (e) {
    var l = e.target && e.target.getAttribute && e.target.getAttribute('data-live');
    if (l === 'cheat') { var box = document.getElementById('cheatList'); if (box) box.innerHTML = cheatList(); }
    else if (l === 'guide') { var g = document.getElementById('guideList'); if (g) g.innerHTML = guideList(); }
  });
  function cheatDocHtml() {
    var h = docHeader();
    cheatForSheet().forEach(function (s) { h += '<h2>' + esc(s.title) + ' (' + esc(s.subject) + ')</h2><pre>' + esc(s.text) + '</pre>'; });
    if (ch.custom.trim()) h += '<h2>Своя шпаргалка: ' + esc(ch.topic) + '</h2><pre>' + esc(ch.custom) + '</pre>';
    return h;
  }
  Kid.register({ key: 'cheats', title: 'Шпаргалки', subtitle: 'Формулы и правила', view: vCheats, acts: {
    chSubject: function (v) { ch.subject = v; },
    chPick: function (id) { var i = ch.picked.indexOf(id); if (i >= 0) ch.picked.splice(i, 1); else ch.picked.push(id); },
    chAi: function () {
      if (!ch.topic.trim()) { ch.error = 'Напиши тему.'; return; }
      if (ch.busy) return;
      ch.busy = true; ch.error = ''; Kid.render();
      var subject = ch.subject === 'Все' ? 'Математика' : ch.subject;
      var system = C.base(Kid.grade()) + ' Составь шпаргалку по теме для предмета «' + subject + '»: только самое важное, 5–8 коротких строк, формулы и правила без воды.';
      return Kid.askAI(system, 'Тема: ' + ch.topic, null, 700).then(function (a) { ch.custom = a; }, function (e) { ch.error = e.message; }).then(function () { ch.busy = false; });
    },
  } });

  // ---------- выгрузка в Word и PDF (заметки и шпаргалки) ----------
  function memosDocHtml() {
    return docHeader() + liveNotes().map(function (n) { return '<p>' + esc(dateLabel(n.createdAt || 0)) + ': ' + esc(n.text).replace(/\n/g, '<br>') + '</p>'; }).join('');
  }
  function exportDoc(kind, how) {
    var M = kind === 'memos' ? mm : ch, title = kind === 'memos' ? 'Заметки' : 'Шпаргалка', html = kind === 'memos' ? memosDocHtml() : cheatDocHtml();
    M.exportBad = false;
    if (how === 'word') { Kid.saveWord(title, html); M.exportMsg = 'Файл «' + title + '.doc» скачан. Он откроется в Word.'; }
    else if (Kid.printHtml(title, html)) M.exportMsg = 'Открылось окно печати. Выбери «Сохранить как PDF» или принтер.';
    else { M.exportMsg = 'Браузер заблокировал окно печати. Разреши всплывающие окна для этого сайта и повтори.'; M.exportBad = true; }
  }
  Kid.acts.exWord = function (v) { exportDoc(v, 'word'); };
  Kid.acts.exPdf = function (v) { exportDoc(v, 'pdf'); };

  // ====================================================================== Таймер учёбы
  var tu = Kid.mod('timer', { done: '', canRest: false });
  var TS = (function () {
    var s = Kid.store('timerState', null);
    if (s && typeof s === 'object' && isFinite(s.minutes) && isFinite(s.remainingMs)) return Object.assign(TM.reset({ minutes: 25 }, 25), s);
    return TM.reset({ mode: 'study', minutes: 25 }, 25);
  })();
  var wake = null;
  function saveTimer() { Kid.saveStore('timerState', TS); }
  function keepAwake(on) {
    try {
      if (on && navigator.wakeLock && !wake) navigator.wakeLock.request('screen').then(function (w) { wake = w; w.addEventListener('release', function () { wake = null; }); }, function () { /* не дали */ });
      else if (!on && wake) { wake.release(); wake = null; }
    } catch (e) { /* нет поддержки */ }
  }
  function finishTimer() {
    var study = TS.mode === 'study', mins = TS.minutes;
    TS = Object.assign({}, TS, { running: false, endAt: 0, remainingMs: 0 }); saveTimer(); keepAwake(false);
    if (study) {
      // как Store.addMinutes: минуты за сегодня плюс отметка дня занятий
      Kid.saveStore('minutes', TM.addMinutes(Kid.store('minutes', {}), Kid.today(), mins));
      Kid.touchToday(); Kid.syncSoon();
      tu.done = 'Молодец! Засчитано ' + mins + ' мин. Сделай перерыв 5 минут: встань, попей воды, посмотри вдаль.'; tu.canRest = true;
      banner('Таймер учёбы', 'Время вышло. Засчитано ' + mins + ' мин. Пора отдохнуть.'); notify('Таймер учёбы', 'Время вышло. Засчитано ' + mins + ' мин. Пора отдохнуть.');
    } else {
      tu.done = 'Перерыв закончился. Можно снова заниматься.'; tu.canRest = false;
      banner('Таймер учёбы', 'Перерыв закончился.'); notify('Таймер учёбы', 'Перерыв закончился.');
    }
    beep();
    rerenderIf('timer');
  }
  function tickTimer() {
    if (!TS.running) return;
    var now = Date.now();
    if (TM.finished(TS, now)) { finishTimer(); return; }
    var el = document.getElementById('tmClock'); if (el) el.textContent = TM.clock(TM.remaining(TS, now));
  }
  setInterval(tickTimer, 250);
  setTimeout(function () { if (TS.running) { tickTimer(); keepAwake(true); } }, 400);

  function vTimer() {
    var now = Date.now(), rest = TS.mode === 'rest', today = Kid.store('minutes', {})[Kid.today()] || 0;
    var h = Kid.head('Таймер учёбы', 'Занимайся и отдыхай по часам') + Kid.chips(['15 мин', '25 мин', '40 мин'], rest ? '' : TS.minutes + ' мин', 'tmSet');
    h += '<div class="card"><div class="noteMeta" style="text-align:center">' + (rest ? 'Перерыв' : 'Занятие') + '</div><div id="tmClock" class="tmclock">' + TM.clock(TM.remaining(TS, now)) + '</div></div>';
    h += '<div class="row"><button class="b" data-act="tmToggle">' + (TS.running ? 'Пауза' : 'Старт') + '</button><button class="b o" data-act="tmReset">Сначала</button>' +
      (!TS.running ? '<button class="b t" data-act="tmRest">Перерыв 5 мин</button>' : '') + '</div>';
    if (tu.done) h += '<div class="card good">' + esc(tu.done) + '</div>';
    if (notifState() === 'default') h += '<div class="card warn"><p>Чтобы услышать конец таймера, когда открыта другая вкладка, разреши уведомления.</p><button class="b" data-act="remNotif">Разрешить уведомления</button></div>';
    h += '<p class="mut">Сегодня засчитано: ' + today + ' мин. Минуты засчитываются, когда таймер дойдёт до нуля.</p>';
    h += '<p class="mut">Таймер идёт по часам, даже если открыть другой раздел. Вкладку браузера закрывать нельзя: на телефоне тоже нельзя выходить из раздела, а на компьютере нужна открытая вкладка.</p>';
    return h;
  }
  Kid.register({ key: 'timer', title: 'Таймер учёбы', subtitle: 'Занимайся и отдыхай по часам', view: vTimer, acts: {
    tmSet: function (v) {
      if (TS.running) return;
      TS = TM.reset(TS, parseInt(v, 10), 'study'); tu.done = ''; tu.canRest = false; saveTimer();
    },
    tmToggle: function () {
      var now = Date.now();
      if (TM.remaining(TS, now) <= 0) return;
      TS = TS.running ? TM.pause(TS, now) : TM.start(TS, now); tu.done = ''; saveTimer(); keepAwake(TS.running);
    },
    tmReset: function () { TS = TM.reset(TS, TS.minutes, TS.mode); tu.done = ''; tu.canRest = false; saveTimer(); keepAwake(false); },
    tmRest: function () { TS = TM.start(TM.reset(TS, 5, 'rest'), Date.now()); tu.done = ''; tu.canRest = false; saveTimer(); keepAwake(true); },
  } });

  // ====================================================================== Как пользоваться
  var GUIDE = (window.KidData && window.KidData.guide) || [];
  var gd = Kid.mod('guide', { q: '', open: 'hw', question: '', answer: '', busy: false, error: '' });
  function hasSection(key) { return !!Kid.section(key) && !Kid.blocked(key); }
  function guideList() {
    var topics = AG.search(GUIDE, gd.q), h = '';
    if (!topics.length) h += '<p class="mut">Ничего не нашлось. Спроси помощника ниже.</p>';
    topics.forEach(function (t) {
      var isOpen = gd.open === t.id, phone = !!AG.PHONE_ONLY[t.id];
      h += '<div class="card"><div class="row" style="justify-content:space-between;align-items:center;flex-wrap:nowrap"><div style="flex:1;min-width:0"><b>' + esc(t.title) + '</b>' +
        (phone ? ' <span class="tag c">работает только на телефоне</span>' : '') + '<div class="mut">' + esc(t.summary) + '</div></div>' +
        '<button class="b t" style="width:auto;flex:none" data-act="gdOpen" data-v="' + esc(t.id) + '">' + (isOpen ? 'Свернуть' : 'Шаги') + '</button></div>';
      if (isOpen) {
        if (phone) h += '<p class="mut"><b>Работает только на телефоне.</b> На компьютере этого нет, шаги ниже для телефона.</p>';
        h += '<ol class="stepsOl">' + (t.steps || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
        var r = AG.webRoute(t, hasSection);
        if (r) h += '<button class="b" data-act="gdGo" data-v="' + esc(r) + '">Открыть раздел «' + esc(Kid.section(r).title) + '»</button>';
      }
      h += '</div>';
    });
    return h;
  }
  function vGuide() {
    var tipsHidden = Kid.store('guideTipsHidden', false), h = Kid.head('Как пользоваться', 'Помощник по приложению');
    if (!tipsHidden) {
      h += '<div class="card tint"><b>Быстрый старт</b><p>1. Во вкладке «ДЗ» сфотографируй или напиши задание.</p><p>2. «Помощь» подскажет, если непонятно.</p><p>3. «Проверка» найдёт ошибку в решении.</p><p>4. «Наглядно» нарисует график, чертёж и столбик.</p><p>5. В «Ещё» есть заметки, напоминания и шпаргалки.</p><button class="b t" data-act="gdTips" data-v="hide">Скрыть</button></div>';
    } else h += '<button class="b o" data-act="gdTips" data-v="show">Показать подсказки заново</button>';
    h += '<label>Что хочешь узнать?</label><input data-bind="guide.q" data-live="guide" placeholder="Например: как поставить напоминание" value="' + esc(gd.q) + '" autocomplete="off">';
    h += '<div id="guideList" style="margin-top:12px">' + guideList() + '</div>';
    h += '<div class="card"><b>Не нашёл ответ?</b>' + Kid.textarea('guide.question', gd.question, 'Спроси помощника своими словами') +
      '<button class="b" data-act="gdAsk"' + (gd.busy ? ' disabled' : '') + '>Спросить</button>' + (gd.busy ? Kid.busy('Думаю…') : '') + Kid.err(gd.error) +
      (gd.answer.trim() ? '<pre>' + esc(gd.answer) + '</pre>' : '') + '</div>';
    return h;
  }
  Kid.register({ key: 'guide', title: 'Как пользоваться', subtitle: 'Помощник по приложению', always: true, view: vGuide, acts: {
    gdOpen: function (id) { gd.open = gd.open === id ? null : id; },
    gdGo: function (key) { if (hasSection(key)) { Kid.go(key); window.scrollTo(0, 0); } },
    gdTips: function (v) { Kid.saveStore('guideTipsHidden', v === 'hide'); },
    gdAsk: function () {
      if (!gd.question.trim()) { gd.error = 'Напиши вопрос.'; return; }
      if (gd.busy) return;
      gd.busy = true; gd.error = ''; Kid.render();
      return Kid.askAI(AG.helpPrompt((window.KidData && window.KidData.guideAi) || ''), gd.question, null, 500, 0.2).then(function (a) { gd.answer = a; }, function (e) { gd.error = e.message; }).then(function () { gd.busy = false; });
    },
  } });
})();
