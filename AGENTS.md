# AGENTS.md

Этот файл нужен как практичная карта репозитория `vampire_siesta_ai` для следующих сессий разработки.
Здесь собраны только полезные для работы вещи: где лежит код, как приложение запускается и куда идти при типовых изменениях.

## Кратко О Проекте

- Монорепозиторий на `npm workspaces`.
- Фронтенд: `apps/client` на React 18 + Vite + React Router.
- Бэкенд: `apps/server` на Express + Socket.IO + Mongoose.
- База данных: MongoDB.
- Домен: лист персонажа Vampire: The Masquerade (V20), хроники, бой, авторизация и редактирование персонажа в реальном времени.

## Карта Репозитория

- `apps/client`
  React-приложение. Главная точка входа: `src/main.tsx`, маршруты: `src/App.tsx`.
- `apps/client/src/pages`
  Основные страницы: логин, главная, хроника, бой, лист персонажа, storyteller view, профиль, помощь.
- `apps/client/src/components`
  Переиспользуемые UI-компоненты, например `Wizard`, `GameMode`, `HealthTrack`.
- `apps/client/src/components/HelpPopover.tsx`
  Общий click-based popover для справочных описаний в UI. Отвечает за single-open поведение, закрытие по клику вне popover и позиционирование относительно строки/контрола, а не только самой кнопки.
- `apps/client/src/context`
  Глобальное состояние через React context: auth, dictionaries, toast-уведомления, actions в заголовке.
- `apps/client/src/hooks/useCharacterSocket.ts`
  Клиентский Socket.IO-хук для живых патчей персонажа и resync.
- `apps/client/src/api`
  Обёртка над same-origin JSON API и общие DTO-типы.
- `apps/client/src/utils/dictionaryHelp.ts`
  Нормализация и сборка текста словарных подсказок из `description`, `specializationDescription`, `specializationAt`, `category`, `pageRef`.
- `apps/server/src/index.ts`
  Bootstrap сервера: загрузка env, подключение к Mongo, создание Express app, подключение Socket.IO.
- `apps/server/src/app.ts`
  Настройка Express: CORS, JSON body parser, `/api` router, раздача статики в production.
- `apps/server/src/routes`
  HTTP-слой, разбитый на `auth`, `dictionaries`, `chronicles`, `characters`.
- `apps/server/src/auth`
  OAuth и сессионная логика, cookie-хелперы, repository layer, auth-errors и утилиты.
- `apps/server/src/socket.ts`
  Real-time логика и валидация патчей персонажа.
- `apps/server/src/validation`
  Подсистема валидации персонажа: модульный v2 pipeline, legacy-адаптер, метрики, кэш, тесты.
- `apps/server/src/db`
  Подключение к Mongo и Mongoose-модели для users, sessions, characters, chronicles, combat, dictionaries, avatars, OAuth flow.
- `data`
  JSON-источники для сидирования справочников и референсных данных.
- `scripts/dev.mjs`
  Корневой dev-оркестратор, который поднимает клиент и сервер вместе.
- `deploy/nginx`
  Пример reverse-proxy-конфига для production.
- `.agents/skills`
  Локальные Codex skills для этого репозитория. Это часть tooling, а не runtime-код приложения. Основные скилы: `dialectic`, `root-cause-investigator`, `learn`.

## Локальные Skills Для Codex

- Все локальные скилы лежат в `.agents/skills/<skill-name>/SKILL.md`.
- Эти файлы относятся к tooling для агентных сессий и не влияют на runtime приложения.
- Если задача явно совпадает с назначением скила, полезно сначала открыть его `SKILL.md`, а уже потом выполнять работу.
- Сейчас в репозитории есть такие локальные скилы:
  `dialectic` — для проверки спорного утверждения или архитектурной гипотезы через параллельный разбор "за" и "против" с последующей верификацией по реальному коду.
  `root-cause-investigator` — для системного поиска первопричины багов, падений тестов, build failures, деградации производительности и интеграционных проблем по методике 5 Why.
  `learn` — для сохранения стратегических выводов из текущей сессии в локальный `AGENTS.md`, если во время работы нашлись устойчивые архитектурные или процессные знания, полезные в будущем.

## Как Устроено Приложение

