## Prompt 01 — Инициализация монорепо и базовых скриптов (DoD)

-  В корне `npm install` проходит без ошибок.
    
-  `npm run dev` поднимает **и client, и server** (оба процесса живые).
    
-  `npm run build` проходит полностью (client build + server build).
    
-  `npm run typecheck` проходит в обоих workspace без TS ошибок.
    
-  Структура workspaces соответствует: `/apps/client`, `/apps/server`.
    
-  Нет “ручных шагов” после clone/install (всё заводится командами из root).
    

---

## Prompt 02 — Каркас Express сервера + статика клиента (DoD)

-  Server стартует командой `npm -w apps/server run dev` (или через root `npm run dev`).
    
-  `GET /api/health` возвращает JSON `{ ok: true }`.
    
-  Ошибки (например, несуществующий route под `/api`) возвращаются **в JSON**, без HTML.
    
-  `npm -w apps/server run build` успешно компилирует TypeScript.
    
-  В коде есть подготовка к раздаче статики клиента в production (без падений в dev).
    

---

## Prompt 03 — Каркас клиента: роутинг + layout (DoD)

-  `npm -w apps/client run dev` поднимается, открывается в браузере.
    
-  Все роуты из ТЗ существуют и отображают заглушки:
    
    -  `/`, `/help`, `/chronicles/:id`, `/c/:uuid`, `/c/:uuid/st`
        
-  Неизвестный route отображает `NotFound`.
    
-  В UI текст на русском (хотя бы заголовки страниц).
    
-  В проекте используется **чистый CSS** (без UI-библиотек).
    

---

## Prompt 04 — Docker Compose + подключение Mongo в сервере (DoD)

-  В корне есть `.env.example` (PORT, MONGO_URL).
    
-  `docker-compose up` поднимает `mongo` и `app` без падений.
    
-  Сервер логирует успешное подключение к Mongo.
    
-  Если Mongo недоступна — сервер падает с понятным сообщением (не “тишина”).
    
-  `GET /api/health` доступен при запуске через docker-compose.
    

---

## Prompt 05 — Mongoose модели (DoD)

-  Все модели экспортируются из понятных модулей (без циклических импортов).
    
-  `npm -w apps/server run build` проходит.
    
-  При старте сервера модели не вызывают runtime ошибок.
    
-  У `Character.uuid` есть unique-индекс.
    
-  Есть утилита генерации UUID v4, используется там, где нужно.
    

---

## Prompt 06 — Seed (DoD)

-  `npm -w apps/server run seed` выполняется успешно.
    
-  Повторный запуск `seed` **не создаёт дубли** (идемпотентность).
    
-  В Mongo гарантированно есть:
    
    -  Chronicle “Без хроники”
        
    -  generations 8..14
        
    -  clans (включая Nosferatu с appearanceFixedTo=0)
        
    -  минимальные dictionaries (discipline/sects/natures/demeanors/attributes/abilities/backgrounds/virtues/…)
        
-  У dictionary документов есть `key` и `labelRu`.
    

---

## Prompt 07 — REST: Dictionaries endpoints (DoD)

-  Каждый `GET /api/<dict>` возвращает JSON массив.
    
-  Ответы не содержат мусор (минимум: `key`, `labelRu`, плюс нужные поля).
    
-  Ошибки возвращаются JSON-ом с понятным `message`.
    
-  Все endpoints из ТЗ заведены (clans, disciplines, …, generations).
    

---

## Prompt 08 — REST: Chronicles endpoints (DoD)

-  `GET /api/chronicles` возвращает все хроники, включая “Без хроники”.
    
-  `GET /api/chronicles/:id` возвращает 404 для несуществующего id.
    
-  `GET /api/chronicles/:id/characters`:
    
    -  не возвращает `deleted=true`
        
    -  сортировка по имени (пустые имена — внизу)
        
    -  возвращает минимум `uuid`, `meta.name`, `creationFinished`, `chronicleId`
        

---

## Prompt 09 — REST: Characters create/get/delete + дефолты (DoD)

-  `POST /api/characters` создаёт документ:
    
    -  `creationFinished=false`, `wizard.currentStep=1`, `generation=13`
        
    -  `chronicleId` указывает на “Без хроники”
        
    -  traits заполнены дефолтами (атрибуты base=1, virtues base=1, остальное base=0)
        
    -  resources нулевые, notes/equipment пустые строки
        
    -  derived рассчитан по generation
        
