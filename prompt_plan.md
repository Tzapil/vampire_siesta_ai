## Prompt 01 — Инициализация монорепо и базовых скриптов

Ты — senior fullstack разработчик. Сгенерируй стартовый монорепозиторий на npm workspaces:  
  
Структура:  
- /package.json (workspaces)  
- /apps/client (React + Vite + TS)  
- /apps/server (Node + Express + TS)  
  
Требования:  
1) В корне настрой общие скрипты:  
- npm run dev: запускает server и client параллельно  
- npm run build: билдит client и server  
- npm run typecheck: проверка типов в обоих приложениях  
2) Добавь общий tsconfig.base.json в корне и подключи его в client/server.  
3) Client: Vite + React + TS. Server: TypeScript сборка через tsc.  
4) Никаких лишних библиотек, только необходимое.  
5) Верни изменения в формате unified diff.  
  
Критерии приёмки:  
- npm install работает  
- npm run dev стартует оба приложения  
- npm run build выполняется без ошибок

---

## Prompt 02 — Каркас Express сервера + статика клиента в production

Добавь в apps/server каркас Express на TypeScript:  
  
1) Эндпоинт GET /api/health -> { ok: true }  
2) Централизованный error handler (JSON формат, без HTML).  
3) Поддержка dotenv: переменные PORT, MONGO_URL (пока можно не подключать Mongo).  
4) Подготовь раздачу статики клиента в production:  
- server должен уметь отдавать /dist клиента (позже подставим путь)  
- в dev режим статику можно не раздавать  
5) Добавь скрипты dev/build/start в apps/server package.json.  
6) Верни unified diff.  
  
Критерии:  
- server стартует и отвечает на /api/health  
- сборка server проходит

---

## Prompt 03 — Каркас клиента: роутинг страниц из ТЗ + базовый layout

В apps/client добавь React Router и страницы:  
  
Routes:  
- / (Home)  
- /help (Help)  
- /chronicles/:id (ChroniclePage)  
- /c/:uuid (CharacterPage)  
- /c/:uuid/st (StorytellerPage)  
- 404 (NotFound)  
  
Требования:  
1) UI на русском (заголовки/плейсхолдеры).  
2) Используй чистый CSS (src/styles.css) + минимальный layout (шапка/контент).  
3) На каждой странице пока просто заглушки с названием страницы и параметрами роутов (id/uuid).  
4) Верни unified diff.  
  
Критерии:  
- npm run dev открывает клиент, переходы по роутам работают  
- 404 показывает NotFound

---

## Prompt 04 — Docker Compose + подключение Mongo в сервере

Добавь docker-compose.yml в корень с сервисами:  
- mongo (volume)  
- app (Node server, пока без production multi-stage)  
  
Требования:  
1) Добавь .env.example (PORT, MONGO_URL).  
2) В server реализуй подключение к Mongo через Mongoose:  
- подключаться при старте  
- логировать успешное подключение  
- падать с понятной ошибкой при недоступности  
3) В docker-compose прокинь env и зависимости так, чтобы app ждал mongo (depends_on достаточно).  
4) Верни unified diff.  
  
Критерии:  
- docker-compose up поднимает mongo и app  
- /api/health доступен

---

## Prompt 05 — Mongoose модели: Chronicle + Dictionaries + Character (минимум ядра)

Добавь Mongoose модели (apps/server):  
  
1) Chronicle:  
- _id, name (string), createdAt/updatedAt  
2) Dictionary коллекции:  
- общий интерфейс: { key: string, labelRu: string, ...optional }  
- сделай отдельные модели/коллекции для clans, disciplines, attributes, abilities, backgrounds, virtues, merits, flaws, sects, natures, demeanors, generations  
- Для clans добавь: disciplineKeys: string[], rules?: { appearanceFixedTo?: number }  
- Для generations: { generation: number, bloodPoolMax: number, bloodPerTurn: number }  
3) Character (минимальная структура):  
- uuid: string (unique)  
- chronicleId: ObjectId  
- creationFinished: boolean  
- deleted: boolean, deletedAt?: Date  
- version: number  
- meta: обязательные поля из ТЗ (можно пустыми при создании)  
- resources (bloodPool/willpower/humanity/health) + notes/equipment  
- derived (bloodPoolMax, bloodPerTurn, willpowerMax, humanityMax, startingHumanity, startingWillpower)  
- traits: заготовка для layered значений (attributes/abilities/disciplines/backgrounds/virtues) как Record<string, {base,freebie,storyteller}>  
- meritsSelected: string[], flawsSelected: string[] (порядок важен)  
4) Добавь утилиту генерации uuid v4.  
5) Верни unified diff.  
  
