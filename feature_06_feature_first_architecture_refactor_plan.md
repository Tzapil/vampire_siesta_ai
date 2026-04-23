# Фича 06: Feature-First архитектурный рефакторинг client/server, screen-oriented API и data layer

## Problem Statement

Сейчас приложение страдает сразу от нескольких связанных архитектурных проблем:

- React-слой перегружен крупными страницами и компонентами:
  - `apps/client/src/components/Wizard.tsx`
  - `apps/client/src/components/GameMode.tsx`
  - `apps/client/src/pages/ChroniclePage.tsx`
  - `apps/client/src/pages/CombatPage.tsx`
  - `apps/client/src/pages/StorytellerPage.tsx`
- UI-компоненты одновременно отвечают за:
  - загрузку данных,
  - orchestration,
  - browser APIs,
  - локальную и серверную синхронизацию,
  - JSX и стили.
- Клиентский REST-слой не имеет единого data layer:
  - `AuthProvider` и `DictionariesProvider` реализуют собственные bootstrap/load/error сценарии,
  - страницы дублируют `loading/error/retry/refetch`,
  - reuse данных между экранами почти отсутствует.
- Справочники глобально блокируют весь protected UI, хотя нужны не всем страницам.
- Клиентский API в основном опирается на collection/CRUD endpoints и fan-out запросы, а не на screen/use-case контракты.
- Character area живёт на отдельной realtime-подсистеме, с низкоуровневым patch transport, размазанным между страницей, хуком сокета и UI.
- CSS уже превратился в глобальный монолит, с поздними override и слабой локализацией feature-стилей.

В результате:

- код тяжело читать и безопасно менять,
- почти невозможно добавлять компактные unit/component tests,
- любая доработка тянет высокий cognitive load,
- архитектурные улучшения тормозятся из-за отсутствия чётких feature boundaries.

## Goal

Выполнить почти атомарный большой рефакторинг приложения и перевести client и server application layers на полноценную feature-first архитектуру, чтобы:

- убрать data access из UI-компонентов,
- перевести client-facing API на screen/use-case-oriented контракты,
- ввести собственный доменно-ориентированный client data layer без TanStack Query,
- выделить общий workspace-пакет для pure domain logic и shared contracts,
- декомпозировать `Wizard`, `GameMode`, `ChroniclePage`, `CombatPage`, `StorytellerPage`,
- сохранить текущую transport-модель character editing (`socket patch/resync + REST wizard actions`), но спрятать её за feature-level boundaries,
- убрать глобальную полноэкранную блокировку protected UI загрузкой словарей,
- разрезать CSS на слои и feature-specific файлы без смены технологии стилизации.

## Non-Goals (для этой фичи)

- Внедрение `TanStack Query` или другой внешней query/cache библиотеки.
- Создание новой клиентской test infrastructure (`Vitest`/RTL и т.п.) как отдельного большого workstream.
- Полная унификация realtime-стратегии для всех shared screens.
- Замена текущего socket patch transport на новый command protocol.
- Полный пересмотр доменных правил `Wizard` или переписывание validation engine с нуля.
- Полный redesign приложения.
- Миграция с plain CSS на CSS Modules или CSS-in-JS.

## Зафиксированные архитектурные решения

- Рефакторинг идёт без `TanStack Query`; data layer строится своими силами.
- Scope фичи покрывает весь клиентский REST-слой, а не только `Wizard`/`ChroniclePage`/`CombatPage`.
- Допускается менять серверные API-контракты ради новой архитектуры клиента.
- Клиентская test infrastructure не входит в scope; фича останавливается на рефакторинге и существующих проверках.
- Для `Wizard` принимается гибридный подход:
  - сервер остаётся authoritative source of truth,
  - клиент сохраняет predictive UX guardrails и preview math,
  - общая pure math выносится в shared package.