- Корневой `npm run dev` запускает оба workspace параллельно через `scripts/dev.mjs`.
- Клиент работает через Vite. Сервер обычно слушает `PORT=4000`.
- В production сервер сам раздаёт собранный фронтенд из `apps/client/dist` или из `CLIENT_DIST_PATH`.
- Все клиентские маршруты, кроме `/auth/login`, защищены на уровне фронтенда.
- Почти все бэкенд-маршруты под `/api` тоже защищены после подключения auth middleware.
- Справочники загружаются после авторизации через `DictionariesProvider`; многие экраны предполагают, что они уже доступны.
- Изменения персонажа проходят в реальном времени через Socket.IO, cookie-auth и optimistic versioning.
- Главная страница помимо хроник загружает завершённых персонажей текущего пользователя через `GET /api/characters?owner=me&creationFinished=true`; в этот список не попадают черновики, удалённые персонажи и персонажи других пользователей.

## Заметки По Клиенту

- Провайдеры подключаются в `apps/client/src/main.tsx`: `BrowserRouter`, `ToastProvider`, `AuthProvider`.
- Маршруты объявлены в `apps/client/src/App.tsx`.
- `ProtectedRoutes` перенаправляет анонимного пользователя на `/auth/login`.
- Все API-запросы идут через `apps/client/src/api/client.ts` и используют `credentials: "same-origin"`.
- При `401` от API или сокета клиент диспатчит browser event `vs:auth-unauthorized`.
- Отдельной библиотеки глобального состояния нет; основа приложения это contexts + локальный state.
- Глобальные стили находятся в `apps/client/src/styles.css`.
- Справочные описания словарей в UI теперь должны идти через `HelpPopover`, а не через `title`/hover tooltip.
- `HelpPopoverGroup` гарантирует, что одновременно открыт только один popover в пределах экрана/секции.
- Для полей, где описание зависит от выбранного значения (`секта`, `натура`, `поведение`), `HelpPopoverButton` поддерживает `showWhenEmpty`: кнопка остаётся на месте disabled и не даёт вёрстке прыгать.
- Если нужно изменить состав текста в popover, сначала смотреть `apps/client/src/utils/dictionaryHelp.ts`, а не править `Wizard`/`GameMode` по месту.
- Импорт JSON в UI доступен на странице хроники (`ChroniclePage`) и создаёт нового персонажа в этой хронике; на главной и странице персонажа пользовательский импорт не показывается.

## Заметки По Серверу

- Переменные окружения загружаются через `apps/server/src/utils/loadEnv.ts`, который ищет `.env` в текущей директории и ещё в двух родительских.
- Конфигурация централизована в `apps/server/src/config.ts`.
- `createApp()` включает `trust proxy`, опциональный CORS, JSON parsing, `/api` router и раздачу статики в production.
- `createApiRouter()` публикует `/api/health`, auth routes, validation maintenance endpoints и доменные роутеры.
- Socket-авторизация использует те же session cookies, что и HTTP.
- Socket patch flow проверяет версию персонажа, нормализует патч, валидирует его по справочникам и правилам, мутирует документ и затем рассылает patch/resync события.
- Экспорт персонажа идёт через `GET /api/characters/:uuid/export` и санитизируется в `apps/server/src/utils/characterTransfer.ts`: не должен сохранять UUID, owner/player-поля и `meta.chronicleId`.
- Импорт персонажа в хронику идёт через `POST /api/chronicles/:id/characters/import`: сервер игнорирует переносимые identity/system/owner/player/`meta.chronicleId` поля, подставляет хронику из URL и текущего пользователя как владельца/игрока. Старый `POST /api/characters/:uuid/import` закрыт для перезаписи существующих персонажей.

## Подсистема Валидации

- Валидация живёт в `apps/server/src/validation`.
- Актуальная архитектура описана в `apps/server/src/validation/architecture.md`.
- `service.ts` это основной orchestration layer для валидации, метрик, dictionary cache и patch structure validation.
- `characterValidation.ts` это совместимый entrypoint и переключатель по feature flag.
- `legacyCharacterValidation.ts` сохранён для безопасного rollback.
- Правила разбиты по зонам ответственности: `baseRules`, `clanRules`, `generationRules`, `wizardRules`.
- Флаги:
  `VALIDATION_ENGINE_V2=1` включает модульный валидатор.
  `VALIDATION_SIDE_BY_SIDE=1` позволяет сравнивать legacy и v2 в логах.

## Auth И OAuth

- Авторизация построена на session cookies, а не на токенах.
- Поддерживаются Google и Yandex.
- OAuth-маршруты живут под `/api/auth/*`.
- Логин может быть недоступен, если не настроен ни один OAuth-провайдер.
- Важное правило по redirect:
  OAuth callback URL должен указывать на browser origin клиента, а не на сырой порт сервера при локальной разработке через Vite.
- Auth endpoints также отвечают за изменение display name и аватара.

## Seed И Справочные Данные