Критерии:  
- server компилируется  
- модели экспортируются без циклических импортов

---

## Prompt 06 — Seed: “Без хроники” + минимальные справочники + generations 8..14

Реализуй seed-скрипт apps/server:  
  
Команда: npm run seed  
Требования:  
1) Идемпотентно создаёт хронику "Без хроники" (если нет).  
2) Идемпотентно наполняет generations 8..14 корректными полями (можно временные значения, но структура должна быть).  
3) Добавляет минимум справочников:  
- clans: включая Nosferatu с rules.appearanceFixedTo = 0 и disciplineKeys (минимум 3 дисциплины)  
- disciplines: несколько ключей с labelRu  
- sects/natures/demeanors: по паре значений  
- attributes/abilities/backgrounds/virtues: ключи V20 (можно минимально необходимые для UI/валидаций)  
4) Seed должен быть безопасным: upsert по key/generation/name.  
5) Верни unified diff.  
  
Критерии:  
- npm run seed выполняется дважды без дублей  
- в Mongo появляются нужные коллекции

---

## Prompt 07 — REST: Dictionaries endpoints

Добавь REST эндпоинты dictionaries в apps/server по ТЗ:  
  
- GET /api/clans  
- GET /api/disciplines  
- ...  
- GET /api/generations  
  
Требования:  
1) Единый роутер /api.  
2) Возвращай массив документов (без лишних полей, но key/labelRu обязательно).  
3) Обработай ошибки: 500 с понятным сообщением.  
4) Верни unified diff.  
  
Критерии:  
- curl к любому /api/<dict> возвращает JSON массив

---

## Prompt 08 — REST: Chronicles endpoints + список персонажей в хронике

Добавь эндпоинты хроник:  
  
- GET /api/chronicles  
- GET /api/chronicles/:id  
- GET /api/chronicles/:id/characters (deleted=false), сортировка по meta.name (пустые в конец)  
  
Требования:  
1) В списке персонажей верни минимум: uuid, meta.name, creationFinished, chronicleId.  
2) Если meta.name пустое — клиент покажет "(Без имени)".  
3) Верни unified diff.  
  
Критерии:  
- /api/chronicles возвращает все хроники (включая "Без хроники")  
- /api/chronicles/:id/characters не возвращает deleted

---

## Prompt 09 — REST: Characters create/get/delete + дефолты по ТЗ

Реализуй эндпоинты персонажей:  
  
- POST /api/characters: создаёт документ с дефолтами (по ТЗ)  
- GET /api/characters/:uuid: 404 если не найден или deleted=true  
- DELETE /api/characters/:uuid: soft delete (deleted=true, deletedAt=Date)  
  
Требования к дефолтам:  
- chronicleId = "Без хроники" (найти по имени)  
- creationFinished=false  
- wizard.currentStep=1 (добавь wizard объект)  
- generation=13  
- traits: атрибуты base=1, остальное base=0; virtues base=1  
- freebie=0 storyteller=0 везде  
- resources: current=0, health=0, notes/equipment=""  
- derived пересчитан по generation из generations  
  
Верни unified diff.  
  
Критерии:  
- POST возвращает uuid и созданный документ (или минимум uuid)  
- GET по uuid возвращает документ  
- DELETE делает так, что GET начинает отдавать 404

---

## Prompt 10 — Клиент: API слой + загрузка всех справочников при старте

В apps/client сделай:  
  
1) API клиент (fetch wrapper):  
- base URL относительный (/api)  
- обработка ошибок (выбрасывать исключение с message)  
2) Загрузка ВСЕХ справочников при старте приложения:  
- параллельно, один раз  
- сохранить в DictionariesContext (in-memory)  
- показать loading screen пока справочники не загружены  
3) Типы DTO (минимальные) для dict элементов и ключевых сущностей.  
  
Верни unified diff.  
  
Критерии:  
- При старте клиент делает запросы ко всем /api/<dict>  
- После загрузки отображает страницы

---

## Prompt 11 — Клиент: Home (список хроник) + Create Character

