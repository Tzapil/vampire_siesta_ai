import type { Dictionaries } from "../dictionaryProvider";
import { issue, type ValidationIssue } from "../contracts";
import { getLayer } from "../layered";
import { ResourceBounds, TraitValue } from "../valueObjects";

type ValidateRangesOptions = {
  allowNonClanDisciplines?: boolean;
};

const MAX_AVATAR_LENGTH = 3_000_000;

function pushRangeIssue(
  issues: ValidationIssue[],
  code: string,
  path: string,
  value: number,
  bounds: ResourceBounds,
  label = "Значение"
) {
  if (!bounds.contains(value)) {
    issues.push(issue(code, path, `${label} должно быть от ${bounds.min} до ${bounds.max}`));
  }
}

export function validateRanges(character: any, dict: Dictionaries, options: ValidateRangesOptions = {}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const clan = dict.clans.get(character.meta?.clanKey ?? "");
  const fixedAppearance = clan?.rules?.appearanceFixedTo === 0;
  const allowedDisciplines = new Set<string>(clan?.disciplineKeys ?? []);
  const allowNonClanDisciplines = options.allowNonClanDisciplines === true;

  for (const attr of dict.attributes) {
    const trait = new TraitValue(getLayer(character.traits?.attributes, attr.key));
    if (attr.key === "appearance" && fixedAppearance) {
      if (trait.total !== 0) {
        issues.push(issue("range.attributes.appearance.fixed", `traits.attributes.${attr.key}`, "У Носферату внешность должна быть 0"));
      }
      continue;
    }

    pushRangeIssue(
      issues,
      "range.attributes.out_of_bounds",
      `traits.attributes.${attr.key}`,
      trait.total,
      new ResourceBounds(1, 5),
      "Атрибут"
    );
  }

  for (const ability of dict.abilities) {
    const trait = new TraitValue(getLayer(character.traits?.abilities, ability.key));
    pushRangeIssue(
      issues,
      "range.abilities.out_of_bounds",
      `traits.abilities.${ability.key}`,
      trait.total,
      new ResourceBounds(0, 5),
      "Способность"
    );
  }

  for (const discipline of dict.disciplines) {
    const trait = new TraitValue(getLayer(character.traits?.disciplines, discipline.key));
    pushRangeIssue(
      issues,
      "range.disciplines.out_of_bounds",
      `traits.disciplines.${discipline.key}`,
      trait.total,
      new ResourceBounds(0, 5),
      "Дисциплина"
    );

    if (!allowNonClanDisciplines && trait.total !== 0 && !allowedDisciplines.has(discipline.key)) {
      issues.push(issue("range.disciplines.non_clan", `traits.disciplines.${discipline.key}`, "Неклановая дисциплина запрещена"));
    }
  }

  for (const background of dict.backgrounds) {
    const trait = new TraitValue(getLayer(character.traits?.backgrounds, background.key));
    pushRangeIssue(
      issues,
      "range.backgrounds.out_of_bounds",
      `traits.backgrounds.${background.key}`,
      trait.total,
      new ResourceBounds(0, 5),
      "Фон"
    );
  }

  for (const virtue of dict.virtues) {
    const trait = new TraitValue(getLayer(character.traits?.virtues, virtue.key));
    pushRangeIssue(
      issues,
      "range.virtues.out_of_bounds",
      `traits.virtues.${virtue.key}`,
      trait.total,
      new ResourceBounds(1, 5),
      "Добродетель"
    );
  }

  const resources = character.resources ?? {};
  const derived = character.derived ?? { bloodPoolMax: 0 };

  pushRangeIssue(
    issues,
    "range.resources.blood_pool",
    "resources.bloodPool.current",
    Number(resources.bloodPool?.current ?? 0),
    new ResourceBounds(0, Number(derived.bloodPoolMax ?? 0)),
    "Текущий запас крови"
  );
  pushRangeIssue(
    issues,
    "range.resources.willpower",
    "resources.willpower.current",
    Number(resources.willpower?.current ?? 0),
    new ResourceBounds(0, 10),
    "Текущая Сила воли"
  );
  pushRangeIssue(
    issues,
    "range.resources.humanity",
    "resources.humanity.current",
    Number(resources.humanity?.current ?? 0),
    new ResourceBounds(0, 10),
    "Текущая Человечность"
  );

  const health = resources.health ?? { bashing: 0, lethal: 0, aggravated: 0 };
  const bashing = Number(health.bashing ?? 0);
  const lethal = Number(health.lethal ?? 0);
  const aggravated = Number(health.aggravated ?? 0);

  pushRangeIssue(
    issues,
    "range.resources.health.bashing",
    "resources.health.bashing",
    bashing,
    new ResourceBounds(0, 7),
    "Урон (контузящий)"
  );
  pushRangeIssue(
    issues,
    "range.resources.health.lethal",
    "resources.health.lethal",
    lethal,
    new ResourceBounds(0, 7),
    "Урон (летальный)"
  );
  pushRangeIssue(
    issues,
    "range.resources.health.aggravated",
    "resources.health.aggravated",
    aggravated,
    new ResourceBounds(0, 7),
    "Урон (аггравированный)"
  );

  if (bashing + lethal + aggravated > 7) {
    issues.push(issue("range.resources.health.total", "resources.health", "Сумма урона не может превышать 7"));
  }

  if (typeof character.notes !== "string") {
    issues.push(issue("range.notes.invalid_type", "notes", "Поле заметок должно быть строкой"));
  }
  if (typeof character.equipment !== "string") {
    issues.push(issue("range.equipment.invalid_type", "equipment", "Поле снаряжения должно быть строкой"));
  }
  if (character.meta?.avatarUrl != null && typeof character.meta.avatarUrl !== "string") {
    issues.push(issue("range.avatar.invalid_type", "meta.avatarUrl", "Картинка должна быть строкой"));
  }
  if (typeof character.meta?.avatarUrl === "string" && character.meta.avatarUrl.length > MAX_AVATAR_LENGTH) {
    issues.push(issue("range.avatar.too_large", "meta.avatarUrl", "Картинка слишком большая"));
  }

  return issues;
}