- Вводится доменно-ориентированный client data layer, но без попытки написать generic query framework.
- Глобальный `DictionariesProvider` gate удаляется; словари становятся on-demand aggregated resource с prefetch после auth bootstrap.
- Допускается добавление нового workspace-пакета, например `packages/shared`.
- Socket transport для character editing сохраняется в текущей модели:
  - `patch`,
  - `patchApplied`,
  - `resync`,
  - REST `wizard/next|back|goto|finish`.
- При этом socket-подсистема тоже рефакторится и прячется за character feature layer.
- Фича допускает `refactor+UX`:
  - можно унифицировать loading/error/retry states,
  - убрать полноэкранную блокировку словарями,
  - подправить screen flow и локальные UX-шероховатости.
- Client-facing API переводится на screen/use-case-oriented контракты почти везде.
- Legacy collection/CRUD endpoints можно удалять по мере перевода клиента.
- `GameMode` и `StorytellerPage` входят в полноценную декомпозицию.
- В этой фиче не делается отдельная унификация freshness strategy для `Chronicle`/`Combat`/`GameMode`; focus остаётся на декомпозиции, data layer и screen-oriented API.
- Миграция планируется как почти атомарный большой рефакторинг.
- Целевая структура для client и server application layers — полноценный `feature-first`.
- CSS входит в scope и остаётся на plain CSS, но делится на слои и feature-specific файлы.
- Server application layer тоже перестраивается под feature/use-case boundaries, при сохранении отдельно infra/db/models/validation.

## Target Architecture

### Root workspaces

Корневой `package.json` должен перейти от:

- `"workspaces": ["apps/*"]`

к:

- `"workspaces": ["apps/*", "packages/*"]`

### Новый shared package

Новый пакет `packages/shared` становится местом для pure modules, которые нужны и клиенту, и серверу:

- `wizard`:
  - budgets,
  - freebie math,
  - priority helpers,
  - selectors/derivations без browser/server зависимостей.
- `character`:
  - patch path/value contracts,
  - socket payload contracts,
  - screen DTO contracts.
- `dictionaries`:
  - aggregated dictionaries DTO,
  - dictionary lookup helpers.
- `common`:
  - result/error value objects,
  - shared type guards,
  - pure mappers.

Ограничение:

- в `packages/shared` не должно быть зависимостей на React, Express, Mongoose, browser API, `window`, `document`, `FileReader`, `Socket`.

### Target client structure

`apps/client/src` должен перейти к feature-first форме:

- `app`
  - router,
  - providers,
  - app shell,
  - route composition,
  - global style imports.
- `shared`
  - low-level ui,
  - generic hooks,
  - lib/utils,
  - shared styles.
- `features/auth`
- `features/dictionaries`
- `features/home`
- `features/chronicle`
- `features/combat`
- `features/character`
- `features/storyteller`
- `pages`
  - только тонкие route entry points и page shells.

### Target server structure

`apps/server/src` должен перейти к зеркальной application-layer форме:

- `app`
  - bootstrap,
  - express/socket composition,
  - top-level router wiring.
- `shared`
  - http helpers,
  - presenter helpers,
  - common errors,
  - cross-feature mappers.
- `features/auth`
- `features/dictionaries`
- `features/home`
- `features/chronicle`
- `features/combat`
- `features/character`
- `features/storyteller`
- `infra`
  - `db`,
  - auth/session infra,
  - socket server plumbing,
  - low-level utilities.
- `validation`
  - сохраняется как отдельная доменная/infra подсистема, но перестаёт течь напрямую в UI-shaped adapters.

### Target CSS structure

Plain CSS остаётся, но перестраивается в слои:

- `apps/client/src/app/styles/tokens.css`
- `apps/client/src/app/styles/base.css`
- `apps/client/src/app/styles/layout.css`
- `apps/client/src/app/styles/components.css`
- `apps/client/src/app/styles/utilities.css`
- feature-specific файлы:
  - `features/character/styles.css`
  - `features/chronicle/styles.css`
  - `features/combat/styles.css`
  - `features/storyteller/styles.css`
  - и т.д.

Глобальный `styles.css` как монолит должен исчезнуть или стать только импорт-агрегатором.

## Целевые client-facing API контракты

