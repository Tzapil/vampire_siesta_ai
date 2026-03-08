## Wizard-валидация по шагам (чек-лист + псевдокод)

### 2.0 Общие константы (сервер)

const WIZARD_STEPS = 9;  
  
const ATTR_BUDGET = { primary: 7, secondary: 5, tertiary: 3 };  
const ABIL_BUDGET  = { primary: 13, secondary: 9, tertiary: 5 };  
  
const BASE_DISCIPLINES_POINTS = 3;  
const BASE_BACKGROUNDS_POINTS = 5;  
const BASE_VIRTUES_EXTRA      = 7; // поверх 1/1/1  
  
const FREEBIE_BASE = 15;  
const FLAW_FREEBIE_CAP = 7;  
  
// Freebie costs V20  
const FREEBIE_COST = {  
  attribute: 5,  
  ability: 2,  
  discipline: 7,  
  background: 1,  
  virtue: 2,  
  humanity: 2,  
  willpower: 1,  
} as const; // :contentReference[oaicite:2]{index=2}

---

### 2.1 Маппинг “поля → шаг”

Нужно, чтобы при изменении данных на шаге N (когда пользователь “откатился” и поменял что-то) сервер мог:

- поставить `wizard.currentStep = N`
    
- при необходимости применить “зависимые сбросы” (смена клана → дисциплины, appearance)
    

Примерно:

- Step 1: `meta.*`, `creation.attributesPriority?` нет, `creation.abilitiesPriority?` нет
    
- Step 2: `traits.attributes`, `creation.attributesPriority`
    
- Step 3: `traits.abilities`, `creation.abilitiesPriority`
    
- Step 4: `traits.disciplines`
    
- Step 5: `traits.backgrounds`
    
- Step 6: `traits.virtues` (+ пересчёт стартовых Humanity/Willpower на уровне derived при finish)
    
- Step 7: `traits.merits`, `traits.flaws`, `creation.flawFreebieEarned`
    
- Step 8: `traits.*.freebie`, `creation.freebieBuys.*`
    
- Step 9: только просмотр/finish
    

---

### 2.2 Валидация диапазонов (всегда)

**Диапазоны totals (base+freebie+storyteller):**

- Атрибуты: `1..5` для всех, кроме Appearance (если клан фиксирует 0 — тогда `0..5` и строго `total=0`)
    
- Способности: `0..5`
    
- Дисциплины: `0..5` + только клановые ключи могут быть >0
    
- Детали биографии: `0..5`
    
- Добродетели: `1..5`
    
- Resources:
    
    - bloodPool.current: `0..derived.bloodPoolMax`
        
    - willpower.current: `0..10`
        
    - humanity.current: `0..10`
        
    - health: `b+l+a <= 7`, каждое `0..7`
        

---

### 2.3 Шаг 1 — Основное

**Должно быть заполнено (required):**

- `meta.characterName`
    
- `meta.playerName`
    
- `meta.clanKey` (существует в clans)
    
- `meta.generation` (8..14)
    
- `meta.chronicleId` (существует)
    
- `meta.sectKey`, `meta.natureKey`, `meta.demeanorKey` (существуют в справочниках)
    

**Зависимости:**

- если у клана `rules.appearanceFixedTo=0` → appearance должен стать 0 (сброс слоёв), иначе appearance минимум 1. (Мы храним правило в Clan.)
    

Псевдокод:

validateStep1(char, dict) {  
  req(char.meta.characterName)  
  req(char.meta.playerName)  
  req(dict.clans.has(char.meta.clanKey))  
  range(char.meta.generation, 8, 14)  
  req(await chronicleExists(char.meta.chronicleId))  
  req(dict.sects.has(char.meta.sectKey))  
  req(dict.natures.has(char.meta.natureKey))  
  req(dict.demeanors.has(char.meta.demeanorKey))  
  
  applyClanAppearanceRule(char, dict.clans.get(char.meta.clanKey))  
}

---

### 2.4 Шаг 2 — Атрибуты (7/5/3 на группы)

**Требуется:**

- `creation.attributesPriority` — должна быть перестановкой primary/secondary/tertiary
    
- Для каждого attributeKey должен быть LayeredValue
    
- Totals в диапазонах
    

**Проверка бюджета:**

- Минимальная база: **все атрибуты >= 1**, кроме appearance у Nosferatu фиксированно 0.
    
- Траты базовых “распределяемых” очков считаем так:
    

`extra = baseTotal - minBase`  
где `minBase` = 1 (обычно) или 0 (appearance при Nosferatu).

Суммируем `extra` по группам (physical/social/mental) и сравниваем с 7/5/3 по выбранным приоритетам.

Псевдокод:

