// Чистая логика разделов «Чтение», «Историческая справка», «Что задано», «Спроси друга», «AR-линза» (без DOM, проверяется в Node).
// Порт Kotlin: ReaderLogic, WikiParser, NetAdvice, AssignedParser, ArParser, AlertDetector, CodeInfo, ReadingList и нужных Prompts.
// Формат как в sync.js: module.exports или window.Kid_world
(function (root) {
  var api = {};

  // ---------- общие мелочи ----------
  function extractJson(raw) {
    raw = String(raw || '');
    var s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s < 0 || e <= s) return null;
    return raw.slice(s, e + 1);
  }
  function parseOrNull(t) { try { return JSON.parse(t); } catch (e) { return null; } }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function obj(v) { return isObj(v) ? v : null; }
  function arr(v) { return Array.isArray(v) ? v : null; }
  // как MiniJson.str: строки, числа и логические значения превращаются в текст
  function str(v) { return (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') ? String(v) : null; }
  function trimStr(v) { var s = str(v); return s == null ? '' : s.trim(); }
  api.extractJson = extractJson;

  // ---------- Prompts.kt (только нужные разделам) ----------
  function who(grade) {
    var g = String(grade || '').replace(/\D/g, '');
    return g ? 'ученика ' + g + ' класса' : 'школьника';
  }
  function base(grade) {
    return 'Ты помощник ' + who(grade) + '. Отвечай по-русски, простыми словами, дружелюбно, коротко и по делу. ' +
      'Не используй markdown: никаких #, *, **, обратных кавычек и таблиц, пиши обычным текстом. ' +
      'Формулы пиши в одну строку, используя знаки −, ·, : и степени ², ³. ' +
      'Ничего не выдумывай: если не уверен в факте, так и скажи. Если не хватает данных, попроси их.';
  }
  var MARKER = '[ALERT]';
  var Prompts = {
    base: base,
    friend: function (grade, childMode) {
      return 'Ты Друг: добрый, умный и весёлый собеседник для ' + who(grade) + '. Знаешь много обо всём: уроки, природа, техника, ' +
        'как что устроено и как что сделать. Твой ответ будет прочитан вслух, поэтому говори разговорно, 1–4 коротких ' +
        'предложения, без списков, markdown, эмодзи и сложных символов. Объясняй простыми словами по возрасту. ' +
        'Ничего не выдумывай: если не знаешь или это могло измениться (погода, новости, расписания, цены), честно скажи, что не знаешь. ' +
        (childMode ? 'Детский режим: простые слова, никаких взрослых тем, опасное и вредное мягко переводи на безопасное. ' : '') +
        'Если ребёнок говорит, что ему очень плохо, он в опасности, ему причиняют вред или он думает навредить себе, ' +
        'начни ответ с метки ' + MARKER + ', затем тепло и спокойно скажи, что ты рядом и сообщишь родителям, чтобы они были рядом, ' +
        'и предложи поговорить со взрослым; можно назвать детский телефон доверия 8-800-2000-122. Не ставь диагнозов и не изображай психолога. ' +
        'Обычные огорчения (двойка, ссора, скучно) метки не требуют: просто поддержи и помоги.';
    },
    photoOcr: function () {
      return 'Перепиши текст задания с фото точно, ничего не решай. Условие, номера и данные сохрани, формулы пиши в одну строку. ' +
        'Если часть неразборчива, поставь [?]. Выводи только текст задания.';
    },
    arLens: function (mode, grade) {
      var task;
      if (mode === 'Тетрадь') {
        task = 'Это тетрадь ученика с решением. Отметь только строки с ошибкой: kind: error, label: что не так (кратко), detail: как правильно. Верные строки не отмечай. Если ошибок нет, notes пустой, а в summary напиши, что всё верно. Перепроверь арифметику сам.';
      } else if (mode === 'Задание') {
        task = 'На фото задания из учебника или тетради. Для каждого задания или примера: label: краткий ответ, detail: решение по шагам коротко, kind: answer. Если задание неразборчиво, kind: info и объясни в detail.';
      } else {
        task = 'Проведи полный разбор того, что в кадре. Определи и подпиши по отдельности: ' +
          'здания и сооружения (kind: place; тип, назначение, стиль и этажность; название и город называй только если уверен, иначе напиши «похоже на» или опиши без названия), ' +
          'достопримечательности, транспорт, предметы и приборы (kind: info; что это, из чего, зачем), растения и животные (вид, если уверен), ' +
          'любой текст, вывески и таблички (kind: text; прочитай дословно и переведи, если язык не русский), ' +
          'формулы, схемы, чертежи и задачи (kind: answer; реши и объясни). ' +
          'Людей по лицу не определяй: просто пиши «человек» и что он делает. ' +
          'summary: подробное описание сцены на 3–6 предложений: где это похоже на то, что происходит, что главное в кадре. ' +
          'detail каждой подписи: 2–4 предложения с интересными и полезными фактами для школьника. Ничего не выдумывай: если не уверен, так и скажи.';
      }
      return base(grade) + ' Ты смотришь на фото с камеры. ' + task + ' ' +
        'QR-коды и штрихкоды приложение считывает само, не подписывай их, но используй в описании. ' +
        'Верни ТОЛЬКО JSON: {"summary":"описание","notes":[{"box":[x,y,w,h],"label":"","detail":"","kind":"answer|info|error|place|text"}]}. ' +
        'box: рамка вокруг объекта в долях изображения от 0 до 1: x и y левый верхний угол, w и h ширина и высота. Не больше 10 подписей.';
    },
    // textbooks: { 'Математика': 'Виленкин', ... }
    assigned: function (grade, textbooks) {
      var keys = Object.keys(textbooks || {});
      var known = keys.length === 0 ? 'Список учебников ученика пуст.' :
        'Учебники ученика: ' + keys.map(function (k) { return k + ' — ' + textbooks[k]; }).join('; ') + '.';
      return base(grade) + ' Тебе дают фото или текст записи о домашнем задании. Определи, по каким предметам что задано. ' +
        'Для каждого задания: subject: школьный предмет (Математика, Алгебра, Геометрия, Физика, Химия, Русский язык, Литература, История, Биология, География, Английский, Информатика, другой), ' +
        'task: что сделать, коротко, pages: страница, параграф и номера упражнений, если указаны, ' +
        'material: название учебника или учебного материала: автор и название, если видны на фото или в записи; иначе возьми из списка учебников ученика для этого предмета; ' +
        'если нигде не указан, оставь пустую строку и НЕ придумывай. source: photo, если учебник виден на фото или в записи, list, если взят из списка, none, если нет. ' +
        known + ' Верни ТОЛЬКО JSON: {"items":[{"subject":"","task":"","pages":"","material":"","source":"photo|list|none"}]}. ' +
        'Если предмет не назван, определи по содержанию, но не угадывай учебник.';
    },
    readingAdvice: function (grade, interests, alreadyRead) {
      alreadyRead = alreadyRead || [];
      return base(grade) + ' Посоветуй 5 настоящих книг для чтения, подходящих по возрасту и интересам ученика. ' +
        'Интересы: ' + (String(interests || '').trim() || 'не указаны') + '. ' +
        (alreadyRead.length === 0 ? '' : 'Уже прочитано, не повторяй: ' + alreadyRead.slice(0, 30).join('; ') + '. ') +
        'Называй только книги, которые точно существуют: автор и название. Для каждой одна фраза, чем она увлекательна. ' +
        'Формат строки: Автор — Название: почему стоит прочитать. Без нумерации и без markdown.';
    },
    readerExplain: function (grade) {
      return base(grade) + ' Тебе дают страницу из книги. Коротко объясни, о чём она, в 3–5 предложениях, затем перечисли трудные или устаревшие слова с простым значением (до 5). ' +
        'Опирайся только на этот текст, ничего не придумывай.';
    }
  };
  Prompts.historySimplify = function (grade) {
    return base(grade) + ' Тебе дают текст справки из Википедии. Перескажи главное простыми словами для школьника в 5–8 предложениях: ' +
      'что это, когда и зачем появилось, чем известно. Используй ТОЛЬКО этот текст, ничего не добавляй от себя. Если чего-то в тексте нет, так и скажи.';
  };
  api.Prompts = Prompts;

  // ---------- ReadingList ----------
  function bookKey(b) { return b.author + ' — ' + b.title; }
  function gradeNumber(grade) {
    var m = /^\d+/.exec(String(grade == null ? '' : grade).trim());
    if (!m) return null;
    var n = parseInt(m[0], 10);
    return n >= 1 && n <= 11 ? n : null;
  }
  function forGrade(data, g) {
    g = Math.min(11, Math.max(1, g | 0));
    return (data && data[String(g)]) || [];
  }
  api.ReadingList = { key: bookKey, gradeNumber: gradeNumber, forGrade: forGrade };

  // ---------- ReaderLogic ----------
  var WS_HOST = 'https://ru.wikisource.org/w/api.php';
  function enc(s) { return encodeURIComponent(s); }
  var ReaderLogic = {
    // origin=* нужен браузеру для CORS у MediaWiki API
    searchUrl: function (query) {
      return WS_HOST + '?action=query&format=json&origin=*&list=search&srsearch=' + enc(String(query).trim()) + '&srnamespace=0&srlimit=10';
    },
    textUrl: function (title) {
      return WS_HOST + '?action=query&format=json&origin=*&prop=extracts&explaintext=1&exsectionformat=plain&redirects=1&titles=' + enc(title);
    },
    linksUrl: function (title) {
      return WS_HOST + '?action=query&format=json&origin=*&prop=links&pllimit=120&plnamespace=0&redirects=1&titles=' + enc(title);
    },
    stripTags: function (s) {
      return String(s).replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    },
    parseSearch: function (json) {
      var root = obj(parseOrNull(json));
      if (!root) return [];
      var q = obj(root.query), list = q && arr(q.search);
      if (!list) return [];
      var out = [];
      list.forEach(function (v) {
        var o = obj(v); if (!o) return;
        var title = trimStr(o.title);
        if (!title) return;
        out.push({ title: title, snippet: ReaderLogic.stripTags(str(o.snippet) || '') });
      });
      return out;
    },
    firstPage: function (json) {
      var root = obj(parseOrNull(json)); if (!root) return null;
      var q = obj(root.query), pages = q && obj(q.pages); if (!pages) return null;
      var keys = Object.keys(pages);
      for (var i = 0; i < keys.length; i++) { var o = obj(pages[keys[i]]); if (o) return o; }
      return null;
    },
    // полный текст страницы {title, text} или null, если страницы нет
    parseText: function (json) {
      var p = ReaderLogic.firstPage(json); if (!p) return null;
      var text = trimStr(p.extract);
      if (!text) return null;
      return { title: str(p.title) || '', text: text };
    },
    parseLinks: function (json) {
      var p = ReaderLogic.firstPage(json); if (!p) return [];
      var links = arr(p.links); if (!links) return [];
      var out = [];
      links.forEach(function (l) { var o = obj(l), t = o && str(o.title); if (t && t.trim()) out.push(t); });
      return out;
    },
    looksLikeToc: function (text, links) { return text.length < 1500 && links.length >= 3; },
    paginate: function (text, size) {
      size = size || 1800;
      var clean = String(text).replace(/\r/g, '').trim();
      if (!clean) return [];
      var out = [], rest = clean;
      while (rest.length > size) {
        var win = rest.substring(0, size);
        var cut = win.lastIndexOf('\n\n');
        if (cut < size / 2) cut = win.lastIndexOf('\n');
        if (cut < size / 2) {
          var m = Math.max(win.lastIndexOf('. '), win.lastIndexOf('! '), win.lastIndexOf('? '));
          cut = m >= 0 ? m + 1 : m;
        }
        if (cut < size / 2) cut = win.lastIndexOf(' ');
        if (cut <= 0) cut = size;
        out.push(rest.substring(0, cut).trim());
        rest = rest.substring(cut).trim();
      }
      if (rest.length) out.push(rest);
      return out;
    },
    clampPage: function (index, pages) { return pages <= 0 ? 0 : Math.min(Math.max(index, 0), pages - 1); },
  };
  api.ReaderLogic = ReaderLogic;

  // ---------- WikiParser ----------
  var WikiParser = {
    // query.pages с extract и fullurl, по порядку релевантности (index)
    parse: function (json) {
      var root = obj(parseOrNull(json)); if (!root) return [];
      var q = obj(root.query), pages = q && obj(q.pages); if (!pages) return [];
      var rows = [];
      Object.keys(pages).forEach(function (k) {
        var o = obj(pages[k]); if (!o) return;
        var title = trimStr(o.title), text = trimStr(o.extract);
        if (!title || !text) return;
        var idx = parseFloat(str(o.index));
        rows.push({ idx: isNaN(idx) ? 999 : idx, title: title, extract: text, url: str(o.fullurl) || '' });
      });
      rows.sort(function (a, b) { return a.idx - b.idx; });   // сортировка устойчива: при равенстве порядок сохраняется
      return rows.map(function (r) { return { title: r.title, extract: r.extract, url: r.url }; });
    },
    searchUrl: function (query, lang) {
      return 'https://' + (lang || 'ru') + '.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=' + enc(String(query).trim()) +
        '&gsrlimit=3&prop=extracts%7Cinfo&exintro=1&explaintext=1&exchars=1200&inprop=url&redirects=1';
    },
  };
  api.WikiParser = WikiParser;

  // ---------- NetAdvice ----------
  var NetAdvice = {
    classify: function (httpStatus, networkError) {
      if (networkError) return 'UNREACHABLE';
      if (httpStatus === 403 || httpStatus === 451 || httpStatus === 429) return 'BLOCKED';
      return 'OTHER';
    },
    advice: function (failure, hasInternet, vpnActive) {
      if (!hasInternet) return 'Нет подключения к интернету. Включи Wi-Fi или мобильные данные и повтори.';
      if (failure === 'UNREACHABLE' || failure === 'BLOCKED') {
        return vpnActive ? 'Сейчас включён VPN, и он может мешать загрузке. Выключи VPN и повтори.'
          : 'Этот сайт может не открываться без VPN. Попроси родителя включить VPN и повтори.';
      }
      return null;
    },
    idleVpnNote: function (vpnActive) { return vpnActive ? 'VPN включён. Если страницы грузятся без проблем, его можно выключить.' : null; },
    // ошибка fetch: объект с полем status (HTTP) или сетевая ошибка (TypeError, тайм-аут, обрыв)
    // Браузер не видит VPN, поэтому vpnActive всегда false; онлайн-статус берём из navigator.onLine
    adviceFor: function (err, online) {
      var http = err && typeof err.status === 'number' ? err.status : null;
      var net = !!(err && !http);
      return NetAdvice.advice(NetAdvice.classify(http, net), online !== false, false);
    },
  };
  api.NetAdvice = NetAdvice;

  // ---------- AssignedParser ----------
  var AssignedParser = {
    parse: function (raw) {
      var json = extractJson(raw); if (!json) return null;
      var root = obj(parseOrNull(json)); if (!root) return null;
      var items = arr(root.items); if (!items) return null;
      var out = [];
      items.forEach(function (it) {
        var o = obj(it); if (!o) return;
        var subject = trimStr(o.subject), task = trimStr(o.task);
        if (!subject && !task) return;
        var src = (str(o.source) || '').toLowerCase().trim();
        out.push({ subject: subject || 'Предмет не определён', task: task, pages: trimStr(o.pages), material: trimStr(o.material), fromPhoto: src === 'photo' || src === 'фото' });
      });
      return out.length ? out : null;
    },
    // один предмет, несколько заданий; порядок появления сохраняется. Возвращает [{subject, items}]
    groupBySubject: function (items) {
      var idx = {}, out = [];
      items.forEach(function (it) {
        var k = it.subject.trim().toLowerCase();
        if (!(k in idx)) { idx[k] = out.length; out.push({ subject: it.subject, items: [] }); }
        out[idx[k]].items.push(it);
      });
      return out;
    },
  };
  api.AssignedParser = AssignedParser;

  // ---------- ArParser ----------
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (typeof v === 'string') {
      var t = v.trim().replace(',', '.');
      if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return null;
      return parseFloat(t);
    }
    return null;
  }
  function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }
  var ArParser = {
    parse: function (raw) {
      var json = extractJson(raw); if (!json) return null;
      var root = obj(parseOrNull(json)); if (!root) return null;
      var items = arr(root.notes); if (!items) return null;
      var notes = [];
      items.forEach(function (item) {
        var o = obj(item); if (!o) return;
        var label = trimStr(o.label).slice(0, 70), detail = trimStr(o.detail);
        if (!label && !detail) return;
        var k0 = (str(o.kind) || '').toLowerCase().trim(), kind;
        if (k0 === 'error' || k0 === 'wrong') kind = 'error';
        else if (k0 === 'answer' || k0 === 'ok') kind = 'answer';
        else if (k0 === 'building' || k0 === 'place' || k0 === 'landmark') kind = 'place';
        else if (k0 === 'code' || k0 === 'qr' || k0 === 'barcode') kind = 'code';
        else if (k0 === 'text' || k0 === 'formula') kind = 'text';
        else kind = 'info';
        var b = arr(o.box), x = 0, y = 0, w = 0, h = 0, has = false;
        if (b) b = b.map(num);
        if (b && b.length === 4 && b.every(function (n) { return n != null; })) {
          // ИИ иногда отдаёт проценты (0..100) вместо долей
          var k = b.some(function (n) { return n > 1.5; }) ? 100 : 1;
          x = clamp(b[0] / k, 0, 0.98);
          y = clamp(b[1] / k, 0, 0.98);
          w = clamp(b[2] / k, 0, 1 - x);
          h = clamp(b[3] / k, 0, 1 - y);
          has = w >= 0.02 && h >= 0.02;
        }
        notes.push({ x: has ? x : 0, y: has ? y : 0, w: has ? w : 0, h: has ? h : 0, label: label || detail.slice(0, 40), detail: detail, kind: kind, hasBox: has });
      });
      notes = notes.slice(0, 14);
      if (!notes.length && !trimStr(root.summary)) return null;
      return { summary: trimStr(root.summary), notes: notes };
    },
  };
  api.ArParser = ArParser;

  // ---------- AlertDetector ----------
  var STRONG = [
    'не хочу жить', 'хочу умереть', 'лучше бы меня не было', 'покончить с собой', 'убить себя',
    'хочу себе навредить', 'причинить себе боль', 'режу себя', 'меня бьют', 'меня обижают дома',
    'мне очень плохо', 'мне ужасно плохо', 'мне страшно жить', 'никто меня не любит', 'я никому не нужен',
    'я никому не нужна', 'мне больно и страшно', 'меня кто-то преследует', 'меня трогают', 'мне угрожают',
  ];
  var AlertDetector = {
    MARKER: MARKER,
    HELPLINE: '8-800-2000-122',
    normalize: function (s) { return String(s).toLowerCase().replace(/ё/g, 'е').replace(/[^а-яa-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); },
    userMessageNeedsAlert: function (text) {
      var t = AlertDetector.normalize(text);
      return STRONG.some(function (p) { return t.indexOf(AlertDetector.normalize(p)) >= 0; });
    },
    // { text: текст для ребёнка, had: была ли метка }
    stripMarker: function (reply) {
      reply = String(reply);
      var had = reply.toLowerCase().indexOf(MARKER.toLowerCase()) >= 0;
      return { text: reply.replace(/\[ALERT]/gi, '').trim(), had: had };
    },
    shouldSend: function (lastSentAt, now, minIntervalMs) {
      minIntervalMs = minIntervalMs == null ? 30 * 60 * 1000 : minIntervalMs;
      return lastSentAt <= 0 || now - lastSentAt >= minIntervalMs;
    },
    // Запись для журнала на компьютере: только дата и время, текста разговора нет
    record: function (nowMs, isoDay, source) { return { at: nowMs, date: isoDay, source: source || 'friend', notified: false }; },
  };
  api.AlertDetector = AlertDetector;

  // ---------- CodeInfo ----------
  var SHORTENERS = ['bit.ly', 't.co', 'tinyurl.com', 'goo.gl', 'clck.ru', 'cutt.ly', 'is.gd', 'vk.cc', 'ow.ly', 'rb.gy'];
  function after(s, d, dflt) { var i = s.indexOf(d); return i < 0 ? dflt : s.substring(i + d.length); }
  function before(s, d) { var i = s.indexOf(d); return i < 0 ? s : s.substring(0, i); }
  function afterLast(s, d) { var i = s.lastIndexOf(d); return i < 0 ? s : s.substring(i + d.length); }
  function isIp(h) { return /^\d{1,3}(\.\d{1,3}){3}$/.test(h); }
  function gs1Country(code) {
    if (code.length !== 13) return null;
    var p3 = parseInt(code.slice(0, 3), 10), p2 = parseInt(code.slice(0, 2), 10);
    if (isNaN(p3) || isNaN(p2) || !/^\d+$/.test(code.slice(0, 3))) return null;
    if (p3 >= 978 && p3 <= 979) return 'книга (ISBN)';
    if (p3 >= 460 && p3 <= 469) return 'Россия';
    if (p3 >= 400 && p3 <= 440) return 'Германия';
    if ((p3 >= 450 && p3 <= 459) || (p3 >= 490 && p3 <= 499)) return 'Япония';
    if (p3 >= 690 && p3 <= 699) return 'Китай';
    if (p3 >= 300 && p3 <= 379) return 'Франция';
    if (p3 === 750) return 'Мексика';
    if (p2 >= 0 && p2 <= 13) return 'США или Канада';
    if (p3 >= 500 && p3 <= 509) return 'Великобритания';
    if (p3 >= 800 && p3 <= 839) return 'Италия';
    if (p3 >= 840 && p3 <= 849) return 'Испания';
    if (p3 === 481) return 'Беларусь';
    if (p3 === 482) return 'Украина';
    if (p3 === 487) return 'Казахстан';
    return null;
  }
  var CodeInfo = {
    host: function (url) {
      var rest = after(url, '://', url);
      rest = before(before(before(rest, '/'), '?'), '#');
      return before(afterLast(rest, '@'), ':').toLowerCase();
    },
    urlWarnings: function (url) {
      var out = [], h = CodeInfo.host(url);
      if (/^http:\/\//i.test(url)) out.push('Ссылка без защиты (http).');
      if (isIp(h)) out.push('Вместо названия сайта стоят цифры.');
      if (SHORTENERS.indexOf(h) >= 0) out.push('Сокращённая ссылка: не видно, куда она ведёт.');
      if (h.indexOf('xn--') >= 0) out.push('Адрес с необычными буквами, похож на подделку.');
      return out;
    },
    // c = { format, text }; возвращает { label, detail }
    describe: function (c) {
      var t = String(c.text == null ? '' : c.text).trim(), fmt = String(c.format || '');
      var up = fmt.toUpperCase();
      var isQr = up.indexOf('QR') >= 0 || up.indexOf('MATRIX') >= 0 || up.indexOf('AZTEC') >= 0 || up.indexOf('PDF') >= 0;
      if (!isQr && /^\d*$/.test(t)) {
        var country = gs1Country(t);
        var kind = country === 'книга (ISBN)' ? 'Штрихкод книги' : 'Штрихкод товара';
        var extra = country ? (country === 'книга (ISBN)' ? ' Это номер книги (ISBN).' : ' Страна по коду: ' + country + '. Это страна регистрации номера, а не обязательно производства.') : '';
        return { label: kind, detail: 'Номер: ' + t + ' (' + fmt + ').' + extra + ' Название и цену по штрихкоду приложение не знает: смотри на упаковку.' };
      }
      var lower = t.toLowerCase();
      if (lower.indexOf('http://') === 0 || lower.indexOf('https://') === 0) {
        var w = CodeInfo.urlWarnings(t);
        return { label: 'QR: ссылка на ' + CodeInfo.host(t), detail: 'Адрес: ' + t + '. Не открывай ссылку, если не знаешь, откуда код. Сначала покажи родителю.' + (w.length ? ' Осторожно: ' + w.join(' ') : '') };
      }
      if (/^wifi:/i.test(t)) {
        var m = /S:((?:\\.|[^;])*)/.exec(t), ssid = m ? m[1] : '';
        return { label: 'QR: доступ к Wi-Fi', detail: 'Сеть: ' + (ssid.trim() ? ssid : 'не указана') + '. В коде есть пароль сети. Подключайся только к сетям, которые разрешил родитель.' };
      }
      if (lower.indexOf('tel:') === 0) return { label: 'QR: номер телефона', detail: 'Номер: ' + t.substring(4) + '. Звонить незнакомым не нужно.' };
      if (lower.indexOf('mailto:') === 0) return { label: 'QR: электронная почта', detail: 'Адрес: ' + before(t.substring(7), '?') + '.' };
      if (lower.indexOf('smsto:') === 0 || lower.indexOf('sms:') === 0) {
        return { label: 'QR: SMS', detail: 'Код готовит сообщение на номер ' + before(after(t, ':', t), ':') + '. Отправка может быть платной, спроси родителя.' };
      }
      if (lower.indexOf('geo:') === 0) return { label: 'QR: место на карте', detail: 'Координаты: ' + before(t.substring(4), '?') + '.' };
      if (/^begin:vcard/i.test(t)) {
        var f = /FN:(.*)/.exec(t), name = f ? f[1].trim() : '';
        return { label: 'QR: визитка', detail: 'Контакт: ' + (name || 'без имени') + '.' };
      }
      return { label: (isQr ? 'QR' : 'Код') + ': текст', detail: 'Внутри написано: ' + t.slice(0, 300) };
    },
    // Рамка кода в долях кадра (как QrScan.scan). pts: [{x,y}], w и h: размер кадра в пикселях
    boxFromPoints: function (pts, w, h) {
      if (!pts || !pts.length) return { x: 0, y: 0, w: 0, h: 0 };
      var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
      var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
      var padX = Math.max((maxX - minX) * 0.15, w * 0.03), padY = Math.max((maxY - minY) * 0.15, h * 0.03);
      var x = clamp((minX - padX) / w, 0, 0.98), y = clamp((minY - padY) / h, 0, 0.98);
      var bw = clamp((maxX + padX) / w - x, 0, 1 - x), bh = clamp((maxY + padY) / h - y, 0, 1 - y);
      return { x: x, y: y, w: bw, h: bh };
    },
    toNotes: function (codes) {
      return codes.map(function (c) {
        var d = CodeInfo.describe(c), has = (c.w || 0) >= 0.02 && (c.h || 0) >= 0.02;
        return { x: c.x || 0, y: c.y || 0, w: c.w || 0, h: c.h || 0, label: d.label, detail: d.detail, kind: 'code', hasBox: has };
      });
    },
  };
  api.CodeInfo = CodeInfo;

  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Kid_world = api;
})(typeof window !== 'undefined' ? window : globalThis);
