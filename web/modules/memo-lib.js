// Чистая логика разделов «Заметки», «Напоминания», «Шпаргалки», «Таймер учёбы», «Как пользоваться» (без DOM, проверяется в Node).
// Порт с Kotlin: NoteCommand.kt, ReminderParser.kt, Reminders.kt (списки и текст), Cheatsheets.kt, AlertDetector.normalize, AppGuide.kt.
// Формат как в sync.js: module.exports или window.Kid_memo
(function (root) {
  'use strict';

  function upFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function trimEndChars(s, chars) {
    var e = s.length;
    while (e > 0 && chars.indexOf(s.charAt(e - 1)) >= 0) e--;
    return s.slice(0, e);
  }

  // ====================================================================== Заметки (NoteCommand.kt)
  // Java 19+: \b понимает только ASCII, поэтому для кириллицы в Kotlin стоят lookahead. В JS (без флага u) \b тоже ASCII, поэтому здесь те же lookahead.
  var NOTE_SAVE = /^\s*(?:(?:привет|слушай|эй)?\s*,?\s*друг\s*[,.!]?\s*)?(?:пожалуйста\s*,?\s*)?(?:запомни|запиши|сохрани|занеси в заметки|добавь в заметки|сделай заметку|заметка)(?=[\s:,.\-–—!]|$)\s*(?:что\s+|мне\s+)?\s*[:,\-–—]?\s*([\s\S]*)$/i;
  var NOTE_READ = /(?:покажи|прочитай|прочти|открой|расскажи|назови)\s+(?:мои\s+|все\s+)?заметки|какие\s+у\s+меня\s+заметки|что\s+я\s+(?:просил|просила)\s+запомнить|что\s+ты\s+запомнил/i;

  // {type:'save', text} (text пустой, если сказано только «запомни»), {type:'readAll'} или null
  function parseNote(text) {
    var t = String(text == null ? '' : text).trim();
    if (!t) return null;
    var m = NOTE_SAVE.exec(t);
    if (m) {
      var body = trimEndChars(m[1].trim(), '.! ');
      return { type: 'save', text: upFirst(body) };
    }
    if (NOTE_READ.test(t)) return { type: 'readAll' };
    return null;
  }

  // Что произнести вслух, когда просят прочитать заметки. notes: [{text}]
  function readAloudNotes(notes, limit) {
    limit = limit == null ? 5 : limit;
    if (!notes.length) return 'У тебя пока нет заметок. Скажи «запомни» и что нужно записать.';
    var shown = notes.slice(0, limit);
    var tail = notes.length > shown.length ? ' Остальные смотри в разделе «Заметки».' : '';
    return 'Заметок: ' + notes.length + '. ' + shown.map(function (n, i) { return (i + 1) + '. ' + trimEndChars(n.text, '.!') + '.'; }).join(' ') + tail;
  }

  // Заметки из карты записей синхронизации: новые сверху (как на телефоне), пустые и удалённые не показываем.
  function sortNotes(list) {
    return list.filter(function (n) { return n && !n.deleted && String(n.text || '').trim(); }).sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0) || String(b.id).localeCompare(String(a.id));
    });
  }

  // ====================================================================== Напоминания (ReminderParser.kt)
  var TRIGGER = /^\s*(?:(?:привет|слушай|эй)?\s*,?\s*друг\s*[,.!]?\s*)?(?:пожалуйста\s*,?\s*)?(?:напомни|напомнить|поставь напоминание|сделай напоминание|разбуди)(?=[\s:,.\-–—!]|$)\s*(?:мне\s+)?([\s\S]*)$/i;
  var LIST = /(?:покажи|прочитай|прочти|расскажи|назови)\s+(?:мои\s+|все\s+)?напоминания|какие\s+у\s+меня\s+напоминания|что\s+ты\s+мне\s+напомнишь/i;

  var NUMBER_WORDS = {
    'один': 1, 'одну': 1, 'одна': 1, 'два': 2, 'две': 2, 'три': 3, 'четыре': 4, 'пять': 5, 'шесть': 6,
    'семь': 7, 'восемь': 8, 'девять': 9, 'десять': 10, 'одиннадцать': 11, 'двенадцать': 12, 'тринадцать': 13,
    'четырнадцать': 14, 'пятнадцать': 15, 'шестнадцать': 16, 'семнадцать': 17, 'восемнадцать': 18, 'девятнадцать': 19,
    'двадцать': 20, 'тридцать': 30, 'сорок': 40, 'пятьдесят': 50, 'шестьдесят': 60,
  };
  var numWordPattern = Object.keys(NUMBER_WORDS).sort(function (a, b) { return b.length - a.length; }).join('|');

  var REL_HALF = /через\s+полчаса/;
  var REL_ONE_HALF = /через\s+полтора\s+часа/;
  var REL = new RegExp('через\\s+(?:(\\d+)|((?:' + numWordPattern + ')(?:\\s+(?:' + numWordPattern + '))?))?\\s*(секунд|минут|час|день|дня|дней|недел)[а-я]*');

  // ISO-номер дня недели: понедельник = 1 ... воскресенье = 7
  var WEEKDAYS = {
    'понедельник': 1, 'вторник': 2, 'среду': 3, 'среда': 3, 'четверг': 4, 'пятницу': 5, 'пятница': 5,
    'субботу': 6, 'суббота': 6, 'воскресенье': 7,
  };
  var WEEKDAY_KEYS = Object.keys(WEEKDAYS);
  var DAY_WORD = new RegExp('послезавтра|завтра|сегодня|(?:в\\s+)?(' + WEEKDAY_KEYS.join('|') + ')');
  var TIME_STRICT = /в\s+(\d{1,2})(?:[:.](\d{2}))?\s*(утра|вечера|дня|ночи|часов|часа|час)?(?![\d:])/;
  var DAY_PART = /утром|вечером|днём|днем/;

  function numberFromWords(s) {
    return s.trim().split(/\s+/).reduce(function (a, w) { return a + (NUMBER_WORDS[w] || 0); }, 0);
  }
  function rng(m) { return [m.index, m.index + m[0].length - 1]; }
  function isoDow(d) { return d.getDay() === 0 ? 7 : d.getDay(); }
  function dayStart(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0); }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

  function cleanText(original, ranges) {
    var chars = original.split('');
    ranges.slice().sort(function (a, b) { return b[0] - a[0]; }).forEach(function (r) {
      if (r[0] >= 0 && r[1] < chars.length) chars.splice(r[0], r[1] - r[0] + 1);
    });
    var s = chars.join('').replace(/\s+/g, ' ').trim().replace(/^[,.\-–! ]+|[,.\-–! ]+$/g, '');
    s = s.replace(/^(?:что|чтобы|мне)\s+/i, '').trim();
    return upFirst(s);
  }

  // Время берётся из часового пояса браузера. now в миллисекундах.
  // Результат: {type:'set', text, at} | {type:'needTime', text} | {type:'list'} | null
  function parseReminder(input, now) {
    var t = String(input == null ? '' : input).trim();
    if (!t) return null;
    if (LIST.test(t)) return { type: 'list' };
    var m = TRIGGER.exec(t);
    if (!m) return null;
    var rest = m[1];
    var work = rest.toLowerCase();
    var remove = [];
    var nowD = new Date(now);
    var at = null;   // Date

    // ---- относительное время ----
    var r0 = REL_HALF.exec(work);
    if (r0) { at = new Date(now + 30 * 60000); remove.push(rng(r0)); }
    if (!at) { r0 = REL_ONE_HALF.exec(work); if (r0) { at = new Date(now + 90 * 60000); remove.push(rng(r0)); } }
    if (!at) {
      var r = REL.exec(work);
      if (r) {
        var n = null;
        if (r[1] && r[1].length <= 9) n = parseInt(r[1], 10);
        if (n == null && r[2] && r[2].trim()) n = numberFromWords(r[2]);
        if (n == null) n = 1;
        var unit = r[3];
        if (unit === 'секунд') at = new Date(now + n * 1000);
        else if (unit === 'минут') at = new Date(now + n * 60000);
        else if (unit === 'час') at = new Date(now + n * 3600000);
        else if (unit === 'недел') at = addDays(nowD, n * 7);
        else at = addDays(nowD, n);
        remove.push(rng(r));
      }
    }

    // ---- абсолютное время ----
    if (!at) {
      var today = dayStart(nowD);
      var d0 = null;
      var d = DAY_WORD.exec(work);
      if (d) {
        if (d[0].indexOf('послезавтра') === 0) d0 = addDays(today, 2);
        else if (d[0].indexOf('завтра') === 0) d0 = addDays(today, 1);
        else if (d[0].indexOf('сегодня') === 0) d0 = today;
        else d0 = addDays(today, (WEEKDAYS[d[1]] - isoDow(nowD) + 7) % 7);
        remove.push(rng(d));
      }
      var time = null;   // [h, min]
      var tm = TIME_STRICT.exec(work);
      if (tm) {
        var h = parseInt(tm[1], 10);
        var min = tm[2] ? parseInt(tm[2], 10) : 0;
        var marker = tm[3] || '';
        if (marker === 'вечера') { if (h < 12) h += 12; }
        else if (marker === 'дня') { if (h < 6) h += 12; }
        else if (marker === 'ночи') { if (h === 12) h = 0; }
        else if (marker === 'утра') { if (h === 12) h = 0; }
        if (h >= 0 && h <= 23 && min >= 0 && min <= 59) { time = [h, min]; remove.push(rng(tm)); }
      }
      if (!time) {
        var p = DAY_PART.exec(work);
        if (p) {
          time = p[0] === 'утром' ? [8, 0] : p[0] === 'вечером' ? [19, 0] : [13, 0];
          remove.push(rng(p));
        }
      }
      if (!d0 && !time) return { type: 'needTime', text: cleanText(rest, []) };
      var resultDate = d0 || today;
      var resultTime = time;
      if (!resultTime) {
        if (d0 && d0.getTime() > today.getTime()) resultTime = [8, 0];
        else return { type: 'needTime', text: cleanText(rest, remove) };
      }
      var dt = new Date(resultDate.getFullYear(), resultDate.getMonth(), resultDate.getDate(), resultTime[0], resultTime[1], 0, 0);
      if (dt.getTime() <= now) {
        // время уже прошло: если день не назван, переносим на завтра; для дня недели на неделю вперёд
        if (!d0) dt = addDays(dt, 1);
        else if (sameDay(d0, today) && WEEKDAY_KEYS.some(function (k) { return work.indexOf(k) >= 0; })) dt = addDays(dt, 7);
      }
      at = dt;
    }
    return { type: 'set', text: cleanText(rest, remove) || 'Напоминание', at: at.getTime() };
  }

  function plural(n, one, few, many) {
    var a = n % 100, b = n % 10;
    if (a >= 11 && a <= 19) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  }
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  // Как произнести время: «через 10 минут», «сегодня в 15:10», «завтра в 8:00», «17 октября в 16:00».
  function describe(at, now) {
    var diffMin = Math.trunc((at - now) / 60000);
    if (diffMin >= 0 && diffMin <= 59) {
      return diffMin === 0 ? 'прямо сейчас' : 'через ' + diffMin + ' ' + plural(diffMin, 'минуту', 'минуты', 'минут');
    }
    var dt = new Date(at), today = dayStart(new Date(now));
    var time = dt.getHours() + ':' + ('0' + dt.getMinutes()).slice(-2);
    if (sameDay(dt, today)) return 'сегодня в ' + time;
    if (sameDay(dt, addDays(today, 1))) return 'завтра в ' + time;
    if (sameDay(dt, addDays(today, 2))) return 'послезавтра в ' + time;
    return dt.getDate() + ' ' + MONTHS[dt.getMonth()] + ' в ' + time;
  }

  // ---- список напоминаний (Reminders.kt): запись {id, text, at, byVoice, done} ----
  function normalizeReminders(raw) {
    return (Array.isArray(raw) ? raw : []).map(function (o) {
      if (!o || typeof o !== 'object' || typeof o.at !== 'number' || !isFinite(o.at)) return null;
      var text = typeof o.text === 'string' ? o.text : '';
      if (!text.trim()) return null;
      return { id: String(o.id == null ? '' : o.id), text: text, at: o.at, byVoice: o.byVoice === true, done: o.done === true };
    }).filter(Boolean).sort(function (a, b) { return a.at - b.at; });
  }
  function upcoming(items, now) { return items.filter(function (r) { return !r.done && r.at >= now - 60000; }); }
  function past(items, now) { return items.filter(function (r) { return r.done || r.at < now - 60000; }).reverse(); }
  // Пора показать: не отмечено выполненным и время наступило (как rescheduleAll: пропущенные показываем сразу).
  function due(items, now) { return items.filter(function (r) { return !r.done && r.at <= now; }); }
  // Фраза для чтения вслух: список ближайших напоминаний.
  function readAloudReminders(items, now) {
    var up = upcoming(items, now);
    if (!up.length) return 'Напоминаний пока нет.';
    var shown = up.slice(0, 5);
    var body = shown.map(function (r) { return describe(r.at, now) + ': ' + trimEndChars(r.text, '.!') + '.'; }).join(' ');
    var more = up.length > shown.length ? ' И ещё ' + (up.length - shown.length) + '.' : '';
    return 'Вот что я напомню. ' + body + more;
  }

  // ====================================================================== Шпаргалки (Cheatsheets.kt, AlertDetector.normalize)
  function normalize(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/ё/g, 'е').replace(/[^а-яa-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function cheatsBySubject(sheets, subject) {
    return (!subject || subject === 'Все') ? sheets : sheets.filter(function (s) { return s.subject === subject; });
  }
  function cheatsSearch(sheets, query, subject) {
    var q = normalize(query);
    var base = cheatsBySubject(sheets, subject);
    if (!q) return base;
    return base.filter(function (s) { return normalize(s.title + ' ' + s.text).indexOf(q) >= 0; });
  }
  // Один лист А4: несколько шпаргалок подряд, текст для PDF и Word.
  function cheatsToDocumentText(sheets) {
    return sheets.map(function (s) { return s.title + ' (' + s.subject + ')\n' + s.text; }).join('\n\n');
  }

  // ====================================================================== Справочник (AppGuide.kt)
  function gnorm(s) { return String(s == null ? '' : s).toLowerCase().replace(/ё/g, 'е'); }
  function tokens(s) { return gnorm(s).split(/[^\p{L}\p{N}]+/u).filter(function (w) { return w.length >= 2; }); }

  // Сопоставление по началу слова (устойчиво к падежам): чем больше совпадений в заголовке и ключевых словах, тем выше.
  function guideSearch(topics, query) {
    var q = tokens(query);
    if (!q.length) return topics;
    var scored = [];
    topics.forEach(function (t) {
      var title = tokens(t.title);
      var keys = [];
      (t.keywords || []).forEach(function (k) { keys = keys.concat(tokens(k)); });
      var body = tokens(t.summary + ' ' + (t.steps || []).join(' '));
      var score = 0;
      q.forEach(function (w) {
        var stem = w.length > 4 ? w.slice(0, -1) : w;
        if (title.some(function (x) { return x.indexOf(stem) === 0; })) score += 5;
        if (keys.some(function (x) { return x.indexOf(stem) === 0; })) score += 3;
        if (body.some(function (x) { return x.indexOf(stem) === 0; })) score += 1;
      });
      if (score > 0) scored.push({ t: t, s: score });
    });
    return scored.sort(function (a, b) { return b.s - a.s; }).map(function (x) { return x.t; });   // сортировка устойчивая, как sortedByDescending
  }

  // Темы, которые имеют смысл только на телефоне.
  var PHONE_ONLY = { ar: 1, friend: 1, power: 1, quickar: 1, location: 1 };
  // Куда вести кнопку «Открыть раздел» на сайте вместо телефонного маршрута.
  var ROUTE_MAP = { friend: 'tutor' };
  // hasSection(key): есть ли такой раздел на сайте и открыт ли он. Возвращает ключ раздела или null (кнопку прячем).
  function webRoute(topic, hasSection) {
    if (!topic || !topic.route) return null;
    var key = ROUTE_MAP[topic.id] || (PHONE_ONLY[topic.id] ? null : topic.route);
    return key && hasSection(key) ? key : null;
  }
  // Системная подсказка для вопросов о приложении (Prompts.appHelp); base — не нужен, текст как в Prompts.kt.
  function appHelpPrompt(knowledge) {
    return 'Ты помощник по работе с приложением «Помощник школьника». Отвечай коротко и по шагам, простыми словами, ' +
      'для школьника. Опирайся только на справку ниже. Если в справке ответа нет, честно скажи, что не знаешь, ' +
      'и предложи спросить у родителя. Не выдумывай кнопки и разделы.\n\nСПРАВКА:\n' + knowledge;
  }

  // ====================================================================== Таймер (по меткам времени, без накопления погрешности)
  // Состояние: {mode:'study'|'rest', minutes, running, endAt, remainingMs}
  function timerRemaining(st, now) { return st.running ? Math.max(0, st.endAt - now) : st.remainingMs; }
  function timerStart(st, now) {
    if (st.running || st.remainingMs <= 0) return st;
    return Object.assign({}, st, { running: true, endAt: now + st.remainingMs });
  }
  function timerPause(st, now) {
    if (!st.running) return st;
    return Object.assign({}, st, { running: false, remainingMs: Math.max(0, st.endAt - now), endAt: 0 });
  }
  function timerReset(st, minutes, mode) {
    var m = minutes == null ? st.minutes : minutes;
    return { mode: mode || st.mode || 'study', minutes: m, running: false, endAt: 0, remainingMs: m * 60000 };
  }
  function timerFinished(st, now) { return !!st.running && now >= st.endAt; }
  function clock(ms) {
    var sec = Math.max(0, Math.ceil(ms / 1000));
    return ('0' + Math.floor(sec / 60)).slice(-2) + ':' + ('0' + (sec % 60)).slice(-2);
  }
  // Подпись для даты в списке заметок.
  function addMinutes(map, date, minutes) {
    var out = Object.assign({}, map);
    out[date] = (out[date] || 0) + minutes;
    return out;
  }

  var api = {
    NoteCommand: { parse: parseNote },
    NoteFormat: { readAloud: readAloudNotes },
    sortNotes: sortNotes,
    ReminderParser: { parse: parseReminder, describe: describe },
    Reminders: { normalize: normalizeReminders, upcoming: upcoming, past: past, due: due, readAloud: readAloudReminders },
    normalize: normalize,
    Cheatsheets: { bySubject: cheatsBySubject, search: cheatsSearch, toDocumentText: cheatsToDocumentText },
    AppGuide: { search: guideSearch, tokens: tokens, webRoute: webRoute, PHONE_ONLY: PHONE_ONLY, ROUTE_MAP: ROUTE_MAP, helpPrompt: appHelpPrompt },
    Timer: { remaining: timerRemaining, start: timerStart, pause: timerPause, reset: timerReset, finished: timerFinished, clock: clock, addMinutes: addMinutes },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Kid_memo = api;
})(typeof window !== 'undefined' ? window : globalThis);
