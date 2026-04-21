import {
  AbilityModel,
  AttributeModel,
  BackgroundModel,
  ClanModel,
  ChronicleModel,
  DemeanorModel,
  DisciplineModel,
  FlawModel,
  GenerationModel,
  MeritModel,
  NatureModel,
  SectModel,
  VirtueModel
} from "../db";

export type ValidationError = { path: string; message: string };
export type ValidationOptions = { mutate?: boolean };

export const WIZARD_STEPS = 8;

export const ATTR_BUDGET = { primary: 7, secondary: 5, tertiary: 3 } as const;
export const ABIL_BUDGET = { primary: 13, secondary: 9, tertiary: 5 } as const;

export const BASE_DISCIPLINES_POINTS = 3;
export const BASE_BACKGROUNDS_POINTS = 5;
export const BASE_VIRTUES_EXTRA = 7;

export const FREEBIE_BASE = 15;
export const FLAW_FREEBIE_CAP = 7;
const MAX_AVATAR_LENGTH = 3_000_000;

export const FREEBIE_COST = {
  attribute: 5,
  ability: 2,
  discipline: 7,
  background: 1,
  virtue: 2,
  humanity: 2,
  willpower: 1
} as const;

export type Dictionaries = {
  clans: Map<string, any>;
  disciplines: Array<{ key: string }>;
  attributes: Array<{ key: string; group: "physical" | "social" | "mental" }>;
  abilities: Array<{ key: string; group: "talents" | "skills" | "knowledges" }>;
  backgrounds: Array<{ key: string }>;
  virtues: Array<{ key: string }>;
  merits: Map<string, { key: string; pointCost: number }>;
  flaws: Map<string, { key: string; pointCost: number }>;
  sects: Map<string, { key: string }>;
  natures: Map<string, { key: string }>;
  demeanors: Map<string, { key: string }>;
  generations: Map<number, { generation: number; bloodPoolMax: number; bloodPerTurn: number }>;
};

let cachedDicts: { value: Dictionaries; ts: number } | null = null;
const DICT_TTL_MS = 60_000;

export async function loadDictionaries(): Promise<Dictionaries> {
  if (cachedDicts && Date.now() - cachedDicts.ts < DICT_TTL_MS) {
    return cachedDicts.value;
  }

  const [
    clans,
    disciplines,
    attributes,
    abilities,
    backgrounds,
    virtues,
    merits,
    flaws,
    sects,
    natures,
    demeanors,
    generations
  ] = await Promise.all([
    ClanModel.find().lean(),
    DisciplineModel.find().select("key").lean(),
    AttributeModel.find().select("key group").lean(),
    AbilityModel.find().select("key group").lean(),
    BackgroundModel.find().select("key").lean(),
    VirtueModel.find().select("key").lean(),
    MeritModel.find().select("key pointCost").lean(),
    FlawModel.find().select("key pointCost").lean(),
    SectModel.find().select("key").lean(),
    NatureModel.find().select("key").lean(),
    DemeanorModel.find().select("key").lean(),
    GenerationModel.find().select("generation bloodPoolMax bloodPerTurn").lean()
  ]);

  const dicts: Dictionaries = {
    clans: new Map(clans.map((item) => [item.key, item])),
    disciplines,
    attributes,
    abilities,
    backgrounds,
    virtues,
    merits: new Map(merits.map((item) => [item.key, item])),
    flaws: new Map(flaws.map((item) => [item.key, item])),
    sects: new Map(sects.map((item) => [item.key, item])),
    natures: new Map(natures.map((item) => [item.key, item])),
    demeanors: new Map(demeanors.map((item) => [item.key, item])),
    generations: new Map(generations.map((item) => [item.generation, item]))
  };

  cachedDicts = { value: dicts, ts: Date.now() };
  return dicts;
}

function isMap(value: any): value is Map<string, any> {
  return value instanceof Map;
}

export function getLayer(container: any, key: string) {
  if (!container) {
    return { base: 0, freebie: 0, storyteller: 0 };
  }
  const entry = isMap(container) ? container.get(key) : container[key];
  if (!entry) {
    return { base: 0, freebie: 0, storyteller: 0 };
  }
  return {
    base: Number(entry.base ?? 0),
    freebie: Number(entry.freebie ?? 0),
    storyteller: Number(entry.storyteller ?? 0)
  };
}

