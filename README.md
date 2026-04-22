# Vampire Siesta — инструкция по запуску

Проект: веб‑приложение для ведения листа персонажа Vampire: The Masquerade (V20).  
Монорепозиторий на `npm workspaces`: клиент (React + Vite) и сервер (Express + Socket.IO + MongoDB).

## Быстрый обзор

- Dev‑режим: клиент и сервер запускаются параллельно (`npm run dev`).
- Prod‑режим: сервер раздаёт статические файлы клиента (нужен `NODE_ENV=production`).
- База данных: MongoDB.

## Переменные окружения

Скопируйте `.env.example` в `.env` и заполните значения.

```env
PORT=4000
MONGO_URL=mongodb://localhost:27017/siesta
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
SESSION_COOKIE_NAME=vs_session
SESSION_TTL_DAYS=7
SESSION_SECURE=false
SESSION_SAMESITE=lax
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
YANDEX_CLIENT_ID=
YANDEX_CLIENT_SECRET=
YANDEX_REDIRECT_URI=
VALIDATION_ENGINE_V2=1
VALIDATION_SIDE_BY_SIDE=0
```

Дополнительно:

- `CLIENT_DIST_PATH` — путь до собранного клиента. Нужен, если вы запускаете сервер НЕ из корня репозитория.
- `NODE_ENV=production` — включает раздачу клиента сервером.
- `ALLOWED_ORIGINS` — список origin через запятую для CORS/Socket.IO. В dev обычно достаточно `http://localhost:5173`.
- `SESSION_COOKIE_NAME`, `SESSION_TTL_DAYS`, `SESSION_SECURE`, `SESSION_SAMESITE` — параметры cookie-сессии.
- Сервер может стартовать и без настроенного OAuth-провайдера, но войти в приложение тогда будет нельзя.
- Для реального входа нужно настроить хотя бы один OAuth-провайдер: Google и/или Яндекс.
- Значения `*_REDIRECT_URI` имеют смысл только вместе с соответствующими `*_CLIENT_ID` и `*_CLIENT_SECRET`.
- `VALIDATION_ENGINE_V2` — переключает новый модульный валидатор (`1` по умолчанию, `0` для rollback на legacy).
- `VALIDATION_SIDE_BY_SIDE` — включает теневое сравнение legacy/v2 и лог mismatch в серверных логах.

### OAuth redirect URI

Для локальной разработки redirect URI должны указывать на browser origin клиента, а не на порт сервера:

- Google: `http://localhost:5173/api/auth/google/callback`
- Яндекс: `http://localhost:5173/api/auth/yandex/callback`

Это важно, чтобы cookie-сессия устанавливалась на тот же origin, с которого работает приложение через Vite.

Для production используйте публичный origin приложения:

- `https://<your-domain>/api/auth/google/callback`
- `https://<your-domain>/api/auth/yandex/callback`

Для Яндекс OAuth приложению нужен доступ к email пользователя. Без email вход будет отклонен.

## Локальный запуск (dev)

### Требования

- Node.js 20+ и npm
- MongoDB 6+ (локально) **или** Docker для запуска MongoDB
- Git

### 1) Установка зависимостей

```bash
npm install
```

### 2) Запуск MongoDB

Вариант A — локальная MongoDB:

- Установите MongoDB 6+ и убедитесь, что служба запущена.
- Укажите `MONGO_URL` в `.env`.

Вариант B — MongoDB в Docker:

```bash
docker run -d \
  --name siesta-mongo \
  -p 27017:27017 \
  -v siesta-mongo:/data/db \
  mongo:6
```

### 3) Сидирование справочников

```bash
npm run seed
```

### 4) Запуск dev‑режима

```bash
npm run dev
```

- Клиент запустится через Vite (порт по умолчанию отображается в консоли).
- Сервер по умолчанию слушает `PORT` из `.env` (обычно 4000).
- Страница входа доступна по `/auth/login`.
- Все рабочие страницы приложения закрыты для анонимного доступа.

## Локальный запуск (prod без Docker)

### 1) Сборка

```bash
npm run build
```

### 2) Запуск сервера

Запускать из корня репозитория:

```bash
set NODE_ENV=production
set PORT=4000
set MONGO_URL=mongodb://localhost:27017/siesta
node apps/server/dist/index.js
```

Если запускаете сервер не из корня, задайте `CLIENT_DIST_PATH` вручную:

```bash
set CLIENT_DIST_PATH=D:\projects\siesta_ai\apps\client\dist
```

## Запуск через Docker Compose (локально или на VPS)

### Требования

- Docker Engine
- Docker Compose (plugin)

### 1) Подготовка `.env`

```bash
copy .env.example .env
```

