# Фича 02: OAuth авторизация (Google + Яндекс) и профиль пользователя

## Problem Statement

Сейчас в приложении отсутствует аутентификация и управление пользовательской сессией:
- любой неавторизованный клиент может обращаться к API/Socket,
- нет единого user identity слоя,
- отсутствует страница входа и профиль пользователя,
- нет механизма блокировки учетной записи.

Это создает критические риски безопасности и не позволяет персонализировать работу пользователя в системе.

## Goal

Реализовать обязательную авторизацию через OAuth (Google и Яндекс) с серверными cookie-сессиями и закрыть приложение для анонимного доступа, а также добавить профиль пользователя с редактированием отображаемого имени и аватара.

## Non-Goals (для этой фичи)

- Локальный логин/пароль, magic link, гостевой режим.
- Детальная ACL-модель данных (в этой фиче любой авторизованный пользователь видит все как сейчас).
- UI/API для администрирования блокировок (блокировка вручную через MongoDB).
- Rate limit и расширенный audit-log в БД (только server logs).
- Fallback-режим при недоступности OAuth-провайдера.

## Зафиксированные продуктовые решения

- Вход только через OAuth-кнопки Google/Яндекс.
- Допускается запуск даже с одним настроенным провайдером.
- После логина создается/обновляется локальный пользователь.
- Сессия: `HttpOnly` cookie, хранение серверной сессии в MongoDB, скользящее окно 7 дней, без абсолютного лимита.
- Разрешены параллельные сессии (несколько устройств).
- Logout только на текущем устройстве.
- API/Sockets для неавторизованных: `401 Unauthorized` (без server-side redirect).
- `/api/health` остается публичным.
- Страница логина `/auth/login`; если пользователь уже авторизован -> redirect на `/`.
- После логина redirect на `next`, если `next` валиден и относительный, иначе на `/`.
- Email нормализуется как `trim + lowercase`.
- Автолинковка провайдеров по email разрешена только при верифицированном email:
- Google: требуем `email_verified=true`.
- Яндекс: считаем email верифицированным по продуктному правилу.
- Если найден конфликт `providerUserId` при том же email -> вход отклоняется и логируется как подозрительный.
- Токены провайдера (`access/refresh/id`) не храним.
- Сохраняем только безопасное подмножество данных провайдера, не полный raw payload.
- Новые пользователи получают роль `player`.
- Поддерживаем `status` (`active`/`blocked`); blocked-пользователь не может войти, получает явное сообщение о блокировке.
- При blocked статусе активные сессии должны инвалидироваться (на следующем запросе/событии доступ прекращается).
- CSRF-допзащита сверх `SameSite=Lax` в рамках фичи не внедряется.

## Целевая модель данных

### `users`

Обязательные поля:
- `email` (уникальный, нормализованный),
- `emailVerified` (boolean),
- `displayName` (trim, длина 2-40),
- `role` (`player | storyteller | admin`, по умолчанию `player`),
- `status` (`active | blocked`, по умолчанию `active`),
- `providers[]` (см. ниже),
- `createdAt`,
- `lastLoginAt`,
- `lastSeenAt` (обновлять не чаще 1 раза в 15 минут).

Поле `providers[]`:
- `provider` (`google | yandex`),
- `providerUserId` (главный ключ связи),
- `emailAtLink`,
- `linkedAt`,
- `profileMeta` (безопасное подмножество provider payload).

### `sessions`

- `sessionIdHash` (уникальный),
- `userId` (index),
- `expiresAt` (TTL index),
- `createdAt`,
- `updatedAt`,
- опционально `ip` и `userAgent` для server logs/диагностики.

### `user_avatars`

- `userId` (уникальный, один текущий аватар на пользователя),
- `dataUrl` (хранение в Mongo по текущему проектному паттерну),
- `updatedAt`.

## Step-by-Step Plan

### Step 1. Контракты auth-конфига и инфраструктурные зависимости