Реализуй Home страницу:  
  
1) Загружает GET /api/chronicles и показывает список (с ссылкой на /chronicles/:id).  
2) Кнопка "Создать персонажа":  
- POST /api/characters  
- после успеха редирект на /c/:uuid  
3) Кнопка "Импорт" пока заглушка (disabled) с подписью "в разработке".  
4) Ссылка Help на /help (только на главной).  
  
Верни unified diff.  
  
Критерии:  
- Можно создать персонажа и попасть на /c/:uuid

---

## Prompt 12 — Клиент: Chronicle page (персонажи) по ТЗ

Реализуй страницу /chronicles/:id:  
  
1) Загружает GET /api/chronicles/:id и GET /api/chronicles/:id/characters.  
2) Показывает список персонажей:  
- сортировка уже на сервере, но дополнительно можно стабилизировать на клиенте  
- для пустого имени показывать "(Без имени)"  
- если creationFinished=false: пометка "Черновик" + простая иконка (можно unicode)  
3) Каждый элемент — ссылка на /c/:uuid.  
  
Верни unified diff.  
  
Критерии:  
- Страница хроники показывает персонажей без deleted

---

## Prompt 13 — Клиент: Character page guard + 404 + кнопки

Реализуй /c/:uuid страницу:  
  
1) При заходе грузит GET /api/characters/:uuid.  
2) Если 404 — показать NotFound.  
3) Если creationFinished=false — пока показываем заглушку "Wizard (в разработке)".  
4) Если creationFinished=true — показываем заглушку "Игровой режим (в разработке)".  
5) В шапке персонажа (даже в заглушке) сделать кнопки:  
- "Скопировать ссылку" (navigator.clipboard)  
- "Экспорт JSON" (пока disabled)  
- "Импорт JSON" (пока disabled)  
- "Перейти в ST mode" -> /c/:uuid/st  
  
Верни unified diff.  
  
Критерии:  
- 404 корректно отображается  
- copy link работает

---

## Prompt 14 — Socket.IO: серверная часть (rooms + patch pipeline skeleton)

Добавь Socket.IO на сервер:  
  
1) Socket.IO сервер поверх существующего HTTP сервера.  
2) При подключении клиент передаёт uuid (например, через query или emit join).  
3) Сервер добавляет сокет в room=uuid.  
4) Добавь обработчик события "patch":  
- принимает Patch { characterUuid, baseVersion, op:"set", path, value }  
- пока НЕ применяет к БД, а просто валидирует форму и отвечает reject/accept заглушкой  
5) Добавь событие "patchApplied" (broadcast в room).  
6) Верни unified diff.  
  
Критерии:  
- клиент может подключиться и join в комнату  
- сервер логирует join и получение patch

---

## Prompt 15 — Socket.IO: клиентская часть (hook) + optimistic UI contract

В apps/client добавь socket слой:  
  
1) Хук useCharacterSocket(uuid):  
- подключается к Socket.IO серверу  
- join room uuid  
- слушает patchApplied  
2) Контракт optimistic:  
- функция sendPatch(patch)  
- при reject (сервер ответил ошибкой) вызывается onReject callback  
3) Пока без реального применения патчей — просто логируй их и показывай toast.  
  
Сделай минимальную toast систему (без библиотек):  
- очередь сообщений  
- авто-скрытие  
  
Верни unified diff.  
  
Критерии:  
- на /c/:uuid клиент подключается к сокету и join  
- можно отправить тестовый patch кнопкой "debug" и увидеть toast

---

## Prompt 16 — Сервер: применение patch к документу + version++ + broadcast

Реализуй реальную обработку Patch на сервере:  
  
Алгоритм:  
1) найти Character по uuid (404/reject если deleted)  
2) проверить baseVersion совпадает с character.version (если нет — reject "version mismatch")  
3) применить op=set по dot-path к объекту (без eval; безопасная утилита setByPath)  
4) выполнить базовую валидацию по диапазонам ДЛЯ РЕСУРСОВ И ТЕКСТОВ:  
- resources.bloodPool.current: 0..derived.bloodPoolMax  
- resources.willpower.current: 0..10  
- resources.humanity.current: 0..10  
- resources.health b/l/a: 0..7 и sum<=7  
- notes/equipment: string  
5) сохранить, увеличить version, broadcast patchApplied в room  
6) В ответ отправителю вернуть accept + newVersion  
  