Новая API-поверхность должна быть ориентирована на экраны и use cases, а не на fan-out коллекций.

Обязательные направления:

- `GET /api/dictionaries`
  - один агрегированный endpoint вместо отдельного `/clans`, `/attributes`, `/abilities`, ...
- `GET /api/home`
  - данные главной страницы:
    - хроники пользователя,
    - завершённые персонажи пользователя,
    - всё, что нужно home shell.
- `GET /api/chronicles/:id/page`
  - page contract для `ChroniclePage`:
    - хроника,
    - персонажи,
    - лог,
    - изображения,
    - combat summary.
- `GET /api/chronicles/:id/combat-screen`
  - contract для `CombatPage`:
    - хроника,
    - участники,
    - combat state,
    - всё, что нужно для инициализации combat screen.
- `GET /api/characters/:uuid/sheet`
  - contract для `CharacterPage`/`Wizard`/`GameMode`.
- `GET /api/characters/:uuid/storyteller-screen`
  - contract для `StorytellerPage`.

Допускается сохранить отдельные mutation endpoints, если они уже use-case-oriented:

- `POST /api/chronicles/:id/characters/import`
- `POST /api/chronicles/:id/combat/start`
- `POST /api/characters/:uuid/wizard/next`
- и т.д.

Но page bootstrap больше не должен собираться fan-out из 3-12 отдельных GET-запросов внутри UI.

## Step-by-Step Plan

### Step 1. Зафиксировать архитектурный каркас feature-first и workspace foundation

1. Обновить root workspace конфигурацию:
- добавить `packages/*` в `package.json`.
2. Создать `packages/shared` и настроить сборку/tsconfig так, чтобы пакет был доступен из `apps/client` и `apps/server`.
3. Зафиксировать правила импортов:
- app -> features -> shared,
- без cross-feature imports в обход публичного API feature,
- без прямого импорта `apps/server` в `apps/client` и наоборот.
4. Завести новые верхнеуровневые каталоги для client/server:
- `app`,
- `shared`,
- `features`,
- `infra` на сервере.
5. Подготовить базовый CSS entrypoint для layered plain CSS.

Done criteria:
- Монорепозиторий собирается с новым workspace-пакетом.
- Есть явный target skeleton для client/server.
- Импорт shared pure code работает без path-hacks.

### Step 2. Вынести shared pure domain logic и общие контракты

1. Перенести в `packages/shared` pure wizard math:
- budgets,
- freebie cost/budget helpers,
- priority permutation helpers,
- derived selectors и preview computations.
2. Вынести shared contracts:
- aggregated dictionaries DTO,
- screen DTO для `home`, `chronicle page`, `combat screen`, `character sheet`, `storyteller screen`,
- socket patch payload/result contracts.
3. Вынести common character helpers:
- patch-path typing,
- layered value helpers,
- pure mappers между domain shape и screen DTO.
4. Оставить server-only правила в серверной зоне:
- Mongoose access,
- auth/session resolution,
- side effects,
- rollback/resync orchestration,
- chronicle existence checks,
- save/mutate operations.

Done criteria:
- Клиент и сервер используют одну shared pure math/contracts поверхность.
- В `Wizard` больше не нужно держать самостоятельную копию budget math, если ту же чистую логику можно взять из shared package.
- Shared package не тянет runtime-зависимости браузера или Node infra.

### Step 3. Перестроить server application layer под feature-first use cases

1. Разделить сервер на feature-oriented application modules:
- `auth`,
- `dictionaries`,
- `home`,
- `chronicle`,
- `combat`,
- `character`,
- `storyteller`.
2. Вытащить из текущих `routes/*` и `socket.ts` use-case orchestration в feature services/handlers.
3. Оставить в `infra`:
- Mongoose models,
- auth/session storage,
- socket server wiring,
- low-level loaders,
- express-specific plumbing.
4. Сделать маршруты и socket handlers thin adapters:
- входные DTO,
- вызов feature service,
- presenter/response mapping.
5. Уменьшить прямую связность между route layer и validation internals.

