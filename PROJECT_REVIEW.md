# Проектный Review: `siesta_ai`

## Scope

Проверены клиент, сервер, маршруты, auth/session flow, socket flow, валидация, CSS и общая архитектура.

Дополнительно прогнаны:

- `npm.cmd run typecheck` - успешно
- `npm.cmd -w apps/server run test` - успешно, но тестовый прогон показал предупреждения Mongoose о дублирующихся индексах

Ниже - 7 главных проблем приложения в порядке приоритета. Для каждой проблемы приведены:

- краткий вывод
- доказательства по коду
- impact
- 5-Why анализ
- корневая причина
- что делать первым

## Top 7

### 1. Критическая: в HTTP API почти нет авторизации на уровне ресурса

`apps/server/src/routes/api.ts:23` гарантирует только факт авторизации пользователя, но не право на доступ к конкретной хронике, персонажу, бою, логам или изображениям.

Доказательства:

- `apps/server/src/routes/characters.ts:225` - персонаж читается только по `uuid`
- `apps/server/src/routes/characters.ts:242` - персонаж удаляется только по `uuid`
- `apps/server/src/routes/characters.ts:293`, `apps/server/src/routes/characters.ts:328`, `apps/server/src/routes/characters.ts:355`, `apps/server/src/routes/characters.ts:387` - wizard endpoints тоже работают только по `uuid`
- `apps/server/src/routes/chronicles.ts:78`, `apps/server/src/routes/chronicles.ts:90`, `apps/server/src/routes/chronicles.ts:103`, `apps/server/src/routes/chronicles.ts:178`, `apps/server/src/routes/chronicles.ts:203`, `apps/server/src/routes/chronicles.ts:249`, `apps/server/src/routes/chronicles.ts:288`, `apps/server/src/routes/chronicles.ts:302`, `apps/server/src/routes/chronicles.ts:337`, `apps/server/src/routes/chronicles.ts:402`, `apps/server/src/routes/chronicles.ts:421` - chronicle/combat/images/log routes проверяют существование ресурса, но не его владельца, участника или роль
- `apps/server/src/auth/types.ts:3` объявляет роли `player | storyteller | admin`, но в route layer они фактически не участвуют в принятии решений

Impact:

- любой авторизованный пользователь может читать, менять и удалять чужие сущности, если узнает `uuid` персонажа или `_id` хроники
- это самый высокий риск в проекте: нарушение целостности данных и приватности

#### 5-Why

1. Why #1: потому что route handlers фильтруют документы по идентификатору ресурса, а не по идентификатору пользователя или членству.
2. Why #2: потому что middleware ограничивается authentication и не добавляет authorization policy.
3. Why #3: потому что в приложении нет единого слоя правил доступа к хроникам и персонажам.
4. Why #4: потому что доменная модель хранит `createdByUserId`, но не хранит участников, storyteller ownership и explicit permissions.
5. Why #5: потому что архитектура развивалась feature-first вокруг предположения "любой вошедший пользователь доверенный".

#### Root Cause Identified

В проекте отсутствует явная модель доступа к доменным ресурсам и отсутствует единый policy/service слой авторизации.

#### Что делать первым

- ввести authorization service для `chronicle` и `character`
- добавить membership/ownership модель для хроник
- перевести все route queries на policy-aware filters

### 2. Критическая: Socket.IO канал не изолирован и принимает доверие от клиента

Socket-слой повторяет ту же проблему, но еще опаснее: клиент сам сообщает, в какую комнату войти и какой `characterUuid` патчить.

Доказательства:

- `apps/server/src/socket.ts:104` - room join по `queryUuid`
- `apps/server/src/socket.ts:108` - явный `join` принимает произвольный `payload.uuid`
- `apps/server/src/socket.ts:115` - patch handler принимает `characterUuid` с клиента
- `apps/server/src/socket.ts:134` - персонаж ищется только по `uuid`
- `apps/server/src/socket.ts:266`, `apps/server/src/socket.ts:270` - события рассылаются в комнату, имя которой равно `characterUuid`
- `apps/client/src/hooks/useCharacterSocket.ts:58`, `apps/client/src/hooks/useCharacterSocket.ts:59`, `apps/client/src/hooks/useCharacterSocket.ts:60` - клиент сам открывает сокет с `query: { uuid }`