-  `GET /api/characters/:uuid` возвращает документ и 404 для deleted/несуществующего.
    
-  `DELETE /api/characters/:uuid` выставляет `deleted=true` и `deletedAt`.
    
-  После delete `GET /api/characters/:uuid` возвращает 404.
    

---

## Prompt 10 — Клиент: API слой + загрузка справочников (DoD)

-  При старте приложения выполняются запросы ко всем dictionaries.
    
-  Пока dictionaries не загружены — показывается loading screen (не пустой экран).
    
-  Ошибка загрузки dictionaries отображается пользователю (toast/сообщение).
    
-  Типы DTO существуют и используются (нет `any` в ключевых местах API слоя).
    
-  Локальная разработка работает (proxy /api корректен).
    

---

## Prompt 11 — Клиент: Home (DoD)

-  На `/` отображается список хроник (ссылки кликабельны).
    
-  Кнопка “Создать персонажа”:
    
    -  делает `POST /api/characters`
        
    -  редиректит на `/c/:uuid`
        
-  “Импорт” пока disabled с пометкой “в разработке”.
    
-  Ссылка Help ведёт на `/help` и есть **только на главной**.
    

---

## Prompt 12 — Клиент: Chronicle page (DoD)

-  `/chronicles/:id` отображает название хроники и список персонажей.
    
-  Для пустого `meta.name` отображается “(Без имени)”.
    
-  Для `creationFinished=false` видна пометка “Черновик” + иконка.
    
-  Каждый персонаж — ссылка на `/c/:uuid`.
    
-  Не отображаются удалённые персонажи.
    

---

## Prompt 13 — Клиент: Character page guard + кнопки (DoD)

-  `/c/:uuid` делает `GET /api/characters/:uuid`.
    
-  Если 404 — показывается NotFound.
    
-  При `creationFinished=false` — заглушка Wizard.
    
-  При `creationFinished=true` — заглушка Game.
    
-  Кнопка “Скопировать ссылку” реально копирует URL (проверка вставкой).
    
-  “Перейти в ST mode” открывает `/c/:uuid/st`.
    

---

## Prompt 14 — Socket.IO server skeleton (DoD)

-  Socket.IO сервер поднимается вместе с Express.
    
-  Клиент может подключиться и join в `room=uuid`.
    
-  Сервер логирует join + получение patch.
    
-  События/контракты согласованы:
    
    -  клиент отправляет `patch`
        
    -  сервер может отправить `patchApplied`
        
-  Нет падений сервера при некорректном patch (reject/ошибка, но процесс жив).
    

---

## Prompt 15 — Socket.IO client hook + toasts (DoD)

-  На странице персонажа клиент подключается к сокету и join’ится.
    
-  Есть `useCharacterSocket(uuid)` с `sendPatch`.
    
-  Есть toast-система без библиотек:
    
    -  очередь сообщений
        
    -  авто-закрытие
        
-  Debug-кнопка отправляет тестовый patch и показывает реакцию (toast/log).
    

---

## Prompt 16 — Server patch apply + versioning (DoD)

-  Патч реально меняет документ в Mongo и повышает `version`.
    
-  `baseVersion` mismatch -> reject с понятной ошибкой.
    
-  Валидация ресурсов enforced:
    
    -  bloodPool.current 0..derived.bloodPoolMax
        
    -  willpower/humanity 0..10
        
    -  health b/l/a 0..7, sum<=7
        
    -  notes/equipment строка
        
-  При reject сервер **не сохраняет** изменения.
    
-  Сервер broadcast’ит `patchApplied` в room и клиенты применяют его как источник истины.
    

---

## Prompt 17 — Клиент: Game mode resources + notes/equipment realtime (DoD)

-  В режиме игры изменения UI:
    
    -  сразу применяются локально (optimistic)
        
    -  отправляют patch через socket
        
-  При `patchApplied` версия и состояние синхронизируются.
    
-  При reject:
    
    -  показывается toast
        
    -  выполняется full resync (GET /api/characters/:uuid)
        
-  Две вкладки видят синхронные изменения resources и notes/equipment.
    

---

## Prompt 18 — Health track UI + wound penalty (DoD)