Done criteria:
- `routes/*` больше не содержат основную доменную orchestration.
- `socket.ts` перестаёт быть монолитом; character realtime flow делится на auth middleware, room wiring и patch handler/use-case слой.
- Server application layer структурно повторяет клиентские feature boundaries.

### Step 4. Перевести сервер на screen/use-case-oriented API контракты

1. Добавить агрегированный endpoint `GET /api/dictionaries`.
2. Добавить `GET /api/home`.
3. Добавить `GET /api/chronicles/:id/page`.
4. Добавить `GET /api/chronicles/:id/combat-screen`.
5. Добавить `GET /api/characters/:uuid/sheet`.
6. Добавить `GET /api/characters/:uuid/storyteller-screen`.
7. Перевести presenter layer на screen DTO вместо отдачи raw collection-shaped ответов.
8. После перевода клиента удалить legacy client-facing endpoints, которые больше не нужны для UI bootstrap:
- набор словарных GET endpoints,
- bootstrap fan-out endpoints для страниц,
- дублирующие collection-shaped ответы, если они больше не используются ни одним экраном.

Done criteria:
- У каждого сложного экрана есть один основной bootstrap contract.
- Клиенту не нужно собирать page state через fan-out GET внутри UI.
- Старые client-only bootstrap endpoints очищены или помечены к удалению в том же рефакторинге.

### Step 5. Построить новый client data layer без generic query framework

1. Для каждого feature завести собственный resource/command слой:
- `auth`,
- `dictionaries`,
- `home`,
- `chronicle`,
- `combat`,
- `character`,
- `storyteller`.
2. Ввести общие lifecycle contracts для ресурса:
- `idle/loading/loaded/error`,
- `retry`,
- `invalidate`,
- `prefetch`,
- `refresh`.
3. Держать shared helpers минимальными:
- abortable loading,
- request dedup на уровне feature resource,
- invalidation helpers,
- uniform error normalization.
4. Не строить универсальную query DSL; shared слой должен помогать, а не становиться собственной мини-библиотекой.
5. Убрать прямые `api.get/post/patch/del` из UI-компонентов и page shells.

Done criteria:
- Data access живёт в feature resources/use-cases, а не в JSX.
- Loading/error/retry states унифицированы по всем основным экранам.
- Новый data layer остаётся доменно-ориентированным, а не превращается в generic cache framework.

### Step 6. Перестроить app bootstrap, auth flow и словари

1. Оставить `ProtectedRoutes` зависимым только от auth bootstrap, а не от словарей.
2. Перевести `AuthProvider` на новый auth feature resource.
3. Перевести login/profile/header identity на feature-first auth слой.
4. Убрать глобальную блокировку protected UI через `DictionariesProvider`.
5. Перевести словари на:
- `GET /api/dictionaries`,
- on-demand resource,
- фоновый prefetch после успешного auth bootstrap.
6. Перевести `Home`, `LoginPage`, `ProfilePage`, `CreateChronicle` на новый data layer и screen/use-case contracts.
7. Убрать `window.location.reload()` как основной recovery path для словарей.

Done criteria:
- Protected UI больше не блокируется словарями целиком.
- Справочники грузятся централизованно одним контрактом.
- Auth/header/home/profile не содержат прямого REST orchestration в UI.

### Step 7. Перестроить Chronicle и Combat features

1. Разделить `ChroniclePage` на:
- page shell,
- feature sections,
- commands для create/import/delete/start combat/upload image/delete image.
2. Перевести bootstrap `ChroniclePage` на один page endpoint.
3. Разделить `CombatPage` на:
- page shell,
- participants section,
- enemies section,
- initiative/actions section,
- header/status section.
4. Перевести bootstrap `CombatPage` на один combat screen endpoint.
5. Сохранить текущую freshness model там, где она уже есть:
- polling при необходимости остаётся,
- но больше не живёт вперемешку с JSX и mutation handlers.
6. Убрать page-level fan-out запросы и ручную локальную orchestration из UI-компонентов.