export function setLayer(container: any, key: string, value: { base: number; freebie: number; storyteller: number }) {
  if (isMap(container)) {
    container.set(key, value);
    return;
  }
  container[key] = value;
}

function sumLayered(value: { base: number; freebie: number; storyteller: number }) {
  return value.base + value.freebie + value.storyteller;
}

function rangeCheck(errors: ValidationError[], path: string, value: number, min: number, max: number, label = "Значение") {
  if (value < min || value > max) {
    errors.push({ path, message: `${label} должно быть от ${min} до ${max}` });
  }
}

function ensureUnique(values: string[]) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return false;
    seen.add(value);
  }
  return true;
}

export function validateRanges(
  character: any,
  dict: Dictionaries,
  options: { allowNonClanDisciplines?: boolean } = {}
): ValidationError[] {
  const errors: ValidationError[] = [];
  const clan = dict.clans.get(character.meta?.clanKey ?? "");
  const fixedAppearance = clan?.rules?.appearanceFixedTo === 0;
  const allowedDisciplines = new Set<string>(clan?.disciplineKeys ?? []);
  const allowNonClanDisciplines = options.allowNonClanDisciplines === true;

  for (const attr of dict.attributes) {
    const layer = getLayer(character.traits?.attributes, attr.key);
    const total = sumLayered(layer);
    if (attr.key === "appearance" && fixedAppearance) {
      if (total !== 0) {
        errors.push({
          path: `traits.attributes.${attr.key}`,
          message: "У Носферату внешность должна быть 0"
        });
      }
    } else {
      rangeCheck(errors, `traits.attributes.${attr.key}`, total, 1, 5, "Атрибут");
    }
  }

  for (const ability of dict.abilities) {
    const layer = getLayer(character.traits?.abilities, ability.key);
    const total = sumLayered(layer);
    rangeCheck(errors, `traits.abilities.${ability.key}`, total, 0, 5, "Способность");
  }

  for (const discipline of dict.disciplines) {
    const layer = getLayer(character.traits?.disciplines, discipline.key);
    const total = sumLayered(layer);
    rangeCheck(errors, `traits.disciplines.${discipline.key}`, total, 0, 5, "Дисциплина");
    if (!allowNonClanDisciplines && total !== 0 && !allowedDisciplines.has(discipline.key)) {
      errors.push({
        path: `traits.disciplines.${discipline.key}`,
        message: "Неклановая дисциплина запрещена"
      });
    }
  }

  for (const background of dict.backgrounds) {
    const layer = getLayer(character.traits?.backgrounds, background.key);
    const total = sumLayered(layer);
    rangeCheck(errors, `traits.backgrounds.${background.key}`, total, 0, 5, "Фон");
  }

  for (const virtue of dict.virtues) {
    const layer = getLayer(character.traits?.virtues, virtue.key);
    const total = sumLayered(layer);
    rangeCheck(errors, `traits.virtues.${virtue.key}`, total, 1, 5, "Добродетель");
  }

  const resources = character.resources ?? {};
  const derived = character.derived ?? { bloodPoolMax: 0 };

  rangeCheck(
    errors,
    "resources.bloodPool.current",
    Number(resources.bloodPool?.current ?? 0),
    0,
    Number(derived.bloodPoolMax ?? 0),
    "Текущий запас крови"
  );
  rangeCheck(
    errors,
    "resources.willpower.current",
    Number(resources.willpower?.current ?? 0),
    0,
    10,
    "Текущая Сила воли"
  );
  rangeCheck(
    errors,
    "resources.humanity.current",
    Number(resources.humanity?.current ?? 0),
    0,
    10,
    "Текущая Человечность"
  );

  const health = resources.health ?? { bashing: 0, lethal: 0, aggravated: 0 };
  const bashing = Number(health.bashing ?? 0);
  const lethal = Number(health.lethal ?? 0);
  const aggravated = Number(health.aggravated ?? 0);

  rangeCheck(errors, "resources.health.bashing", bashing, 0, 7, "Урон (контузящий)");
  rangeCheck(errors, "resources.health.lethal", lethal, 0, 7, "Урон (летальный)");
  rangeCheck(errors, "resources.health.aggravated", aggravated, 0, 7, "Урон (аггравированный)");

  if (bashing + lethal + aggravated > 7) {
    errors.push({ path: "resources.health", message: "Сумма урона не может превышать 7" });
  }

  if (typeof character.notes !== "string") {
    errors.push({ path: "notes", message: "Поле заметок должно быть строкой" });
  }
  if (typeof character.equipment !== "string") {
    errors.push({ path: "equipment", message: "Поле снаряжения должно быть строкой" });
  }
  if (character.meta?.avatarUrl != null && typeof character.meta.avatarUrl !== "string") {
    errors.push({ path: "meta.avatarUrl", message: "Картинка должна быть строкой" });
  }
  if (typeof character.meta?.avatarUrl === "string" && character.meta.avatarUrl.length > MAX_AVATAR_LENGTH) {
    errors.push({ path: "meta.avatarUrl", message: "Картинка слишком большая" });
  }

  return errors;
}

