# Feature 05: Monitoring Plan

## Problem Statement

Сейчас в приложении есть только базовые operational hooks:
- публичный `GET /api/health`,
- внутренний JSON endpoint `GET /api/validation/metrics`,
- серверные логи.

Этого недостаточно для нормальной эксплуатации:
- нет Prometheus-compatible endpoint для скрейпа,
- нет стандартных runtime/process метрик Node.js,
- нет HTTP latency/error telemetry в удобном для Grafana формате,
- нет базовых метрик по `Socket.IO`,
- нет готового monitoring stack для VPS,
- локальный `npm run dev` не даёт единого способа проверить техническое состояние приложения, кроме ручного чтения логов.

## Goal

Добавить минимальный production-ready monitoring слой поверх текущего приложения:
- `GET /metrics` в Prometheus text format на сервере,
- стандартные app-level метрики для HTTP, Node.js runtime, `Socket.IO` и validation subsystem,
- optional Docker monitoring stack (`Prometheus + Grafana`) для VPS,
- репозиторные provisioning-файлы для Grafana datasource и одного стартового dashboard,
- поддержку локальной разработки через `npm run dev`, где приложение тоже отдаёт `/metrics`, но без обязательного локального monitoring stack.

## Non-Goals (for this feature)

- `Alertmanager`, alerting rules и pager/notification integration.
- `mongodb-exporter`, `node-exporter`, `cadvisor`, `nginx-exporter` и другие внешние exporters.
- Distributed tracing, centralized logging, log shipping.
- Долговременное хранение метрик и сохранение истории после пересоздания контейнеров.
- Публичная публикация `/metrics` или Prometheus наружу через `nginx`.
- Локальный `Prometheus + Grafana` для сценария `npm run dev` в первой фазе.

## Fixed Product Decisions

- Метрики приложения публикуются на корневом route `GET /metrics`, а не под `/api/*`.
- `GET /metrics` всегда включён и не требует auth.
- Защита `GET /metrics` обеспечивается не приложением, а сетевой топологией:
- в локальной разработке endpoint доступен на локальном dev/server origin,
- на VPS endpoint не должен проксироваться наружу через публичный `nginx`.
- Prometheus в MVP остаётся внутренним сервисом и не публикуется наружу.
- Grafana в MVP доступна на VPS только через loopback binding + SSH tunnel, без публичного `nginx` route.
- Docker monitoring stack подключается опционально через profile `monitoring`.
- Локальный сценарий `npm run dev` ограничивается подъёмом приложения с `/metrics`; локальный monitoring stack в scope первой фазы не входит.
- В MVP собираются только app-level метрики:
- стандартные Node.js/process метрики через `prom-client.collectDefaultMetrics()`,
- HTTP request count/latency/status/method/normalized route,
- `Socket.IO` active connections + counters connect/disconnect/errors,
- validation totals/duration/cache hits/cache misses/rejections by code.
- Grafana provisioning хранится в репозитории и поднимается автоматически.
- Admin credentials Grafana задаются через env: `GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD`.
- Потеря исторических данных и Grafana runtime state после пересоздания monitoring-контейнеров в первой фазе допустима.
- Existing `GET /api/validation/metrics` может быть сохранён как debug endpoint, но Prometheus metrics становятся основным operational интерфейсом.

## Step-by-Step Plan

### Step 1. Monitoring Foundation and Contracts

1. Добавить серверную зависимость для Prometheus instrumentation (`prom-client`).
2. Вынести monitoring infrastructure в отдельный server-side модуль:
- registry creation,
- metric naming/prefix policy,
- reusable metric definitions,
- helper для экспорта в Prometheus text format.
3. Добавить env-контракт для Grafana:
- `GRAFANA_ADMIN_USER`,
- `GRAFANA_ADMIN_PASSWORD`.
4. Обновить `.env.example` и startup expectations для monitoring-related env.

Done criteria:
- В коде есть единая monitoring registry abstraction.
- Env-контракт для Grafana зафиксирован в документации и `.env.example`.

### Step 2. Public Technical Endpoint `GET /metrics`

1. Добавить root-level route `GET /metrics` в Express app вне `/api`.
2. Убедиться, что route не проходит через auth middleware и возвращает корректный `Content-Type` для Prometheus scrape.
3. Зарегистрировать route так, чтобы он не конфликтовал с production static serving и SPA fallback.
4. Явно не проксировать `/metrics` через публичный `nginx`.

Done criteria:
- `GET /metrics` работает в dev и prod server process.
- Endpoint не требует cookie/session и не пересекается с `/api` auth-flow.

### Step 3. Node.js Runtime and HTTP Instrumentation

1. Включить стандартные process/runtime метрики Node.js через `prom-client.collectDefaultMetrics()`.
2. Добавить Express middleware для HTTP instrumentation:
- request counter,
- request duration histogram,
- labels: `method`, `route`, `status_code`.
3. Нормализовать route labels до низкой кардинальности:
- использовать template route вместо raw URL,
- не включать query string,
- не включать user-controlled identifiers как label values.
4. Исключить или отдельно учитывать `GET /metrics`, чтобы scrape traffic не искажал полезные HTTP графики.

Done criteria:
- В Prometheus видны process/runtime метрики Node.js.
- HTTP метрики отражают объём, latency и статусы без high-cardinality labels.

### Step 4. Socket.IO and Validation Metrics