Done criteria:
- `ChroniclePage` и `CombatPage` становятся тонкими entry points.
- UI-секции не знают о raw REST вызовах.
- Операции upload/import/delete/start/initiative вынесены в feature commands.

### Step 8. Перестроить Character feature и socket architecture, не меняя transport model

1. Сохранить текущую модель:
- socket `patch`,
- socket `patchApplied`,
- socket `resync`,
- REST `wizard/next|back|goto|finish`.
2. Спрятать transport details за character feature boundary:
- socket adapter,
- optimistic patch controller,
- version queue coordination,
- resync/reject handling.
3. Убрать дублирование этой orchestration между `CharacterPage`, `StorytellerPage`, `useCharacterSocket`.
4. Вынести screen bootstrap для character sheet в `GET /api/characters/:uuid/sheet`.
5. Перевести `CharacterPage` на character feature resource/controller вместо собственного `fetchCharacter + applyLocalPatch + sendPatch`.
6. Разделить текущий `socket.ts` на:
- auth/session socket middleware,
- room management,
- character patch application handler.

Done criteria:
- Character realtime flow инкапсулирован в character feature layer.
- UI больше не знает о деталях `baseVersion`, patch queue и низкоуровневом ack flow.
- При этом transport semantics и поведение патчей не меняются продуктово.

### Step 9. Декомпозировать Wizard, GameMode и StorytellerPage

1. Разбить `Wizard` на step components:
- step 1: origin/meta,
- step 2: attributes,
- step 3: abilities,
- step 4: disciplines,
- step 5: backgrounds/biography,
- step 6: virtues,
- step 7: merits/flaws,
- step 8: freebies/review.
2. Вынести shared hooks/selectors для `Wizard`:
- step state,
- field error mapping,
- preview math,
- dictionary lookups,
- section-specific handlers.
3. Перевести `Wizard` на гибридную модель:
- server authoritative validation,
- client predictive guardrails,
- shared pure math из `packages/shared`.
4. Разбить `GameMode` на feature sections:
- resources,
- dice/initiative tools,
- chronicle log panel,
- chronicle context/combat context,
- avatar/upload tools,
- help/rules panels.
5. Полноценно декомпозировать `StorytellerPage`:
- screen shell,
- metadata controls,
- chronicle reassignment,
- storyteller trait adjustment sections,
- destructive actions.
6. Для `StorytellerPage` и `GameMode` перевести data access и patch commands в feature layer, не оставляя `api.*` внутри UI.

Done criteria:
- `Wizard`, `GameMode`, `StorytellerPage` перестают быть монолитами.
- Shared hooks/selectors/use-cases отделены от presentation.
- В `Wizard` нет второй самостоятельной rule engine поверх серверной логики; остаются только predictive client guardrails и shared pure math.

### Step 10. Перестроить CSS-архитектуру под feature-first plain CSS

1. Разделить глобальный stylesheet на слои:
- tokens,
- base,
- layout,
- shared components,
- utilities.
2. Вынести feature-specific стили в соответствующие feature CSS файлы.
3. Прекратить late overrides для глобальных селекторов.
4. Локализовать стили `Wizard`, `GameMode`, `Chronicle`, `Combat`, `Storyteller` около feature-кода.
5. Обновить импортный порядок CSS так, чтобы каскад был предсказуемым и документированным.

Done criteria:
- Монолитный `styles.css` больше не является единственной точкой всей визуальной системы.
- Feature components не зависят от случайных поздних override в конце глобального файла.
- CSS-слои соответствуют новой архитектуре client code.

### Step 11. Cleanup, удаление legacy-поверхностей и верификация