-  Health UI строго последовательный:
    
    -  нельзя кликать “в середину”
        
    -  цикл: empty → bashing → lethal → aggravated → empty
        
-  В данные сохраняются числа b/l/a, не массив ячеек.
    
-  Любое изменение отправляет patch на `resources.health`.
    
-  Wound penalty считается и отображается рядом.
    
-  Сервер reject при sum>7, клиент делает resync.
    

---

## Prompt 19 — ST route базовый + delete (DoD)

-  `/c/:uuid/st` грузит персонажа и отображает ST заголовок.
    
-  Кнопка “Удалить персонажа”:
    
    -  спрашивает подтверждение (желательно)
        
    -  вызывает DELETE
        
    -  после успеха уводит на `/` (или показывает NotFound)
        
-  После удаления `/c/:uuid` и `/c/:uuid/st` дают NotFound.
    

---

## Prompt 20 — ST totals editor + server enforcement (DoD)

-  В ST видны блоки traits (attributes/abilities/disciplines/backgrounds/virtues).
    
-  +/- меняют `desiredTotal`, а фактически записывают `storyteller` слой.
    
-  Сервер разрешает патчи storyteller слоёв и enforced диапазоны totals.
    
-  Out-of-range -> reject с errors.
    
-  Состояние сохраняется и переживает reload страницы.
    

---

## Prompt 21 — ST смена клана: сброс дисциплин + Nosferatu Appearance rule (DoD)

-  В ST есть select клана из dictionaries.
    
-  При смене клана:
    
    -  дисциплины вне клана сбрасываются (на сервере)
        
    -  клиенты получают обновления (patchApplied/resync) и UI отражает сброс
        
-  Для Nosferatu Appearance становится 0 по правилу:
    
    -  enforced сервером
        
    -  не “визуально”, а реально в данных (total=0)
        

---

## Prompt 22 — Единый формат ошибок + validate* утилиты (DoD)

-  Все reject/валидации возвращают **одинаковый формат** массива `{path,message}`.
    
-  Логика валидации вынесена в `validateRanges/validatePatch` (не размазана по handlers).
    
-  Сообщения ошибок на русском и понятные.
    
-  Патч-обработчик стал короче/читабельнее без потери функционала.
    
-  Поведение не сломало существующие сценарии realtime.
    

---

## Prompt 23 — Wizard каркас (server+client) (DoD)

-  Wizard отображается при `creationFinished=false`.
    
-  Stepper из 9 шагов:
    
    -  текущий подсвечен
        
    -  клик только назад работает через `wizard/goto`
        
-  Кнопки:
    
    -  “Назад” вызывает `wizard/back`
        
    -  “Далее” вызывает `wizard/next`
        
-  `wizard.currentStep` сохраняется в Mongo и переживает reload.
    
-  Нельзя “перепрыгнуть” вперёд кликом.
    

---

## Prompt 24 — Wizard Step 1 “Основное” required validation (DoD)

-  Поля формы соответствуют ТЗ (required + optional).
    
-  Изменения сохраняются патчами в `meta.*` корректно.
    
-  `wizard/next` на шаге 1:
    
    -  возвращает ошибки если required пустые
        
    -  не повышает шаг при ошибках
        
-  Клиент показывает ошибки:
    
    -  toast + подсветка/сообщение у полей
        
-  Поколение валидируется 8..14.
    

---

## Prompt 25 — Wizard Step 2 “Атрибуты” 7/5/3 + Nosferatu (DoD)

-  Есть выбор приоритетов Physical/Social/Mental для 7/5/3.
    
-  Атрибуты меняются dots UI и сохраняются в `traits.attributes.*.base`.
    
-  Сервер валидирует:
    
    -  min 1 для всех (кроме Nosferatu Appearance=0)
        
    -  max 5
        
    -  корректные суммы по группам 7/5/3 с учётом минимумов
        
-  Нельзя пройти шаг без корректного распределения.
    
-  Nosferatu строго фиксирует `appearance.base=0`.
    

---

## Prompt 26 — Wizard Step 3 “Способности” 13/9/5 (DoD)

-  Выбор приоритетов Talents/Skills/Knowledges = 13/9/5.
    
-  Способности 0..5 dots, сохраняются в `traits.abilities.*.base`.
    
-  Сервер валидирует суммы по группам и диапазоны.
    
