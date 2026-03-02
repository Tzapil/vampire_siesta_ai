import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api/client";
import type {
  AbilityDto,
  AttributeDto,
  CharacterDto,
  ChronicleDto,
  DictItem,
  MeritDto,
  FlawDto
} from "../api/types";
import { useDictionaries } from "../context/DictionariesContext";
import { useToast } from "../context/ToastContext";

const STEP_TITLES = [
  "Основное",
  "Атрибуты",
  "Способности",
  "Дисциплины",
  "Фоны",
  "Добродетели",
  "Достоинства / Недостатки",
  "Свободные очки"
];

const FREEBIE_COST = {
  attribute: 5,
  ability: 2,
  discipline: 7,
  background: 1,
  virtue: 2,
  humanity: 2,
  willpower: 1
};
const FREEBIE_BASE = 15;
const FLAW_FREEBIE_CAP = 7;
const DISCIPLINE_BUDGET = 3;
const BACKGROUND_BUDGET = 5;
const VIRTUE_EXTRA_BUDGET = 7;
const ATTR_BUDGET = { primary: 7, secondary: 5, tertiary: 3 } as const;
const ABIL_BUDGET = { primary: 13, secondary: 9, tertiary: 5 } as const;
const DEFAULT_ATTR_PRIORITIES = {
  physical: "primary",
  social: "secondary",
  mental: "tertiary"
} as const;
const DEFAULT_ABILITY_PRIORITIES = {
  talents: "primary",
  skills: "secondary",
  knowledges: "tertiary"
} as const;

type FieldErrors = Record<string, string>;

type WizardProps = {
  character: CharacterDto;
  onPatch: (path: string, value: unknown) => void;
  onStepChange: (step: number, version?: number) => void;
  refresh: () => Promise<void>;
};