Формат reject:  
- { ok:false, errors:[{path,message}] } (как в ТЗ)  
  
Верни unified diff.  
  
Критерии:  
- два клиента в разных вкладках видят синхронизацию ресурсов/текста (позже UI)  
- при неправильном значении сервер reject и не сохраняет

---

## Prompt 17 — Клиент: Игровой режим MVP (resources + notes/equipment) с realtime

Реализуй на /c/:uuid при creationFinished=true игровой режим:  
  
UI:  
1) Resources:  
- Blood Pool current (инпут number + кнопки +/-)  
- Willpower current (инпут number + +/-)  
- Humanity current (инпут number + +/-)  
2) Notes и Equipment: textarea  
3) Все изменения отправлять как socket Patch (op=set, path, value) с baseVersion из текущего состояния.  
4) Optimistic UI:  
- сразу применяй локально  
- если reject -> toast + full resync GET /api/characters/:uuid и переприсвоить состояние  
- если patchApplied -> применяй broadcast как source of truth и обновляй version  
  
Верни unified diff.  
  
Критерии:  
- изменения синхронизируются между двумя вкладками  
- reject приводит к resync

---

## Prompt 18 — Health track UI (7 ячеек) + wound penalty (client)

Добавь Health компонент в игровом режиме:  
  
Требования:  
1) Хранение в данных: resources.health = {bashing, lethal, aggravated}  
2) UI: 7 ячеек, клики только последовательно:  
- клик по следующей пустой или последней заполненной  
- цикл: empty -> bashing -> lethal -> aggravated -> empty  
3) При клике пересчитать b/l/a и отправить patch на path "resources.health" целиком.  
4) Wound penalty: посчитать по стандартной таблице V20 (покажи рядом текст "Штраф ранений: -X" или "нет").  
  
Верни unified diff.  
  
Критерии:  
- нельзя кликнуть произвольную ячейку в середине трека  
- сервер отклоняет если sum>7

---

## Prompt 19 — Переключение режимов: ST route + базовая страница + загрузка персонажа

Реализуй /c/:uuid/st страницу:  
  
1) Загружает персонажа как и /c/:uuid.  
2) Показывает заголовок "Storyteller mode".  
3) Пока без полноценного редактора, но добавь кнопку:  
- "Удалить персонажа" -> вызывает DELETE /api/characters/:uuid, после успеха редирект на / (или показать 404).  
  
Верни unified diff.  
  
Критерии:  
- soft delete работает из UI  
- после delete /c/:uuid и /c/:uuid/st дают NotFound

---

## Prompt 20 — ST mode: редактирование totals через storyteller слой (attributes/abilities/…)

Расширь ST mode:  
  
1) Покажи редактируемые блоки traits:  
- attributes, abilities, disciplines, backgrounds, virtues  
2) Для каждого трейта отображай total = base+freebie+storyteller и кнопки +/- для изменения desiredTotal.  
3) При изменении total:  
- вычисляй storyteller = desiredTotal - (base + freebie)  
- отправляй patch на соответствующий path storyteller слоя (например traits.attributes.strength.storyteller)  
4) Диапазоны пока валидируй только для:  
- attributes 1..5 (Appearance 0..5 в особом случае позже)  
- abilities 0..5  
- disciplines 0..5  
- backgrounds 0..5  
- virtues 1..5  
  
Сервер:  
- расширь patch-валидацию: разреши изменения storyteller слоя по этим путям и enforce диапазоны totals.  
- при reject отдавай errors по формату.  
  
Верни unified diff.  
  
Критерии:  
- ST может менять totals и это сохраняется  
- вне диапазонов сервер reject

---

## Prompt 21 — ST: смена клана и сброс дисциплин + Nosferatu appearance rule

Добавь логику смены клана в ST:  
  
Клиент:  
1) Выпадающий список clanKey (из dictionaries.clans).  
2) При смене отправить patch на meta.clanKey.  
  
Сервер:  
1) При изменении meta.clanKey:  
- найти новый клан по key  
- сбросить disciplines, которые не входят в clan.disciplineKeys: поставить base/freebie/storyteller=0 (или удалить ключ)  
- если у клана rules.appearanceFixedTo=0, то attributes.appearance.total должно стать 0:  
  - реализуй через изменение base (если wizard не завершён?) — в ST меняем ТОЛЬКО storyteller:  
    desiredTotal=0 -> пересчитать storyteller так, чтобы total=0  
