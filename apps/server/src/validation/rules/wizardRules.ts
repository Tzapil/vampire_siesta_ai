import type { ChronicleExistsFn, ValidationIssue } from "../contracts";
import { issue } from "../contracts";
import type { Dictionaries } from "../dictionaryProvider";
import { getLayer, setLayer, sumFreebieDots, sumLayered } from "../layered";
import { TraitValue } from "../valueObjects";
import { validateRanges } from "./baseRules";

export type ValidationOptions = {
  mutate?: boolean;
  chronicleExists?: ChronicleExistsFn;
};

export const WIZARD_STEPS = 8;

export const ATTR_BUDGET = { primary: 7, secondary: 5, tertiary: 3 } as const;
export const ABIL_BUDGET = { primary: 13, secondary: 9, tertiary: 5 } as const;

export const BASE_DISCIPLINES_POINTS = 3;
export const BASE_BACKGROUNDS_POINTS = 5;
export const BASE_VIRTUES_EXTRA = 7;

export const FREEBIE_BASE = 15;
export const FLAW_FREEBIE_CAP = 7;

export const FREEBIE_COST = {
  attribute: 5,
  ability: 2,
  discipline: 7,
  background: 1,
  virtue: 2,
  humanity: 2,
  willpower: 1
} as const;

function ensureUnique(values: string[]) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
  }
  return true;
}

function assertPriorityPermutation(value: any, keys: string[]) {
  if (!value) {
    return false;
  }
  const set = new Set(Object.values(value));
  return keys.every((key) => value[key]) && set.size === 3 && set.has("primary") && set.has("secondary") && set.has("tertiary");
}

export async function validateStep1(character: any, dict: Dictionaries, options: ValidationOptions = {}): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const meta = character.meta ?? {};

  if (!meta.name) {
    issues.push(issue("wizard.step1.meta.name.required", "meta.name", "Имя персонажа обязательно"));
  }
  if (!meta.playerName) {
    issues.push(issue("wizard.step1.meta.player_name.required", "meta.playerName", "Имя игрока обязательно"));
  }
  if (!meta.clanKey || !dict.clans.has(meta.clanKey)) {
    issues.push(issue("wizard.step1.meta.clan.required", "meta.clanKey", "Клан обязателен"));
  }
  if (meta.generation == null || meta.generation < 8 || meta.generation > 14) {
    issues.push(issue("wizard.step1.meta.generation.out_of_bounds", "meta.generation", "Поколение должно быть от 8 до 14"));
  }
  if (!meta.chronicleId) {
    issues.push(issue("wizard.step1.meta.chronicle.required", "meta.chronicleId", "Хроника обязательна"));
  }
  if (!meta.sectKey || !dict.sects.has(meta.sectKey)) {
    issues.push(issue("wizard.step1.meta.sect.required", "meta.sectKey", "Секта обязательна"));
  }
  if (!meta.natureKey || !dict.natures.has(meta.natureKey)) {
    issues.push(issue("wizard.step1.meta.nature.required", "meta.natureKey", "Натура обязательна"));
  }
  if (!meta.demeanorKey || !dict.demeanors.has(meta.demeanorKey)) {
    issues.push(issue("wizard.step1.meta.demeanor.required", "meta.demeanorKey", "Поведение обязательно"));
  }

  if (meta.chronicleId && options.chronicleExists) {
    const exists = await options.chronicleExists(meta.chronicleId);
    if (!exists) {
      issues.push(issue("wizard.step1.meta.chronicle.not_found", "meta.chronicleId", "Хроника не найдена"));
    }
  }

  return issues;
}

export function validateStep2(character: any, dict: Dictionaries): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const priorities = character.creation?.attributesPriority;
  if (!assertPriorityPermutation(priorities, ["physical", "social", "mental"])) {
    issues.push(issue("wizard.step2.attributes.priority.invalid", "creation.attributesPriority", "Нужно выбрать приоритеты атрибутов"));
    return issues;
  }

  const clan = dict.clans.get(character.meta?.clanKey ?? "");
  const fixedAppearance = clan?.rules?.appearanceFixedTo === 0;
  const sums = { physical: 0, social: 0, mental: 0 };

  for (const attr of dict.attributes) {
    const layer = getLayer(character.traits?.attributes, attr.key);
    const minBase = attr.key === "appearance" && fixedAppearance ? 0 : 1;

    if (layer.base < minBase) {
      issues.push(
        issue("wizard.step2.attributes.base.too_low", `traits.attributes.${attr.key}.base`, "База атрибутов не может быть ниже минимума")
      );
    }
    if (layer.base > 5) {
      issues.push(issue("wizard.step2.attributes.base.too_high", `traits.attributes.${attr.key}.base`, "База атрибута не может быть выше 5"));
    }

    sums[attr.group] += layer.base - minBase;
  }

  const mapBudget = (rank: keyof typeof ATTR_BUDGET) => ATTR_BUDGET[rank];
  if (sums.physical !== mapBudget(priorities.physical)) {
    issues.push(issue("wizard.step2.attributes.physical.budget", "traits.attributes", "Неверная сумма базовых атрибутов (Физические)"));
  }
  if (sums.social !== mapBudget(priorities.social)) {
    issues.push(issue("wizard.step2.attributes.social.budget", "traits.attributes", "Неверная сумма базовых атрибутов (Социальные)"));
  }
  if (sums.mental !== mapBudget(priorities.mental)) {
    issues.push(issue("wizard.step2.attributes.mental.budget", "traits.attributes", "Неверная сумма базовых атрибутов (Ментальные)"));
  }

  if (fixedAppearance) {
    const appearance = getLayer(character.traits?.attributes, "appearance");
    if (appearance.base !== 0) {
      issues.push(issue("wizard.step2.attributes.appearance.fixed", "traits.attributes.appearance.base", "У Носферату внешность должна быть 0"));
    }
  }

  return issues;
}

