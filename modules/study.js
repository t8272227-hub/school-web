// Разделы: «ДЗ» (hw), «Реферат» (essay), «К контрольной» (exam), «Конспект параграфа» (notes), «Слова и диктант» (words).
// Порт HomeworkScreen (Screens1.kt), EssayScreen (Screens3.kt), ExamScreen / WordsScreen / NotesScreen (Screens4.kt).
(function () {
  'use strict';
  var Kid = window.Kid, L = window.Kid_study, C = window.KidCheck, esc = Kid.esc;
  var SUBJ = Kid.SUBJECTS;

  // ---------- немного стилей ----------
  var css = document.createElement('style');
  css.textContent = '.st-big{min-height:260px}.st-fig{margin:10px 0}.st-fig svg{max-width:100%;height:auto;border:1px solid var(--line);border-radius:12px;background:#fff}' +
    '.st-mono{font-family:ui-monospace,Consolas,monospace;font-size:15px}.st-thumb{max-height:96px;max-width:100%;border-radius:10px;margin-top:8px;display:block}' +
    '.st-front{font-size:28px;font-weight:700}.st-back{font-size:22px;color:var(--v);margin-top:8px}.st-num{margin:2px 0}';
  document.head.appendChild(css);

  // ---------- общие кирпичики ----------
  function ta(bind, value, label, cls) { return (label ? '<label>' + esc(label) + '</label>' : '') + '<textarea' + (cls ? ' class="' + cls + '"' : '') + ' data-bind="' + bind + '">' + esc(value) + '</textarea>'; }
  function dis(m) { return m.busy ? ' disabled' : ''; }
  function btn(act, label, kind, v, extra) { return '<button class="b' + (kind ? ' ' + kind : '') + '" data-act="' + act + '"' + (v != null ? ' data-v="' + esc(v) + '"' : '') + (extra || '') + '>' + esc(label) + '</button>'; }
  function infoLine(t) { return t ? '<p class="okt">' + esc(t) + '</p>' : ''; }

  // Запуск ИИ с учётом занятости и ошибок. После успеха: учёт дня и синхронизация (как Ai.ask на телефоне).
  function run(m, system, text, o, onOk) {
    if (m.busy) return undefined;
    o = o || {};
    m.busy = true; m.error = ''; Kid.render();
    return Kid.askAI(system, text, o.photo, o.max, o.temp).then(function (raw) {
      onOk(raw); Kid.touchToday(); Kid.syncSoon();
    }).catch(function (e) { m.error = (e && e.message) || 'Ошибка.'; }).then(function () { m.busy = false; });
  }

  // Ввод задания: текст, фото (сразу переписывается в текст через ИИ), галерея, голос. Стилуса в браузере нет.
  function taskInput(key, m, label, pre) {
    var h = ta(key + '.' + (pre.field), m[pre.field], label);
    h += '<div class="row"><div style="flex:1"><label>Фото</label><input type="file" accept="image/*" capture="environment" data-act="' + pre.photo + '"></div>' +
      '<div style="flex:1"><label>Из галереи</label><input type="file" accept="image/*" data-act="' + pre.photo + '"></div></div>';
    if (Kid.canListen()) h += btn(pre.voice, m.listening ? 'Слушаю…' : 'Голос', 't');
    if (m.thumb) h += '<img class="st-thumb" src="' + m.thumb + '" alt="Фото задания">';
    if (m.ocr) h += Kid.busy('Читаю фото…');
    return h;
  }
  function photoAct(m, field) {
    return function (v, el) {
      var f = el.files && el.files[0]; if (!f) return undefined;
      m.error = '';
      return Kid.readPhoto(f).then(function (data) {
        m.thumb = data; m.ocr = true; Kid.render();
        return Kid.askAI(L.promptPhotoOcr(), 'Перепиши задание с фото.', data).then(function (t) {
          m[field] = (m[field] || '').trim() ? m[field].replace(/\s+$/, '') + '\n' + t : t;
          Kid.touchToday(); Kid.syncSoon();
        });
      }).catch(function (e) { m.error = (e && e.message) || 'Не получилось открыть картинку.'; }).then(function () { m.ocr = false; });
    };
  }
  function voiceAct(m, field) {
    return function () {
      if (m.listening) return;
      m.listening = true; m.error = '';
      Kid.listen(function (said) {
        if (said) m[field] = (m[field] || '').trim() ? m[field].replace(/\s+$/, '') + ' ' + said : said;
        Kid.render();
      }, function (msg) { m.listening = false; if (msg) m.error = msg; Kid.render(); });
    };
  }

  // Экспорт: Word (.doc) и печать/PDF. Содержимое собирается в момент нажатия функцией exporters[key]().
  var exporters = {}, expMsg = {};
  function exportBar(key) {
    return '<div class="row">' + btn('stExp', 'Word', 't', key + '|word') + btn('stExp', 'PDF / печать', 't', key + '|print') + '</div>' + (expMsg[key] ? '<p class="mut">' + esc(expMsg[key]) + '</p>' : '');
  }
  function svgToPng(svg) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onerror = function () { reject(new Error('svg')); };
      img.onload = function () {
        try {
          var cv = document.createElement('canvas'); cv.width = 1000; cv.height = Math.round(1000 * (img.height || 760) / (img.width || 1000));
          var g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL('image/png'));
        } catch (e) { reject(e); }
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  var expAct = function (v) {
    var p = String(v).split('|'), key = p[0], kind = p[1], ex = exporters[key] ? exporters[key]() : null;
    if (!ex) return undefined;
    var html = L.blocksToHtml(ex.blocks, esc);
    if (kind === 'print') {
      var svg = ex.svg ? '<div style="margin-top:12px">' + ex.svg.replace('class="fig"', 'class="fig" style="max-width:100%;height:auto"') + '</div>' : '';
      expMsg[key] = Kid.printHtml(ex.title, html + svg) ? 'Открыто окно печати: выбери принтер или «Сохранить как PDF».' : 'Браузер заблокировал окно печати. Разреши всплывающие окна для этой страницы.';
      return undefined;
    }
    function done() { expMsg[key] = 'Файл Word сохранён в папку загрузок.'; }
    if (ex.svg) return svgToPng(ex.svg).then(function (png) { Kid.saveWord(ex.title, html + '<p><img src="' + png + '" width="600"></p>'); done(); }, function () { Kid.saveWord(ex.title, html); done(); });
    Kid.saveWord(ex.title, html); done(); return undefined;
  };

  // ====================================================================== ДЗ
  var hw = Kid.mod('hw', { subject: 'Математика', task: '', result: '', kind: '', level: 'Как в учебнике', busy: false, error: '', info: '', showSaved: false, thumb: null, ocr: false, listening: false });
  function saved() { return Kid.store('homework', []); }

  function vHw() {
    var h = Kid.head('ДЗ', 'Оформим как в тетради'), list = saved();
    h += '<div class="card"><label>Предмет</label>' + Kid.chips(SUBJ, hw.subject, 'stHwSubject') + taskInput('hw', hw, 'Задание', { field: 'task', photo: 'stHwPhoto', voice: 'stHwVoice' }) +
      '<div class="row">' + btn('stHwGo', 'Как в тетради', '', 'format', dis(hw)) + btn('stHwGo', 'По шагам', 't', 'steps', dis(hw)) + '</div>' +
      '<label>Пояснить</label>' + Kid.chips(L.LEVELS.map(function (l) { return l.label; }), hw.level, 'stHwLevel') +
      btn('stHwGo', 'Пояснить', 'o', 'explain', dis(hw)) + '</div>';
    if (hw.busy) h += Kid.busy('Думаю…');
    h += Kid.err(hw.error);
    if (hw.result.trim()) {
      if (hw.kind === 'steps') {
        L.splitSteps(hw.result).forEach(function (s, i) { h += '<div class="card"><label>Шаг ' + (i + 1) + '</label><pre>' + esc(s) + '</pre></div>'; });
      } else h += '<div class="card"><pre>' + esc(hw.result) + '</pre></div>';
      h += '<div class="row">' + btn('stHwSave', 'В мои ДЗ', 't') + btn('stHwNew', 'Новое', 'o') + '</div>' + infoLine(hw.info);
      h += exportBar('hw');
    }
    h += btn('stHwToggle', hw.showSaved ? 'Скрыть «Мои ДЗ»' : 'Мои ДЗ (' + list.length + ')', 'o');
    if (hw.showSaved) {
      if (!list.length) h += '<p class="mut">Пока ничего не сохранено.</p>';
      list.forEach(function (x) {
        h += '<div class="card"><b>' + esc(x.subject) + ', ' + esc(x.date) + '</b><div>' + esc(String(x.task).slice(0, 160)) + '</div>' +
          '<div class="row">' + btn('stHwOpen', 'Открыть', 't', x.id) + btn('stHwDel', 'Удалить', 'o', x.id) + '</div></div>';
      });
    }
    return h;
  }
  exporters.hw = function () { return { title: 'ДЗ: ' + hw.subject, blocks: L.hwBlocks(hw.subject, hw.task, hw.result) }; };

  Kid.register({ key: 'hw', title: 'ДЗ', subtitle: 'Оформим как в тетради', view: vHw, acts: {
    stHwSubject: function (v) { hw.subject = v; },
    stHwLevel: function (v) { hw.level = v; },
    stHwPhoto: photoAct(hw, 'task'),
    stHwVoice: voiceAct(hw, 'task'),
    stHwGo: function (k) {
      hw.info = '';
      if (!hw.task.trim()) { hw.error = 'Сначала введи задание.'; return undefined; }
      var hint = Kid.hintOnly(), grade = Kid.grade(), system;
      if (hint && k !== 'explain') system = C.help('hint', hw.subject, grade);
      else if (k === 'format') system = L.promptFormat(hw.subject, grade);
      else if (k === 'steps') system = L.promptSteps(hw.subject, grade);
      else system = L.promptExplain(hw.subject, grade, hw.level);
      if (hint && k !== 'explain') hw.info = 'Включён режим подсказок: готовое решение не показывается.';
      var task = hw.task;
      return run(hw, system, task, { max: 1800, temp: 0.3 }, function (raw) { hw.kind = hint ? 'explain' : k; hw.result = raw; });
    },
    stHwSave: function () {
      Kid.saveStore('homework', L.addHomework(saved(), hw.subject, hw.task, hw.result, Kid.newId(), Kid.today()));
      hw.info = 'Сохранено в «Мои ДЗ».';
    },
    stHwNew: function () { hw.task = ''; hw.result = ''; hw.kind = ''; hw.thumb = null; hw.info = ''; },
    stHwToggle: function () { hw.showSaved = !hw.showSaved; },
    stHwOpen: function (id) {
      var x = saved().filter(function (s) { return s.id === id; })[0]; if (!x) return;
      hw.subject = x.subject; hw.task = x.task; hw.result = x.result; hw.kind = 'format';
    },
    stHwDel: function (id) { Kid.saveStore('homework', L.deleteHomework(saved(), id)); },
    stExp: expAct,
  } });

  // ====================================================================== Реферат
  var es = Kid.mod('essay', { subject: 'История', topic: '', pages: '2 стр', plan: '', text: '', scheme: 'Без схемы', busy: false, error: '' });

  function vEssay() {
    var h = Kid.head('Реферат', 'Составлю план и текст');
    h += '<div class="card"><label>Предмет</label>' + Kid.chips(SUBJ, es.subject, 'stEsSubject') + Kid.input('essay.topic', es.topic, 'Тема реферата') +
      '<label>Объём</label>' + Kid.chips(['1 стр', '2 стр', '3 стр'], es.pages, 'stEsPages') + btn('stEsPlan', 'Составить план', 't', null, dis(es));
    if (es.plan.trim() || es.text.trim()) h += ta('essay.plan', es.plan, 'План (можно править)');
    if (es.plan.trim()) h += btn('stEsText', 'Написать реферат', '', null, dis(es));
    h += '</div>';
    if (es.busy) h += Kid.busy('Пишу…');
    h += Kid.err(es.error);
    if (es.text.trim()) {
      h += '<div class="card">' + ta('essay.text', es.text, 'Текст реферата (можно править)', 'st-big');
      var marks = L.schemeMarkers(es.text);
      if (marks.length) h += '<p class="mut">ИИ предложил схемы: ' + marks.map(esc).join('; ') + '. Выбери подходящую ниже, если она есть в списке.</p>';
      h += '<label>Схема в конце реферата</label>' + Kid.chips(L.SCHEMES, es.scheme, 'stEsScheme');
      var svg = L.schemeSvg(es.scheme);
      if (svg) h += '<div class="st-fig">' + svg + '</div>';
      h += exportBar('essay') + '</div>';
    }
    return h;
  }
  exporters.essay = function () {
    return { title: 'Реферат: ' + (es.topic.trim() || es.subject), blocks: L.essayBlocks(es.topic.trim() || es.subject, es.text), svg: L.schemeSvg(es.scheme) };
  };
  Kid.register({ key: 'essay', title: 'Реферат', subtitle: 'План, текст и схемы', view: vEssay, acts: {
    stEsSubject: function (v) { es.subject = v; },
    stEsPages: function (v) { es.pages = v; },
    stEsScheme: function (v) { es.scheme = v; },
    stEsPlan: function () {
      if (!es.topic.trim()) { es.error = 'Напиши тему.'; return undefined; }
      return run(es, L.promptEssayPlan(es.subject, Kid.grade()), 'Тема: ' + es.topic, {}, function (raw) { es.plan = raw; });
    },
    stEsText: function () {
      var pages = parseInt(es.pages.slice(0, 1), 10) || 2;
      return run(es, L.promptEssayText(es.subject, Kid.grade(), pages), 'Тема: ' + es.topic + '\nПлан:\n' + es.plan, { max: 4500, temp: 0.5 }, function (raw) { es.text = raw; });
    },
  } });

  // ====================================================================== К контрольной
  var ex = Kid.mod('exam', { subject: 'Математика', topic: '', days: '5 дней', plan: null, busy: false, error: '' });

  function vExam() {
    var h = Kid.head('К контрольной', 'План повторения по дням');
    h += '<div class="card"><label>Предмет</label>' + Kid.chips(SUBJ, ex.subject, 'stExSubject') + Kid.input('exam.topic', ex.topic, 'Тема контрольной') +
      '<label>Сколько дней осталось</label>' + Kid.chips(['2 дня', '3 дня', '5 дней', '7 дней'], ex.days, 'stExDays') + btn('stExGo', 'Составить план', '', null, dis(ex)) + '</div>';
    if (ex.busy) h += Kid.busy('Составляю план…');
    h += Kid.err(ex.error);
    var p = ex.plan;
    if (p) {
      p.days.forEach(function (d, i) {
        h += '<div class="card"><b style="color:var(--v)">' + esc(d.day || 'День ' + (i + 1)) + ' · ' + esc(d.minutes) + ' мин</b><pre>' + esc(d.task) + '</pre></div>';
      });
      if (p.cheat) h += '<div class="card tint"><label>Шпаргалка</label><pre class="st-mono">' + esc(p.cheat) + '</pre></div>';
      h += exportBar('exam');
    }
    return h;
  }
  exporters.exam = function () { return { title: 'К контрольной: ' + (ex.topic.trim() || ex.subject), blocks: L.examBlocks(ex.subject, ex.topic, ex.plan) }; };
  Kid.register({ key: 'exam', title: 'К контрольной', subtitle: 'План повторения по дням', view: vExam, acts: {
    stExSubject: function (v) { ex.subject = v; },
    stExDays: function (v) { ex.days = v; },
    stExGo: function () {
      if (!ex.topic.trim()) { ex.error = 'Напиши тему контрольной.'; return undefined; }
      return run(ex, L.promptExamPlan(ex.subject, Kid.grade()), 'Тема: ' + ex.topic + '. Дней до контрольной: ' + ex.days.replace(/\D.*$/, '') + '.', { max: 2200 }, function (raw) {
        var p = L.parseExamPlan(raw);
        if (!p) ex.error = 'Не получилось составить план, попробуй ещё раз.'; else ex.plan = p;
      });
    },
  } });

  // ====================================================================== Конспект параграфа
  var nt = Kid.mod('notes', { subject: 'История', text: '', result: null, busy: false, error: '', thumb: null, ocr: false, listening: false });

  function vNotes() {
    var h = Kid.head('Конспект параграфа', 'Кратко, термины и вопросы');
    h += '<div class="card"><label>Предмет</label>' + Kid.chips(SUBJ, nt.subject, 'stNtSubject') + taskInput('notes', nt, 'Текст параграфа (или фото страницы)', { field: 'text', photo: 'stNtPhoto', voice: 'stNtVoice' }) +
      btn('stNtGo', 'Сделать конспект', '', null, dis(nt)) + '</div>';
    if (nt.busy) h += Kid.busy('Делаю конспект…');
    h += Kid.err(nt.error);
    var r = nt.result;
    if (r) {
      h += '<div class="card tint"><label>Кратко</label><pre>' + esc(r.short) + '</pre></div>';
      if (r.plan.length) h += '<div class="card"><label>План</label>' + r.plan.map(function (p, i) { return '<div class="st-num">' + (i + 1) + '. ' + esc(p) + '</div>'; }).join('') + '</div>';
      if (r.terms.length) h += '<div class="card"><label>Термины</label>' + r.terms.map(function (t) { return '<div class="st-num"><b>' + esc(t.term) + '</b> — ' + esc(t.meaning) + '</div>'; }).join('') + '</div>';
      if (r.questions.length) h += '<div class="card tint"><label>Вопросы для самопроверки</label>' + r.questions.map(function (q, i) { return '<div class="st-num">' + (i + 1) + '. ' + esc(q) + '</div>'; }).join('') + '</div>';
      h += exportBar('notes');
    }
    return h;
  }
  exporters.notes = function () { return { title: 'Конспект: ' + nt.subject, blocks: L.notesBlocks(nt.result) }; };
  Kid.register({ key: 'notes', title: 'Конспект параграфа', subtitle: 'Кратко, термины и вопросы', view: vNotes, acts: {
    stNtSubject: function (v) { nt.subject = v; },
    stNtPhoto: photoAct(nt, 'text'),
    stNtVoice: voiceAct(nt, 'text'),
    stNtGo: function () {
      if (!nt.text.trim()) { nt.error = 'Добавь текст параграфа.'; return undefined; }
      return run(nt, L.promptNotes(nt.subject, Kid.grade()), nt.text, { max: 2500 }, function (raw) {
        var r = L.parseNotes(raw);
        if (!r) nt.error = 'Не получилось сделать конспект, попробуй ещё раз.'; else nt.result = r;
      });
    },
  } });

  // ====================================================================== Слова и диктант
  var wd = Kid.mod('words', { mode: 'Карточки', topic: '', own: '', revealed: false, dictation: [], dIdx: 0, showAll: false, busy: false, error: '' });
  function deck() { return Kid.store('cards_main', []); }
  function setDeck(d) { Kid.saveStore('cards_main', d); wd.revealed = false; }

  function vWords() {
    var h = Kid.head('Слова и диктант', 'Карточки и слова для диктанта'), cards = deck(), queue = L.queue(cards), cur = queue[0];
    h += '<div class="card">' + Kid.chips(['Карточки', 'Диктант'], wd.mode, 'stWdMode') +
      Kid.input('words.topic', wd.topic, 'Тема (' + (wd.mode === 'Карточки' ? 'например: Английский: еда' : 'например: Правописание: безударные гласные') + ')');
    if (wd.mode === 'Карточки') {
      h += btn('stWdWords', 'Подобрать 10 слов', '', null, dis(wd)) + ta('words.own', wd.own, 'Свои слова (по строке: слово - перевод)') + btn('stWdOwn', 'Добавить свои', 't') + '</div>';
      if (wd.busy) h += Kid.busy('Думаю…');
      h += Kid.err(wd.error);
      if (!cards.length) h += '<p class="mut">Колода пока пуста.</p>';
      else if (!cur) h += '<div class="card good"><b>Все слова выучены. Молодец!</b></div>' + btn('stWdReset', 'Повторить всё', 't');
      else {
        h += '<p class="mut">Осталось: ' + queue.length + ' из ' + cards.length + '</p><div class="card flash"><div><div class="st-front">' + esc(cur.f) + '</div>' +
          (wd.revealed ? '<div class="st-back">' + esc(cur.b) + '</div>' : '') + '</div></div>';
        h += wd.revealed ? '<div class="row">' + btn('stWdKnown', 'Знаю') + btn('stWdAgain', 'Ещё раз', 't') + '</div>' : btn('stWdShow', 'Показать перевод');
      }
      if (cards.length) { exporters.wordsDeck = function () { return { title: 'Слова', blocks: L.wordsBlocks(deck()) }; }; h += exportBar('wordsDeck'); }
    } else {
      h += btn('stWdDict', 'Подобрать слова для диктанта', '', null, dis(wd)) + '</div>';
      if (wd.busy) h += Kid.busy('Думаю…');
      h += Kid.err(wd.error);
      var dw = wd.dictation;
      if (dw.length) {
        h += '<p class="mut">Слово ' + (wd.dIdx + 1) + ' из ' + dw.length + '</p><div class="row">' + btn('stWdSay', 'Прочитать') + btn('stWdNext', 'Дальше', 't') + '</div>' +
          btn('stWdAll', wd.showAll ? 'Скрыть слова' : 'Проверить себя: показать слова', 'o');
        if (wd.showAll) h += '<div class="card"><pre>' + esc(dw.map(function (w, i) { return (i + 1) + '. ' + w; }).join('\n')) + '</pre></div>';
        exporters.dictation = function () { return { title: 'Диктант', blocks: L.dictationBlocks(wd.dictation) }; };
        h += exportBar('dictation');
      }
    }
    return h;
  }
  Kid.register({ key: 'words', title: 'Слова и диктант', subtitle: 'Карточки и слова для диктанта', view: vWords, acts: {
    stWdMode: function (v) { wd.mode = v; wd.error = ''; Kid.stopSpeak(); },
    stWdWords: function () {
      if (!wd.topic.trim()) { wd.error = 'Напиши тему.'; return undefined; }
      return run(wd, L.promptWords(Kid.grade()), 'Тема: ' + wd.topic, { max: 900 }, function (raw) {
        var w = L.parseWords(raw);
        if (!w) wd.error = 'Не получилось подобрать слова, попробуй ещё раз.'; else setDeck(L.mergeDeck(deck(), w));
      });
    },
    stWdOwn: function () {
      var w = L.parseWordLines(wd.own);
      if (!w.length) { wd.error = 'Пиши по строке: apple - яблоко.'; return; }
      setDeck(L.addOwn(deck(), w)); wd.own = ''; wd.error = '';
    },
    stWdShow: function () { wd.revealed = true; },
    stWdKnown: function () { setDeck(L.markKnown(deck())); },
    stWdAgain: function () { setDeck(L.repeatLater(deck())); },
    stWdReset: function () { setDeck(L.resetDeck(deck())); },
    stWdDict: function () {
      return run(wd, L.promptDictation(Kid.grade()), 'Тема: ' + (wd.topic.trim() || 'любые слова по возрасту'), { max: 600, temp: 0.7 }, function (raw) {
        var w = L.parseDictation(raw);
        if (!w) wd.error = 'Не получилось подобрать слова, попробуй ещё раз.'; else { wd.dictation = w; wd.dIdx = 0; wd.showAll = false; }
      });
    },
    stWdSay: function () { if (wd.dictation[wd.dIdx] != null) Kid.speak(wd.dictation[wd.dIdx]); },
    stWdNext: function () { if (wd.dIdx < wd.dictation.length - 1) wd.dIdx++; },
    stWdAll: function () { wd.showAll = !wd.showAll; },
  } });
})();