export function applyClanRules(character: any, dict: Dictionaries, mode: "wizard" | "st") {
  const clan = dict.clans.get(character.meta?.clanKey ?? "");
  if (!clan) return false;

  let changed = false;
  const allowed = new Set<string>(clan.disciplineKeys ?? []);

  if (mode === "wizard") {
    for (const discipline of dict.disciplines) {
      if (!allowed.has(discipline.key)) {
        const current = getLayer(character.traits?.disciplines, discipline.key);
        if (sumLayered(current) !== 0) {
          setLayer(character.traits.disciplines, discipline.key, { base: 0, freebie: 0, storyteller: 0 });
          changed = true;
        }
      }
    }
  }

  const appearance = getLayer(character.traits?.attributes, "appearance");
  const total = sumLayered(appearance);

  if (clan.rules?.appearanceFixedTo === 0) {
    if (mode === "wizard") {
      if (total !== 0 || appearance.base !== 0 || appearance.freebie !== 0 || appearance.storyteller !== 0) {
        setLayer(character.traits.attributes, "appearance", { base: 0, freebie: 0, storyteller: 0 });
        changed = true;
      }
    } else {
      const desiredStoryteller = 0 - (appearance.base + appearance.freebie);
      if (appearance.storyteller !== desiredStoryteller) {
        setLayer(character.traits.attributes, "appearance", {
          base: appearance.base,
          freebie: appearance.freebie,
          storyteller: desiredStoryteller
        });
        changed = true;
      }
    }
  } else {
    if (mode === "wizard") {
      if (total === 0) {
        setLayer(character.traits.attributes, "appearance", { base: 1, freebie: 0, storyteller: 0 });
        changed = true;
      }
    } else if (total < 1) {
      const desiredStoryteller = 1 - (appearance.base + appearance.freebie);
      if (appearance.storyteller !== desiredStoryteller) {
        setLayer(character.traits.attributes, "appearance", {
          base: appearance.base,
          freebie: appearance.freebie,
          storyteller: desiredStoryteller
        });
        changed = true;
      }
    }
  }

  return changed;
}

export function applyGenerationDerived(character: any, dict: Dictionaries) {
  const generation = Number(character.meta?.generation ?? 0);
  const record = dict.generations.get(generation);
  if (!record) {
    return false;
  }

  const current = character.derived ?? {};
  const next = {
    ...current,
    bloodPoolMax: record.bloodPoolMax,
    bloodPerTurn: record.bloodPerTurn
  };

  if (
    current.bloodPoolMax !== next.bloodPoolMax ||
    current.bloodPerTurn !== next.bloodPerTurn
  ) {
    character.derived = next;
    return true;
  }

  return false;
}

function assertPriorityPermutation(value: any, keys: string[]) {
  if (!value) return false;
  const set = new Set(Object.values(value));
  return (
    keys.every((key) => value[key]) &&
    set.size === 3 &&
    set.has("primary") &&
    set.has("secondary") &&
    set.has("tertiary")
  );
}