function DotsInput({
  value,
  max = 5,
  min = 0,
  allowZero = false,
  baseValue,
  disabled = false,
  onChange
}: {
  value: number;
  max?: number;
  min?: number;
  allowZero?: boolean;
  baseValue?: number;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  const dots = Array.from({ length: max });
  const resolvedBase = typeof baseValue === "number" ? Math.max(0, baseValue) : null;
  return (
    <div className="dots">
      {dots.map((_, index) => {
        const dotValue = index + 1;
        const filled = dotValue <= value;
        const isFreebie = resolvedBase !== null && filled && dotValue > resolvedBase;
        return (
          <div
            key={index}
            className={`dot ${filled ? "filled" : ""} ${isFreebie ? "freebie" : ""} ${
              disabled ? "disabled" : ""
            }`}
            onClick={() => {
              if (disabled) return;
              if (allowZero && dotValue === value) {
                const next = Math.max(min, 0);
                onChange(next);
                return;
              }
              const next = Math.max(min, dotValue);
              onChange(next);
            }}
            role="button"
          />
        );
      })}
    </div>
  );
}

function StepHeader({ title }: { title: string }) {
  return <h3 className="section-title">{title}</h3>;
}

export function Wizard({ character, onPatch, onStepChange, refresh }: WizardProps) {
  const { dictionaries } = useDictionaries();
  const { pushToast } = useToast();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [chronicles, setChronicles] = useState<ChronicleDto[]>([]);

  const lastStep = STEP_TITLES.length;
  const currentStep = Math.min(character.wizard?.currentStep ?? 1, lastStep);

  useEffect(() => {
    let active = true;
    async function loadChronicles() {
      try {
        const data = await api.get<ChronicleDto[]>("/chronicles");
        if (active) setChronicles(data);
      } catch {
        // ignore
      }
    }
    loadChronicles();
    return () => {
      active = false;
    };
  }, []);

  const errorsFor = (path: string) => fieldErrors[path];
  const errorForPaths = (paths: string[]) => {
    for (const path of paths) {
      const message = errorsFor(path);
      if (message) return message;
    }
    return undefined;
  };
  const collectErrors = (prefixes: string[]) => {
    const messages: string[] = [];
    for (const [path, message] of Object.entries(fieldErrors)) {
      if (prefixes.some((prefix) => path.startsWith(prefix))) {
        messages.push(message);
      }
    }
    return Array.from(new Set(messages));
  };

  const handleNext = async () => {
    try {
      const result = await api.post<{ currentStep: number; version?: number }>(
        `/characters/${character.uuid}/wizard/next`
      );
      setFieldErrors({});
      onStepChange(result.currentStep, result.version);
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        const map: FieldErrors = {};
        err.errors.forEach((item) => {
          map[item.path] = item.message;
        });
        setFieldErrors(map);
        pushToast("Есть ошибки в шаге", "error");
      } else {
        pushToast("Не удалось перейти на следующий шаг", "error");
      }
    }
  };

  const handleBack = async () => {
    try {
      const result = await api.post<{ currentStep: number; version?: number }>(
        `/characters/${character.uuid}/wizard/back`
      );
      setFieldErrors({});
      onStepChange(result.currentStep, result.version);
    } catch {
      pushToast("Не удалось вернуться назад", "error");
    }
  };

  const handleGoto = async (step: number) => {
    try {
      const result = await api.post<{ currentStep: number; version?: number }>(
        `/characters/${character.uuid}/wizard/goto`,
        { targetStep: step }
      );
      setFieldErrors({});
      onStepChange(result.currentStep, result.version);
    } catch {
      pushToast("Не удалось перейти к шагу", "error");
    }
  };

  const handleFinish = async () => {
    try {
      const result = await api.post<{ warning?: boolean; message?: string }>(
        `/characters/${character.uuid}/wizard/finish`
      );
      if (result.warning) {
        const confirmed = window.confirm(result.message || "Остались непотраченные очки. Сжечь?");
        if (!confirmed) return;
        await api.post(`/characters/${character.uuid}/wizard/finish`, { confirmBurn: true });
      }
      pushToast("Персонаж завершён", "success");
      await refresh();
    } catch (err: any) {
      if (err instanceof ApiError && err.errors) {
        const map: FieldErrors = {};
        err.errors.forEach((item) => {
          map[item.path] = item.message;
        });
        setFieldErrors(map);
        pushToast("Есть ошибки в шаге", "error");
      } else {
        pushToast("Не удалось завершить персонажа", "error");
      }
    }
  };

  const totalFor = (layer?: { base: number; freebie: number; storyteller: number }) =>
    layer ? layer.base + layer.freebie + layer.storyteller : 0;

  const meritCostFor = (key: string) =>
    dictionaries.merits.find((item) => item.key === key)?.pointCost ?? 0;
  const flawCostFor = (key: string) =>
    dictionaries.flaws.find((item) => item.key === key)?.pointCost ?? 0;
  const sumMeritCost = (keys: string[]) => keys.reduce((sum, key) => sum + meritCostFor(key), 0);
  const sumFlawCost = (keys: string[]) => keys.reduce((sum, key) => sum + flawCostFor(key), 0);

  const priorities = character.creation?.attributesPriority;
  const abilityPriorities = character.creation?.abilitiesPriority;
  const attrPriorities = {
    physical: priorities?.physical ?? DEFAULT_ATTR_PRIORITIES.physical,
    social: priorities?.social ?? DEFAULT_ATTR_PRIORITIES.social,
    mental: priorities?.mental ?? DEFAULT_ATTR_PRIORITIES.mental
  };
  const abilPriorities = {
    talents: abilityPriorities?.talents ?? DEFAULT_ABILITY_PRIORITIES.talents,
    skills: abilityPriorities?.skills ?? DEFAULT_ABILITY_PRIORITIES.skills,
    knowledges: abilityPriorities?.knowledges ?? DEFAULT_ABILITY_PRIORITIES.knowledges
  };
  const groupLabels: Record<AttributeDto["group"], string> = {
    physical: "Физические",
    social: "Социальные",
    mental: "Ментальные"
  };
  const priorityLabels: Record<"primary" | "secondary" | "tertiary", string> = {
    primary: "Основной",
    secondary: "Вторичный",
    tertiary: "Третичный"
  };
  const hasAttrPriorities = Boolean(
    attrPriorities.physical && attrPriorities.social && attrPriorities.mental
  );
  const hasAbilityPriorities = Boolean(
    abilPriorities.talents && abilPriorities.skills && abilPriorities.knowledges
  );

  useEffect(() => {
    if (!priorities?.physical) {
      onPatch("creation.attributesPriority.physical", DEFAULT_ATTR_PRIORITIES.physical);
    }
    if (!priorities?.social) {
      onPatch("creation.attributesPriority.social", DEFAULT_ATTR_PRIORITIES.social);
    }
    if (!priorities?.mental) {
      onPatch("creation.attributesPriority.mental", DEFAULT_ATTR_PRIORITIES.mental);
    }
  }, [onPatch, priorities?.mental, priorities?.physical, priorities?.social]);

  useEffect(() => {
    if (!abilityPriorities?.talents) {
      onPatch("creation.abilitiesPriority.talents", DEFAULT_ABILITY_PRIORITIES.talents);
    }
    if (!abilityPriorities?.skills) {
      onPatch("creation.abilitiesPriority.skills", DEFAULT_ABILITY_PRIORITIES.skills);
    }
    if (!abilityPriorities?.knowledges) {
      onPatch("creation.abilitiesPriority.knowledges", DEFAULT_ABILITY_PRIORITIES.knowledges);
    }
  }, [
    abilityPriorities?.knowledges,
    abilityPriorities?.skills,
    abilityPriorities?.talents,
    onPatch
  ]);

  const clan = dictionaries.clans.find((item) => item.key === character.meta.clanKey);
  const appearanceFixed = clan?.rules?.appearanceFixedTo === 0;

  const minBaseForAttribute = (key: string) => (key === "appearance" && appearanceFixed ? 0 : 1);
  const sumBase = (record: Record<string, { base: number }>) =>
    Object.values(record).reduce((sum, item) => sum + (item?.base ?? 0), 0);

  const attributeExtras = useMemo(() => {
    const extras = { physical: 0, social: 0, mental: 0 };
    dictionaries.attributes.forEach((item) => {
      const base = character.traits.attributes[item.key]?.base ?? 0;
      const minBase = minBaseForAttribute(item.key);
      extras[item.group] += Math.max(0, base - minBase);
    });
    return extras;
  }, [character.traits.attributes, dictionaries.attributes, appearanceFixed]);

  const abilitiesBase = useMemo(() => {
    const sums = { talents: 0, skills: 0, knowledges: 0 };
    dictionaries.abilities.forEach((item) => {
      const base = character.traits.abilities[item.key]?.base ?? 0;
      sums[item.group] += base;
    });
    return sums;
  }, [character.traits.abilities, dictionaries.abilities]);

  const canSetAttributeBase = (attr: AttributeDto, next: number) => {
    const currentBase = character.traits.attributes[attr.key]?.base ?? 0;
    if (next <= currentBase) return true;
    const rank = attrPriorities[attr.group];
    if (!rank) return true;

    const extras = { ...attributeExtras };
    const minBase = minBaseForAttribute(attr.key);
    const currentExtra = Math.max(0, currentBase - minBase);
    const nextExtra = Math.max(0, next - minBase);
    extras[attr.group] = extras[attr.group] - currentExtra + nextExtra;

    const budget = ATTR_BUDGET[rank];
    return extras[attr.group] <= budget;
  };

  const canSetAbilityBase = (ability: AbilityDto, next: number) => {
    const currentBase = character.traits.abilities[ability.key]?.base ?? 0;
    if (next <= currentBase) return true;
    const rank = abilPriorities[ability.group];
    if (!rank) return true;

    const sums = { ...abilitiesBase };
    sums[ability.group] = sums[ability.group] - currentBase + next;
    const budget = ABIL_BUDGET[rank];
    return sums[ability.group] <= budget;
  };

  const canSetDisciplineBase = (key: string, next: number) => {
    const currentBase = character.traits.disciplines[key]?.base ?? 0;
    if (next <= currentBase) return true;
    const currentSum = sumBase(character.traits.disciplines);
    return currentSum - currentBase + next <= DISCIPLINE_BUDGET;
  };

  const canSetBackgroundBase = (key: string, next: number) => {
    const currentBase = character.traits.backgrounds[key]?.base ?? 0;
    if (next <= currentBase) return true;
    const currentSum = sumBase(character.traits.backgrounds);
    return currentSum - currentBase + next <= BACKGROUND_BUDGET;
  };

  const canSetVirtueBase = (key: string, next: number) => {
    const currentBase = character.traits.virtues[key]?.base ?? 1;
    if (next <= currentBase) return true;
    const currentExtras = Object.values(character.traits.virtues).reduce(
      (sum, item) => sum + Math.max(0, (item?.base ?? 1) - 1),
      0
    );
    const currentExtra = Math.max(0, currentBase - 1);
    const nextExtra = Math.max(0, next - 1);
    return currentExtras - currentExtra + nextExtra <= VIRTUE_EXTRA_BUDGET;
  };

  const freebieState = useMemo(() => {
    const flawSum = sumFlawCost(character.traits.flaws);
    const flawEarned = Math.min(flawSum, FLAW_FREEBIE_CAP);

    const meritCost = sumMeritCost(character.traits.merits);

    const sumFreebieDots = (record: Record<string, { freebie: number }>) =>
      Object.values(record).reduce((sum, item) => sum + (item?.freebie ?? 0), 0);

    const attributeDots = sumFreebieDots(character.traits.attributes);
    const abilityDots = sumFreebieDots(character.traits.abilities);
    const disciplineDots = sumFreebieDots(character.traits.disciplines);
    const backgroundDots = sumFreebieDots(character.traits.backgrounds);
    const virtueDots = sumFreebieDots(character.traits.virtues);

    const spent =
      attributeDots * FREEBIE_COST.attribute +
      abilityDots * FREEBIE_COST.ability +
      disciplineDots * FREEBIE_COST.discipline +
      backgroundDots * FREEBIE_COST.background +
      virtueDots * FREEBIE_COST.virtue +
      meritCost +
      (character.creation?.freebieBuys?.humanity ?? 0) * FREEBIE_COST.humanity +
      (character.creation?.freebieBuys?.willpower ?? 0) * FREEBIE_COST.willpower;

    const budget = FREEBIE_BASE + flawEarned;
    return {
      budget,
      spent,
      remaining: budget - spent,
      meritCost,
      flawEarned,
      breakdown: {
        attributes: attributeDots,
        abilities: abilityDots,
        disciplines: disciplineDots,
        backgrounds: backgroundDots,
        virtues: virtueDots
      }
    };
  }, [character, dictionaries]);

  const renderStep1 = () => (
    <div className="card">
      <StepHeader title="Основное" />
      <div className="grid-2">
        <div className="field">
          <label>Имя персонажа</label>
          <input
            value={character.meta.name}
            onChange={(event) => onPatch("meta.name", event.target.value)}
          />
          {errorsFor("meta.name") && <small>{errorsFor("meta.name")}</small>}
        </div>
        <div className="field">
          <label>Имя игрока</label>
          <input
            value={character.meta.playerName}
            onChange={(event) => onPatch("meta.playerName", event.target.value)}
          />
          {errorsFor("meta.playerName") && <small>{errorsFor("meta.playerName")}</small>}
        </div>
        <div className="field">
          <label>Клан</label>
          <select
            value={character.meta.clanKey}
            onChange={(event) => onPatch("meta.clanKey", event.target.value)}
          >
            <option value="">Выберите клан</option>
            {dictionaries.clans.map((item) => (
              <option key={item.key} value={item.key}>
                {item.labelRu}
              </option>
            ))}
          </select>
          {errorsFor("meta.clanKey") && <small>{errorsFor("meta.clanKey")}</small>}
        </div>
        <div className="field">
          <label>Поколение</label>
          <select
            value={character.meta.generation}
            onChange={(event) => onPatch("meta.generation", Number(event.target.value))}
          >
            {Array.from({ length: 7 }).map((_, index) => {
              const gen = 8 + index;
              return (
                <option key={gen} value={gen}>
                  {gen}
                </option>
              );
            })}
          </select>
          {errorsFor("meta.generation") && <small>{errorsFor("meta.generation")}</small>}
        </div>
        <div className="field">
          <label>Хроника</label>
          <select
            value={character.meta.chronicleId}
            onChange={(event) => onPatch("meta.chronicleId", event.target.value)}
          >
            <option value="">Выберите хронику</option>
            {chronicles.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
          {errorsFor("meta.chronicleId") && <small>{errorsFor("meta.chronicleId")}</small>}
        </div>
        <div className="field">
          <label>Секта</label>
          <select
            value={character.meta.sectKey}
            onChange={(event) => onPatch("meta.sectKey", event.target.value)}
          >
            <option value="">Выберите секту</option>
            {dictionaries.sects.map((item) => (
              <option key={item.key} value={item.key}>
                {item.labelRu}
              </option>
            ))}
          </select>
          {errorsFor("meta.sectKey") && <small>{errorsFor("meta.sectKey")}</small>}
        </div>
        <div className="field">
          <label>Натура</label>
          <select
            value={character.meta.natureKey}
            onChange={(event) => onPatch("meta.natureKey", event.target.value)}
          >
            <option value="">Выберите натуру</option>
            {dictionaries.natures.map((item) => (
              <option key={item.key} value={item.key}>
                {item.labelRu}
              </option>
            ))}
          </select>
          {errorsFor("meta.natureKey") && <small>{errorsFor("meta.natureKey")}</small>}
        </div>
        <div className="field">
          <label>Поведение</label>
          <select
            value={character.meta.demeanorKey}
            onChange={(event) => onPatch("meta.demeanorKey", event.target.value)}
          >
            <option value="">Выберите поведение</option>
            {dictionaries.demeanors.map((item) => (
              <option key={item.key} value={item.key}>
                {item.labelRu}
              </option>
            ))}
          </select>
          {errorsFor("meta.demeanorKey") && <small>{errorsFor("meta.demeanorKey")}</small>}
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label>Сир (необязательно)</label>
          <input value={character.meta.sire} onChange={(event) => onPatch("meta.sire", event.target.value)} />
        </div>
        <div className="field">
          <label>Концепт (необязательно)</label>
          <input value={character.meta.concept} onChange={(event) => onPatch("meta.concept", event.target.value)} />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => {
    const stepErrors = collectErrors(["creation.attributesPriority", "traits.attributes"]);
    const priorityError = errorForPaths(["creation.attributesPriority"]);
    const totalBudget = hasAttrPriorities
      ? ATTR_BUDGET[attrPriorities.physical] +
        ATTR_BUDGET[attrPriorities.social] +
        ATTR_BUDGET[attrPriorities.mental]
      : 0;
    const spentBudget = attributeExtras.physical + attributeExtras.social + attributeExtras.mental;
    const remaining = hasAttrPriorities ? Math.max(0, totalBudget - spentBudget) : null;

    const grouped = {
      physical: dictionaries.attributes.filter((item) => item.group === "physical"),
      social: dictionaries.attributes.filter((item) => item.group === "social"),
      mental: dictionaries.attributes.filter((item) => item.group === "mental")
    };

    const renderAttributeItem = (attr: AttributeDto) => {
      const layer = character.traits.attributes[attr.key];
      const value = layer?.base ?? 0;
      const isAppearance = attr.key === "appearance" && appearanceFixed;
      const rank = attrPriorities[attr.group];
      const budgetLabel = rank ? ATTR_BUDGET[rank] : null;
      const error = errorForPaths([
        `traits.attributes.${attr.key}.base`,
        `traits.attributes.${attr.key}`
      ]);
      return (
        <div key={attr.key} className="wizard-attr-item">
          <div className={`wizard-attr-row ${isAppearance ? "disabled" : ""}`}>
            <span>{attr.labelRu}</span>
            <DotsInput
              value={isAppearance ? 0 : value}
              min={minBaseForAttribute(attr.key)}
              allowZero={false}
              disabled={isAppearance}
              onChange={(next) => {
                if (!canSetAttributeBase(attr, next)) {
                  if (budgetLabel != null) {
                    pushToast(
                      `Лимит группы "${groupLabels[attr.group]}" — ${budgetLabel} доп. точек`,
                      "error"
                    );
                  }
                  return;
                }
                onPatch(`traits.attributes.${attr.key}.base`, next);
              }}
            />
          </div>
          {error && <small>{error}</small>}
        </div>
      );
    };

    const renderGroup = (group: AttributeDto["group"]) => {
      const rank = attrPriorities[group];
      const label = rank ? `${priorityLabels[rank]} (${ATTR_BUDGET[rank]})` : "Приоритет не выбран";
      return (
        <div key={group} className="wizard-attr-card">
          <div className="wizard-attr-card-header">
            <span>{groupLabels[group]}</span>
            <span className="wizard-attr-priority">{label}</span>
          </div>
          <div className="wizard-attr-list">
            {grouped[group].map(renderAttributeItem)}
          </div>
        </div>
      );
    };

    const reduceGroupToBudget = (
      group: AttributeDto["group"],
      budget: number
    ): Record<string, number> => {
      const items = grouped[group].map((attr) => {
        const base = character.traits.attributes[attr.key]?.base ?? 0;
        const minBase = minBaseForAttribute(attr.key);
        return { key: attr.key, base, minBase };
      });
      let extras = items.reduce((sum, item) => sum + Math.max(0, item.base - item.minBase), 0);
      const updates: Record<string, number> = {};

      while (extras > budget) {
        const candidates = items.filter((item) => item.base > item.minBase);
        if (candidates.length === 0) break;
        const maxBase = Math.max(...candidates.map((item) => item.base));
        const top = candidates.filter((item) => item.base === maxBase);
        const picked = top[Math.floor(Math.random() * top.length)];
        picked.base -= 1;
        extras -= 1;
        updates[picked.key] = picked.base;
      }

      return updates;
    };

    const applyPriorityLimits = (
      nextPriorities: Record<AttributeDto["group"], "primary" | "secondary" | "tertiary">
    ) => {
      const updates: Record<string, number> = {};
      (["physical", "social", "mental"] as const).forEach((group) => {
        const budget = ATTR_BUDGET[nextPriorities[group]];
        Object.assign(updates, reduceGroupToBudget(group, budget));
      });
      Object.entries(updates).forEach(([key, base]) => {
        const currentBase = character.traits.attributes[key]?.base ?? 0;
        if (base !== currentBase) {
          onPatch(`traits.attributes.${key}.base`, base);
        }
      });
    };

    const handlePriorityChange = (group: AttributeDto["group"], next: string) => {
      if (!next) return;
      const nextRank = next as "primary" | "secondary" | "tertiary";
      const current = attrPriorities[group];
      if (next === current) return;
      const swapGroup = (Object.keys(attrPriorities) as Array<AttributeDto["group"]>).find(
        (key) => attrPriorities[key] === next
      );
      const nextPriorities = {
        ...attrPriorities,
        [group]: nextRank
      } as Record<AttributeDto["group"], "primary" | "secondary" | "tertiary">;

      if (swapGroup) {
        onPatch(`creation.attributesPriority.${swapGroup}`, current);
        nextPriorities[swapGroup] = current;
      }
      onPatch(`creation.attributesPriority.${group}`, nextRank);
      applyPriorityLimits(nextPriorities);
    };

    return (
      <div className="card">
        <StepHeader title="Атрибуты" />
        <div className="step-counter">
          {hasAttrPriorities
            ? `Очки по группам: ${spentBudget} из ${totalBudget}, осталось ${remaining}`
            : "Выберите приоритеты, чтобы увидеть бюджет"}
        </div>
        {stepErrors.length > 0 && (
          <div className="error-list">
            {stepErrors.map((message, index) => (
              <div key={`${message}-${index}`}>{message}</div>
            ))}
          </div>
        )}

        <div className="wizard-priority-grid">
          <div className="wizard-priority-card">
            <label>Приоритет Физические</label>
            <select
              value={attrPriorities.physical}
              onChange={(event) => handlePriorityChange("physical", event.target.value)}
            >
              <option value="primary">Основной (7)</option>
              <option value="secondary">Вторичный (5)</option>
              <option value="tertiary">Третичный (3)</option>
            </select>
          </div>
          <div className="wizard-priority-card">
            <label>Приоритет Социальные</label>
            <select
              value={attrPriorities.social}
              onChange={(event) => handlePriorityChange("social", event.target.value)}
            >
              <option value="primary">Основной (7)</option>
              <option value="secondary">Вторичный (5)</option>
              <option value="tertiary">Третичный (3)</option>
            </select>
          </div>
          <div className="wizard-priority-card">
            <label>Приоритет Ментальные</label>
            <select
              value={attrPriorities.mental}
              onChange={(event) => handlePriorityChange("mental", event.target.value)}
            >
              <option value="primary">Основной (7)</option>
              <option value="secondary">Вторичный (5)</option>
              <option value="tertiary">Третичный (3)</option>
            </select>
          </div>
        </div>
        {priorityError && <small>{priorityError}</small>}

        <div className="wizard-attr-grid">
          {renderGroup("physical")}
          {renderGroup("social")}
          {renderGroup("mental")}
        </div>
      </div>
    );
  };

  const renderStep3 = () => {
    const stepErrors = collectErrors(["creation.abilitiesPriority", "traits.abilities"]);
    const priorityError = errorForPaths(["creation.abilitiesPriority"]);
    const totalBudget = hasAbilityPriorities
      ? ABIL_BUDGET[abilPriorities.talents] +
        ABIL_BUDGET[abilPriorities.skills] +
        ABIL_BUDGET[abilPriorities.knowledges]
      : 0;
    const spentBudget = abilitiesBase.talents + abilitiesBase.skills + abilitiesBase.knowledges;
    const remaining = hasAbilityPriorities ? Math.max(0, totalBudget - spentBudget) : null;

    const abilityGroupLabels: Record<AbilityDto["group"], string> = {
      talents: "Таланты",
      skills: "Навыки",
      knowledges: "Знания"
    };
    const grouped = {
      talents: dictionaries.abilities.filter((item) => item.group === "talents"),
      skills: dictionaries.abilities.filter((item) => item.group === "skills"),
      knowledges: dictionaries.abilities.filter((item) => item.group === "knowledges")
    };

    const renderAbilityItem = (ability: AbilityDto) => {
      const layer = character.traits.abilities[ability.key];
      const error = errorForPaths([
        `traits.abilities.${ability.key}.base`,
        `traits.abilities.${ability.key}`
      ]);
      return (
        <div key={ability.key} className="wizard-attr-item">
          <div className="wizard-attr-row">
            <span>{ability.labelRu}</span>
            <DotsInput
              value={layer?.base ?? 0}
              min={0}
              allowZero
              onChange={(next) => {
                if (!canSetAbilityBase(ability, next)) {
                  const rank = abilPriorities[ability.group];
                  if (rank) {
                    pushToast(
                      `Лимит группы "${abilityGroupLabels[ability.group]}" — ${ABIL_BUDGET[rank]} точек`,
                      "error"
                    );
                  }
                  return;
                }
                onPatch(`traits.abilities.${ability.key}.base`, next);
              }}
            />
          </div>
          {error && <small>{error}</small>}
        </div>
      );
    };

    const renderAbilityGroup = (group: AbilityDto["group"]) => {
      const rank = abilPriorities[group];
      const label = rank ? `${priorityLabels[rank]} (${ABIL_BUDGET[rank]})` : "Приоритет не выбран";
      return (
        <div key={group} className="wizard-attr-card">
          <div className="wizard-attr-card-header">
            <span>{abilityGroupLabels[group]}</span>
            <span className="wizard-attr-priority">{label}</span>
          </div>
          <div className="wizard-attr-list">
            {grouped[group].map(renderAbilityItem)}
          </div>
        </div>
      );
    };

    const reduceGroupToBudget = (
      group: AbilityDto["group"],
      budget: number
    ): Record<string, number> => {
      const items = grouped[group].map((ability) => {
        const base = character.traits.abilities[ability.key]?.base ?? 0;
        return { key: ability.key, base };
      });
      let sum = items.reduce((total, item) => total + item.base, 0);
      const updates: Record<string, number> = {};

      while (sum > budget) {
        const candidates = items.filter((item) => item.base > 0);
        if (candidates.length === 0) break;
        const maxBase = Math.max(...candidates.map((item) => item.base));
        const top = candidates.filter((item) => item.base === maxBase);
        const picked = top[Math.floor(Math.random() * top.length)];
        picked.base -= 1;
        sum -= 1;
        updates[picked.key] = picked.base;
      }

      return updates;
    };

    const applyPriorityLimits = (
      nextPriorities: Record<AbilityDto["group"], "primary" | "secondary" | "tertiary">
    ) => {
      const updates: Record<string, number> = {};
      (["talents", "skills", "knowledges"] as const).forEach((group) => {
        const budget = ABIL_BUDGET[nextPriorities[group]];
        Object.assign(updates, reduceGroupToBudget(group, budget));
      });
      Object.entries(updates).forEach(([key, base]) => {
        const currentBase = character.traits.abilities[key]?.base ?? 0;
        if (base !== currentBase) {
          onPatch(`traits.abilities.${key}.base`, base);
        }
      });
    };

    const handleAbilityPriorityChange = (group: AbilityDto["group"], next: string) => {
      if (!next) return;
      const nextRank = next as "primary" | "secondary" | "tertiary";
      const current = abilPriorities[group];
      if (next === current) return;
      const swapGroup = (Object.keys(abilPriorities) as Array<AbilityDto["group"]>).find(
        (key) => abilPriorities[key] === next
      );
      const nextPriorities = {
        ...abilPriorities,
        [group]: nextRank
      } as Record<AbilityDto["group"], "primary" | "secondary" | "tertiary">;

      if (swapGroup) {
        onPatch(`creation.abilitiesPriority.${swapGroup}`, current);
        nextPriorities[swapGroup] = current;
      }
      onPatch(`creation.abilitiesPriority.${group}`, nextRank);
      applyPriorityLimits(nextPriorities);
    };

    return (
      <div className="card">
        <StepHeader title="Способности" />
        <div className="step-counter">
          {hasAbilityPriorities
            ? `Очки по группам: ${spentBudget} из ${totalBudget}, осталось ${remaining}`
            : "Выберите приоритеты, чтобы увидеть бюджет"}
        </div>
        {stepErrors.length > 0 && (
          <div className="error-list">
            {stepErrors.map((message, index) => (
              <div key={`${message}-${index}`}>{message}</div>
            ))}
          </div>
        )}

        <div className="wizard-priority-grid">
          <div className="wizard-priority-card">
            <label>Приоритет Таланты</label>
            <select
              value={abilPriorities.talents}
              onChange={(event) => handleAbilityPriorityChange("talents", event.target.value)}
            >
              <option value="primary">Основной (13)</option>
              <option value="secondary">Вторичный (9)</option>
              <option value="tertiary">Третичный (5)</option>
            </select>
          </div>
          <div className="wizard-priority-card">
            <label>Приоритет Навыки</label>
            <select
              value={abilPriorities.skills}
              onChange={(event) => handleAbilityPriorityChange("skills", event.target.value)}
            >
              <option value="primary">Основной (13)</option>
              <option value="secondary">Вторичный (9)</option>
              <option value="tertiary">Третичный (5)</option>
            </select>
          </div>
          <div className="wizard-priority-card">
            <label>Приоритет Знания</label>
            <select
              value={abilPriorities.knowledges}
              onChange={(event) => handleAbilityPriorityChange("knowledges", event.target.value)}
            >
              <option value="primary">Основной (13)</option>
              <option value="secondary">Вторичный (9)</option>
              <option value="tertiary">Третичный (5)</option>
            </select>
          </div>
        </div>
        {priorityError && <small>{priorityError}</small>}

        <div className="wizard-attr-grid">
          {renderAbilityGroup("talents")}
          {renderAbilityGroup("skills")}
          {renderAbilityGroup("knowledges")}
        </div>
      </div>
    );
  };

  const renderStep4 = () => {
    const stepErrors = collectErrors(["traits.disciplines"]);
    const baseSum = sumBase(character.traits.disciplines);
    const remaining = Math.max(0, DISCIPLINE_BUDGET - baseSum);
    const allowedDisciplines = dictionaries.disciplines.filter((disc) =>
      clan?.disciplineKeys?.includes(disc.key)
    );
    return (
      <div className="card">
        <StepHeader title="Дисциплины" />
        <div className="step-counter">
          Базовые точки: {baseSum} из {DISCIPLINE_BUDGET}, осталось {remaining}
        </div>
        {stepErrors.length > 0 && (
          <div className="error-list">
            {stepErrors.map((message, index) => (
              <div key={`${message}-${index}`}>{message}</div>
            ))}
          </div>
        )}
        <div className="wizard-attr-grid">
          <div className="wizard-attr-card">
            <div className="wizard-attr-card-header">
              <span>Список дисциплин</span>
              <span className="wizard-attr-priority">Клановые</span>
            </div>
            <div className="wizard-attr-list">
              {allowedDisciplines.length === 0 && (
                <div className="wizard-attr-item">
                  <div className="wizard-attr-row disabled">
                    <span>Нет доступных дисциплин для выбранного клана</span>
                  </div>
                </div>
              )}
              {allowedDisciplines.map((disc) => {
                const layer = character.traits.disciplines[disc.key];
                const error = errorForPaths([
                  `traits.disciplines.${disc.key}.base`,
                  `traits.disciplines.${disc.key}`
                ]);
                return (
                  <div key={disc.key} className="wizard-attr-item">
                    <div className="wizard-attr-row">
                      <span>{disc.labelRu}</span>
                      <DotsInput
                        value={layer?.base ?? 0}
                        min={0}
                        max={3}
                        allowZero
                        onChange={(next) => {
                          if (!canSetDisciplineBase(disc.key, next)) {
                            pushToast(
                              `Лимит дисциплин — ${DISCIPLINE_BUDGET} базовые точки`,
                              "error"
                            );
                            return;
                          }
                          onPatch(`traits.disciplines.${disc.key}.base`, next);
                        }}
                      />
                    </div>
                    {error && <small>{error}</small>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStep5 = () => {
    const stepErrors = collectErrors(["traits.backgrounds"]);
    const baseSum = sumBase(character.traits.backgrounds);
    const remaining = Math.max(0, BACKGROUND_BUDGET - baseSum);
    return (
      <div className="card">
        <StepHeader title="Фоны" />
        <div className="step-counter">
          Базовые точки: {baseSum} из {BACKGROUND_BUDGET}, осталось {remaining}
        </div>
        {stepErrors.length > 0 && (
          <div className="error-list">
            {stepErrors.map((message, index) => (
              <div key={`${message}-${index}`}>{message}</div>
            ))}
          </div>
        )}
        <div className="wizard-attr-grid">
          <div className="wizard-attr-card">
            <div className="wizard-attr-card-header">
              <span>Фоны</span>
              <span className="wizard-attr-priority">Базовые</span>
            </div>
            <div className="wizard-attr-list">
              {dictionaries.backgrounds.map((bg) => {
                const layer = character.traits.backgrounds[bg.key];
                const error = errorForPaths([
                  `traits.backgrounds.${bg.key}.base`,
                  `traits.backgrounds.${bg.key}`
                ]);
                return (
                  <div key={bg.key} className="wizard-attr-item">
                    <div className="wizard-attr-row">
                      <span>{bg.labelRu}</span>
                      <DotsInput
                        value={layer?.base ?? 0}
                        min={0}
                        allowZero
                        onChange={(next) => {
                          if (!canSetBackgroundBase(bg.key, next)) {
                            pushToast(
                              `Лимит фонов — ${BACKGROUND_BUDGET} базовых точек`,
                              "error"
                            );
                            return;
                          }
                          onPatch(`traits.backgrounds.${bg.key}.base`, next);
                        }}
                      />
                    </div>
                    {error && <small>{error}</small>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStep6 = () => {
    const stepErrors = collectErrors(["traits.virtues"]);
    const extrasSpent = Object.values(character.traits.virtues).reduce(
      (sum, item) => sum + Math.max(0, (item?.base ?? 1) - 1),
      0
    );
    const remaining = Math.max(0, VIRTUE_EXTRA_BUDGET - extrasSpent);
    const humanityValue =
      totalFor(character.traits.virtues["conscience"]) +
      totalFor(character.traits.virtues["selfControl"]);
    const willpowerValue = totalFor(character.traits.virtues["courage"]);
    return (
      <div className="card">
        <StepHeader title="Добродетели" />
        <div className="step-counter">
          Доп. точки: {extrasSpent} из {VIRTUE_EXTRA_BUDGET}, осталось {remaining}
        </div>
        {stepErrors.length > 0 && (
          <div className="error-list">
            {stepErrors.map((message, index) => (
              <div key={`${message}-${index}`}>{message}</div>
            ))}
          </div>
        )}
        <div className="wizard-attr-grid">
          <div className="wizard-attr-card">
            <div className="wizard-attr-card-header">
              <span>Добродетели</span>
              <span className="wizard-attr-priority">Минимум 1</span>
            </div>
            <div className="wizard-attr-list">
              {dictionaries.virtues.map((virtue) => {
                const layer = character.traits.virtues[virtue.key];
                const error = errorForPaths([
                  `traits.virtues.${virtue.key}.base`,
                  `traits.virtues.${virtue.key}`
                ]);
                return (
                  <div key={virtue.key} className="wizard-attr-item">
                    <div className="wizard-attr-row">
                      <span>{virtue.labelRu}</span>
                      <DotsInput
                        value={layer?.base ?? 1}
                        min={1}
                        onChange={(next) => {
                          if (!canSetVirtueBase(virtue.key, next)) {
                            pushToast(
                              `Лимит добродетелей — ${VIRTUE_EXTRA_BUDGET} доп. точек`,
                              "error"
                            );
                            return;
                          }
                          onPatch(`traits.virtues.${virtue.key}.base`, next);
                        }}
                      />
                    </div>
                    {error && <small>{error}</small>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="wizard-attr-grid">
          <div className="wizard-attr-card">
            <div className="wizard-attr-card-header">
              <span>Человечность</span>
              <span className="wizard-attr-priority">Стартовое значение</span>
            </div>
            <div className="wizard-attr-list">
              <div className="wizard-attr-row disabled">
                <span>{humanityValue}</span>
                <DotsInput value={humanityValue} max={10} allowZero disabled onChange={() => {}} />
              </div>
            </div>
          </div>
          <div className="wizard-attr-card">
            <div className="wizard-attr-card-header">
              <span>Сила воли</span>
              <span className="wizard-attr-priority">Стартовое значение</span>
            </div>
            <div className="wizard-attr-list">
              <div className="wizard-attr-row disabled">
                <span>{willpowerValue}</span>
                <DotsInput value={willpowerValue} max={10} allowZero disabled onChange={() => {}} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const toggleKey = (list: string[], key: string) => {
    if (list.includes(key)) {
      return list.filter((item) => item !== key);
    }
    return [...list, key];
  };

  const renderMeritFlawList = (
    items: (MeritDto | FlawDto)[],
    selected: string[],
    path: "traits.merits" | "traits.flaws"
  ) => (
    <div className="wizard-attr-list">
      {items.map((item) => {
        const description =
          item.description?.trim() || "Описание отсутствует";
        const isSelected = selected.includes(item.key);
        return (
          <label key={item.key} className="wizard-attr-row wizard-check-row">
            <span className="wizard-attr-label">
              <span>
                {item.labelRu} ({item.pointCost})
              </span>
              <span className="help-icon" title={description} aria-label={description}>
                ?
              </span>
            </span>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {
                if (isSelected) {
                  onPatch(path, toggleKey(selected, item.key));
                  return;
                }
                const next = toggleKey(selected, item.key);
                if (path === "traits.flaws") {
                  const nextCost = sumFlawCost(next);
                  if (nextCost > FLAW_FREEBIE_CAP) {
                    pushToast(
                      `Лимит недостатков — ${FLAW_FREEBIE_CAP} очков`,
                      "error"
                    );
                    return;
                  }
                  onPatch(path, next);
                  return;
                }
                const budget =
                  FREEBIE_BASE +
                  Math.min(sumFlawCost(character.traits.flaws), FLAW_FREEBIE_CAP);
                const nextCost = sumMeritCost(next);
                if (nextCost > budget) {
                  pushToast(
                    `Недостаточно свободных очков: бюджет ${budget}`,
                    "error"
                  );
                  return;
                }
                onPatch(path, next);
              }}
            />
          </label>
        );
      })}
    </div>
  );

  const renderStep7 = () => {
    const stepErrors = collectErrors(["traits.merits", "traits.flaws", "creation.flawFreebieEarned"]);
    const meritsError = errorForPaths(["traits.merits", "creation.flawFreebieEarned"]);
    const flawsError = errorForPaths(["traits.flaws"]);
    return (
      <div className="card">
        <StepHeader title="Достоинства и недостатки" />
        {stepErrors.length > 0 && (
          <div className="error-list">
            {stepErrors.map((message, index) => (
              <div key={`${message}-${index}`}>{message}</div>
            ))}
          </div>
        )}
        <div className="step-counter">
          Доступный бюджет свободных очков: {FREEBIE_BASE + freebieState.flawEarned - freebieState.meritCost}
        </div>
        <div className="wizard-attr-grid">
          <div className="wizard-attr-card">
            <div className="wizard-attr-card-header">
              <span>Достоинства</span>
            </div>
            {renderMeritFlawList(dictionaries.merits, character.traits.merits, "traits.merits")}
            {meritsError && <small>{meritsError}</small>}
          </div>
          <div className="wizard-attr-card">
            <div className="wizard-attr-card-header">
              <span>Недостатки</span>
            </div>
            {renderMeritFlawList(dictionaries.flaws, character.traits.flaws, "traits.flaws")}
            {flawsError && <small>{flawsError}</small>}
          </div>
        </div>
      </div>
    );
  };

  const renderStep8 = () => {
    const stepErrors = collectErrors([
      "creation.freebies",
      "creation.freebieBuys",
      "traits.attributes",
      "traits.abilities",
      "traits.disciplines",
      "traits.backgrounds",
      "traits.virtues",
      "traits.merits",
      "traits.flaws"
    ]);
    const budgetError = errorForPaths(["creation.freebies"]);
    const humanityBase =
      totalFor(character.traits.virtues["conscience"]) +
      totalFor(character.traits.virtues["selfControl"]);
    const willpowerBase = totalFor(character.traits.virtues["courage"]);
    const humanityFreebie = character.creation?.freebieBuys?.humanity ?? 0;
    const willpowerFreebie = character.creation?.freebieBuys?.willpower ?? 0;
    return (
      <div className="card wizard-freebie">
        <StepHeader title="Свободные очки" />
        {stepErrors.length > 0 && (
          <div className="error-list">
            {stepErrors.map((message, index) => (
              <div key={`${message}-${index}`}>{message}</div>
            ))}
          </div>
        )}
        <div className="step-counter">
          Потрачено свободных очков: {freebieState.spent} из {freebieState.budget}
        </div>
        <div className="step-counter">Осталось свободных очков: {freebieState.remaining}</div>
        {budgetError && <small>{budgetError}</small>}

        <div className="wizard-freebie-columns">
          <div className="wizard-freebie-col">
            <div className="wizard-attr-card">
              <div className="wizard-attr-card-header">
                <span>Атрибуты (цена: {FREEBIE_COST.attribute})</span>
              </div>
              <div className="wizard-attr-list">
                {dictionaries.attributes.map((attr) => {
                  const isAppearance = attr.key === "appearance" && appearanceFixed;
                  const baseValue = character.traits.attributes[attr.key]?.base ?? 0;
                  const safeBase = isAppearance ? 0 : baseValue;
                  const freebieValue = character.traits.attributes[attr.key]?.freebie ?? 0;
                  const totalValue = safeBase + freebieValue;
                  const error = errorForPaths([
                    `traits.attributes.${attr.key}.freebie`,
                    `traits.attributes.${attr.key}`
                  ]);
                  return (
                    <div key={attr.key} className="wizard-attr-item">
                      <div className={`wizard-attr-row ${isAppearance ? "disabled" : ""}`}>
                        <span>{attr.labelRu}</span>
                      <DotsInput
                        value={isAppearance ? 0 : totalValue}
                        min={safeBase}
                        max={5}
                        baseValue={safeBase}
                        allowZero
                        disabled={isAppearance}
                        onChange={(next) =>
                          onPatch(
                              `traits.attributes.${attr.key}.freebie`,
                              Math.max(0, next - safeBase)
                            )
                          }
                        />
                      </div>
                      {error && <small>{error}</small>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="wizard-attr-card">
              <div className="wizard-attr-card-header">
                <span>Дисциплины (цена: {FREEBIE_COST.discipline})</span>
              </div>
              <div className="wizard-attr-list">
                {dictionaries.disciplines
                  .filter((disc) => clan?.disciplineKeys?.includes(disc.key))
                  .map((disc) => {
                    const baseValue = character.traits.disciplines[disc.key]?.base ?? 0;
                    const freebieValue = character.traits.disciplines[disc.key]?.freebie ?? 0;
                    const totalValue = baseValue + freebieValue;
                    const error = errorForPaths([
                      `traits.disciplines.${disc.key}.freebie`,
                      `traits.disciplines.${disc.key}`
                    ]);
                    return (
                      <div key={disc.key} className="wizard-attr-item">
                        <div className="wizard-attr-row">
                          <span>{disc.labelRu}</span>
                      <DotsInput
                        value={totalValue}
                        min={baseValue}
                        max={5}
                        baseValue={baseValue}
                        allowZero
                        onChange={(next) =>
                          onPatch(
                                `traits.disciplines.${disc.key}.freebie`,
                                Math.max(0, next - baseValue)
                              )
                            }
                          />
                        </div>
                        {error && <small>{error}</small>}
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="wizard-attr-card">
              <div className="wizard-attr-card-header">
                <span>Добродетели (цена: {FREEBIE_COST.virtue})</span>
              </div>
              <div className="wizard-attr-list">
                {dictionaries.virtues.map((virtue) => {
                  const baseValue = character.traits.virtues[virtue.key]?.base ?? 1;
                  const freebieValue = character.traits.virtues[virtue.key]?.freebie ?? 0;
                  const totalValue = baseValue + freebieValue;
                  const error = errorForPaths([
                    `traits.virtues.${virtue.key}.freebie`,
                    `traits.virtues.${virtue.key}`
                  ]);
                  return (
                    <div key={virtue.key} className="wizard-attr-item">
                      <div className="wizard-attr-row">
                        <span>{virtue.labelRu}</span>
                          <DotsInput
                            value={totalValue}
                            min={baseValue}
                            max={5}
                            baseValue={baseValue}
                            allowZero
                            onChange={(next) =>
                              onPatch(
                              `traits.virtues.${virtue.key}.freebie`,
                              Math.max(0, next - baseValue)
                            )
                          }
                        />
                      </div>
                      {error && <small>{error}</small>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="wizard-attr-card">
              <div className="wizard-attr-card-header">
                <span>Достоинства</span>
              </div>
              {renderMeritFlawList(dictionaries.merits, character.traits.merits, "traits.merits")}
              {errorForPaths(["traits.merits"]) && <small>{errorForPaths(["traits.merits"])}</small>}
            </div>

            <div className="wizard-attr-card">
              <div className="wizard-attr-card-header">
                <span>Недостатки</span>
              </div>
              {renderMeritFlawList(dictionaries.flaws, character.traits.flaws, "traits.flaws")}
              {errorForPaths(["traits.flaws"]) && <small>{errorForPaths(["traits.flaws"])}</small>}
            </div>
          </div>

          <div className="wizard-freebie-col">
            <div className="wizard-attr-card">
              <div className="wizard-attr-card-header">
                <span>Способности (цена: {FREEBIE_COST.ability})</span>
              </div>
              <div className="wizard-attr-list">
                {dictionaries.abilities.map((ability) => {
                  const baseValue = character.traits.abilities[ability.key]?.base ?? 0;
                  const freebieValue = character.traits.abilities[ability.key]?.freebie ?? 0;
                  const totalValue = baseValue + freebieValue;
                  const error = errorForPaths([
                    `traits.abilities.${ability.key}.freebie`,
                    `traits.abilities.${ability.key}`
                  ]);
                  return (
                    <div key={ability.key} className="wizard-attr-item">
                      <div className="wizard-attr-row">
                        <span>{ability.labelRu}</span>
                        <DotsInput
                          value={totalValue}
                          min={baseValue}
                          max={5}
                          baseValue={baseValue}
                          allowZero
                          onChange={(next) =>
                            onPatch(
                              `traits.abilities.${ability.key}.freebie`,
                              Math.max(0, next - baseValue)
                            )
                          }
                        />
                      </div>
                      {error && <small>{error}</small>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="wizard-attr-card">
              <div className="wizard-attr-card-header">
                <span>Фоны (цена: {FREEBIE_COST.background})</span>
              </div>
              <div className="wizard-attr-list">
                {dictionaries.backgrounds.map((bg) => {
                  const baseValue = character.traits.backgrounds[bg.key]?.base ?? 0;
                  const freebieValue = character.traits.backgrounds[bg.key]?.freebie ?? 0;
                  const totalValue = baseValue + freebieValue;
                  const error = errorForPaths([
                    `traits.backgrounds.${bg.key}.freebie`,
                    `traits.backgrounds.${bg.key}`
                  ]);
                  return (
                    <div key={bg.key} className="wizard-attr-item">
                      <div className="wizard-attr-row">
                        <span>{bg.labelRu}</span>
                        <DotsInput
                          value={totalValue}
                          min={baseValue}
                          max={5}
                          baseValue={baseValue}
                          allowZero
                          onChange={(next) =>
                            onPatch(
                              `traits.backgrounds.${bg.key}.freebie`,
                              Math.max(0, next - baseValue)
                            )
                          }
                        />
                      </div>
                      {error && <small>{error}</small>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="wizard-attr-card">
              <div className="wizard-attr-card-header">
                <span>Добродетели (свободные очки)</span>
              </div>
              <div className="wizard-attr-list">
                {dictionaries.virtues.map((virtue) => {
                  const baseValue = character.traits.virtues[virtue.key]?.base ?? 1;
                  const freebieValue = character.traits.virtues[virtue.key]?.freebie ?? 0;
                  const totalValue = baseValue + freebieValue;
                  const error = errorForPaths([
                    `traits.virtues.${virtue.key}.freebie`,
                    `traits.virtues.${virtue.key}`
                  ]);
                  return (
                    <div key={virtue.key} className="wizard-attr-item">
                      <div className="wizard-attr-row">
                        <span>{virtue.labelRu}</span>
                        <DotsInput
                          value={totalValue}
                          min={baseValue}
                          max={5}
                          allowZero
                          onChange={(next) =>
                            onPatch(
                              `traits.virtues.${virtue.key}.freebie`,
                              Math.max(0, next - baseValue)
                            )
                          }
                        />
                      </div>
                      {error && <small>{error}</small>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="wizard-attr-card">
              <div className="wizard-attr-card-header">
                <span>Доп. покупки</span>
              </div>
              <div className="wizard-attr-list">
                <div className="wizard-attr-item">
                <div className="wizard-attr-row">
                    <span>
                      Человечность (Совесть + Самообладание, цена: {FREEBIE_COST.humanity})
                    </span>
                  <DotsInput
                    value={humanityBase + humanityFreebie}
                    min={humanityBase}
                    max={10}
                      baseValue={humanityBase}
                      allowZero
                      onChange={(next) =>
                        onPatch(
                          "creation.freebieBuys.humanity",
                          Math.max(0, next - humanityBase)
                        )
                      }
                    />
                  </div>
                  {errorForPaths(["creation.freebieBuys.humanity"]) && (
                    <small>{errorForPaths(["creation.freebieBuys.humanity"])}</small>
                  )}
                </div>
                <div className="wizard-attr-item">
                <div className="wizard-attr-row">
                    <span>
                      Сила воли (Мужество, цена: {FREEBIE_COST.willpower})
                    </span>
                  <DotsInput
                    value={willpowerBase + willpowerFreebie}
                    min={willpowerBase}
                      max={10}
                      baseValue={willpowerBase}
                      allowZero
                      onChange={(next) =>
                        onPatch(
                          "creation.freebieBuys.willpower",
                          Math.max(0, next - willpowerBase)
                        )
                      }
                    />
                  </div>
                  {errorForPaths(["creation.freebieBuys.willpower"]) && (
                    <small>{errorForPaths(["creation.freebieBuys.willpower"])}</small>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      case 6:
        return renderStep6();
      case 7:
        return renderStep7();
      case 8:
        return renderStep8();
      default:
        return null;
    }
  };

  return (
    <section className="page">
      <div className="card">
        <div className="stepper">
          {STEP_TITLES.map((title, index) => {
            const step = index + 1;
            return (
              <button
                key={title}
                type="button"
                className={step === currentStep ? "active" : ""}
                disabled={step > currentStep}
                onClick={() => handleGoto(step)}
              >
                {step}. {title}
              </button>
            );
          })}
        </div>
      </div>

      {renderStep()}

      <div className="page-actions">
        <button type="button" onClick={handleBack} disabled={currentStep <= 1}>
          Назад
        </button>
        {currentStep < lastStep && (
          <button className="primary" type="button" onClick={handleNext}>
            Далее
          </button>
        )}
        {currentStep === lastStep && (
          <button className="primary" type="button" onClick={handleFinish}>
            Завершить
          </button>
        )}
      </div>
    </section>
  );
}