1. Добавить instrumentation для `Socket.IO`:
- gauge активных подключений,
- counters подключений,
- counters отключений,
- counters socket-level errors.
2. Перевести validation instrumentation на native Prometheus metrics:
- total validations,
- duration histogram or summary,
- cache hits,
- cache misses,
- rejections by validation code.
3. По возможности переиспользовать существующую validation metrics abstraction, чтобы не разводить две независимые системы счётчиков.
4. Сохранить текущий JSON debug endpoint без изменения внешнего поведения, если это не конфликтует с новой реализацией.

Done criteria:
- `Socket.IO` health отражается в Prometheus.
- Validation metrics доступны в Prometheus-формате и пригодны для Grafana panels.

### Step 5. Docker Compose Monitoring Profile for VPS

1. Расширить `docker-compose.yml` profile `monitoring` сервисами:
- `prometheus`,
- `grafana`.
2. Настроить Prometheus scrape существующего `app` сервиса по internal network.
3. Не публиковать Prometheus наружу.
4. Опубликовать Grafana только на loopback interface хоста, чтобы доступ шёл через SSH tunnel.
5. Не добавлять persistent volumes для Prometheus/Grafana state в первой фазе.

Done criteria:
- Monitoring stack поднимается отдельной командой через compose profile.
- На VPS Grafana доступна локально на хосте, Prometheus остаётся внутренним сервисом.

### Step 6. Grafana Provisioning and Overview Dashboard

1. Добавить provisioning для Prometheus datasource в репозиторий.
2. Добавить один стартовый dashboard уровня `Application Overview`.
3. Покрыть dashboard следующими панелями:
- availability / scrape visibility,
- HTTP throughput,
- HTTP latency,
- HTTP error rate,
- memory / CPU / event loop / process basics,
- active socket connections and socket errors,
- validation throughput / latency / rejection hotspots / cache efficiency.
4. Сделать dashboard совместимым с репозиторным provisioning без ручного кликанья в UI после старта.

Done criteria:
- После старта Grafana datasource уже настроен.
- В Grafana автоматически доступен один рабочий overview dashboard.

### Step 7. Documentation and Runbook

1. Обновить `README.md`:
- что такое `/metrics`,
- как это работает в `npm run dev`,
- как поднять monitoring profile в Docker,
- какие порты и ограничения доступа используются,
- как зайти в Grafana через SSH tunnel.
2. Обновить `.env.example` новыми переменными Grafana.
3. Добавить короткий operational runbook для VPS:
- команда старта monitoring profile,
- команда/пример SSH tunnel,
- где ожидать доступ к Grafana,
- что `/metrics` и Prometheus не публикуются наружу.

Done criteria:
- Документация покрывает dev и VPS сценарии.
- Оператору не нужно читать код, чтобы поднять и открыть мониторинг.

### Step 8. Verification and Safety Checks

1. Добавить серверные тесты для `GET /metrics`:
- endpoint отвечает успешно,
- content type корректный,
- в выдаче присутствуют ключевые metric families.
2. Проверить, что instrumentation не ломает существующий auth/API flow.
3. Прогнать `npm run typecheck`.
4. Прогнать server test suite.
5. Выполнить smoke check compose monitoring profile.

Done criteria:
- Monitoring changes автоматизированно проверяются хотя бы на базовом уровне.
- Новая instrumentation не ломает существующие server routes и socket flow.

## Suggested Delivery Slices

1. Slice A: Steps 1-3 (monitoring foundation + `/metrics` + runtime/HTTP metrics).
2. Slice B: Steps 4-6 (`Socket.IO` + validation metrics + Docker monitoring profile + Grafana provisioning).
3. Slice C: Steps 7-8 (documentation + tests + smoke verification).

## Risks and Mitigations

- Risk: High-cardinality labels на HTTP метриках сделают Prometheus noisy и дорогим.
Mitigation: использовать нормализованные route templates, исключить raw URL/query strings и не метить user-generated values.

- Risk: `GET /metrics` случайно станет публично доступен на VPS.
Mitigation: не проксировать route через `nginx`, держать endpoint только на app service и зафиксировать это в compose/docs.

- Risk: scrape traffic исказит latency/request rate графики приложения.
Mitigation: исключить `/metrics` из основных HTTP SLI метрик или считать его отдельным route.

- Risk: Dashboard окажется хрупким из-за несогласованных metric names или datasource settings.
Mitigation: централизовать naming policy и хранить datasource/dashboard provisioning в репозитории.

- Risk: Небезопасные или забытые дефолтные Grafana credentials.
Mitigation: вынести admin user/password в явный env-контракт и задокументировать ожидания для VPS.

- Risk: Дублирование старой validation metrics модели и новой Prometheus instrumentation усложнит поддержку.
Mitigation: переиспользовать текущий collector или сделать одну source-of-truth abstraction для обоих представлений.

## Definition of Done (Feature 05)

- Сервер отдаёт `GET /metrics` в Prometheus-compatible формате в dev и production process.
- В метрики включены Node.js default metrics, базовые HTTP метрики, `Socket.IO` health metrics и validation metrics.
- `docker-compose` поддерживает optional profile `monitoring` с `Prometheus + Grafana`.
- Prometheus не публикуется наружу, а Grafana на VPS открывается через loopback binding + SSH tunnel.
- Grafana datasource и один overview dashboard provisioning-ятся автоматически из файлов репозитория.
- `.env.example` и `README.md` обновлены под новый monitoring flow.
- Базовые тесты и smoke checks подтверждают, что monitoring layer не ломает существующее приложение.