export async function validateStep1(character: any, dict: Dictionaries): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  const meta = character.meta ?? {};

  if (!meta.name) {
    errors.push({ path: "meta.name", message: "Имя персонажа обязательно" });
  }
  if (!meta.playerName) {
    errors.push({ path: "meta.playerName", message: "Имя игрока обязательно" });
  }
  if (!meta.clanKey || !dict.clans.has(meta.clanKey)) {
    errors.push({ path: "meta.clanKey", message: "Клан обязателен" });
  }
  if (meta.generation == null || meta.generation < 8 || meta.generation > 14) {
    errors.push({ path: "meta.generation", message: "Поколение должно быть от 8 до 14" });
  }
  if (!meta.chronicleId) {
    errors.push({ path: "meta.chronicleId", message: "Хроника обязательна" });
  }
  if (!meta.sectKey || !dict.sects.has(meta.sectKey)) {
    errors.push({ path: "meta.sectKey", message: "Секта обязательна" });
  }
  if (!meta.natureKey || !dict.natures.has(meta.natureKey)) {
    errors.push({ path: "meta.natureKey", message: "Натура обязательна" });
  }
  if (!meta.demeanorKey || !dict.demeanors.has(meta.demeanorKey)) {
    errors.push({ path: "meta.demeanorKey", message: "Поведение обязательно" });
  }

  if (meta.chronicleId) {
    const exists = await ChronicleModel.exists({ _id: meta.chronicleId });
    if (!exists) {
      errors.push({ path: "meta.chronicleId", message: "Хроника не найдена" });
    }
  }

  return errors;
}

export function validateStep2(character: any, dict: Dictionaries): ValidationError[] {
  const errors: ValidationError[] = [];
  const priorities = character.creation?.attributesPriority;
  if (!assertPriorityPermutation(priorities, ["physical", "social", "mental"])) {
    errors.push({ path: "creation.attributesPriority", message: "Нужно выбрать приоритеты атрибутов" });
    return errors;
  }

  const clan = dict.clans.get(character.meta?.clanKey ?? "");
  const fixedAppearance = clan?.rules?.appearanceFixedTo === 0;

  const sums = { physical: 0, social: 0, mental: 0 };

  for (const attr of dict.attributes) {
    const layer = getLayer(character.traits?.attributes, attr.key);
    const minBase = attr.key === "appearance" && fixedAppearance ? 0 : 1;

    if (layer.base < minBase) {
      errors.push({
        path: `traits.attributes.${attr.key}.base`,
        message: "База атрибутов не может быть ниже минимума"
      });
    }
    if (layer.base > 5) {
      errors.push({
        path: `traits.attributes.${attr.key}.base`,
        message: "База атрибута не может быть выше 5"
      });
    }

    sums[attr.group] += layer.base - minBase;
  }

  const mapBudget = (rank: keyof typeof ATTR_BUDGET) => ATTR_BUDGET[rank];
  if (sums.physical !== mapBudget(priorities.physical)) {
    errors.push({ path: "traits.attributes", message: "Неверная сумма базовых атрибутов (Физические)" });
  }
  if (sums.social !== mapBudget(priorities.social)) {
    errors.push({ path: "traits.attributes", message: "Неверная сумма базовых атрибутов (Социальные)" });
  }
  if (sums.mental !== mapBudget(priorities.mental)) {
    errors.push({ path: "traits.attributes", message: "Неверная сумма базовых атрибутов (Ментальные)" });
  }

  if (fixedAppearance) {
    const appearance = getLayer(character.traits?.attributes, "appearance");
    if (appearance.base !== 0) {
      errors.push({
        path: "traits.attributes.appearance.base",
        message: "У Носферату внешность должна быть 0"
      });
    }
  }

  return errors;
}

export function validateStep3(character: any, dict: Dictionaries): ValidationError[] {
  const errors: ValidationError[] = [];
  const priorities = character.creation?.abilitiesPriority;
  if (!assertPriorityPermutation(priorities, ["talents", "skills", "knowledges"])) {
    errors.push({ path: "creation.abilitiesPriority", message: "Нужно выбрать приоритеты способностей" });
    return errors;
  }

  const sums = { talents: 0, skills: 0, knowledges: 0 };

  for (const ability of dict.abilities) {
    const layer = getLayer(character.traits?.abilities, ability.key);
    if (layer.base < 0) {
      errors.push({ path: `traits.abilities.${ability.key}.base`, message: "База способности не может быть ниже 0" });
    }
    if (layer.base > 5) {
      errors.push({ path: `traits.abilities.${ability.key}.base`, message: "База способности не может быть выше 5" });
    }
    sums[ability.group] += layer.base;
  }

  const mapBudget = (rank: keyof typeof ABIL_BUDGET) => ABIL_BUDGET[rank];
  if (sums.talents !== mapBudget(priorities.talents)) {
    errors.push({ path: "traits.abilities", message: "Неверная сумма базовых способностей (Таланты)" });
  }
  if (sums.skills !== mapBudget(priorities.skills)) {
    errors.push({ path: "traits.abilities", message: "Неверная сумма базовых способностей (Навыки)" });
  }
  if (sums.knowledges !== mapBudget(priorities.knowledges)) {
    errors.push({ path: "traits.abilities", message: "Неверная сумма базовых способностей (Знания)" });
  }

  return errors;
}