export function validateStep3(character: any, dict: Dictionaries): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const priorities = character.creation?.abilitiesPriority;
  if (!assertPriorityPermutation(priorities, ["talents", "skills", "knowledges"])) {
    issues.push(issue("wizard.step3.abilities.priority.invalid", "creation.abilitiesPriority", "Нужно выбрать приоритеты способностей"));
    return issues;
  }

  const sums = { talents: 0, skills: 0, knowledges: 0 };

  for (const ability of dict.abilities) {
    const layer = getLayer(character.traits?.abilities, ability.key);
    if (layer.base < 0) {
      issues.push(issue("wizard.step3.abilities.base.too_low", `traits.abilities.${ability.key}.base`, "База способности не может быть ниже 0"));
    }
    if (layer.base > 5) {
      issues.push(issue("wizard.step3.abilities.base.too_high", `traits.abilities.${ability.key}.base`, "База способности не может быть выше 5"));
    }
    sums[ability.group] += layer.base;
  }

  const mapBudget = (rank: keyof typeof ABIL_BUDGET) => ABIL_BUDGET[rank];
  if (sums.talents !== mapBudget(priorities.talents)) {
    issues.push(issue("wizard.step3.abilities.talents.budget", "traits.abilities", "Неверная сумма базовых способностей (Таланты)"));
  }
  if (sums.skills !== mapBudget(priorities.skills)) {
    issues.push(issue("wizard.step3.abilities.skills.budget", "traits.abilities", "Неверная сумма базовых способностей (Навыки)"));
  }
  if (sums.knowledges !== mapBudget(priorities.knowledges)) {
    issues.push(issue("wizard.step3.abilities.knowledges.budget", "traits.abilities", "Неверная сумма базовых способностей (Знания)"));
  }

  return issues;
}

export function validateStep4(character: any, dict: Dictionaries): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const clan = dict.clans.get(character.meta?.clanKey ?? "");
  const allowed = new Set<string>(clan?.disciplineKeys ?? []);

  let baseSum = 0;
  for (const discipline of dict.disciplines) {
    const layer = getLayer(character.traits?.disciplines, discipline.key);
    if (layer.base > 3) {
      issues.push(
        issue(
          "wizard.step4.disciplines.base.too_high",
          `traits.disciplines.${discipline.key}.base`,
          "Базовая дисциплина не может быть выше 3"
        )
      );
    }
    if (!allowed.has(discipline.key) && sumLayered(layer) !== 0) {
      issues.push(issue("wizard.step4.disciplines.non_clan", `traits.disciplines.${discipline.key}`, "Неклановая дисциплина запрещена"));
    }
    baseSum += layer.base;
  }

  if (baseSum !== BASE_DISCIPLINES_POINTS) {
    issues.push(issue("wizard.step4.disciplines.base_sum.invalid", "traits.disciplines", "Нужно распределить ровно 3 базовые точки"));
  }

  return issues;
}

export function validateStep5(character: any, dict: Dictionaries): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let baseSum = 0;

  for (const background of dict.backgrounds) {
    const layer = getLayer(character.traits?.backgrounds, background.key);
    if (layer.base < 0) {
      issues.push(issue("wizard.step5.backgrounds.base.too_low", `traits.backgrounds.${background.key}.base`, "База фона не может быть ниже 0"));
    }
    if (layer.base > 5) {
      issues.push(issue("wizard.step5.backgrounds.base.too_high", `traits.backgrounds.${background.key}.base`, "База фона не может быть выше 5"));
    }
    baseSum += layer.base;
  }

  if (baseSum !== BASE_BACKGROUNDS_POINTS) {
    issues.push(issue("wizard.step5.backgrounds.base_sum.invalid", "traits.backgrounds", "Нужно распределить ровно 5 базовых точек"));
  }

  return issues;
}