-  Нельзя перейти дальше при ошибках (ошибки подсвечиваются).
    

---

## Prompt 27 — Wizard Steps 4–6 (DoD)

**Step 4 Disciplines**

-  Только клановые дисциплины доступны для распределения.
    
-  Сумма базовых = 3.
    
-  Каждая дисциплина base <= 3 на старте.
    
-  Сервер отклоняет дисциплины не из клана.
    

**Step 5 Backgrounds**

-  Сумма base = 5, диапазон 0..5.
    
-  Сервер enforced.
    

**Step 6 Virtues**

-  База 1/1/1 сохранена, распределяется +7, max 5.
    
-  Сервер enforced суммы/диапазоны.
    

---

## Prompt 28 — Wizard Step 7 Merits/Flaws + cap +7 (DoD)

-  Merits/Flaws выбираются из dictionaries и сохраняются в массивы `meritsSelected/flawsSelected`.
    
-  Flaws дают бонус freebie **только до +7**.
    
-  Сервер валидирует, что итоговый бюджет (15 + бонус - meritsCost) не отрицательный.
    
-  Нельзя пройти шаг при отрицательном бюджете.
    
-  Сообщения ошибок понятные (например “Не хватает freebie…”).
    

---

## Prompt 29 — Wizard Step 8 Freebies purchases (DoD)

-  Единая страница с покупками freebie в слоях `freebie` для traits.
    
-  Есть таблица стоимости покупок (константа) и она используется в расчётах.
    
-  UI показывает “Осталось freebie: N” и он не расходится с сервером.
    
-  Сервер валидирует:
    
    -  бюджет >= 0
        
    -  диапазоны totals
        
-  Нельзя пройти дальше при нехватке бюджета.
    

---

## Prompt 30 — Rollback engine freebies (DoD)

-  Rollback срабатывает в двух случаях:
    
    -  удалили flaw → бюджет стал отрицательным
        
    -  изменили ранние шаги → текущие freebie стали невалидными
        
-  Порядок отката строго как в ТЗ (Humanity → … → Merits).
    
-  Rollback детерминированный (одинаковый ввод → одинаковый результат).
    
-  После rollback бюджет всегда >= 0.
    
-  Клиент показывает единый toast о том, что часть freebie откатана.
    

---

## Prompt 31 — Wizard Step 9 + finish confirmBurn + starting* (DoD)

-  Финальный обзор отображает ключевые totals и остаток freebies.
    
-  `wizard/finish`:
    
    -  валидирует весь лист + бюджеты
        
    -  при непотраченных очках возвращает `warning`
        
    -  при `confirmBurn=true` завершает создание
        
-  После успешного finish:
    
    -  `creationFinished=true`
        
    -  `derived.startingHumanity` и `derived.startingWillpower` зафиксированы
        
    -  `wizard` удалён из документа
        
-  `/c/:uuid` открывает игровой режим, wizard больше недоступен.
    

---

## Prompt 32 — Import/Export строгий (DoD)

-  Export:
    
    -  `GET /api/characters/:uuid/export` возвращает JSON без uuid
        
    -  скачивание файла работает на клиенте
        
-  Import:
    
    -  `POST /api/characters/:uuid/import` игнорирует uuid из JSON
        
    -  строгая валидация: невалидное → reject (не “подрезать” значения)
        
    -  успешный import приводит к resync и обновлению UI
        
-  Home Import поток работает: create → import → redirect.
    

---

## Prompt 33 — Help + UX polish (DoD)

-  `/help` содержит инструкцию по режимам (Wizard/Игра/ST), импорт/экспорт.
    
-  Тосты покрывают основные события:
    
    -  валидационные ошибки
        
    -  reject + resync
        
    -  rollback уведомление
        
    -  успешный импорт/экспорт
        
-  UI тексты на русском, термины единообразны.
    

---

## Prompt 34 — Docker multi-stage production (DoD)

-  Есть `Dockerfile` multi-stage (vite build → tsc build → final).
    
-  `docker-compose up --build` поднимает приложение.
    
-  Server раздаёт статику клиента и делает SPA fallback:
    
    -  прямой заход по URL `/help`, `/chronicles/:id`, `/c/:uuid` работает
        
    -  `/api/*` не ломается fallback’ом
        
    -  `/socket.io/*` работает
        
-  В final образе только production deps (без dev мусора).