- Команда сидирования: `npm run seed`.
- Реализация сидирования: `apps/server/src/seed.ts`.
- Источник данных: `data/*.json`.
- Seed заполняет clans, disciplines, attributes, abilities, backgrounds, merits, flaws, natures, demeanors, virtues, sects и generations.
- Seed также гарантирует наличие дефолтной хроники.
- `virtues` и `sects` больше не зашиты inline в `seed.ts`; их source of truth — `data/virtues.json` и `data/sects.json`.
- `natures` и `demeanors` продолжают сидироваться из `data/archetypes.json`; если нужно поправить их описания, менять именно этот файл.
- `syncByKey()` в `seed.ts` делает `deleteMany({ key: { $nin: keys } })` + `updateOne(..., { upsert: true })`, поэтому повторный `npm run seed` обновляет тексты и состав словарей в MongoDB без ручной чистки базы.
- Для словарных описаний важен полный путь `data/*.json -> seed.ts -> /api/dictionaries/* -> DictionariesProvider -> buildDictionaryHelpText()`.

## Полезные Команды

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `npm run seed`
- `npm -w apps/server run test`
- Если в локальном shell `node`/`npm` не находятся, в этом окружении помогает сначала выполнить `source ~/.nvm/nvm.sh && nvm use 25.9.0`.

## Docker И Деплой

- `Dockerfile` отдельно собирает клиент и сервер, а затем запускает собранный сервер в production.
- `docker-compose.yml` поднимает `mongo` и `app`, а профиль `https` добавляет контейнерный `nginx` на `80/443`.
- Compose выставляет `NODE_ENV=production` и раздаёт статический клиент через сервер.
- Compose запускает Mongo с `mongod --auth` и на первом старте может создать root-пользователя через `MONGO_INITDB_ROOT_USERNAME` / `MONGO_INITDB_ROOT_PASSWORD`; контейнер `app` в compose получает строку подключения из `COMPOSE_MONGO_URL`, чтобы не конфликтовать с локальным `MONGO_URL`.
- `deploy/nginx/vampire-siesta.example.conf` содержит пример reverse-proxy-конфига для `nginx` на хосте, а `deploy/nginx/vampire-siesta.docker.conf` — для `nginx` в Docker Compose.

## Куда Вносить Изменения

- UI, page flow и поведение экранов:
  `apps/client/src/pages`, `apps/client/src/components`, `apps/client/src/styles.css`
- Поведение и визуал справочных popover:
  `apps/client/src/components/HelpPopover.tsx`, `apps/client/src/utils/dictionaryHelp.ts`, `apps/client/src/styles.css`
- Auth UI или session UX:
  клиентский `context/AuthContext.tsx`, страницы логина и профиля, серверные `src/auth` и `src/routes/auth.ts`
- API-контракты или fetch-поведение:
  клиентский `src/api`, серверные `src/routes`, DTO/presenter-утилиты на сервере
- Real-time редактирование персонажа:
  клиентский `hooks/useCharacterSocket.ts`, серверный `socket.ts`, patch-path helpers и валидация
- Правила создания персонажа и валидация:
  `apps/server/src/validation` и связанные тесты
- Справочники и V20 reference data:
  `data/*.json`, `apps/server/src/seed.ts`, а при изменении схемы ещё и соответствующие models/routes
- Если описание словаря не видно на клиенте, проверять не только `data/*.json`, но и `apps/server/src/routes/dictionaries.ts`: часть групп пробрасывает `description` через отдельные select-поля.
- Форма хранения в базе:
  `apps/server/src/db/models`

## Что С Тестами

- На сервере есть тесты для auth-утилит, config, character transfer/presenter helpers и validation subsystem.
- Видимых клиентских тестов в репозитории сейчас нет.
- После изменений в backend-правилах минимум запускать `npm -w apps/server run test`.
- После сквозных изменений полезно прогонять `npm run typecheck`.

## Важные Нюансы

- Раздача клиентской статики сервером работает только при `NODE_ENV=production`.
- Если сервер запускается не из корня репозитория, нужно явно задать `CLIENT_DIST_PATH`.
- Так как API и Socket.IO завязаны на cookies, CORS и `ALLOWED_ORIGINS` должны совпадать с реальным browser origin.
- Ошибки анонимного доступа часто связаны не с отсутствием маршрута, а с auth/session-проблемой.
- Многие экраны завязаны на предварительную загрузку справочников; сбой dictionaries может выглядеть как общая поломка UI.
- Поведение валидации зависит от `VALIDATION_ENGINE_V2` и `VALIDATION_SIDE_BY_SIDE`.
- Секреты из `.env` не коммитим; коммитим только примеры в `.env.example`.