validateStep2(char, dict) {  
  assertPriorityPermutation(char.creation.attributesPriority)  
  
  const clan = dict.clans.get(char.meta.clanKey)  
  const fixedAppearance = clan.rules?.appearanceFixedTo === 0  
  
  for (attr of dict.attributes) {  
    const v = getLayer(char.traits.attributes, attr.key)  
    const total = v.base + v.freebie + v.storyteller  
  
    // range total  
    if (attr.key === "appearance" && fixedAppearance) {  
      if (total !== 0) error("traits.attributes.appearance", "У Носферату внешность = 0")  
    } else {  
      range(total, 1, 5)  
    }  
  
    // base minimum  
    if (attr.key === "appearance" && fixedAppearance) {  
      // base допускаем 0  
      if (v.base !== 0) error(...)  
    } else {  
      if (v.base < 1) error(...)  
    }  
  }  
  
  // budget base extras by group  
  const sums = { physical:0, social:0, mental:0 }  
  for (attr of dict.attributes) {  
    const v = getLayer(...)  
    const minBase = (attr.key==="appearance" && fixedAppearance) ? 0 : 1  
    sums[attr.group] += (v.base - minBase)  
  }  
  
  const p = char.creation.attributesPriority  
  assertEqual(sums.physical, ATTR_BUDGET[p.physical])  
  assertEqual(sums.social,   ATTR_BUDGET[p.social])  
  assertEqual(sums.mental,   ATTR_BUDGET[p.mental])  
}

---

### 2.5 Шаг 3 — Способности (13/9/5 по Talents/Skills/Knowledges)

**Требуется:**

- `creation.abilitiesPriority` — перестановка primary/secondary/tertiary
    
- totals abilities в диапазоне `0..5`
    

**Проверка бюджета base:**  
Сумма `base` по каждой группе должна равняться соответствующему бюджету (13/9/5) по выбранным приоритетам.

validateStep3(char, dict) {  
  assertPriorityPermutation(char.creation.abilitiesPriority)  
  
  // range  
  for (ab of dict.abilities) {  
    const v = getLayer(char.traits.abilities, ab.key)  
    range(v.base + v.freebie + v.storyteller, 0, 5)  
    if (v.base < 0) error(...)  
  }  
  
  const sums = { talents:0, skills:0, knowledges:0 }  
  for (ab of dict.abilities) sums[ab.group] += getLayer(...).base  
  
  const p = char.creation.abilitiesPriority  
  assertEqual(sums.talents,    ABIL_BUDGET[p.talents])  
  assertEqual(sums.skills,     ABIL_BUDGET[p.skills])  
  assertEqual(sums.knowledges, ABIL_BUDGET[p.knowledges])  
}

---

### 2.6 Шаг 4 — Дисциплины (3 base, только клановые, base cap 3)

**Требуется:**

- любые дисциплины **вне** `clan.disciplineKeys` должны иметь total=0
    
- сумма `base` по всем дисциплинам = 3
    
- `base` каждой дисциплины `<= 3`
    
- totals `0..5`
    

validateStep4(char, dict) {  
  const clan = dict.clans.get(char.meta.clanKey)  
  const allowed = new Set(clan.disciplineKeys)  
  
  let baseSum = 0  
  for (disc of dict.disciplines) {  
    const v = getLayer(char.traits.disciplines, disc.key)  
    const total = v.base + v.freebie + v.storyteller  
  
    range(total, 0, 5)  
  
    if (!allowed.has(disc.key) && total !== 0)  
      error(`traits.disciplines.${disc.key}`, "Неклановая дисциплина запрещена в MVP")  
  
    if (v.base > 3) error(..., "На этапе создания base дисциплин не выше 3")  
    baseSum += v.base  
  }  
  
  assertEqual(baseSum, BASE_DISCIPLINES_POINTS)  
}

---

### 2.7 Шаг 5 — Backgrounds (5 base)

validateStep5(char, dict) {  
  let baseSum = 0  
  for (bg of dict.backgrounds) {  
    const v = getLayer(char.traits.backgrounds, bg.key)  
    range(v.base + v.freebie + v.storyteller, 0, 5)  
    baseSum += v.base  
  }  
  assertEqual(baseSum, BASE_BACKGROUNDS_POINTS)  
}

---

### 2.8 Шаг 6 — Virtues (min 1/1/1 + 7 base сверху)

**Требуется:**

- три ключа добродетелей существуют (в словаре `virtues`)
    
- base каждой добродетели >= 1
    
- totals `1..5`
    
- сумма `(base - 1)` по трем = 7
    

validateStep6(char, dict) {  
  // ожидаем 3 ключа в словаре virtues  
  const virtueKeys = dict.virtues.map(v => v.key)  
  
  let extras = 0  
  for (vk of virtueKeys) {  
    const v = getLayer(char.traits.virtues, vk)  
    range(v.base + v.freebie + v.storyteller, 1, 5)  
    if (v.base < 1) error(..., "Добродетели не могут быть ниже 1")  
    extras += (v.base - 1)  
  }  
  
  assertEqual(extras, BASE_VIRTUES_EXTRA)  
}