export function validateStep4(character: any, dict: Dictionaries): ValidationError[] {
  const errors: ValidationError[] = [];
  const clan = dict.clans.get(character.meta?.clanKey ?? "");
  const allowed = new Set<string>(clan?.disciplineKeys ?? []);

  let baseSum = 0;
  for (const discipline of dict.disciplines) {
    const layer = getLayer(character.traits?.disciplines, discipline.key);
    if (layer.base > 3) {
      errors.push({
        path: `traits.disciplines.${discipline.key}.base`,
        message: "Базовая дисциплина не может быть выше 3"
      });
    }
    if (!allowed.has(discipline.key) && sumLayered(layer) !== 0) {
      errors.push({
        path: `traits.disciplines.${discipline.key}`,
        message: "Неклановая дисциплина запрещена"
      });
    }
    baseSum += layer.base;
  }

  if (baseSum !== BASE_DISCIPLINES_POINTS) {
    errors.push({ path: "traits.disciplines", message: "Нужно распределить ровно 3 базовые точки" });
  }

  return errors;
}

export function validateStep5(character: any, dict: Dictionaries): ValidationError[] {
  const errors: ValidationError[] = [];
  let baseSum = 0;
  for (const background of dict.backgrounds) {
    const layer = getLayer(character.traits?.backgrounds, background.key);
    if (layer.base < 0) {
      errors.push({ path: `traits.backgrounds.${background.key}.base`, message: "База фона не может быть ниже 0" });
    }
    if (layer.base > 5) {
      errors.push({ path: `traits.backgrounds.${background.key}.base`, message: "База фона не может быть выше 5" });
    }
    baseSum += layer.base;
  }

  if (baseSum !== BASE_BACKGROUNDS_POINTS) {
    errors.push({ path: "traits.backgrounds", message: "Нужно распределить ровно 5 базовых точек" });
  }

  return errors;
}

export function validateStep6(character: any, dict: Dictionaries): ValidationError[] {
  const errors: ValidationError[] = [];
  let extras = 0;

  for (const virtue of dict.virtues) {
    const layer = getLayer(character.traits?.virtues, virtue.key);
    if (layer.base < 1) {
      errors.push({ path: `traits.virtues.${virtue.key}.base`, message: "Добродетели не могут быть ниже 1" });
    }
    if (layer.base > 5) {
      errors.push({ path: `traits.virtues.${virtue.key}.base`, message: "Добродетели не могут быть выше 5" });
    }
    extras += layer.base - 1;
  }

  if (extras !== BASE_VIRTUES_EXTRA) {
    errors.push({ path: "traits.virtues", message: "Нужно распределить ровно 7 дополнительных точек" });
  }

  return errors;
}

export function computeFlawFreebie(character: any, dict: Dictionaries) {
  let sum = 0;
  for (const key of character.traits?.flaws ?? []) {
    const flaw = dict.flaws.get(key);
    if (flaw) {
      sum += flaw.pointCost;
    }
  }
  return Math.min(sum, FLAW_FREEBIE_CAP);
}

export function recalcFlawFreebie(character: any, dict: Dictionaries) {
  const earned = computeFlawFreebie(character, dict);
  character.creation.flawFreebieEarned = earned;
  return earned;
}

