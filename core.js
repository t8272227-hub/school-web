// Ядро веб-версии: состояние, реестр разделов, ИИ, синхронизация, блокировка и вход родителя.
// Разделы подключаются файлами modules/*.js через Kid.register (описание в MODULES.md).
(function () {
  'use strict';
  var S = window.KidSync, C = window.KidCheck, P = window.KidParent;
  var Kid = window.Kid = { sections: [], acts: {}, ui: {} };

  var SUBJECTS = ['Математика', 'Алгебра', 'Геометрия', 'Русский язык', 'Литература', 'Английский язык', 'Физика', 'Химия', 'Биология', 'История', 'География', 'Информатика', 'Окружающий мир'];
  var MAIN = ['hw', 'tutor', 'check', 'visual'];          // верхние вкладки (как нижние на телефоне)
  Kid.SUBJECTS = SUBJECTS; Kid.MAIN = MAIN;
  Kid.ALWAYS = { parent: 1, guide: 1, settings: 1 };       // эти разделы родитель выключить не может

  // ---------- хранение ----------
  function load(key, def) { try { var t = localStorage.getItem(key); return t ? JSON.parse(t) : def; } catch (e) { return def; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* хранилище недоступно */ } }
  Kid.load = load; Kid.save = save;
  // Локальные данные раздела (не синхронизируются): Kid.store('cards', []) / Kid.saveStore('cards', v)
  Kid.store = function (name, def) { return load('kid.m.' + name, def); };
  Kid.saveStore = function (name, v) { save('kid.m.' + name, v); };

  var state = Kid.state = Object.assign(S.emptySnap(), load('kid.state', {}));
  state.mistakes = state.mistakes || {}; state.notes = state.notes || {}; state.profile = state.profile || {}; state.usage = state.usage || {}; state.alerts = state.alerts || {}; state.accounts = state.accounts || {}; state.days = state.days || [];
  var settings = Kid.settings = Object.assign({ repo: '', token: '', aiKey: '', aiBase: 'https://api.zveno.ai/v1', model: 'anthropic/claude-sonnet-5' }, load('kid.settings', {}));
  Kid.persist = function () { save('kid.state', state); };
  Kid.persistSettings = function () { save('kid.settings', settings); };

  var ui = Kid.ui;
  ui.view = load('kid.view', 'check'); ui.s = settings; ui.sync = { busy: false, msg: '', ok: true }; ui.pf = null; ui.setInfo = '';
  // Состояние раздела на время сессии: var m = Kid.mod('essay', { topic: '' })
  Kid.mod = function (key, defaults) { if (!ui[key]) ui[key] = Object.assign({}, defaults); return ui[key]; };

  // ---------- утилиты ----------
  Kid.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var esc = Kid.esc;
  Kid.today = function () { return isoDate(new Date()); };
  function isoDate(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  Kid.isoDate = isoDate;
  Kid.newId = function () { return String(Date.now()) + String(Math.floor(Math.random() * 1000)); };
  Kid.profile = function () { return S.live(state.profile)[0] || {}; };
  Kid.grade = function () { return Kid.profile().grade || ''; };
  Kid.parentCore = function () { return (state.parent && P.coreOf(state.parent)) || null; };
  Kid.hintOnly = function () { var c = Kid.parentCore(); return !!(c && c.hintOnly); };
  Kid.blocked = function (key) { var c = Kid.parentCore(); return !!(c && !Kid.ALWAYS[key] && c.blocked.indexOf(key) >= 0); };
  Kid.touchToday = function () { if (state.days.indexOf(Kid.today()) < 0) state.days.push(Kid.today()); };
  Kid.recordTask = function () { state.tasks = (state.tasks || 0) + 1; Kid.touchToday(); };
  Kid.mistakes = function () { return S.live(state.mistakes).sort(function (a, b) { return String(b.created).localeCompare(String(a.created)) || String(b.id).localeCompare(String(a.id)); }); };
  Kid.addMistake = function (subject, wrong, right, why) {
    var now = Date.now(), ex = Kid.mistakes().filter(function (m) { return m.subject === subject && String(m.wrong).trim() === wrong.trim(); })[0];
    if (ex) S.put(state.mistakes, Object.assign({}, ex, { streak: 0, right: right || ex.right, why: why || ex.why }), now);
    else S.put(state.mistakes, { id: Kid.newId(), subject: subject, wrong: wrong.trim(), right: (right || '').trim(), why: (why || '').trim(), streak: 0, created: Kid.today() }, now);
  };
  Kid.go = function (key) { ui.view = key; save('kid.view', key); Kid.render(); };

  // ---------- ИИ ----------
  function aiCall(messages, maxTokens, temperature) {
    if (!settings.aiKey) return Promise.reject(new Error('Нужен ключ ИИ: открой «Настройки» и вставь ключ ZVENO AI.'));
    var body = { model: settings.model, messages: messages, max_tokens: maxTokens || 1500, temperature: temperature == null ? 0.3 : temperature };
    return fetch(String(settings.aiBase).replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + settings.aiKey }, body: JSON.stringify(body),
    }).then(function (r) {
      return r.text().then(function (t) {
        if (!r.ok) throw new Error(r.status === 401 ? 'Ключ ИИ не подошёл. Проверь его в настройках.' : r.status === 429 ? 'Слишком много запросов. Подожди минуту.' : 'Ошибка ИИ (' + r.status + ').');
        var j; try { j = JSON.parse(t); } catch (e) { throw new Error('ИИ вернул непонятный ответ.'); }
        var c = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
        if (!c) throw new Error('ИИ вернул пустой ответ. Попробуй ещё раз.');
        return typeof c === 'string' ? c : c.map(function (p) { return p.text || ''; }).join('');
      });
    }, function () {
      throw new Error('Не удалось связаться с ИИ. Проверь интернет. Если интернет есть, браузер мог заблокировать запрос: смотри раздел «Версия для компьютера» в README.');
    });
  }
  // Один вопрос: askAI(system, text, photoDataUrl?, maxTokens?, temperature?)
  Kid.askAI = function (system, text, photo, maxTokens, temperature) {
    var user = photo ? [{ type: 'text', text: text }, { type: 'image_url', image_url: { url: photo } }] : text;
    return aiCall([{ role: 'system', content: system }, { role: 'user', content: user }], maxTokens, temperature);
  };
  // Диалог: chatAI(system, [{role:'user'|'assistant', content}], maxTokens?, temperature?)
  Kid.chatAI = function (system, messages, maxTokens, temperature) {
    return aiCall([{ role: 'system', content: system }].concat(messages), maxTokens, temperature);
  };
  // Ответ ИИ в виде JSON (или null, если не разобрался)
  Kid.parseJson = function (raw) {
    var j = C.extractJson(raw || ''); if (j) { try { return JSON.parse(j); } catch (e) { /* дальше */ } }
    var s = (raw || '').indexOf('['), e2 = (raw || '').lastIndexOf(']');
    if (s >= 0 && e2 > s) { try { return JSON.parse(raw.slice(s, e2 + 1)); } catch (e) { /* нет */ } }
    return null;
  };
  Kid.readPhoto = function (file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('Не удалось прочитать файл.')); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('Это не картинка.')); };
        img.onload = function () {
          var k = Math.min(1, 1600 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
          cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL('image/jpeg', 0.85));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  };

  // ---------- вёрстка ----------
  Kid.chips = function (list, cur, act) { return '<div class="chips">' + list.map(function (s) { return '<button data-act="' + act + '" data-v="' + esc(s) + '" class="' + (s === cur ? 'on' : '') + '">' + esc(s) + '</button>'; }).join('') + '</div>'; };
  Kid.head = function (t, s) { return '<h2>' + esc(t) + '</h2>' + (s ? '<p class="sub">' + esc(s) + '</p>' : ''); };
  Kid.busy = function (t) { return '<p class="mut"><span class="spin"></span>' + esc(t) + '</p>'; };
  Kid.photoBox = function (p, act, label) {
    return '<label>' + esc(label || 'Фото (можно вместо текста)') + '</label><input type="file" accept="image/*" capture="environment" data-act="' + act + '">' +
      (p ? '<img class="photo" src="' + p + '" alt="Фото"><button class="b o" data-act="' + act + 'Clear">Убрать фото</button>' : '');
  };
  Kid.textarea = function (bind, value, label) { return (label ? '<label>' + esc(label) + '</label>' : '') + '<textarea data-bind="' + bind + '">' + esc(value) + '</textarea>'; };
  Kid.input = function (bind, value, label, type) { return (label ? '<label>' + esc(label) + '</label>' : '') + '<input' + (type ? ' type="' + type + '"' : '') + ' data-bind="' + bind + '" value="' + esc(value) + '">'; };
  Kid.err = function (t) { return t ? '<p class="err">' + esc(t) + '</p>' : ''; };

  // ---------- файлы, печать, голос ----------
  // Скачать текстовый файл: Kid.download('реферат.doc', 'application/msword', html)
  Kid.download = function (name, mime, content) {
    var a = document.createElement('a'), url = URL.createObjectURL(new Blob([content], { type: mime + ';charset=utf-8' }));
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 1000);
  };
  // Word откроет HTML с расширением .doc: Kid.saveWord('Реферат', '<h1>..</h1><p>..</p>')
  Kid.saveWord = function (title, bodyHtml) {
    Kid.download(title.replace(/[\\/:*?"<>|]+/g, '_') + '.doc', 'application/msword',
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>' + esc(title) + '</title></head><body style="font-family:Times New Roman;font-size:14pt">' + bodyHtml + '</body></html>');
  };
  // Печать или «Сохранить как PDF»: Kid.printHtml('Реферат', '<h1>..</h1>')
  Kid.printHtml = function (title, bodyHtml) {
    var w = window.open('', '_blank'); if (!w) return false;
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>body{font:14pt/1.4 "Times New Roman",serif;margin:2cm}h1,h2{font-weight:700}pre{white-space:pre-wrap;font:inherit}</style></head><body>' + bodyHtml + '</body></html>');
    w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 300); return true;
  };
  // Озвучка: Kid.speak('текст', function () { /* закончили */ }); Kid.stopSpeak()
  Kid.speak = function (text, onEnd) {
    if (!window.speechSynthesis) { if (onEnd) onEnd(); return false; }
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text); u.lang = 'ru-RU'; u.onend = u.onerror = function () { if (onEnd) onEnd(); };
    window.speechSynthesis.speak(u); return true;
  };
  Kid.stopSpeak = function () { if (window.speechSynthesis) window.speechSynthesis.cancel(); };
  // Голосовой ввод (Chrome, Edge): Kid.canListen(); Kid.listen(function (text) {...}, function () { /* конец */ })
  var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  Kid.canListen = function () { return !!Rec; };
  Kid.listen = function (onText, onEnd) {
    if (!Rec) { if (onEnd) onEnd('Голосовой ввод не поддерживается этим браузером. Используй Chrome или Edge.'); return null; }
    var r = new Rec(); r.lang = 'ru-RU'; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = function (e) { var t = ''; for (var i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; onText(t.trim()); };
    r.onerror = function (e) { if (onEnd) onEnd(e.error === 'not-allowed' ? 'Разреши браузеру доступ к микрофону.' : 'Не расслышал, попробуй ещё раз.'); onEnd = null; };
    r.onend = function () { if (onEnd) onEnd(); };
    r.start(); return r;
  };

  // ---------- реестр разделов ----------
  // Kid.register({ key, title, subtitle?, icon?, view: function () { return html; }, acts: { name: function (v, el) {} }, always?: true })
  Kid.register = function (def) {
    if (!def || !def.key || typeof def.view !== 'function') throw new Error('register: нужны key и view');
    Kid.sections = Kid.sections.filter(function (s) { return s.key !== def.key; });
    Kid.sections.push(def);
    Object.keys(def.acts || {}).forEach(function (n) { Kid.acts[n] = def.acts[n]; });
  };
  function find(key) { return Kid.sections.filter(function (s) { return s.key === key; })[0]; }
  Kid.section = find;

  // ---------- синхронизация через GitHub ----------
  function enc(str) { var b = new TextEncoder().encode(str), s = ''; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
  function dec(b64) { var s = atob(b64.replace(/\s/g, '')), b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return new TextDecoder().decode(b); }
  function gh(path, method, body) {
    return fetch('https://api.github.com/repos/' + settings.repo + path, {
      method: method || 'GET', headers: { Authorization: 'Bearer ' + settings.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, body: body ? JSON.stringify(body) : undefined,
    });
  }
  function ghExplain(code) {
    return code === 401 ? 'GitHub не принял токен. Проверь, что он скопирован целиком и не истёк.'
      : code === 403 ? 'У токена нет прав на запись. Нужен доступ «Contents: Read and write» к репозиторию.'
      : code === 404 ? 'Репозиторий не найден. Проверь адрес вида имя/репозиторий и что токен выдан на этот репозиторий.' : 'Ошибка GitHub (' + code + ').';
  }
  Kid.syncConfigured = function () { return /^[\w.-]+\/[\w.-]+$/.test(settings.repo || '') && !!settings.token; };

  function syncOnce() {
    return gh('/contents/data.json').then(function (r) {
      if (r.status === 404) return gh('').then(function (rr) { if (rr.status !== 200) throw new Error(ghExplain(rr.status)); return { snap: S.emptySnap(), sha: null }; });
      if (r.status < 200 || r.status > 299) throw new Error(ghExplain(r.status));
      return r.json().then(function (o) {
        var text = dec(o.content || ''), snap = S.emptySnap();
        if (text.trim()) { try { snap = S.fromWire(JSON.parse(text)); } catch (e) { snap = null; } if (!snap) throw new Error('Файл data.json в репозитории повреждён или чужой.'); }
        return { snap: snap, sha: o.sha };
      });
    }).then(function (remote) {
      var merged = S.mergeSnap(state, remote.snap, Date.now());
      Object.assign(state, merged); Kid.persist();
      if (S.sameSnap(merged, remote.snap)) return { done: 'Всё актуально.' };
      var body = { message: 'sync from computer', content: enc(JSON.stringify(S.toWire(merged))) };
      if (remote.sha) body.sha = remote.sha;
      return gh('/contents/data.json', 'PUT', body).then(function (r) {
        if (r.status >= 200 && r.status < 300) return { done: 'Готово: данные обновлены.' };
        if (r.status === 409 || r.status === 422) return { retry: true };
        throw new Error(ghExplain(r.status));
      });
    });
  }
  Kid.syncNow = function (silent) {
    if (!Kid.syncConfigured() || ui.sync.busy) return Promise.resolve();
    ui.sync.busy = true; if (!silent) Kid.render();
    var attempt = 0;
    function go() { attempt++; return syncOnce().then(function (res) { if (res.retry && attempt < 3) return go(); if (res.retry) throw new Error('Файл меняли одновременно, попробуй ещё раз.'); return res.done; }); }
    return go().then(function (m) { ui.sync.msg = m; ui.sync.ok = true; settings.last = Date.now(); Kid.persistSettings(); }, function (e) {
      ui.sync.ok = false; ui.sync.msg = (e instanceof TypeError) ? 'Нет связи с GitHub. Проверь интернет.' : e.message;
    }).then(function () { ui.sync.busy = false; Kid.render(); });
  };
  Kid.syncSoon = function () { Kid.persist(); Kid.syncNow(true); };

  // ---------- родитель: вход, правила, блокировка ----------
  var parentSession = { key: null, until: 0 };
  Kid.parentLoggedIn = function () { return !!parentSession.key && Date.now() < parentSession.until; };
  Kid.parentLogout = function () { parentSession.key = null; parentSession.until = 0; };
  Kid.parentHasPin = function () { return !!(state.parent && state.parent.sig); };
  // Проверка PIN по подписи правил, пришедших с телефона. Сам PIN нигде не хранится.
  Kid.parentLogin = function (pin) {
    if (!Kid.parentHasPin()) return Promise.reject(new Error('Правил родителя ещё нет. На телефоне задай PIN в «Для родителя» и синхронизируй, затем повтори здесь.'));
    return P.deriveKey(pin).then(function (key) {
      return P.verify(state.parent, key).then(function (ok) {
        if (!ok) throw new Error('Неверный PIN.');
        parentSession.key = key; parentSession.until = Date.now() + 15 * 60 * 1000;
      });
    });
  };
  // Сохранить новые правила (нужен вход родителя). Телефон применит их после проверки подписи.
  Kid.setParentCore = function (core) {
    if (!Kid.parentLoggedIn()) return Promise.reject(new Error('Сначала войди как родитель.'));
    parentSession.until = Date.now() + 15 * 60 * 1000;
    return P.makeRec(core, parentSession.key).then(function (rec) { state.parent = rec; Kid.syncSoon(); Kid.render(); });
  };
  // Снять блокировку на 30 минут по PIN (экран отдыха)
  Kid.parentOverride = function (pin) {
    return Kid.parentLogin(pin).then(function () { save('kid.override', Date.now() + 30 * 60 * 1000); });
  };
  function overrideActive() { return load('kid.override', 0) > Date.now(); }

  // Учёт времени: секунды, пока вкладка видна
  var usage = load('kid.usage', { day: '', sec: 0 });
  if (usage.day !== Kid.today()) usage = { day: Kid.today(), sec: 0 };
  Kid.usedSec = function () { return usage.day === Kid.today() ? usage.sec : 0; };
  function lockReason() {
    var c = Kid.parentCore(); if (!c || !Kid.parentHasPin()) return null;
    var now = new Date();
    return P.lockReason(c, now.getHours() * 60 + now.getMinutes(), Kid.usedSec(), overrideActive());
  }
  Kid.lockReason = lockReason;
  // автосинхронизация: раз в 2 минуты, пока вкладка открыта, и сразу при возвращении на вкладку
  setInterval(function () { if (!document.hidden) Kid.syncNow(true); }, 120000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) Kid.syncNow(true); });
  var lastTick = Date.now(), lastLocked = null;
  setInterval(function () {
    var now = Date.now(), dt = Math.min(10, (now - lastTick) / 1000); lastTick = now;
    if (document.hidden) return;
    if (usage.day !== Kid.today()) usage = { day: Kid.today(), sec: 0 };
    if (!lockReason()) {
      usage.sec += dt; save('kid.usage', usage);
      var min = Math.ceil(usage.sec / 60);
      state.usage.pc = state.usage.pc || {};
      if ((state.usage.pc[usage.day] || 0) < min) { state.usage.pc[usage.day] = min; if (min % 5 === 0) Kid.persist(); }
    }
    var r = lockReason();
    if (r !== lastLocked) { lastLocked = r; Kid.render(); }
  }, 5000);

  // ---------- отрисовка ----------
  function visibleSections() { return Kid.sections.filter(function (s) { return (Kid.ALWAYS[s.key] || !Kid.blocked(s.key)) && !(s.key === 'parent' && Kid.gate && Kid.gate.isChild()); }); }
  function renderLock() {
    var r = lockReason(), el = document.getElementById('lock');
    if (!r) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'lock'; document.body.appendChild(el); }
    if (el.getAttribute('data-r') === r && el.querySelector('input')) return;   // не сбиваем ввод PIN
    el.setAttribute('data-r', r);
    el.innerHTML = '<div class="lockbox"><h2>Пора отдохнуть</h2><p>' + esc(P.lockMessage(r, Kid.parentCore())) + '</p><label>PIN родителя</label><input id="lockpin" type="password" inputmode="numeric" autocomplete="off"><button class="b" id="lockbtn">Разрешить ещё 30 минут</button><p class="err" id="lockerr"></p></div>';
    el.querySelector('#lockbtn').onclick = function () {
      var pin = el.querySelector('#lockpin').value;
      Kid.parentOverride(pin).then(function () { Kid.render(); }, function (e) { el.querySelector('#lockerr').textContent = e.message; });
    };
  }

  Kid.render = function () {
    if (Kid.gate && Kid.gate.show()) return;   // не вошли: показываем только форму входа
    var vis = visibleSections(), keys = vis.map(function (s) { return s.key; });
    if (!find(ui.view) && ui.view !== 'more') ui.view = 'check';
    if (ui.view !== 'more' && !Kid.ALWAYS[ui.view] && Kid.blocked(ui.view)) ui.view = (MAIN.filter(function (k) { return keys.indexOf(k) >= 0; })[0]) || 'more';
    var tabs = MAIN.filter(function (k) { return keys.indexOf(k) >= 0; }).map(function (k) { return [k, find(k).title]; }).concat([['more', 'Ещё']]);
    var active = MAIN.indexOf(ui.view) >= 0 ? ui.view : 'more';
    document.getElementById('tabs').innerHTML = tabs.map(function (t) { return '<button data-act="go" data-v="' + t[0] + '" class="' + (t[0] === active ? 'on' : '') + '">' + esc(t[1]) + '</button>'; }).join('');
    var html;
    if (ui.view === 'more') {
      html = Kid.head('Ещё', 'Всё для учёбы в одном месте') + '<div class="grid">' + vis.filter(function (s) { return MAIN.indexOf(s.key) < 0; }).map(function (s) {
        return '<button class="tile" data-act="go" data-v="' + esc(s.key) + '"><b>' + esc(s.title) + '</b><span>' + esc(s.subtitle || '') + '</span></button>';
      }).join('') + '</div>' + (Kid.gate && Kid.gate.active() ? '<div class="row" style="margin-top:12px"><button class="b o" data-act="gateLogout">Выйти из аккаунта (' + esc(Kid.gate.who()) + ')</button></div>' : '');
    } else {
      var sec = find(ui.view), back = MAIN.indexOf(ui.view) >= 0 ? '' : '<button class="b o back" data-act="go" data-v="more">← Ещё</button>';
      try { html = back + sec.view(); } catch (e) { html = back + '<p class="err">Ошибка раздела: ' + esc(e.message) + '</p>'; }
    }
    document.getElementById('view').innerHTML = html;
    renderLock();
  };

  // ---------- действия ----------
  Kid.acts.gateLogout = function () { Kid.gate.logout(); Kid.parentLogout(); };
  Kid.acts.go = function (v) { ui.view = v; save('kid.view', v); window.scrollTo(0, 0); };

  function setBind(path, v) {
    var p = path.split('.'), o = ui;
    for (var i = 0; i < p.length - 1; i++) { if (o[p[i]] == null || typeof o[p[i]] !== 'object') o[p[i]] = {}; o = o[p[i]]; }
    o[p[p.length - 1]] = v;
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-act]'); if (!el || el.tagName === 'INPUT') return;
    var name = el.getAttribute('data-act'), a = Kid.acts[name]; if (!a) return;
    var res; try { res = a(el.getAttribute('data-v'), el, e); } catch (err) { console.error(err); }
    Promise.resolve(res).then(Kid.render, function (err) { console.error(err); Kid.render(); });
    Kid.render();
  });
  document.addEventListener('change', function (e) {
    var el = e.target; if (!el.getAttribute) return;
    var name = el.getAttribute('data-act');
    if (name && el.tagName === 'INPUT' && el.type === 'file' && el.files && el.files[0] && Kid.acts[name]) { Promise.resolve(Kid.acts[name](null, el, e)).then(Kid.render); return; }
    if (name && el.tagName === 'SELECT' && Kid.acts[name]) { Promise.resolve(Kid.acts[name](el.value, el, e)).then(Kid.render); return; }
    if (name && el.tagName === 'INPUT' && el.type === 'checkbox' && Kid.acts[name]) { Promise.resolve(Kid.acts[name](el.getAttribute('data-v'), el, e)).then(Kid.render); }
  });
  document.addEventListener('input', function (e) { var b = e.target.getAttribute && e.target.getAttribute('data-bind'); if (b) setBind(b, e.target.value); });

  Kid.start = function () {
    Kid.touchToday(); Kid.persist(); Kid.render();
    if (Kid.syncConfigured()) Kid.syncNow(true);
  };
})();