export function validateStep6(character: any, dict: Dictionaries): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let extras = 0;

  for (const virtue of dict.virtues) {
    const layer = getLayer(character.traits?.virtues, virtue.key);
    if (layer.base < 1) {
      issues.push(issue("wizard.step6.virtues.base.too_low", `traits.virtues.${virtue.key}.base`, "Добродетели не могут быть ниже 1"));
    }
    if (layer.base > 5) {
      issues.push(issue("wizard.step6.virtues.base.too_high", `traits.virtues.${virtue.key}.base`, "Добродетели не могут быть выше 5"));
    }
    extras += layer.base - 1;
  }

  if (extras !== BASE_VIRTUES_EXTRA) {
    issues.push(issue("wizard.step6.virtues.extra_sum.invalid", "traits.virtues", "Нужно распределить ровно 7 дополнительных точек"));
  }

  return issues;
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

export function validateStep7(character: any, dict: Dictionaries, options: ValidationOptions = {}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const merits = character.traits?.merits ?? [];
  const flaws = character.traits?.flaws ?? [];

  if (!ensureUnique(merits)) {
    issues.push(issue("wizard.step7.merits.duplicate", "traits.merits", "Повторяющиеся достоинства недопустимы"));
  }
  if (!ensureUnique(flaws)) {
    issues.push(issue("wizard.step7.flaws.duplicate", "traits.flaws", "Повторяющиеся недостатки недопустимы"));
  }

  let meritCost = 0;
  for (const key of merits) {
    const merit = dict.merits.get(key);
    if (!merit) {
      issues.push(issue("wizard.step7.merits.unknown", "traits.merits", "Неизвестное достоинство"));
      continue;
    }
    meritCost += merit.pointCost;
  }

  for (const key of flaws) {
    const flaw = dict.flaws.get(key);
    if (!flaw) {
      issues.push(issue("wizard.step7.flaws.unknown", "traits.flaws", "Неизвестный недостаток"));
    }
  }

  const earned = computeFlawFreebie(character, dict);
  if (options.mutate !== false) {
    character.creation.flawFreebieEarned = earned;
  } else if (character.creation?.flawFreebieEarned !== earned) {
    issues.push(
      issue(
        "wizard.step7.flaw_freebie.invalid",
        "creation.flawFreebieEarned",
        "Некорректное значение свободных очков от недостатков"
      )
    );
  }

  const remaining = FREEBIE_BASE + earned - meritCost;
  if (remaining < 0) {
    issues.push(
      issue(
        "wizard.step7.freebies.insufficient",
        "traits.merits",
        "Не хватает свободных очков, уберите достоинства или добавьте недостатки"
      )
    );
  }

  return issues;
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

export function validateStep8(character: any, dict: Dictionaries, options: ValidationOptions = {}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const budget = options.mutate === false ? FREEBIE_BASE + computeFlawFreebie(character, dict) : computeFreebieBudget(character, dict);
  const spent = computeFreebieSpent(character, dict);

  if (spent > budget) {
    issues.push(issue("wizard.step8.freebies.overspent", "creation.freebies", `Потрачено ${spent}, доступно ${budget}`));
  }

  issues.push(...validateRanges(character, dict));
  return issues;
}

export async function validateWizardStep(
  character: any,
  step: number,
  dict: Dictionaries,
  options: ValidationOptions = {}
): Promise<ValidationIssue[]> {
  if (step === 1) {
    return validateStep1(character, dict, options);
  }
  if (step === 2) {
    return validateStep2(character, dict);
  }
  if (step === 3) {
    return validateStep3(character, dict);
  }
  if (step === 4) {
    return validateStep4(character, dict);
  }
  if (step === 5) {
    return validateStep5(character, dict);
  }
  if (step === 6) {
    return validateStep6(character, dict);
  }
  if (step === 7) {
    return validateStep7(character, dict, options);
  }
  if (step === 8) {
    return validateStep8(character, dict, options);
  }
  return [];
}

export async function validateAllWizardSteps(character: any, dict: Dictionaries, options: ValidationOptions = {}) {
  const issues: ValidationIssue[] = [];
  issues.push(...(await validateStep1(character, dict, options)));
  issues.push(...validateStep2(character, dict));
  issues.push(...validateStep3(character, dict));
  issues.push(...validateStep4(character, dict));
  issues.push(...validateStep5(character, dict));
  issues.push(...validateStep6(character, dict));
  issues.push(...validateStep7(character, dict, options));
  issues.push(...validateStep8(character, dict, options));
  return issues;
}

export function rollbackFreebies(character: any, dict: Dictionaries) {
  const budget = computeFreebieBudget(character, dict);
  let spent = computeFreebieSpent(character, dict);
  if (spent <= budget) {
    return false;
  }

  let changed = false;

  const reduceFreebie = (container: any, cost: number) => {
    const keys = container instanceof Map ? Array.from(container.keys()) : Object.keys(container || {});
    keys.sort();
    for (const key of keys) {
      const layer = getLayer(container, key);
      while (layer.freebie > 0 && spent > budget) {
        layer.freebie -= 1;
        spent -= cost;
        setLayer(container, key, layer);
        changed = true;
      }
      if (spent <= budget) {
        return;
      }
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
    if (!removed) {
      break;
    }
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

export function getStepForPath(path: string, currentStep?: number) {
  if (path.startsWith("meta.")) {
    return 1;
  }
  if (path.includes(".freebie") || path.startsWith("creation.freebieBuys")) {
    return 8;
  }
  if (path.startsWith("traits.merits") || path.startsWith("traits.flaws")) {
    return currentStep && currentStep >= 8 ? 8 : 7;
  }
  if (path.startsWith("creation.attributesPriority") || (path.startsWith("traits.attributes") && path.endsWith(".base"))) {
    return 2;
  }
  if (path.startsWith("creation.abilitiesPriority") || (path.startsWith("traits.abilities") && path.endsWith(".base"))) {
    return 3;
  }
  if (path.startsWith("traits.disciplines") && path.endsWith(".base")) {
    return 4;
  }
  if (path.startsWith("traits.backgrounds") && path.endsWith(".base")) {
    return 5;
  }
  if (path.startsWith("traits.virtues") && path.endsWith(".base")) {
    return 6;
  }
  return null;
}

export function isPatchAllowed(path: string, creationFinished: boolean) {
  const wizardAllowed = [
    /^meta\.(name|clanKey|generation|chronicleId|sectKey|natureKey|demeanorKey|sire|concept)$/,
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

export function validateTraitValueForPatch(
  group: "attributes" | "abilities" | "disciplines" | "backgrounds" | "virtues",
  key: string,
  layerName: "base" | "freebie" | "storyteller",
  patchValue: unknown,
  character: any,
  dict: Dictionaries
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const numericValue = Number(patchValue);
  if (typeof patchValue !== "number" || Number.isNaN(numericValue)) {
    issues.push(issue("patch.trait.value.invalid_type", `traits.${group}.${key}.${layerName}`, "Значение должно быть числом"));
    return issues;
  }

  if (layerName === "freebie" && numericValue < 0) {
    issues.push(issue("patch.trait.freebie.negative", `traits.${group}.${key}.${layerName}`, "Свободные очки не могут быть отрицательными"));
  }

  if (layerName !== "base") {
    return issues;
  }

  if (group === "attributes") {
    const clan = dict.clans.get(character.meta?.clanKey ?? "");
    const fixedAppearance = clan?.rules?.appearanceFixedTo === 0;
    const minBase = key === "appearance" && fixedAppearance ? 0 : 1;
    if (numericValue < minBase || numericValue > 5) {
      issues.push(issue("patch.attributes.base.invalid", `traits.${group}.${key}.${layerName}`, "Недопустимая база атрибута"));
    }
  } else if (group === "virtues") {
    if (numericValue < 1 || numericValue > 5) {
      issues.push(issue("patch.virtues.base.invalid", `traits.${group}.${key}.${layerName}`, "Недопустимая база добродетели"));
    }
  } else if (group === "disciplines") {
    if (numericValue < 0 || numericValue > 3) {
      issues.push(issue("patch.disciplines.base.invalid", `traits.${group}.${key}.${layerName}`, "База дисциплины должна быть от 0 до 3"));
    }
  } else if (numericValue < 0 || numericValue > 5) {
    issues.push(issue("patch.traits.base.invalid", `traits.${group}.${key}.${layerName}`, "Недопустимая база"));
  }

  return issues;
}

export function validatePriorityPatch(path: string, value: unknown): ValidationIssue[] {
  if (!path.startsWith("creation.attributesPriority") && !path.startsWith("creation.abilitiesPriority")) {
    return [];
  }
  const allowed = new Set(["primary", "secondary", "tertiary"]);
  if (typeof value !== "string" || !allowed.has(value)) {
    return [issue("patch.priority.invalid", path, "Недопустимое значение приоритета")];
  }
  return [];
}

export function validateFreebieBuyPatch(path: string, value: unknown): ValidationIssue[] {
  if (!path.startsWith("creation.freebieBuys.")) {
    return [];
  }
  if (typeof value !== "number" || value < 0 || !Number.isInteger(value)) {
    return [issue("patch.freebie_buy.invalid", path, "Значение должно быть неотрицательным целым")];
  }
  return [];
}
