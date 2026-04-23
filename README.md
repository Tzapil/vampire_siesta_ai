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
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=change-me
COMPOSE_MONGO_URL=mongodb://admin:change-me@mongo:27017/siesta?authSource=admin
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
- `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD` — используются контейнером `mongo` в `docker-compose` для создания root-пользователя при первом старте с пустым volume.
- `COMPOSE_MONGO_URL` — строка подключения, которую `docker-compose` передаёт контейнеру `app`. Это отдельная переменная, чтобы docker-сеть с хостом `mongo` не конфликтовала с локальным `MONGO_URL=...localhost...`.
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

Для `docker-compose` по умолчанию используется root-пользователь Mongo. В `.env` можно оставить такие значения:

```env
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=change-me
COMPOSE_MONGO_URL=mongodb://admin:change-me@mongo:27017/siesta?authSource=admin
```

Пользователь создаётся только при первом старте Mongo с пустым `mongo-data`. Если volume уже существует, новые `MONGO_INITDB_*` не применятся автоматически.

### 2) Сборка и запуск

```bash
docker compose up -d --build
```

По умолчанию `app` доступен только на `http://127.0.0.1:4000`, а `mongo` на `127.0.0.1:27017`. Статический клиент раздаётся сервером.

Для публичного HTTPS на `80/443` используйте профиль `https`, описанный в подробном VPS-гайде ниже.

### 3) Остановка

```bash
docker compose down
```

## Пошаговый деплой на VPS (Docker Compose + nginx + Let's Encrypt)

Ниже описан рекомендуемый production-сценарий для VPS:

- `mongo` и `app` живут в `docker-compose`,
- `app` слушает только `127.0.0.1:4000`,
- контейнерный `nginx` публикует наружу `80/443`,
- TLS-сертификаты выпускаются `certbot` на хосте и монтируются в контейнер из `/etc/letsencrypt`.

### Что должно быть готово заранее

- VPS с публичным IPv4-адресом.
- Домен или поддомен, которым вы управляете.
- На VPS уже установлены `Docker Engine`, `Docker Compose (plugin)`, `Git`, `snapd`.
- Во внешнем фаерволе и на самом VPS открыты порты `80` и `443` для HTTP/HTTPS и `22` для SSH.

### Шаг 1. Настройте DNS домена

- Создайте `A`-запись домена на IP вашего VPS.
- Если хотите обслуживать и `www`, создайте отдельную запись для `www`.
- Дождитесь, пока домен начнёт резолвиться на ваш VPS.

Примеры:

- `example.com -> 203.0.113.10`
- `www.example.com -> 203.0.113.10`

Если используете поддомен вроде `app.example.com`, везде дальше подставляйте именно его: в `nginx`, в `ALLOWED_ORIGINS`, в OAuth callback URL и в команде `certbot`.

### Шаг 2. Подготовьте сервер и репозиторий

```bash
cd /opt
sudo git clone <ваш-репозиторий> siesta_ai
sudo chown -R $USER:$USER /opt/siesta_ai
cd /opt/siesta_ai
cp .env.example .env
```

Если проект уже склонирован, просто перейдите в каталог репозитория.

### Шаг 3. Заполните `.env`

Для VPS с `docker-compose` удобно начать с такого шаблона:

```env
NODE_ENV=production
PORT=4000

MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=replace-with-strong-password
COMPOSE_MONGO_URL=mongodb://admin:replace-with-strong-password@mongo:27017/siesta?authSource=admin
MONGO_URL=mongodb://admin:replace-with-strong-password@127.0.0.1:27017/siesta?authSource=admin

ALLOWED_ORIGINS=https://example.com
SESSION_COOKIE_NAME=vs_session
SESSION_TTL_DAYS=7
SESSION_SECURE=true
SESSION_SAMESITE=lax

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://example.com/api/auth/google/callback

YANDEX_CLIENT_ID=
YANDEX_CLIENT_SECRET=
YANDEX_REDIRECT_URI=https://example.com/api/auth/yandex/callback

VALIDATION_ENGINE_V2=1
VALIDATION_SIDE_BY_SIDE=0
```

Что здесь важно:

- `COMPOSE_MONGO_URL` использует хост `mongo`, потому что контейнер `app` подключается к Mongo внутри docker-сети.
- `MONGO_URL` нужен для команд, которые вы запускаете с самого VPS, например для локального `npm run seed`, если когда-нибудь будете это делать вне контейнера.
- `MONGO_INITDB_ROOT_USERNAME` и `MONGO_INITDB_ROOT_PASSWORD` создают root-пользователя Mongo только при первом старте с пустым volume `mongo-data`.
- Если хотите принимать трафик и на `https://example.com`, и на `https://www.example.com`, укажите оба origin через запятую:
  `ALLOWED_ORIGINS=https://example.com,https://www.example.com`
- OAuth callback URL должны совпадать и в `.env`, и в настройках приложения у Google/Яндекса.
- Если не настроен ни один OAuth-провайдер, сервер поднимется, но войти в приложение будет нельзя.

### Шаг 4. Настройте домен в `nginx`

Откройте [deploy/nginx/vampire-siesta.docker.conf](deploy/nginx/vampire-siesta.docker.conf) и замените тестовые значения:

- в обоих `server_name` вместо `example.com www.example.com` укажите свой домен;
- в `ssl_certificate` и `ssl_certificate_key` укажите путь, соответствующий имени сертификата.

Пример для одного домена:

```nginx
server_name app.example.com;
ssl_certificate     /etc/letsencrypt/live/app.example.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;
```

Пример для домена и `www`:

```nginx
server_name example.com www.example.com;
ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
```

Важно: каталог `/etc/letsencrypt/live/<name>/` должен совпадать с тем, как `certbot` назовёт сертификат. Обычно это имя первого домена в команде `certbot`.

### Шаг 5. Первый запуск `mongo` и `app`

Сначала поднимите базовый стек без `nginx`:

```bash
docker compose up -d --build
```

Проверьте, что контейнеры стартовали:

```bash
docker compose ps
docker compose logs --tail=100 app
```

На этом этапе:

- `app` будет слушать только `127.0.0.1:4000`,
- `mongo` будет слушать только `127.0.0.1:27017`,
- снаружи VPS приложение ещё не доступно.

Нюанс по Mongo:

- root-пользователь `admin` создаётся только один раз, при первом старте с пустым volume;
- если вы уже запускали Mongo раньше и меняете `MONGO_INITDB_ROOT_PASSWORD`, контейнер не пересоздаст пользователя автоматически;
- в таком случае либо создайте пользователя вручную, либо удалите volume через `docker compose down -v`, если данные можно потерять.

### Шаг 6. Выполните `seed`

После первого старта приложения заполните справочники и создайте дефолтную хронику:

```bash
docker compose exec app node apps/server/dist/seed.js
```

Если команда прошла без ошибок, база инициализирована. `seed` можно запускать повторно после изменений в `data/*.json`.

Если контейнер `app` ещё не успел подняться, сначала посмотрите:

```bash
docker compose logs --tail=100 app
```

### Шаг 7. Выпустите TLS-сертификаты Let's Encrypt

Сертификаты выпускаются на хосте, а контейнер `nginx` потом получает их через bind mount `/etc/letsencrypt:/etc/letsencrypt:ro`.

Установка `certbot`:

```bash
sudo apt update
sudo apt install -y snapd
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/local/bin/certbot
```

Выпуск сертификата для домена и `www`:

```bash
sudo certbot certonly --standalone -d example.com -d www.example.com
```

Выпуск сертификата только для поддомена:

```bash
sudo certbot certonly --standalone -d app.example.com
```

Что важно перед запуском `certbot`:

- домен уже должен резолвиться на ваш VPS;
- порты `80` и `443` должны быть открыты;
- на этих портах не должно быть другого процесса;
- базовый `docker compose up` этому не мешает, потому что `app` слушает только `127.0.0.1:4000`.

После успешного выпуска сертификаты появятся в каталоге вида:

```text
/etc/letsencrypt/live/example.com/fullchain.pem
/etc/letsencrypt/live/example.com/privkey.pem
```

или:

```text
/etc/letsencrypt/live/app.example.com/fullchain.pem
/etc/letsencrypt/live/app.example.com/privkey.pem
```

### Шаг 8. Поднимите `nginx` с HTTPS

Когда сертификаты уже существуют и `deploy/nginx/vampire-siesta.docker.conf` настроен, поднимите профиль `https`:

```bash
docker compose --profile https up -d
```

Проверьте контейнер и логи:

```bash
docker compose ps
docker compose logs --tail=100 nginx
```

После этого приложение должно открываться по `https://ваш-домен`.

### Шаг 9. Проверьте домен, HTTPS и авторизацию

Минимальная проверка:

```bash
curl -I https://example.com
```

Ожидаемое поведение:

- открывается главная страница по HTTPS;
- браузер не ругается на сертификат;
- редирект с `http://` идёт на `https://`;
- логин через OAuth уводит на тот же домен, который указан в `*_REDIRECT_URI`.

Если OAuth не работает, почти всегда проблема в одном из трёх мест:

- неверный `GOOGLE_REDIRECT_URI` или `YANDEX_REDIRECT_URI` в `.env`;
- тот же URI не добавлен в консоли OAuth-провайдера;
- `ALLOWED_ORIGINS` не совпадает с реальным браузерным origin.

### Шаг 10. Настройте продление сертификатов

Проверьте, что продление работает:

```bash
sudo certbot renew --dry-run
```

После реального продления `nginx` в контейнере нужно перечитать сертификаты:

```bash
cd /opt/siesta_ai
docker compose exec -T nginx nginx -s reload
```

Если хотите автоматизировать это, добавьте cron-задачу на хосте:

```cron
15 4 * * * root cd /opt/siesta_ai && certbot renew --quiet && docker compose exec -T nginx nginx -s reload
```

Если `cron` не видит `docker compose` или `certbot`, укажите для них полные пути.

### Шаг 11. Обновление приложения на VPS

Обычный сценарий обновления:

```bash
cd /opt/siesta_ai
git pull
docker compose --profile https up -d --build
docker compose exec app node apps/server/dist/seed.js
```

Последний шаг полезен после изменений в `data/*.json` или в логике сидирования.

### Что важно именно для этого проекта

- Express уже работает с proxy через `trust proxy`, поэтому `SESSION_SECURE=true` за `nginx` поддерживается корректно.
- Для `Socket.IO` в `nginx` уже настроены `Upgrade` и `Connection` headers.
- `client_max_body_size` в конфиге `nginx` выставлен с запасом для JSON и загрузки аватаров.
- Порт `4000` не нужно открывать наружу: публичный доступ идёт только через `nginx`.

### Альтернатива: `nginx` на хосте

Если не хотите держать `nginx` в `docker-compose`, используйте [deploy/nginx/vampire-siesta.example.conf](deploy/nginx/vampire-siesta.example.conf) как базовый конфиг для системного `nginx` на хосте. Логика `.env`, OAuth и сертификатов остаётся той же, меняется только место, где живёт сам reverse proxy.

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