export function validateStep7(character: any, dict: Dictionaries, options: ValidationOptions = {}): ValidationError[] {
  const errors: ValidationError[] = [];
  const merits = character.traits?.merits ?? [];
  const flaws = character.traits?.flaws ?? [];

  if (!ensureUnique(merits)) {
    errors.push({ path: "traits.merits", message: "Повторяющиеся достоинства недопустимы" });
  }
  if (!ensureUnique(flaws)) {
    errors.push({ path: "traits.flaws", message: "Повторяющиеся недостатки недопустимы" });
  }

  let meritCost = 0;
  for (const key of merits) {
    const merit = dict.merits.get(key);
    if (!merit) {
      errors.push({ path: "traits.merits", message: "Неизвестное достоинство" });
      continue;
    }
    meritCost += merit.pointCost;
  }

  for (const key of flaws) {
    const flaw = dict.flaws.get(key);
    if (!flaw) {
      errors.push({ path: "traits.flaws", message: "Неизвестный недостаток" });
    }
  }

  const earned = computeFlawFreebie(character, dict);
  if (options.mutate !== false) {
    character.creation.flawFreebieEarned = earned;
  } else if (character.creation?.flawFreebieEarned !== earned) {
    errors.push({
      path: "creation.flawFreebieEarned",
      message: "Некорректное значение свободных очков от недостатков"
    });
  }
  const remaining = FREEBIE_BASE + earned - meritCost;
  if (remaining < 0) {
    errors.push({
      path: "traits.merits",
      message: "Не хватает свободных очков, уберите достоинства или добавьте недостатки"
    });
  }

  return errors;
}

export function sumFreebieDots(container: any) {
  if (!container) return 0;
  const values = isMap(container) ? Array.from(container.values()) : Object.values(container);
  return values.reduce((sum: number, layer: any) => sum + Number(layer?.freebie ?? 0), 0);
}

export function computeFreebieSpent(character: any, dict: Dictionaries) {
  let spent = 0;
  spent += sumFreebieDots(character.traits?.attributes) * FREEBIE_COST.attribute;
  spent += sumFreebieDots(character.traits?.abilities) * FREEBIE_COST.ability;
  spent += sumFreebieDots(character.traits?.disciplines) * FREEBIE_COST.discipline;
  spent += sumFreebieDots(character.traits?.backgrounds) * FREEBIE_COST.background;
  spent += sumFreebieDots(character.traits?.virtues) * FREEBIE_COST.virtue;

  for (const key of character.traits?.merits ?? []) {
    const merit = dict.merits.get(key);
    if (merit) {
      spent += merit.pointCost;
    }
  }

  spent += Number(character.creation?.freebieBuys?.humanity ?? 0) * FREEBIE_COST.humanity;
  spent += Number(character.creation?.freebieBuys?.willpower ?? 0) * FREEBIE_COST.willpower;

  return spent;
}

export function computeFreebieBudget(character: any, dict: Dictionaries) {
  recalcFlawFreebie(character, dict);
  return FREEBIE_BASE + Number(character.creation?.flawFreebieEarned ?? 0);
}

export function validateStep8(character: any, dict: Dictionaries, options: ValidationOptions = {}): ValidationError[] {
  const errors: ValidationError[] = [];
  const budget = options.mutate === false
    ? FREEBIE_BASE + computeFlawFreebie(character, dict)
    : computeFreebieBudget(character, dict);
  const spent = computeFreebieSpent(character, dict);

  if (spent > budget) {
    errors.push({
      path: "creation.freebies",
      message: `Потрачено ${spent}, доступно ${budget}`
    });
  }

  errors.push(...validateRanges(character, dict));
  return errors;
}

export function getStepForPath(path: string, currentStep?: number) {
  if (path.startsWith("meta.")) return 1;
  if (path.includes(".freebie") || path.startsWith("creation.freebieBuys")) return 8;
  if (path.startsWith("traits.merits") || path.startsWith("traits.flaws")) {
    return currentStep && currentStep >= 8 ? 8 : 7;
  }
  if (path.startsWith("creation.attributesPriority") || (path.startsWith("traits.attributes") && path.endsWith(".base"))) {
    return 2;
  }
  if (path.startsWith("creation.abilitiesPriority") || (path.startsWith("traits.abilities") && path.endsWith(".base"))) {
    return 3;
  }
  if (path.startsWith("traits.disciplines") && path.endsWith(".base")) return 4;
  if (path.startsWith("traits.backgrounds") && path.endsWith(".base")) return 5;
  if (path.startsWith("traits.virtues") && path.endsWith(".base")) return 6;
  return null;
}