Impact:

- любой авторизованный пользователь может подписаться на чужие изменения персонажа
- любой авторизованный пользователь потенциально может отправлять patch для чужого персонажа
- это нарушает и приватность, и целостность данных, и real-time trust model

#### 5-Why

1. Why #1: потому что socket room определяется клиентским `uuid`, а не серверным разрешением.
2. Why #2: потому что socket middleware проверяет только валидность сессии, но не право на ресурс.
3. Why #3: потому что HTTP и socket используют одну идею "authenticated == allowed".
4. Why #4: потому что transport layer проектировался вокруг удобства доставки patch-событий, а не вокруг secure domain boundary.
5. Why #5: потому что в проекте нет общего authorization механизма, обязательного для всех транспортов.

#### Root Cause Identified

Socket transport не подчинен единой политике доступа и доверяет идентификаторам, присланным клиентом.

#### Что делать первым

- запретить `join` без server-side authorization check
- вычислять допустимые rooms на сервере
- перед патчем проверять ownership/role/membership так же, как в HTTP

### 3. Высокая: правила домена размазаны по клиенту, transport-слою и двум версиям серверной валидации

Сейчас у мастера создания персонажа несколько источников истины одновременно.

Доказательства:

- клиент хранит budgets и rule math прямо в `apps/client/src/components/Wizard.tsx:27`, `apps/client/src/components/Wizard.tsx:41`, `apps/client/src/components/Wizard.tsx:42`, `apps/client/src/components/Wizard.tsx:330`, `apps/client/src/components/Wizard.tsx:346`, `apps/client/src/components/Wizard.tsx:358`, `apps/client/src/components/Wizard.tsx:365`, `apps/client/src/components/Wizard.tsx:372`, `apps/client/src/components/Wizard.tsx:400`
- новый серверный источник правил есть в `apps/server/src/validation/rules/wizardRules.ts:15`, `apps/server/src/validation/rules/wizardRules.ts:16`, `apps/server/src/validation/rules/wizardRules.ts:25`
- legacy-правила все еще живут в `apps/server/src/validation/legacyCharacterValidation.ts:22`, `apps/server/src/validation/legacyCharacterValidation.ts:23`, `apps/server/src/validation/legacyCharacterValidation.ts:33`
- фасад-переключатель между движками находится в `apps/server/src/validation/characterValidation.ts:99`, `apps/server/src/validation/characterValidation.ts:106`, `apps/server/src/validation/characterValidation.ts:287`, `apps/server/src/validation/characterValidation.ts:294`, `apps/server/src/validation/characterValidation.ts:308`
- часть доменной логики все равно остается в transport layer: `apps/server/src/routes/characters.ts:293`, `apps/server/src/routes/characters.ts:328`, `apps/server/src/routes/characters.ts:355`, `apps/server/src/routes/characters.ts:387`, `apps/server/src/routes/characters.ts:402`, `apps/server/src/socket.ts:178`, `apps/server/src/socket.ts:240`, `apps/server/src/socket.ts:254`

Impact:

- одно изменение правил нужно делать в нескольких местах
- повышается риск расхождения UX и серверного поведения
- сложнее гарантировать корректность после рефакторинга

#### 5-Why

1. Why #1: потому что budgets, step rules и freebie math продублированы в клиенте и на сервере.
2. Why #2: потому что UI пытается быть "умным" и заранее ограничивать действия локально.
3. Why #3: потому что routes и socket handlers держат часть workflow у себя, вместо вызова одного application service.
4. Why #4: потому что рефакторинг валидации оставил legacy и v2 параллельно, не устранив старую поверхность.
5. Why #5: потому что в архитектуре нет единой доменной границы с одним источником истины для правил создания персонажа.