1. Добавить env-контракты для Google/Яндекс OAuth:
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`,
- `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`, `YANDEX_REDIRECT_URI`.
2. Добавить параметры cookie/session:
- `SESSION_COOKIE_NAME`, `SESSION_TTL_DAYS=7`, `SESSION_SECURE`, `SESSION_SAMESITE=lax`.
3. Зафиксировать origin-политику (убрать wildcard CORS/Socket CORS, перейти к конфигурируемому allowlist).
4. Подготовить auth service слой: генерация state/nonce/pkce, обмен кода на токены, получение профиля.

Done criteria:
- Конфигурация валидируется на старте.
- Приложение корректно стартует с 1 или 2 настроенными провайдерами.

### Step 2. Реализация user/session/avatars моделей и индексов

1. Добавить Mongoose-модели `User`, `Session`, `UserAvatar`.
2. Создать индексы:
- уникальный индекс на `users.email`,
- индекс на `providers.provider + providers.providerUserId`,
- TTL индекс для `sessions.expiresAt`,
- уникальный индекс на `user_avatars.userId`.
3. Добавить слой репозиториев/сервисов для операций:
- find/create/update user,
- create/rotate/revoke session,
- set/replace avatar.

Done criteria:
- Модели доступны через `db/index.ts`.
- Индексы создаются и не конфликтуют на повторном старте.

### Step 3. OAuth flow (server-side Authorization Code) для Google и Яндекс

1. Реализовать start endpoints:
- `GET /api/auth/google/start`
- `GET /api/auth/yandex/start`
2. На старте flow генерировать и краткоживуще сохранять `state`, `nonce`, `code_verifier` (PKCE где поддерживается).
3. Реализовать callback endpoints:
- `GET /api/auth/google/callback`
- `GET /api/auth/yandex/callback`
4. Валидировать `state`/`nonce` и обменивать `code` на provider payload.
5. Нормализовать email (`trim + lowercase`) и применять правила:
- отсутствие email -> отказ,
- Google без `email_verified=true` -> отказ,
- Яндекс email считаем verified.
6. Логика линковки:
- сначала поиск по `providerUserId`,
- затем автолинковка по verified email,
- при конфликте provider identity -> отказ + лог.
7. Создавать/обновлять локального пользователя:
- initial `displayName` из локальной части email,
- `lastLoginAt` обновлять при каждом успешном логине.

Done criteria:
- Успешный OAuth вход приводит к созданию/обновлению user.
- Ошибки OAuth приводят к возврату на `/auth/login` с безопасным сообщением.

### Step 4. Сессии и middleware авторизации (HTTP + Socket.IO)

1. После успешного OAuth создавать server session:
- генерировать session id,
- сохранять только `sessionIdHash`,
- выдавать cookie (`HttpOnly`, `SameSite=Lax`, `Secure` в prod),
- выполнять ротацию session id после логина.
2. Реализовать middleware `requireAuth` для `/api/*` (кроме публичных auth/health маршрутов).
3. Проверка blocked-статуса в middleware:
- при `blocked` сессия инвалидируется, ответ `401`.
4. Реализовать sliding expiration:
- продление `expiresAt` при активности.
5. Обновлять `lastSeenAt` не чаще 1 раза в 15 минут.
6. Подключить Socket.IO auth middleware (`io.use`) на cookie-сессию.
7. Проверять валидность сессии/статус пользователя на каждом socket-событии.

Done criteria:
- Неавторизованные HTTP/Socket операции стабильно получают `401`.
- Авторизованный пользователь проходит в API и Socket.

### Step 5. Auth API контракты

1. `GET /api/auth/me`:
- всегда `200`,
- `{ user: null }`, если сессии нет,
- `{ user: { id, email, role, status, providers, lastSeenAt, lastLoginAt, displayName, avatarUrl } }`, если сессия есть.
2. `POST /api/auth/logout`:
- удаляет текущую сессию,
- чистит cookie,
- возвращает `200`.
3. `PATCH /api/auth/me`:
- обновление `displayName` (валидация `trim + длина 2-40`).
4. `POST /api/auth/me/avatar`:
- прием `dataUrl` в JSON (как в текущих частях приложения),
- замена текущего аватара пользователя.
5. `GET /api/auth/avatar/:userId` (или эквивалентный id-based endpoint):
- защищенный endpoint выдачи аватара по `avatarUrl`.

Done criteria:
- Контракты стабильны, покрыты базовыми интеграционными тестами.
- Logout работает только для текущей сессии.

### Step 6. Frontend: auth gate и страница входа

1. Добавить страницу `/auth/login`:
- краткая инструкция,
- кнопки Google/Яндекс только для включенных провайдеров,
- вывод ошибок входа без техподробностей.
2. Реализовать global auth bootstrap через `GET /api/auth/me`.
3. Закрыть все приватные маршруты:
- для анонимного пользователя redirect на `/auth/login?next=<originalPath>`.
4. Реализовать обработку `next`:
- только относительные URL внутри приложения.
5. Для уже авторизованного пользователя на `/auth/login` делать redirect на `/`.

Done criteria:
- Анонимный пользователь не может попасть на рабочие страницы.
- После входа пользователь возвращается на исходный URL (если валиден).

### Step 7. Frontend: профиль пользователя и элементы шапки

1. Добавить `/profile`.
2. На странице профиля:
- email read-only,
- редактирование `displayName`,
- замена аватара (без отдельной кнопки удаления).
3. В шапке показывать:
- текущий `displayName`,
- аватар или placeholder (первая буква имени),
- переход в профиль по клику на имя/аватар,
- кнопку logout.
4. Принять текущее UX-ограничение:
- данные шапки гарантированно обновляются после refresh (без требования live-sync после сохранения профиля).

Done criteria:
- Пользователь может обновить имя и аватар в профиле.
- Шапка отображает user identity и выход.

### Step 8. Тесты и проверки безопасности

1. Unit-тесты:
- email normalization,
- state/nonce/pkce validation,
- provider-linking сценарии,
- session hash/rotation/expiry logic.
2. Integration-тесты API:
- OAuth callback happy path,
- `me` для auth/unauth,
- logout,
- blocked user behavior,
- profile update/avatar replace.
3. Socket тесты:
- connect без cookie -> отказ,
- connect с валидной cookie -> успех,
- blocked/expired session на событии -> отказ.
4. Проверить сценарии ошибок:
- provider не настроен,
- provider отказал/вернул ошибку,
- mismatch `providerUserId`.

Done criteria:
- Критичные auth-сценарии покрыты автоматическими тестами.
- Нет регрессии по текущему API/Socket поведению для авторизованного пользователя.

### Step 9. Rollout и операционная готовность

1. Добавить миграционный чек-лист:
- заполнение новых env,
- создание OAuth apps в Google/Yandex,
- настройка redirect URI для dev/prod.
2. Добавить smoke-checklist:
- login/logout,
- auth guard,
- profile update/avatar,
- socket auth.
3. Обновить README по запуску и переменным окружения.
4. Обновить runbook по ручной блокировке пользователя в MongoDB:
- смена `status` на `blocked`,
- ожидаемое поведение для активных сессий.

Done criteria:
- Фича поднимается в dev и deploy-ready для production-конфигурации.
- Документация достаточна для эксплуатации.

## Suggested Delivery Slices

1. Slice A: Steps 1-3 (инфраструктура + OAuth core).
2. Slice B: Steps 4-6 (session/auth guard + login UX).
3. Slice C: Steps 7-9 (профиль + hardening + документация).

## Risks and Mitigations

- Risk: Неправильная настройка redirect URI и env приведет к нерабочему login.
Mitigation: startup validation + README с примерами dev/prod конфигураций.

- Risk: Ошибка в cookie/session конфиге сломает авторизацию в dev/prod.
Mitigation: явные env-флаги `Secure/SameSite` + smoke тесты для обеих сред.

- Risk: Отсутствие лимитов на аватар может привести к росту БД и нагрузке.
Mitigation: вынести лимиты и image constraints в отдельную ближайшую задачу hardening.

- Risk: Конфликты provider identity при автолинковке.
Mitigation: строгий приоритет `providerUserId`, отказ при mismatch и подробный server log.

- Risk: Расхождение auth-check между HTTP и Socket.
Mitigation: единый session validation service и интеграционные тесты для обоих транспортов.

## Definition of Done (Feature 02)

- Приложение закрыто для неавторизованных пользователей (кроме публичных auth/health точек).
- Реализован OAuth login через Google/Яндекс (server-side code flow) с state/nonce/pkce.
- Локальные пользователи создаются/обновляются по правилам линковки и verified-email политике.
- Сессии работают через `HttpOnly` cookie и Mongo session store (hash-only session id, sliding TTL 7 дней).
- `GET /api/auth/me`, `POST /api/auth/logout`, профильные endpoints работают по контрактам.
- Добавлена страница `/auth/login` и `/profile`, а также user identity блок в шапке.
- Поддержан blocked status с запретом входа и инвалидизацией сессий.
- Тесты и документация обновлены для новых auth/profile сценариев.