export function isPatchAllowed(path: string, creationFinished: boolean) {
  const wizardAllowed = [
    /^meta\.(name|playerName|clanKey|generation|chronicleId|sectKey|natureKey|demeanorKey|sire|concept)$/,
    /^traits\.(attributes|abilities|disciplines|backgrounds|virtues)\.[^.]+\.base$/,
    /^traits\.(attributes|abilities|disciplines|backgrounds|virtues)\.[^.]+\.freebie$/,
    /^traits\.merits$/,
    /^traits\.flaws$/,
    /^creation\.(attributesPriority|abilitiesPriority)\.(physical|social|mental|talents|skills|knowledges)$/,
    /^creation\.freebieBuys\.(humanity|willpower)$/
  ];

  const gameAllowed = [
    /^resources\.(bloodPool|willpower|humanity)\.current$/,
    /^resources\.health$/,
    /^notes$/,
    /^equipment$/,
    /^traits\.(attributes|abilities|disciplines|backgrounds|virtues)\.[^.]+\.storyteller$/,
    /^meta\.clanKey$/,
    /^meta\.chronicleId$/,
    /^meta\.generation$/,
    /^meta\.avatarUrl$/
  ];

  const list = creationFinished ? gameAllowed : wizardAllowed;
  return list.some((rx) => rx.test(path));
}

export function rollbackFreebies(character: any, dict: Dictionaries) {
  const budget = computeFreebieBudget(character, dict);
  let spent = computeFreebieSpent(character, dict);
  if (spent <= budget) return false;

  let changed = false;

  const reduceFreebie = (container: any, cost: number) => {
    const keys = isMap(container)
      ? Array.from(container.keys())
      : Object.keys(container || {});
    keys.sort();
    for (const key of keys) {
      const layer = getLayer(container, key);
      while (layer.freebie > 0 && spent > budget) {
        layer.freebie -= 1;
        spent -= cost;
        setLayer(container, key, layer);
        changed = true;
      }
      if (spent <= budget) return;
    }
  };

  const reduceSimple = (path: "humanity" | "willpower", cost: number) => {
    while (character.creation?.freebieBuys?.[path] > 0 && spent > budget) {
      character.creation.freebieBuys[path] -= 1;
      spent -= cost;
      changed = true;
    }
  };

  reduceSimple("humanity", FREEBIE_COST.humanity);
  reduceSimple("willpower", FREEBIE_COST.willpower);
  reduceFreebie(character.traits?.backgrounds, FREEBIE_COST.background);
  reduceFreebie(character.traits?.disciplines, FREEBIE_COST.discipline);
  reduceFreebie(character.traits?.abilities, FREEBIE_COST.ability);
  reduceFreebie(character.traits?.attributes, FREEBIE_COST.attribute);
  reduceFreebie(character.traits?.virtues, FREEBIE_COST.virtue);

  while (spent > budget && (character.traits?.merits ?? []).length > 0) {
    const removed = character.traits.merits.pop();
    if (!removed) break;
    const merit = dict.merits.get(removed);
    if (merit) {
      spent -= merit.pointCost;
    }
    changed = true;
  }

  return changed;
}

export function computeRemainingFreebies(character: any, dict: Dictionaries) {
  const budget = computeFreebieBudget(character, dict);
  const spent = computeFreebieSpent(character, dict);
  return budget - spent;
}

export async function validateWizardStep(character: any, step: number, dict: Dictionaries, options: ValidationOptions = {}) {
  if (step === 1) return await validateStep1(character, dict);
  if (step === 2) return validateStep2(character, dict);
  if (step === 3) return validateStep3(character, dict);
  if (step === 4) return validateStep4(character, dict);
  if (step === 5) return validateStep5(character, dict);
  if (step === 6) return validateStep6(character, dict);
  if (step === 7) return validateStep7(character, dict, options);
  if (step === 8) return validateStep8(character, dict, options);
  return [];
}

export async function validateAllWizardSteps(character: any, dict: Dictionaries, options: ValidationOptions = {}) {
  const errors: ValidationError[] = [];
  errors.push(...(await validateStep1(character, dict)));
  errors.push(...validateStep2(character, dict));
  errors.push(...validateStep3(character, dict));
  errors.push(...validateStep4(character, dict));
  errors.push(...validateStep5(character, dict));
  errors.push(...validateStep6(character, dict));
  errors.push(...validateStep7(character, dict, options));
  errors.push(...validateStep8(character, dict, options));
  return errors;
}