#### Root Cause Identified

В проекте нет одного authoritative domain service для character creation/editing; правила распределены между несколькими слоями.

#### Что делать первым

- собрать весь wizard workflow в один application/domain service
- оставить клиенту только UX-подсказки, а не копию бизнес-правил
- убрать legacy/v2 duality после миграции и проверки

### 4. Высокая: React-слой перегружен слишком крупными компонентами и страницами

Компоненты и страницы одновременно отвечают за загрузку данных, бизнес-логику, orchestration, browser APIs и рендеринг.

Доказательства:

- `apps/client/src/components/Wizard.tsx` - 1741 строка
- `apps/client/src/components/GameMode.tsx` - 1527 строк
- `apps/client/src/pages/ChroniclePage.tsx` - 491 строка
- `apps/client/src/pages/CombatPage.tsx` - 684 строки
- `apps/client/src/pages/StorytellerPage.tsx` - 491 строка
- `apps/client/src/components/Wizard.tsx:129` - fetch хроник внутри UI-компонента
- `apps/client/src/components/Wizard.tsx:211` - imperative confirm flow внутри компонента
- `apps/client/src/pages/ChroniclePage.tsx:35`, `apps/client/src/pages/ChroniclePage.tsx:191`, `apps/client/src/pages/ChroniclePage.tsx:199`, `apps/client/src/pages/ChroniclePage.tsx:233`, `apps/client/src/pages/ChroniclePage.tsx:248` - страница одновременно fetches, imports, uploads, deletes и orchestrates navigation
- `apps/client/src/pages/CombatPage.tsx:103`, `apps/client/src/pages/CombatPage.tsx:135`, `apps/client/src/pages/CombatPage.tsx:221`, `apps/client/src/pages/CombatPage.tsx:248`, `apps/client/src/pages/CombatPage.tsx:356`, `apps/client/src/pages/CombatPage.tsx:388`
- `apps/client/src/pages/StorytellerPage.tsx:76`, `apps/client/src/pages/StorytellerPage.tsx:80`, `apps/client/src/pages/StorytellerPage.tsx:95`, `apps/client/src/pages/StorytellerPage.tsx:153`, `apps/client/src/pages/StorytellerPage.tsx:168`

Impact:

- код тяжело читать и безопасно менять
- почти невозможно покрывать важные сценарии компактными unit/component tests
- любая доработка тянет высокий cognitive load и риск регрессии

#### 5-Why

1. Why #1: потому что крупные компоненты совмещают fetch logic, domain decisions, imperative browser APIs и JSX.
2. Why #2: потому что feature logic не вынесена в отдельные hooks/use-cases/presenters.
3. Why #3: потому что страницы развивались инкрементально и остались главной точкой сборки всего поведения.
4. Why #4: потому что текущая client architecture опирается на contexts + local state, но без четких feature boundaries.
5. Why #5: потому что maintainability limits вроде decomposition rules, max file size или mandatory extraction patterns не были закреплены как инженерные ограничения.

#### Root Cause Identified

Клиентский слой не разделен на presentation, data hooks и use-case orchestration; почти все остается внутри страниц и гигантских компонентов.

#### Что делать первым

- разбить `Wizard` на step components + shared hooks
- вынести `ChroniclePage` и `CombatPage` в page shell + feature sections
- держать data access отдельно от UI-компонентов

### 5. Высокая: CSS-архитектура стала монолитом с повторными глобальными override

`apps/client/src/styles.css` уже дорос до 3078 строк и содержит несколько слоев переопределений одних и тех же глобальных селекторов.

Доказательства:

- `apps/client/src/styles.css:4` и `apps/client/src/styles.css:3073` - два блока `:root`
- `apps/client/src/styles.css:15` и `apps/client/src/styles.css:3094` - два глобальных блока `body`
- `apps/client/src/styles.css:29` и `apps/client/src/styles.css:3115` - повтор `.inline-link`
- `apps/client/src/styles.css:280` и `apps/client/src/styles.css:3226` - повтор `.icon-button`
- `apps/client/src/styles.css:347` и `apps/client/src/styles.css:3249` - повтор `button`
- `apps/client/src/styles.css:407` и `apps/client/src/styles.css:3169` - повтор `.card`
- `apps/client/src/styles.css:1415`, `apps/client/src/styles.css:2584`, `apps/client/src/styles.css:3526` - несколько независимых `@media (max-width: 720px)`

