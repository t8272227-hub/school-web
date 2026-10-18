// Экран входа по логину и паролю. Сессия живёт, пока открыта вкладка (sessionStorage).
// Это защита от случайного доступа: сайт статический, поэтому злонамеренный человек с инструментами браузера её обойдёт.
(function () {
  'use strict';
  var Kid = window.Kid, A = window.KidAuth, P = window.KidParent, esc = Kid.esc, state = Kid.state;
  var g = { mode: 'login', msg: '', sig: '' };
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { /* нет хранилища */ } return null; }
  function accounts() { return A.live(state.accounts); }
  function session() { var l = ss('kid.session'); if (!l) return null; var r = A.find(state.accounts, l); return r ? r : null; }
  function hasAny() { return accounts().length > 0; }
  var api = Kid.gate = {};
  api.active = function () { return hasAny() && !!session(); };
  api.who = function () { var r = session(); return r ? r.login : ''; };
  api.isChild = function () { var r = session(); return !!(r && r.role === 'child'); };
  api.logout = function () { ss('kid.session', null); Kid.render(); };
  // Попытки: после 5 ошибок подряд пауза 30 секунд
  function lockedFor() { var u = parseInt(ss('kid.failUntil') || '0', 10); return Math.max(0, Math.ceil((u - Date.now()) / 1000)); }
  function fail() { var n = parseInt(ss('kid.fails') || '0', 10) + 1; ss('kid.fails', String(n)); if (n >= 5) { ss('kid.fails', '0'); ss('kid.failUntil', String(Date.now() + 30000)); } }
  function enter(rec) { ss('kid.fails', '0'); ss('kid.session', rec.login); g.msg = ''; g.mode = 'login'; Kid.render(); }
  function setMsg(t) { g.msg = t; g.sig = ''; Kid.render(); }

  function field(id, label, type, val) { if (!val && type !== 'password' && g.keep && g.keep[id]) val = g.keep[id]; return '<label>' + esc(label) + '</label><input id="' + id + '" type="' + (type || 'text') + '" autocomplete="off" value="' + esc(val || '') + '">'; }
  function html() {
    var m = g.mode, h = '<div class="lockbox">';
    if (m === 'setup') {
      h += '<h2>Первый вход</h2><p class="mut">Придумайте логин и пароль родителя. Потом в разделе «Для родителя» можно добавить вход для ребёнка.</p>' + field('gl', 'Логин родителя', 'text') + field('gp', 'Пароль (не короче 6 символов)', 'password') + field('gp2', 'Пароль ещё раз', 'password') +
        '<button class="b" id="gok">Создать и войти</button><p><a href="#" id="glink1">Уже есть семья на телефоне или другом компьютере: подключиться</a></p>';
    } else if (m === 'connect') {
      h += '<h2>Подключить к семье</h2><p class="mut">Нужны репозиторий и токен GitHub из настроек синхронизации на телефоне. После подключения логины подтянутся сами.</p>' + field('gr', 'Репозиторий, например ivan/kid-sync', 'text', Kid.settings.repo) + field('gt', 'Токен GitHub', 'password') +
        '<button class="b" id="gok">Подключить</button><p><a href="#" id="glink2">Назад</a></p>';
    } else if (m === 'reset') {
      h += '<h2>Забыли пароль</h2><p class="mut">Нужен PIN родителя (тот же, что на телефоне). Можно задать новый пароль для любого логина.</p>' + field('gl', 'Логин', 'text') + field('gpin', 'PIN родителя', 'password') + field('gp', 'Новый пароль', 'password') +
        '<button class="b" id="gok">Сменить пароль и войти</button><p><a href="#" id="glink2">Назад</a></p>';
    } else {
      h += '<h2>Вход</h2>' + field('gl', 'Логин', 'text') + field('gp', 'Пароль', 'password') + '<button class="b" id="gok">Войти</button>' +
        '<p><a href="#" id="glink3">Забыли пароль</a></p>';
    }
    return h + (g.msg ? '<p class="err">' + esc(g.msg) + '</p>' : '') + '</div>';
  }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }

  function doLogin() {
    var w = lockedFor(); if (w) return setMsg('Слишком много попыток. Подождите ' + w + ' с.');
    var rec = A.find(state.accounts, val('gl')), pw = val('gp');
    if (!rec) { fail(); return setMsg('Неверный логин или пароль.'); }
    A.verify(rec, pw).then(function (ok) { if (ok) enter(rec); else { fail(); setMsg('Неверный логин или пароль.'); } });
  }
  function doSetup() {
    var l = val('gl'), p = val('gp'), e = A.checkLogin(l) || A.checkPassword(p) || (p !== val('gp2') ? 'Пароли не совпадают.' : '');
    if (e) return setMsg(e);
    A.make(l, 'parent', p, Date.now()).then(function (rec) { window.KidSync.put(state.accounts, rec, rec.updated); Kid.syncSoon(); enter(rec); });
  }
  function doConnect() {
    Kid.settings.repo = val('gr').trim(); Kid.settings.token = val('gt').trim(); Kid.persistSettings();
    if (!Kid.syncConfigured()) return setMsg('Проверьте репозиторий и токен.');
    g.msg = 'Подключаюсь…'; g.sig = ''; Kid.render();
    Kid.syncNow(true).then(function () {
      g.mode = hasAny() ? 'login' : 'setup';
      g.msg = hasAny() ? 'Готово. Войдите.' : 'Подключено, но логинов пока нет: создайте первый.'; g.sig = ''; Kid.render();
    });
  }
  function doReset() {
    var rec = A.find(state.accounts, val('gl')), e = A.checkPassword(val('gp'));
    if (!rec) return setMsg('Такого логина нет.'); if (e) return setMsg(e);
    var w = lockedFor(); if (w) return setMsg('Слишком много попыток. Подождите ' + w + ' с.');
    if (!Kid.parentHasPin()) return setMsg('PIN родителя ещё не пришёл с телефона. Синхронизируйте телефон.');
    P.deriveKey(val('gpin')).then(function (key) { return P.verify(state.parent, key); }).then(function (ok) {
      if (!ok) { fail(); return setMsg('Неверный PIN.'); }
      return A.make(rec.login, rec.role, val('gp'), Date.now()).then(function (n) { window.KidSync.put(state.accounts, n, n.updated); Kid.syncSoon(); enter(n); });
    });
  }
  var ACT = { login: doLogin, setup: doSetup, connect: doConnect, reset: doReset };

  // true, если показана форма (интерфейс закрыт)
  api.show = function () {
    var el = document.getElementById('gate');
    var need = !hasAny() || !session();
    if (!need) { if (el) el.remove(); return false; }
    if (!hasAny() && g.mode !== 'connect' && g.mode !== 'setup') g.mode = 'setup';
    if (hasAny() && (g.mode === 'setup')) g.mode = 'login';
    var sig = g.mode + '|' + g.msg;
    if (!el) { el = document.createElement('div'); el.id = 'gate'; document.body.appendChild(el); g.sig = ''; }
    if (g.sig !== sig) {          // перерисовываем только при смене режима или сообщения, чтобы не стирать ввод
      g.keep = {}; ['gl', 'gr'].forEach(function (i) { var e = el.querySelector('#' + i); if (e) g.keep[i] = e.value; });   // логин не стираем при ошибке, пароль стираем
      g.sig = sig; el.innerHTML = html();
      var go = el.querySelector('#gok'); if (go) go.onclick = ACT[g.mode];
      el.querySelectorAll('input').forEach(function (i) { i.onkeydown = function (e) { if (e.key === 'Enter') ACT[g.mode](); }; });
      [['glink1', 'connect'], ['glink2', hasAny() ? 'login' : 'setup'], ['glink3', 'reset']].forEach(function (x) { var a = el.querySelector('#' + x[0]); if (a) a.onclick = function (e) { e.preventDefault(); g.mode = x[1]; g.msg = ''; Kid.render(); }; });
    }
    return true;
  };
  // Управление аккаунтами (для раздела «Для родителя»)
  api.list = accounts;
  api.add = function (login, role, pw) {
    var e = A.checkLogin(login) || A.checkPassword(pw); if (e) return Promise.reject(new Error(e));
    return A.make(login, role, pw, Date.now()).then(function (rec) { window.KidSync.put(state.accounts, rec, rec.updated); Kid.syncSoon(); });
  };
  api.remove = function (login) {
    var rec = A.find(state.accounts, login); if (!rec) return;
    var parents = accounts().filter(function (r) { return r.role === 'parent' && r.login !== rec.login; });
    if (rec.role === 'parent' && !parents.length) throw new Error('Нельзя удалить последний вход родителя.');
    window.KidSync.remove(state.accounts, rec.id, Date.now()); Kid.syncSoon();
  };
})();
