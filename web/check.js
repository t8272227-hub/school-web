// Тексты для ИИ и разбор ответа проверки. Те же, что в Prompts.kt и CheckParser.kt.
(function (root) {
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
  function check(subject, grade) {
    return base(grade) +
      ' Проверь решение ученика по предмету «' + subject + '». Тебе дано задание и записи ученика (текст или фото). ' +
      'Для каждой строки решения определи статус: ok, error (ошибка именно в этой строке) или consequence ' +
      '(строка сама по себе верна, но опирается на ошибку выше). ' +
      'Верни ТОЛЬКО JSON без пояснений вокруг: ' +
      '{"verdict":"ok или errors","summary":"одно-два предложения",' +
      '"lines":[{"text":"строка ученика как написана","status":"ok|error|consequence",' +
      '"why":"что не так, простыми словами (только для error)","fix":"как правильно (только для error)"}],' +
      '"correct":"верное решение кратко"}. ' +
      'Перепроверь арифметику сам: подставь ответ в условие. Если запись неразборчива, так и напиши в summary. ' +
      'Для русского языка lines это предложения или слова с ошибками, в why назови правило.';
  }
  var LEVEL = 'Объясни как другу: очень просто, коротко, с примером из жизни.';
  function help(mode, subject, grade) {
    var head = base(grade) + ' Предмет: «' + subject + '». ';
    if (mode === 'hint') return head + 'Не давай готового ответа. Дай одну подсказку и один наводящий вопрос, чтобы ученик продвинулся сам.';
    if (mode === 'forgot') return head + 'Напомни коротким списком, какие правила и формулы нужны для этого задания. Решение не пиши.';
    return head + 'Объясни непонятное. ' + LEVEL;
  }

  function extractJson(raw) {
    var s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s < 0 || e <= s) return null;
    return raw.slice(s, e + 1);
  }
  function str(v) { return (typeof v === 'string' || typeof v === 'number') ? String(v) : ''; }

  // null, если ответ не похож на ожидаемый JSON.
  function parseCheck(raw) {
    var j = extractJson(raw || '');
    if (!j) return null;
    var root;
    try { root = JSON.parse(j); } catch (e) { return null; }
    if (!root || !Array.isArray(root.lines)) return null;
    var lines = [];
    root.lines.forEach(function (it) {
      if (!it || typeof it !== 'object') return;
      var text = str(it.text).trim();
      if (!text) return;
      var st = str(it.status).toLowerCase().trim();
      var status = (st === 'error' || st === 'wrong' || st === 'mistake') ? 'error'
        : (st === 'consequence' || st === 'follow' || st === 'carried') ? 'consequence' : 'ok';
      lines.push({ text: text, status: status, why: str(it.why).trim(), fix: str(it.fix).trim() });
    });
    if (!lines.length) return null;
    var verdict = str(root.verdict).toLowerCase().trim();
    var errors = lines.filter(function (l) { return l.status === 'error'; }).length;
    var allCorrect = errors === 0 && verdict !== 'errors';
    return { allCorrect: allCorrect, errorCount: errors, summary: str(root.summary).trim(), lines: lines, correct: str(root.correct).trim() };
  }

  var api = { base: base, check: check, help: help, extractJson: extractJson, parseCheck: parseCheck };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KidCheck = api;
})(typeof window !== 'undefined' ? window : this);