---

### 2.9 Шаг 7 — Merits/Flaws

**Требуется:**

- все ключи есть в словаре `MeritFlawModel`
    
- нельзя добавлять “свои”
    
- массивы без дублей (рекомендуется enforce на сервере)
    

**Подсчет заработанных freebies от flaws:**

- `flawFreebieEarned = min(sum(flaws.cost), 7)`
    
- хранится в `creation.flawFreebieEarned`
    

validateStep7(char, dict) {  
  ensureUnique(char.traits.merits)  
  ensureUnique(char.traits.flaws)  
  
  let flawSum = 0  
  for (fk of char.traits.flaws) {  
    const item = dict.meritFlaws.get(fk)  
    if (!item || item.type !== "flaw") error(...)  
    flawSum += item.cost  
  }  
  char.creation.flawFreebieEarned = Math.min(flawSum, 7)  
  
  for (mk of char.traits.merits) {  
    const item = dict.meritFlaws.get(mk)  
    if (!item || item.type !== "merit") error(...)  
  }  
}

---

### 2.10 Шаг 8 — Freebies

На этом шаге игрок:

- докупает точки, увеличивая `freebie` слой у trait’ов
    
- покупает merits (они тратят freebie бюджет)
    
- может брать flaws (но очки уже учтены на шаге 7, кап 7)
    
- может докупить Humanity/Willpower (учитываем через `creation.freebieBuys.*`)
    

**Стоимость freebie-покупок фиксируем:**

- Attribute 5 / Ability 2 / Discipline 7 / Background 1 / Virtue 2 / Humanity 2 / Willpower 1
    

**Бюджет:**

- `budget = 15 + creation.flawFreebieEarned`
    

**Spent:**

- sum over `freebie` dots в traits * cost per dot
    
- - сумма `merits.cost`
        
- - `creation.freebieBuys.humanity * 2`
        
- - `creation.freebieBuys.willpower * 1`
        

computeFreebieSpent(char, dict) {  
  let spent = 0  
  
  spent += sumFreebieDots(char.traits.attributes)  * 5  
  spent += sumFreebieDots(char.traits.abilities)   * 2  
  spent += sumFreebieDots(char.traits.disciplines) * 7  
  spent += sumFreebieDots(char.traits.backgrounds) * 1  
  spent += sumFreebieDots(char.traits.virtues)     * 2  
  
  // merits  
  for (mk of char.traits.merits) spent += dict.meritFlaws.get(mk).cost  
  
  // humanity/willpower  
  spent += char.creation.freebieBuys.humanity  * 2  
  spent += char.creation.freebieBuys.willpower * 1  
  
  return spent  
}  
  
validateStep8(char, dict) {  
  const budget = 15 + char.creation.flawFreebieEarned  
  const spent = computeFreebieSpent(char, dict)  
  
  if (spent > budget) error("creation.freebies", `Потрачено ${spent}, доступно ${budget}`)  
  
  // дополнительно: диапазоны totals + дисциплины только клановые  
  validateRangesAndClanDisciplineRule(char, dict)  
}

**Откаты freebies при удалении flaws** (если budget упал и стало `spent > budget`):  
запускаем rollback по нашему порядку (Humanity → Willpower → Backgrounds → Disciplines → Abilities → Attributes → Virtues → Merits), уменьшая freebie/удаляя merits, пока `spent <= budget`.

---

### 2.11 Шаг 9 — Finish (полная валидация + предупреждение о “сгорании”)

**Finish endpoint делает:**

1. `validateSteps1..8` (полный прогон)
    
2. Проверяет, что обязательные поля заполнены
    
3. Проверяет budget (spent <= budget)
    
4. Если **остались непотраченные freebies** (`budget - spent > 0`):
    
    - возвращает `warning` и требует `confirmBurn=true`
        
5. Если ок:
    
    - вычисляет `derived.startingHumanity = Conscience + SelfControl`
        
    - вычисляет `derived.startingWillpower = Courage`
        
    - выставляет `creationFinished=true`
        
    - удаляет `wizard`
        

---

## 3) Важные “авто-эффекты” (зависимости)

### 3.1 Смена клана

- Сбрасываем **все дисциплины в 0** (base/freebie/storyteller = 0)
    
- Применяем правило appearance:
    
    - если `appearanceFixedTo=0`: обнуляем appearance во всех слоях
        
    - иначе: если appearance был 0, ставим `base=1`, `freebie=0`, `storyteller=0`
        

### 3.2 Пересчёт derived по поколению

- При изменении `meta.generation`:
    
    - подтягиваем запись из `generations`
        
    - обновляем `derived.bloodPoolMax` и `derived.bloodPerTurn`
        
- `startingHumanity/startingWillpower` **не пересчитываем**, кроме момента finish.