2) Верни клиенту patchApplied для всех затронутых полей (можно отправить несколько patchApplied или один resync-event; выбери один подход и используй последовательно).  
  
Верни unified diff.  
  
Критерии:  
- при смене клана дисциплины вне клана сбрасываются  
- для Nosferatu Appearance становится 0 (и сервер не позволяет вывести total из допустимого правила)

---

## Prompt 22 — Server: строгая валидация ошибок формата + утилиты validateCharacter

Рефакторинг сервера:  
  
1) Вынеси в отдельный модуль:  
- validateRanges(character): возвращает массив ошибок {path,message}  
- validatePatch(character, patch): использует validateRanges + специфичные проверки  
2) Везде используй единый формат ошибок (как в ТЗ):  
[  
  { "path": "meta.name", "message": "..." }  
]  
3) Добавь маппинг человеко-понятных сообщений на русском для основных ошибок диапазонов.  
4) Верни unified diff.  
  
Критерии:  
- все reject/errors приходят в одном формате  
- код патч-обработчика стал читабельнее

---

## Prompt 23 — Wizard: REST операции next/back/goto/finish (каркас) + UI stepper

Добавь Wizard каркас (server + client):  
  
Server:  
1) Модель wizard в Character уже есть; дополни:  
- wizard.currentStep:number  
2) Реализуй endpoints:  
- POST /api/characters/:uuid/wizard/next  
- POST /api/characters/:uuid/wizard/back  
- POST /api/characters/:uuid/wizard/goto { targetStep }  
- POST /api/characters/:uuid/wizard/finish (пока заглушка, без строгих правил)  
Правила:  
- goto только назад (targetStep <= currentStep)  
- next увеличивает шаг на 1  
- back уменьшает шаг на 1, но не ниже 1  
  
Client:  
1) На /c/:uuid при creationFinished=false показать Wizard:  
- Stepper из 9 шагов с названиями  
- клик по прошлым шагам вызывает wizard/goto  
- кнопки "Назад" и "Далее" -> wizard/back и wizard/next  
2) Пока контент шагов — заглушки.  
  
Верни unified diff.  
  
Критерии:  
- шаг сохраняется в БД, переживает перезагрузку  
- вперёд только кнопкой

## Prompt 24 — Wizard Step 1 “Основное”: поля + валидация required

Реализуй Wizard Step 1 (Основное):  
  
Client:  
1) Форма:  
- Имя персонажа (required)  
- Имя игрока (required)  
- Клан (required, select)  
- Поколение (required, 8..14, select)  
- Хроника (required, select chronicleId)  
- Секта (required, select)  
- Натура (required, select)  
- Поведение (required, select)  
+ необязательные: Сир, Концепт (textarea)  
2) При изменении полей сохраняй в Character через socket patch (op=set):  
- meta.name, meta.playerName, meta.clanKey, meta.generation, meta.chronicleId, meta.sectKey, meta.natureKey, meta.demeanorKey, meta.sire, meta.concept  
  
Server:  
1) Разреши эти пути патчей в режиме wizard (creationFinished=false).  
2) На wizard/next для шага 1 выполняй валидацию required и диапазон поколения 8..14.  
3) Возвращай ошибки по формату + подсветка полей на клиенте (минимально: показать сообщение рядом).  
  
Верни unified diff.  
  
Критерии:  
- нельзя пройти дальше шага 1 без обязательных полей  
- ошибки подсвечиваются, показывается toast

---

## Prompt 25 — Wizard Step 2 “Атрибуты”: приоритеты 7/5/3 + Nosferatu правило

Реализуй Wizard Step 2 (Атрибуты):  
  
Требования:  
1) Выбор приоритетов Physical/Social/Mental (порядок 7/5/3) на этом шаге.  
2) 9 атрибутов (dots UI 0..5, но итоговые правила):  
- у всех минимум 1  
- максимум 5  
- исключение: Nosferatu -> Appearance = 0 (в wizard это фиксированное правило)  
3) На сервере храни base распределение в traits.attributes.<key>.base.  
4) Валидация при wizard/next:  
- сумма base по группам соответствует выбранному распределению 7/5/3 с учётом минимумов  
- для Nosferatu appearance.base должен быть 0, иначе ошибка  
5) UI: клики по dots меняют base, но не должны позволять уходить в заведомо невозможные состояния (мягко ограничивай на клиенте, но сервер — источник истины).  
  
