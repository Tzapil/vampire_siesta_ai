# 1) Крупные этапы (Milestones)

## M1. Фундамент репозитория и DX

**Цель:** монорепо, сборка, единые типы, запуск dev/prod.  
**DoD:** `npm i`, `npm run dev`, `npm run build`, `npm run typecheck` работают.

## M2. Сервер: каркас API + Mongo + Seed

**Цель:** Express + Mongoose + базовые схемы, seed идемпотентный.  
**DoD:** `npm run seed` создаёт “Без хроники” и справочники; сервер подключается к Mongo.

## M3. REST API: справочники / хроники / персонажи

**Цель:** полный REST минимум по ТЗ (без wizard-логики).  
**DoD:** можно создать персонажа, открыть по uuid, увидеть списки хроник/персонажей, soft delete.

## M4. Клиент: каркас UI + роутинг + загрузка справочников

**Цель:** React Router, API клиент, глобальная загрузка справочников.  
**DoD:** страницы существуют, данные отображаются, 404 работает.

## M5. Realtime инфраструктура (Socket.IO) + патчи + версионирование

**Цель:** комнаты на uuid, optimistic UI, resync при reject.  
**DoD:** изменение ресурсов/текста синхронизируется между вкладками.

## M6. Игровой режим (read-only лист + редактируемые ресурсы)

**Цель:** ресурсы, health-трек, notes/equipment, экспорт/импорт кнопки.  
**DoD:** всё редактируемое синкается realtime; ограничения enforced сервером.

## M7. ST mode

**Цель:** редактирование всего через слой `storyteller`, диапазоны enforced, сброс дисциплин при смене клана, soft delete.  
**DoD:** ST может менять totals, сервер корректно пишет storyteller-дельту.

## M8. Wizard (пошаговое создание) — каркас → правила → freebies → finish

**Цель:** stepper, next/back/goto/finish, строгие бюджеты/валидации, rollback freebies.  
**DoD:** создаём персонажа строго по правилам, “Завершить” фиксирует derived starting*, wizard удаляется.

## M9. Импорт/экспорт (строгий), Help, Docker production

**Цель:** строгий импорт, export без uuid, help-страница, docker multi-stage.  
**DoD:** docker-compose поднимает app+mongo, приложение доступно и работает.

---

# 2) Декомпозиция этапов до исполнимых задач

## M1. Фундамент репозитория и DX

1. Монорепо `npm workspaces`: `apps/client`, `apps/server`
    
2. Общий TypeScript базис: `tsconfig.base.json`, алиасы
    
3. Общие скрипты: `dev`, `build`, `typecheck`, `lint`
    
4. Dev-запуск: параллельно client+server, proxy /api и /socket.io
    
5. Минимальный стиль/форматирование (ESLint/Prettier) без усложнений
    

## M2. Сервер + Mongo + Seed

1. Express каркас: health endpoint, JSON middleware, централизованный error handler
    
2. Подключение к Mongo (dotenv + env example)
    
3. Mongoose модели:
    
    - Chronicle
        
    - Dictionary коллекции
        
    - Character (ядро + resources + derived + version + deleted)
        
4. Seed idempotent:
    
    - “Без хроники”
        
    - `generations` 8..14
        
    - `clans` (disciplineKeys + nosferatu rule)
        
    - минимальные справочники (key+labelRu)
        

## M3. REST API core

1. `GET /api/*` dictionaries (все)
    
2. Chronicles:
    
    - `GET /api/chronicles`
        
    - `GET /api/chronicles/:id`
        
    - `GET /api/chronicles/:id/characters` (deleted=false, sort by name)
        
3. Characters:
    
    - `POST /api/characters` (defaults по ТЗ)
        
    - `GET /api/characters/:uuid` (404 если deleted)
        
    - `DELETE /api/characters/:uuid` (soft delete)
        

## M4. Клиент foundation

1. Роутинг (все страницы из ТЗ) + 404
    
2. API client + типы DTO
    
3. Глобальная загрузка справочников + хранение в памяти (context)
    
4. Главная: список хроник, создать персонажа, импорт (позже)
    
5. Хроника: список персонажей, сортировка, “Черновик”
    
6. Персонаж: загрузка по uuid, режим по `creationFinished`
    

## M5. Socket.IO + патчи

1. Server Socket.IO:
    
    - room = uuid
        
    - событие `patchApplied`
        
    - обработка входящего `Patch`
        
2. Версионирование:
    
    - `character.version` ++ при каждом изменении
        
3. Client socket layer:
    
    - connect/join, send patch
        
    - optimistic apply
        
    - reject => toast + full resync
        
    - accept => применяем broadcast как source of truth
        

## M6. Игровой режим UI

1. Read-only отображение меты и traits totals
    
2. Редактируемые ресурсы:
    
    - BloodPool current (0..derived.max)
        
    - Willpower/Humanity current (0..10)
        
    - Health b/l/a (sum<=7) + sequential click UI + wound penalty
        
3. Notes/Equipment (last-write-wins)
    
4. Кнопки: copy link, export, import, goto ST
    

## M7. ST mode

1. UI редактирования totals через пересчёт storyteller слоя
    
2. Серверная валидация диапазонов + клановые ограничения дисциплин
    
3. Смена клана:
    
    - сброс дисциплин не из нового клана
        
    - appearance rule (Nosferatu)
        
4. Soft delete из ST
    

## M8. Wizard

Каркас:

1. `wizard.currentStep` хранится в БД
    
2. Stepper: назад кликабельный, вперёд только “Далее”
    
3. REST: next/back/goto/finish, серверная валидация шага  
    Правила:
    
4. Step 1: обязательные поля “Основное”
    
5. Step 2: Attributes 7/5/3 + Nosferatu appearance=0 + max 5
    
6. Step 3: Abilities 13/9/5 + max 5
    
7. Step 4: Disciplines base=3, только клановые, каждая <=3 на старте
    
8. Step 5: Backgrounds base=5
    
9. Step 6: Virtues base min 1 + распределить 7, max 5
    
10. Step 7: Merits/Flaws selection + cap +7 для бонуса
    
11. Step 8: Freebies покупка + budgets + rollback
    
12. Step 9: Review + finish: confirm burn, фиксировать startingHumanity/startingWillpower, удалить wizard
    

## M9. Импорт/экспорт + Help + Docker

1. Export: документ без uuid
    
2. Import: строгая валидация, uuid игнорируется, перезапись
    
3. Home Import: создаёт персонажа → импортит JSON
    
4. Help-страница (русская)
    
5. Docker multi-stage + docker-compose (app + mongo) + `.env.example`