1. Удалить старые client-facing endpoints и старые client data access paths, которые больше не используются.
2. Удалить obsolete contexts/hooks/services после миграции:
- legacy `DictionariesProvider` gate,
- page-local fetch orchestration,
- дублирующие adapters.
3. Обновить README и архитектурную документацию:
- новая workspace структура,
- `packages/shared`,
- screen-oriented API,
- словари,
- socket boundaries,
- CSS layout.
4. Прогнать существующие проверки:
- `npm run typecheck`
- `npm run build`
- `npm -w apps/server run test`
5. Составить ручной smoke checklist для big refactor:
- login/logout,
- protected routes,
- home bootstrap,
- dictionaries prefetch,
- chronicle page,
- combat page,
- character wizard,
- game mode,
- storyteller mode,
- export/import,
- image upload/delete,
- socket patch/resync.

Done criteria:
- В кодовой базе не осталось основных legacy путей для старой архитектуры.
- Сборка и typecheck проходят.
- Server tests проходят без регрессии.
- Документация отражает новую структуру проекта.

## Execution Strategy

Несмотря на почти атомарный merge, внутри рабочей ветки рефакторинг должен идти в таком порядке:

1. Foundation:
- workspace,
- shared package,
- target skeleton,
- CSS entrypoints.
2. Server contracts:
- feature services,
- screen endpoints,
- presenter reshaping.
3. Client data layer:
- auth,
- dictionaries,
- home/profile/login.
4. Complex screens:
- chronicle,
- combat,
- character,
- wizard,
- game mode,
- storyteller.
5. Cleanup:
- удаление legacy endpoints,
- удаление старых contexts/hooks,
- docs,
- verification.

Это позволяет держать refactor coherent, но не терять внутреннюю управляемость.

## Risks and Mitigations

- Risk: scope почти атомарного рефакторинга слишком велик и легко расползётся.
Mitigation: жёстко держать фиксированный target architecture и не добавлять новые product features в эту ветку.

- Risk: самодельный client data layer превратится в неустойчивую generic query library.
Mitigation: держать data layer domain-oriented и feature-specific; shared primitives только минимальные.

- Risk: перенос wizard math приведёт к новому drift между клиентом и сервером.
Mitigation: shared pure math только в `packages/shared`, authoritative validation и side effects остаются на сервере.

- Risk: ломка socket flow приведёт к version conflicts, resync regressions или silent data loss.
Mitigation: не менять transport semantics; рефакторить только boundaries и orchestration packaging вокруг текущего `patch/resync`.

- Risk: screen-oriented API потребует слишком широких server changes.
Mitigation: концентрироваться на page bootstrap endpoints и use-case mutations, а не переписывать весь backend domain model.

- Risk: удаление глобального dictionaries gate породит race conditions на экранах, которым словари реально нужны.
Mitigation: aggregated dictionaries resource + prefetch после auth + feature-level explicit loading states.

- Risk: CSS-рефакторинг создаст визуальные регрессии в поздних override.
Mitigation: вводить layers и переносить feature styles вместе с декомпозицией компонентов, а не отдельно от неё.

- Risk: отсутствие новой client test infrastructure увеличивает риск regressions.
Mitigation: держать строгий smoke checklist, существующие server tests и type/build checks обязательными для завершения фичи.

## Definition of Done (Feature 06)

- Client и server application layers переведены на feature-first структуру.
- В монорепозитории добавлен `packages/shared` для pure domain logic и shared contracts.
- Клиентский data access вынесен из UI-компонентов в feature resources/use-cases.
- Client-facing API переведён на screen/use-case-oriented контракты для основных экранов.
- Глобальный `DictionariesProvider` gate удалён; словари грузятся агрегированно и по потребности.
- `Wizard`, `GameMode`, `ChroniclePage`, `CombatPage`, `StorytellerPage` декомпозированы на shell/sections/hooks/use-cases.
- Character realtime flow инкапсулирован в feature layer без смены текущей socket transport модели.
- `Wizard` использует hybrid approach:
  - server authoritative,
  - client predictive guardrails,
  - shared pure math.
- Plain CSS разделён на архитектурные слои и feature-specific файлы.
- Legacy client-facing bootstrap endpoints и старая внутренняя архитектура удалены или сведены к минимуму.
- Проходят:
  - `npm run typecheck`
  - `npm run build`
  - `npm -w apps/server run test`
- README и архитектурная документация обновлены под новую структуру.