Верни unified diff.  
  
Критерии:  
- шаг 2 нельзя пройти без корректного распределения  
- Nosferatu фиксирует appearance=0

---

## Prompt 26 — Wizard Step 3 “Способности”: приоритеты 13/9/5

Реализуй Wizard Step 3 (Способности):  
  
1) Выбор приоритетов Talents/Skills/Knowledges = 13/9/5.  
2) Способности: base 0..5, ограничение "не больше 3" НЕ применять.  
3) Сервер хранит traits.abilities.<key>.base.  
4) wizard/next валидирует сумму base по группам согласно выбранному приоритету.  
5) UI dots 0..5.  
  
Верни unified diff.  
  
Критерии:  
- валидные суммы 13/9/5, иначе ошибки

---

## Prompt 27 — Wizard Steps 4–6: Disciplines / Backgrounds / Virtues

Реализуй сразу 3 шага Wizard (4-6), но инкрементально внутри кода:  
  
Step 4 Disciplines:  
- базово 3 точки  
- только клановые дисциплины (из clans.disciplineKeys)  
- каждая дисциплина base <=3 на старте  
- хранить traits.disciplines.<key>.base  
  
Step 5 Backgrounds:  
- базово 5 точек  
- traits.backgrounds.<key>.base 0..5  
  
Step 6 Virtues:  
- минимум 1/1/1 (Conscience, Self-Control, Courage) уже есть base=1  
- распределяем +7 очков, max 5  
- traits.virtues.<key>.base  
  
Server:  
- wizard/next валидирует текущий шаг  
- выдаёт ошибки массива {path,message}  
  
Client:  
- UI dots, подсказки бюджета на каждом шаге  
  
Верни unified diff.  
  
Критерии:  
- каждый шаг строго валидируется  
- disciplines ограничены кланом

---

## Prompt 28 — Wizard Step 7: Merits/Flaws + freebie bonus cap +7 (данные)

Реализуй Wizard Step 7 Merits/Flaws:  
  
Данные:  
- meritsSelected: string[] (порядок добавления)  
- flawsSelected: string[] (порядок добавления)  
  
Справочники:  
- merits/flaws элементы должны содержать pointCost (число), а для flaws pointGain (или reuse pointCost со знаком) — выбери одну схему и приведи seed к ней.  
  
Логика:  
1) На шаге 7 UI позволяет выбрать merits и flaws из справочников (checkbox/list).  
2) Flaws дают freebie бонус, но максимум +7 (сверх можно брать flaws, но бюджет не увеличивать).  
3) На этом шаге не тратим freebies ещё, только формируем список merits/flaws и считаем доступный бюджет freebies (15 + min(sumFlaws,7) - sumMeritsCost).  
  
Server:  
- патчи на meritsSelected/flawsSelected разрешены  
- wizard/next валидирует, что итоговый freebieBudget не отрицательный (если отрицательный — ошибка "Не хватает freebie, уберите merits или добавьте flaws")  
  
Верни unified diff.  
  
Критерии:  
- cap +7 работает  
- нельзя пройти дальше с отрицательным бюджетом

---

## Prompt 29 — Wizard Step 8: Freebies покупка (attributes/abilities/…/merits) + расчёт бюджета

Реализуй Wizard Step 8 Freebies:  
  
1) Единая страница со всем листом и возможностью докупить:  
- Attributes, Abilities, Disciplines, Backgrounds, Virtues: увеличиваем freebie слой traits.*.<key>.freebie  
- Merits: выбор meritsSelected уже есть; на этом шаге можно добавлять/убирать merits (учти бюджет)  
- Flaws: можно добавлять/убирать flaws (cap +7 на доход)  
2) Бюджет:  
- base 15  
- + min(sumFlawsGain, 7)  
- - costMerits  
- - costFreebieInvestments (стоимости за докупку)  
Важно: стоимости за докупку задай отдельной таблицей (константа) и используй везде последовательно.  
  
Server:  
- wizard/next валидирует, что бюджет >=0 и все диапазоны соблюдены.  
  
Client:  
- показывает "Осталось freebie: N"  
  
Верни unified diff.  
  