Impact:

- поведение каскада становится трудно предсказуемым
- рефакторинг дизайна требует помнить о поздних overrides
- повышается риск "случайных" визуальных регрессий

#### 5-Why

1. Why #1: потому что одни и те же селекторы переопределяются позже в этом же файле.
2. Why #2: потому что все стили живут в одном глобальном stylesheet.
3. Why #3: потому что нет явного layering: base, theme, components, pages, utilities.
4. Why #4: потому что новые визуальные изменения накладывались поверх старых, вместо структурного рефакторинга.
5. Why #5: потому что CSS не оформлен как система с собственными архитектурными ограничениями.

#### Root Cause Identified

Стили эволюционировали additively в одном глобальном файле без изоляции, слоев и контрактов между компонентами.

#### Что делать первым

- разделить CSS минимум на `tokens`, `base`, `layout`, `components`, `pages`
- прекратить late overrides для глобальных селекторов
- локализовать стили feature-компонентов

### 6. Средне-высокая: data loading и state sync устроены фрагментированно и слишком "болтливо"

У приложения нет единой стратегии загрузки данных и синхронизации состояния: где-то сокеты, где-то polling, где-то fan-out из нескольких REST-запросов.

Доказательства:

- `apps/client/src/App.tsx:43` - все protected routes блокируются через `DictionariesProvider`
- `apps/client/src/context/DictionariesContext.tsx:66` - загрузка 12 справочников через `Promise.all`
- `apps/client/src/context/DictionariesContext.tsx:67`-`apps/client/src/context/DictionariesContext.tsx:78` - 12 отдельных GET-запросов
- `apps/client/src/context/DictionariesContext.tsx:132` - recovery через `window.location.reload()`
- `apps/server/src/routes/dictionaries.ts:20`-`apps/server/src/routes/dictionaries.ts:122` - сервер тоже отдает 12 отдельных endpoints
- `apps/server/src/routes/api.ts:23` и `apps/server/src/routes/api.ts:37` - справочники еще и завязаны на auth middleware, поэтому весь protected UI зависит от их успешной загрузки после логина
- `apps/client/src/pages/ChroniclePage.tsx:35` - хроника грузится fan-out запросом из 5 endpoints
- `apps/client/src/pages/CombatPage.tsx:103` - бой стартует с fan-out из 3 endpoints
- `apps/client/src/pages/CombatPage.tsx:135` - polling каждые 5 секунд
- `apps/client/src/components/GameMode.tsx:210` - еще один polling loop

Impact:

- лишняя задержка на старте и при навигации
- увеличение количества точек отказа
- часть данных живет в near-real-time, часть - в 5-секундной stale zone
- сложно централизованно кэшировать и управлять invalidation

#### 5-Why

1. Why #1: потому что каждый экран и провайдер грузит свои данные напрямую и по-своему.
2. Why #2: потому что нет общего data layer с aggregation, caching и invalidation.
3. Why #3: потому что backend routes спроектированы вокруг коллекций и CRUD-поверхностей, а не вокруг use cases экранов.
4. Why #4: потому что real-time стратегия не унифицирована: character sheet работает по сокетам, другие части - по polling или fan-out REST.
5. Why #5: потому что архитектура не закрепила отдельный слой управления данными и state sync policy.

#### Root Cause Identified

Frontend и backend не разделяют единую use-case-oriented стратегию доставки данных; каждый экран фактически изобретает ее заново.

#### Что делать первым

- агрегировать справочники в один endpoint
- ввести client-side query/cache слой
- решить на уровне архитектуры, что real-time, а что polling, и почему

