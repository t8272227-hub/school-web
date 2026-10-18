# Как устроена веб-версия

Файлы загружаются обычными `<script>`: `sync.js`, `check.js`, `parent.js`, `data/*.js`, `core.js`, затем `modules/*.js`. Сборки нет.
Всё, что делает раздел, берётся из глобального объекта `Kid` (см. `core.js`).

## Раздел

```js
Kid.register({
  key: 'essay',                       // ключ как в Sections.kt на телефоне (hw, tutor, check, visual, friend, ar, assigned, reading,
                                      // history, essay, memos, reminders, cheats, mistakes, trainer, exam, words, notes, progress, timer)
  title: 'Реферат', subtitle: 'План, текст и схемы',
  view: function () { return '<html-строка>'; },        // вызывается при каждой перерисовке
  acts: { essayGo: function (v, el) { /* v = data-v, el = элемент; можно вернуть Promise */ } },
});
```

Кнопка: `<button class="b" data-act="essayGo" data-v="x">`. После действия экран перерисовывается сам.
Поле ввода: `data-bind="essay.topic"` записывает значение в `Kid.mod('essay', {...}).topic` (состояние на время сессии).
Флажок: `<input type="checkbox" data-act="имя" data-v="ключ">` (в действии читать `el.checked`).
Выпадающий список: `<select data-act="имя">`, в действие приходит выбранное значение.
Файл: `Kid.photoBox(photo, 'myPhoto')` и действия `myPhoto` / `myPhotoClear`.

## Что даёт Kid

- `Kid.mod(key, defaults)` состояние раздела на сессию; `Kid.store(name, def)` / `Kid.saveStore(name, v)` постоянные локальные данные (localStorage, не синхронизируются).
- `Kid.askAI(system, text, photo?, maxTokens?, temperature?)` и `Kid.chatAI(system, messages, ...)`: Promise со строкой. `Kid.parseJson(raw)` достаёт JSON (объект или массив) из ответа ИИ.
- `Kid.hintOnly()`: режим «Только подсказки», нельзя показывать готовые решения. `Kid.grade()`, `Kid.profile()`.
- `Kid.touchToday()`, `Kid.recordTask()` учёт занятий; `Kid.addMistake(subject, wrong, right, why)`.
- Синхронизируются через `Kid.state` (ошибки, заметки, профиль, дни, задания): после изменения `Kid.syncSoon()`.
- Вёрстка: `Kid.esc`, `Kid.head`, `Kid.chips`, `Kid.busy`, `Kid.err`, `Kid.input`, `Kid.textarea`, `Kid.photoBox`; классы `card`, `tint`, `good`, `bad`, `warn`, `b`, `b t`, `b o`, `row`, `mut`, `tag`.
- Данные приложения: `KidData.cheats`, `KidData.reading`, `KidData.guide`, `KidData.guideAi` (выгружены из Kotlin).

Родитель закрывает раздел по его `key`: закрытый раздел не показывается и не открывается, `view` для него не вызывается. Всегда открыты: `parent`, `guide`, `settings`.

## Файлы раздела

Каждый исполнитель пишет только свои файлы: `modules/<имя>.js` (экраны, `Kid.register`) и `modules/<имя>-lib.js` (чистая логика без DOM, формат как в `sync.js`, проверяется в Node). В `index.html` они уже подключены.
Дополнительно в `Kid`: `Kid.download(имя, mime, текст)`, `Kid.saveWord(заголовок, html)` (файл .doc, открывается в Word), `Kid.printHtml(заголовок, html)` (печать или PDF),
`Kid.speak(текст, onEnd)`, `Kid.stopSpeak()`, `Kid.canListen()`, `Kid.listen(onText, onEnd)`.