Критерии:  
- бюджет пересчитывается детерминированно  
- сервер отклоняет выход за диапазоны

---

## Prompt 30 — Rollback engine freebies по приоритету (раздел 7)

Реализуй детерминированный rollback freebie (server):  
  
Триггеры:  
1) Удалили flaw и бюджет стал отрицательным  
2) Изменили ранние шаги wizard так, что текущие freebie распределения стали невалидными  
  
Порядок отката:  
1. Humanity  
2. Willpower  
3. Backgrounds  
4. Disciplines  
5. Abilities  
6. Attributes  
7. Virtues  
8. Merits  
  
Правило:  
- идём по списку, уменьшаем freebie часть (или удаляем merits с конца), пока бюджет не станет валидным.  
  
Интеграция:  
- при патче на flawsSelected или при “step rewind” (изменение данных раннего шага) сервер применяет rollback и затем сохраняет документ одной транзакцией save().  
  
Client:  
- показывает toast "Часть freebie была откатана из-за изменения бюджета" (один общий).  
  
Верни unified diff.  
  
Критерии:  
- rollback детерминированный и воспроизводимый  
- после rollback бюджет всегда >=0

---

## Prompt 31 — Wizard Step 9: Финальный обзор + finish с confirmBurn + фикс starting*

Реализуй Step 9 и wizard/finish:  
  
Client:  
1) Финальный обзор (read-only): ключевые totals + остаток freebie.  
2) Кнопка "Завершить":  
- вызывает POST /api/characters/:uuid/wizard/finish  
- если сервер отвечает warning о непотраченных очках -> показать модал подтверждения -> повторить вызов с {confirmBurn:true}  
  
Server:  
1) wizard/finish:  
- валидирует ВЕСЬ лист + бюджеты  
- если остались непотраченные freebies -> вернуть { warning:true, message:"Остались непотраченные очки" }  
- при confirmBurn=true продолжить  
2) При успехе:  
- creationFinished=true  
- derived.startingHumanity = virtues.conscience.total + virtues.selfControl.total  
- derived.startingWillpower = virtues.courage.total  
- удалить wizard объект  
  
Верни unified diff.  
  
Критерии:  
- wizard больше недоступен после finish  
- /c/:uuid открывает игровой режим

---

## Prompt 32 — Import/Export: REST + UI (строгий импорт)

Добавь импорт/экспорт по ТЗ:  
  
Server:  
- GET /api/characters/:uuid/export -> JSON полного документа БЕЗ uuid  
- POST /api/characters/:uuid/import -> перезаписывает персонажа данными из JSON, uuid игнорируется  
- строгая валидация: если JSON невалидный -> reject с errors  
- импорт не должен “чинить” значения, только отклонять  
  
Client:  
- На /c/:uuid включи кнопки Export/Import:  
  - Export: скачать JSON файл  
  - Import: выбрать JSON файл и отправить на import (перезапись), затем resync  
- На Home кнопка "Импорт": создаёт персонажа -> импортит JSON -> редирект на /c/:uuid  
  
Верни unified diff.  
  
Критерии:  
- export не содержит uuid  
- import строгий, при ошибке показывает ошибки

---

## Prompt 33 — Help page + финальный проход полировки UX

Доработай UX:  
  
1) /help: инструкция по режимам (Wizard/Игра/ST), импорт/экспорт, общие правила.  
2) Тосты:  
- ошибки валидации  
- resync после reject  
- rollback уведомление  
- успешный импорт/экспорт  
3) Мелкие тексты на русском, без англицизмов в UI.  
  
Верни unified diff.  
  
Критерии:  
- основные сценарии понятны без README

---

## Prompt 34 — Docker multi-stage production + server serving client dist

Сделай production сборку по ТЗ:  
  
1) Dockerfile multi-stage:  
- stage1: vite build клиента  
- stage2: tsc build сервера  
- final: prod deps + server + статические файлы клиента  
2) Обнови docker-compose.yml чтобы использовался production Dockerfile для app.  
3) Server должен раздавать built client (dist) и корректно отдавать SPA fallback на index.html для фронтовых роутов (кроме /api/* и /socket.io/*).  
  
Верни unified diff.  
  
Критерии:  
- docker-compose up --build поднимает приложение  
- открываются /, /chronicles/:id, /c/:uuid, /help напрямую по URL