### 7. Средне-высокая: автоматическое покрытие не защищает ключевые пользовательские и security-сценарии

Формально typecheck и серверные unit tests проходят, но этого недостаточно для текущего профиля рисков.

Доказательства:

- `apps/client/package.json:6`-`apps/client/package.json:10` - в клиенте нет `test` script
- в `apps/client/src` отсутствуют `*.test.*` и `*.spec.*` файлы
- `apps/server/package.json:11` - тестовый запуск ограничен `src/**/*.test.ts`
- существующие server tests покрывают в основном `config`, `auth`, `utils`, `validation`, но не `routes` и не `socket`

Impact:

- текущие проблемы с доступом и transport isolation спокойно проходят через CI-подобную проверку
- изменения в UI и routing зависят почти полностью от ручной проверки
- архитектурные регрессии становятся видны слишком поздно

#### 5-Why

1. Why #1: потому что automated checks почти не заходят в пользовательские flows и authorization boundaries.
2. Why #2: потому что тесты сосредоточены на низкоуровневых функциях, а не на интеграции маршрутов, сокетов и UI.
3. Why #3: потому что текущая структура клиента и transport-слоя плохо подготовлена к удобному тестированию.
4. Why #4: потому что основная ставка сделана на typecheck и ручную проверку фич.
5. Why #5: потому что quality strategy не была сформулирована как часть архитектуры и security posture.

#### Root Cause Identified

В проекте нет обязательной тестовой пирамиды для client, route-level authorization и end-to-end сценариев.

#### Что делать первым

- добавить route tests для `characters`, `chronicles`, `auth avatar`, `socket`
- покрыть хотя бы 2-3 критических e2e сценария
- после декомпозиции начать component tests для `Wizard` и `ChroniclePage`

## Cross-Cutting Pattern

Главный повторяющийся мотив в кодовой базе:

- authentication есть
- authorization как системы нет
- доменные правила есть
- single source of truth для них нет
- UI уже богатый
- архитектурный каркас вокруг него пока не дотянут

Именно это сочетание объясняет, почему одновременно возникают security-дыры, большие файлы, сложный data flow и слабая тестируемость.

## Secondary Observations

Это не вошло в top-7, но заслуживает внимания.

### A. Медиа хранятся как `dataUrl` в MongoDB

Доказательства:

- `apps/server/src/db/models/ChronicleImage.ts:6`
- `apps/server/src/db/models/UserAvatar.ts:6`
- `apps/server/src/routes/chronicles.ts:16`, `apps/server/src/routes/chronicles.ts:234`, `apps/server/src/routes/chronicles.ts:262`
- `apps/client/src/pages/ChroniclePage.tsx:191`, `apps/client/src/pages/ChroniclePage.tsx:215`

Это упростило разработку, но приведет к росту размера документов, памяти, трафика и ограничит нормальный image pipeline.

### B. Тесты показывают предупреждения о дублирующихся индексах Mongoose

Во время `npm.cmd -w apps/server run test` появились предупреждения про дубли `chronicleId` и `expiresAt`.

Вероятные источники:

- `apps/server/src/db/models/CombatState.ts:28` и `apps/server/src/db/models/CombatState.ts:40`
- `apps/server/src/db/models/ChronicleImage.ts:5` и `apps/server/src/db/models/ChronicleImage.ts:12`
- `apps/server/src/db/models/Session.ts:7` и `apps/server/src/db/models/Session.ts:14`
- `apps/server/src/db/models/OAuthFlow.ts:10` и `apps/server/src/db/models/OAuthFlow.ts:15`

Это не ломает приложение немедленно, но сигнализирует о неаккуратном контроле схем БД.

## Recommended Order

1. Сначала закрыть authorization для HTTP и Socket.IO.
2. Затем собрать единый domain/application service для character workflows.
3. После этого декомпозировать крупные React-компоненты и вынести data layer.
4. Параллельно начать минимальный набор integration/e2e тестов именно на security и ключевые flows.
5. Потом уже чистить CSS-архитектуру и media pipeline.