Отредактируйте `MONGO_URL` при необходимости. Для docker‑compose можно использовать:

```env
MONGO_URL=mongodb://mongo:27017/siesta
```

### 2) Сборка и запуск

```bash
docker compose up -d --build
```

Сервис `app` слушает `PORT` (по умолчанию 4000). Статический клиент раздаётся сервером.

### 3) Остановка

```bash
docker compose down
```

## VPS запуск (рекомендуемый вариант: Docker Compose)

### Что установить на VPS

- Docker Engine
- Docker Compose (plugin)
- Git

### 1) Клонирование и подготовка

```bash
git clone <ваш-репозиторий>
cd siesta_ai
copy .env.example .env
```

Отредактируйте `.env`:

```env
PORT=4000
MONGO_URL=mongodb://mongo:27017/siesta
```

### 2) Запуск

```bash
docker compose up -d --build
```

### 3) Обновление версии

```bash
git pull

docker compose up -d --build
```

### 4) Порты и доступ

- Откройте входящий порт `PORT` (обычно 4000) на фаерволе.
- Для домена обычно ставят reverse‑proxy (Nginx/Caddy). В этом случае проксируйте запросы на `http://127.0.0.1:4000`.

## Nginx: HTTPS reverse proxy

Если приложение работает в production за `nginx`, самый простой вариант такой:

- `nginx` принимает HTTPS на `443`,
- Node/Express слушает только локальный `127.0.0.1:4000`,
- `nginx` проксирует и обычные HTTP-запросы, и `Socket.IO`,
- клиентская статика продолжает раздаваться самим приложением.

### Рекомендуемые env для production

```env
NODE_ENV=production
PORT=4000
MONGO_URL=mongodb://localhost:27017/siesta
SESSION_SECURE=true
SESSION_SAMESITE=lax
ALLOWED_ORIGINS=https://example.com
GOOGLE_REDIRECT_URI=https://example.com/api/auth/google/callback
YANDEX_REDIRECT_URI=https://example.com/api/auth/yandex/callback
```

Если приложение доступно только с одного публичного origin, обычно достаточно указать именно его.

### Пример конфига `nginx`

Готовый пример вынесен в отдельный файл:

- [deploy/nginx/vampire-siesta.example.conf](/Users/tzapil/projects/vampire_siesta_ai/deploy/nginx/vampire-siesta.example.conf)

Скопируйте его в `/etc/nginx/sites-available/`, замените домен `example.com` и пути к сертификатам, затем подключите через symlink в `sites-enabled`.

### Что важно для этого проекта

- Приложение уже умеет работать за proxy: в Express включен `trust proxy`, поэтому `SESSION_SECURE=true` за `nginx` будет работать корректно.
- OAuth redirect URI должны указывать на публичный HTTPS-домен, а не на внутренний `127.0.0.1:4000`.
- `Socket.IO` требует `Upgrade`/`Connection` headers, поэтому секцию `/socket.io/` лучше выделять явно.
- `client_max_body_size` лучше держать не меньше `15m`, потому что сервер принимает JSON до `15mb`, а в приложении есть загрузка изображений/аватаров.
- Порт приложения `4000` лучше не открывать наружу, если доступ к нему идет только через `nginx`.

### Перезапуск после изменения конфига

Проверка конфига и reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Если используете `certbot`, после выпуска сертификата обычно достаточно снова выполнить `nginx -t` и `reload`.

## VPS запуск без Docker (Node + MongoDB)

### Что установить

- Node.js 20+
- MongoDB 6+
- Git
- (опционально) pm2 для управления процессом

### 1) Установка и сборка

```bash
git clone <ваш-репозиторий>
cd siesta_ai
npm install
npm run build
npm run seed
```

### 2) Запуск (один процесс)

```bash
export NODE_ENV=production
export PORT=4000
export MONGO_URL=mongodb://localhost:27017/siesta
node apps/server/dist/index.js
```

### 3) Запуск через pm2 (рекомендуется)

```bash
npm install -g pm2
pm2 start apps/server/dist/index.js --name siesta
pm2 save
```

## Полезные команды

```bash
npm run typecheck
npm run seed
```

## Auth rollout

Пошаговый migration/smoke checklist для OAuth и профиля находится в [feature_02_oauth_rollout_checklist.md](feature_02_oauth_rollout_checklist.md).

## Частые проблемы

- Нет справочников: убедитесь, что `npm run seed` выполнен и MongoDB доступна.
- Клиент не раздаётся в проде: проверьте `NODE_ENV=production` и `CLIENT_DIST_PATH`.
- Ошибка подключения к БД: проверьте `MONGO_URL` и доступность MongoDB.
