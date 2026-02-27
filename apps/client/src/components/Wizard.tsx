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
  "Свободные очки",
  "Финальный обзор"
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
const ATTR_BUDGET = { primary: 7, secondary: 5, tertiary: 3 } as const;
const ABIL_BUDGET = { primary: 13, secondary: 9, tertiary: 5 } as const;

type FieldErrors = Record<string, string>;

type WizardProps = {
  character: CharacterDto;
  onPatch: (path: string, value: unknown) => void;
  onStepChange: (step: number) => void;
  refresh: () => Promise<void>;
};

function DotsInput({
  value,
  max = 5,
  min = 0,
  allowZero = false,
  disabled = false,
  onChange
}: {
  value: number;
  max?: number;
  min?: number;
  allowZero?: boolean;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  const dots = Array.from({ length: max });
  return (
    <div className="dots">
      {dots.map((_, index) => {
        const dotValue = index + 1;
        const filled = dotValue <= value;
        return (
          <div
            key={index}
            className={`dot ${filled ? "filled" : ""} ${disabled ? "disabled" : ""}`}
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

  const currentStep = character.wizard?.currentStep ?? 1;

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

  const handleNext = async () => {
    try {
      const result = await api.post<{ currentStep: number }>(
        `/characters/${character.uuid}/wizard/next`
      );
      setFieldErrors({});
      onStepChange(result.currentStep);
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
      const result = await api.post<{ currentStep: number }>(
        `/characters/${character.uuid}/wizard/back`
      );
      setFieldErrors({});
      onStepChange(result.currentStep);
    } catch {
      pushToast("Не удалось вернуться назад", "error");
    }
  };

  const handleGoto = async (step: number) => {
    try {
      const result = await api.post<{ currentStep: number }>(
        `/characters/${character.uuid}/wizard/goto`,
        { targetStep: step }
      );
      setFieldErrors({});
      onStepChange(result.currentStep);
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

  const priorities = character.creation?.attributesPriority;
  const abilityPriorities = character.creation?.abilitiesPriority;

  const clan = dictionaries.clans.find((item) => item.key === character.meta.clanKey);
  const appearanceFixed = clan?.rules?.appearanceFixedTo === 0;

  const minBaseForAttribute = (key: string) => (key === "appearance" && appearanceFixed ? 0 : 1);

  const canSetAttributeBase = (attr: AttributeDto, next: number) => {
    const currentBase = character.traits.attributes[attr.key]?.base ?? 0;
    if (next <= currentBase) return true;
    if (!priorities?.physical || !priorities?.social || !priorities?.mental) return true;

    const extras = { physical: 0, social: 0, mental: 0 };
    dictionaries.attributes.forEach((item) => {
      const base = character.traits.attributes[item.key]?.base ?? 0;
      const minBase = minBaseForAttribute(item.key);
      extras[item.group] += Math.max(0, base - minBase);
    });

    const minBase = minBaseForAttribute(attr.key);
    const currentExtra = Math.max(0, currentBase - minBase);
    const nextExtra = Math.max(0, next - minBase);
    extras[attr.group] = extras[attr.group] - currentExtra + nextExtra;

    const budget = ATTR_BUDGET[priorities[attr.group]];
    return extras[attr.group] <= budget;
  };

  const canSetAbilityBase = (ability: AbilityDto, next: number) => {
    const currentBase = character.traits.abilities[ability.key]?.base ?? 0;
    if (next <= currentBase) return true;
    if (!abilityPriorities?.talents || !abilityPriorities?.skills || !abilityPriorities?.knowledges) return true;

    const sums = { talents: 0, skills: 0, knowledges: 0 };
    dictionaries.abilities.forEach((item) => {
      const base = character.traits.abilities[item.key]?.base ?? 0;
      sums[item.group] += base;
    });

    sums[ability.group] = sums[ability.group] - currentBase + next;
    const budget = ABIL_BUDGET[abilityPriorities[ability.group]];
    return sums[ability.group] <= budget;
  };

  const freebieState = useMemo(() => {
    const flawSum = character.traits.flaws
      .map((key) => dictionaries.flaws.find((item) => item.key === key)?.pointCost || 0)
      .reduce((a, b) => a + b, 0);
    const flawEarned = Math.min(flawSum, 7);

    const meritCost = character.traits.merits
      .map((key) => dictionaries.merits.find((item) => item.key === key)?.pointCost || 0)
      .reduce((a, b) => a + b, 0);

    const sumFreebieDots = (record: Record<string, { freebie: number }>) =>
      Object.values(record).reduce((sum, item) => sum + (item?.freebie ?? 0), 0);

    const spent =
      sumFreebieDots(character.traits.attributes) * FREEBIE_COST.attribute +
      sumFreebieDots(character.traits.abilities) * FREEBIE_COST.ability +
      sumFreebieDots(character.traits.disciplines) * FREEBIE_COST.discipline +
      sumFreebieDots(character.traits.backgrounds) * FREEBIE_COST.background +
      sumFreebieDots(character.traits.virtues) * FREEBIE_COST.virtue +
      meritCost +
      (character.creation?.freebieBuys?.humanity ?? 0) * FREEBIE_COST.humanity +
      (character.creation?.freebieBuys?.willpower ?? 0) * FREEBIE_COST.willpower;

    const budget = FREEBIE_BASE + flawEarned;
    return {
      budget,
      spent,
      remaining: budget - spent,
      meritCost,
      flawEarned
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

  const renderStep2 = () => (
    <div className="card">
      <StepHeader title="Атрибуты" />
      <div className="grid-2">
        <div className="field">
          <label>Приоритет Физические</label>
          <select
            value={priorities?.physical || ""}
            onChange={(event) => onPatch("creation.attributesPriority.physical", event.target.value)}
          >
            <option value="">Выберите</option>
            <option value="primary">Основной (7)</option>
            <option value="secondary">Вторичный (5)</option>
            <option value="tertiary">Третичный (3)</option>
          </select>
        </div>
        <div className="field">
          <label>Приоритет Социальные</label>
          <select
            value={priorities?.social || ""}
            onChange={(event) => onPatch("creation.attributesPriority.social", event.target.value)}
          >
            <option value="">Выберите</option>
            <option value="primary">Основной (7)</option>
            <option value="secondary">Вторичный (5)</option>
            <option value="tertiary">Третичный (3)</option>
          </select>
        </div>
        <div className="field">
          <label>Приоритет Ментальные</label>
          <select
            value={priorities?.mental || ""}
            onChange={(event) => onPatch("creation.attributesPriority.mental", event.target.value)}
          >
            <option value="">Выберите</option>
            <option value="primary">Основной (7)</option>
            <option value="secondary">Вторичный (5)</option>
            <option value="tertiary">Третичный (3)</option>
          </select>
        </div>
      </div>

      <div className="grid-2">
        {dictionaries.attributes.map((attr) => {
          const layer = character.traits.attributes[attr.key];
          const value = layer?.base ?? 0;
          const isAppearance = attr.key === "appearance" && appearanceFixed;
          return (
            <div key={attr.key} className="field">
              <label>{attr.labelRu}</label>
              <DotsInput
                value={isAppearance ? 0 : value}
                min={minBaseForAttribute(attr.key)}
                allowZero={false}
                disabled={isAppearance}
                onChange={(next) => {
                  if (!canSetAttributeBase(attr, next)) return;
                  onPatch(`traits.attributes.${attr.key}.base`, next);
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="card">
      <StepHeader title="Способности" />
      <div className="grid-2">
        <div className="field">
          <label>Приоритет Таланты</label>
          <select
            value={abilityPriorities?.talents || ""}
            onChange={(event) => onPatch("creation.abilitiesPriority.talents", event.target.value)}
          >
            <option value="">Выберите</option>
            <option value="primary">Основной (13)</option>
            <option value="secondary">Вторичный (9)</option>
            <option value="tertiary">Третичный (5)</option>
          </select>
        </div>
        <div className="field">
          <label>Приоритет Навыки</label>
          <select
            value={abilityPriorities?.skills || ""}
            onChange={(event) => onPatch("creation.abilitiesPriority.skills", event.target.value)}
          >
            <option value="">Выберите</option>
            <option value="primary">Основной (13)</option>
            <option value="secondary">Вторичный (9)</option>
            <option value="tertiary">Третичный (5)</option>
          </select>
        </div>
        <div className="field">
          <label>Приоритет Знания</label>
          <select
            value={abilityPriorities?.knowledges || ""}
            onChange={(event) => onPatch("creation.abilitiesPriority.knowledges", event.target.value)}
          >
            <option value="">Выберите</option>
            <option value="primary">Основной (13)</option>
            <option value="secondary">Вторичный (9)</option>
            <option value="tertiary">Третичный (5)</option>
          </select>
        </div>
      </div>

      <div className="grid-2">
        {dictionaries.abilities.map((ability) => {
          const layer = character.traits.abilities[ability.key];
          return (
            <div key={ability.key} className="field">
              <label>{ability.labelRu}</label>
              <DotsInput
                value={layer?.base ?? 0}
                min={0}
                allowZero
                onChange={(next) => {
                  if (!canSetAbilityBase(ability, next)) return;
                  onPatch(`traits.abilities.${ability.key}.base`, next);
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="card">
      <StepHeader title="Дисциплины" />
      <div className="grid-2">
        {dictionaries.disciplines.map((disc) => {
          const layer = character.traits.disciplines[disc.key];
          const allowed = clan?.disciplineKeys?.includes(disc.key) ?? false;
          return (
            <div key={disc.key} className="field">
              <label>{disc.labelRu}</label>
              <DotsInput
                value={layer?.base ?? 0}
                min={0}
                max={3}
                allowZero
                disabled={!allowed}
                onChange={(next) => onPatch(`traits.disciplines.${disc.key}.base`, next)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="card">
      <StepHeader title="Фоны" />
      <div className="grid-2">
        {dictionaries.backgrounds.map((bg) => {
          const layer = character.traits.backgrounds[bg.key];
          return (
            <div key={bg.key} className="field">
              <label>{bg.labelRu}</label>
              <DotsInput
                value={layer?.base ?? 0}
                min={0}
                allowZero
                onChange={(next) => onPatch(`traits.backgrounds.${bg.key}.base`, next)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStep6 = () => (
    <div className="card">
      <StepHeader title="Добродетели" />
      <div className="grid-2">
        {dictionaries.virtues.map((virtue) => {
          const layer = character.traits.virtues[virtue.key];
          return (
            <div key={virtue.key} className="field">
              <label>{virtue.labelRu}</label>
              <DotsInput
                value={layer?.base ?? 1}
                min={1}
                onChange={(next) => onPatch(`traits.virtues.${virtue.key}.base`, next)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  const toggleKey = (list: string[], key: string) => {
    if (list.includes(key)) {
      return list.filter((item) => item !== key);
    }
    return [...list, key];
  };

  const renderMeritFlawList = (items: (MeritDto | FlawDto)[], selected: string[], path: string) => (
    <div className="list">
      {items.map((item) => (
        <label key={item.key} className="list-item">
          <span>
            {item.labelRu} ({item.pointCost})
          </span>
          <input
            type="checkbox"
            checked={selected.includes(item.key)}
            onChange={() => onPatch(path, toggleKey(selected, item.key))}
          />
        </label>
      ))}
    </div>
  );

  const renderStep7 = () => (
    <div className="card">
      <StepHeader title="Достоинства и недостатки" />
      <p>
        Доступный бюджет свободных очков: {FREEBIE_BASE + freebieState.flawEarned - freebieState.meritCost}
      </p>
      <div className="grid-2">
        <div>
          <h4>Достоинства</h4>
          {renderMeritFlawList(dictionaries.merits, character.traits.merits, "traits.merits")}
        </div>
        <div>
          <h4>Недостатки</h4>
          {renderMeritFlawList(dictionaries.flaws, character.traits.flaws, "traits.flaws")}
        </div>
      </div>
    </div>
  );

  const renderStep8 = () => (
    <div className="card">
      <StepHeader title="Свободные очки" />
      <p>Осталось свободных очков: {freebieState.remaining}</p>
      <div className="grid-2">
        <div>
          <h4>Атрибуты (свободные очки)</h4>
          {dictionaries.attributes.map((attr) => {
            const isAppearance = attr.key === "appearance" && appearanceFixed;
            return (
            <div key={attr.key} className="field">
              <label>{attr.labelRu}</label>
              <DotsInput
                value={isAppearance ? 0 : character.traits.attributes[attr.key]?.freebie ?? 0}
                min={0}
                allowZero
                disabled={isAppearance}
                onChange={(next) => onPatch(`traits.attributes.${attr.key}.freebie`, next)}
              />
            </div>
            );
          })}
        </div>
        <div>
          <h4>Способности (свободные очки)</h4>
          {dictionaries.abilities.map((ability) => (
            <div key={ability.key} className="field">
              <label>{ability.labelRu}</label>
              <DotsInput
                value={character.traits.abilities[ability.key]?.freebie ?? 0}
                min={0}
                allowZero
                onChange={(next) => onPatch(`traits.abilities.${ability.key}.freebie`, next)}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="grid-2">
        <div>
          <h4>Дисциплины (свободные очки)</h4>
          {dictionaries.disciplines.map((disc) => {
            const allowed = clan?.disciplineKeys?.includes(disc.key) ?? false;
            return (
            <div key={disc.key} className="field">
              <label>{disc.labelRu}</label>
              <DotsInput
                value={character.traits.disciplines[disc.key]?.freebie ?? 0}
                min={0}
                allowZero
                disabled={!allowed}
                onChange={(next) => onPatch(`traits.disciplines.${disc.key}.freebie`, next)}
              />
            </div>
            );
          })}
        </div>
        <div>
          <h4>Фоны (свободные очки)</h4>
          {dictionaries.backgrounds.map((bg) => (
            <div key={bg.key} className="field">
              <label>{bg.labelRu}</label>
              <DotsInput
                value={character.traits.backgrounds[bg.key]?.freebie ?? 0}
                min={0}
                allowZero
                onChange={(next) => onPatch(`traits.backgrounds.${bg.key}.freebie`, next)}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="grid-2">
        <div>
          <h4>Добродетели (свободные очки)</h4>
          {dictionaries.virtues.map((virtue) => (
            <div key={virtue.key} className="field">
              <label>{virtue.labelRu}</label>
              <DotsInput
                value={character.traits.virtues[virtue.key]?.freebie ?? 0}
                min={0}
                allowZero
                onChange={(next) => onPatch(`traits.virtues.${virtue.key}.freebie`, next)}
              />
            </div>
          ))}
        </div>
        <div>
          <h4>Доп. покупки</h4>
          <div className="field">
            <label>Человечность (свободные очки)</label>
            <DotsInput
              value={character.creation?.freebieBuys?.humanity ?? 0}
              min={0}
              max={10}
              allowZero
              onChange={(next) => onPatch("creation.freebieBuys.humanity", next)}
            />
          </div>
          <div className="field">
            <label>Сила воли (свободные очки)</label>
            <DotsInput
              value={character.creation?.freebieBuys?.willpower ?? 0}
              min={0}
              max={10}
              allowZero
              onChange={(next) => onPatch("creation.freebieBuys.willpower", next)}
            />
          </div>
        </div>
      </div>
      <div className="grid-2">
        <div>
          <h4>Достоинства</h4>
          {renderMeritFlawList(dictionaries.merits, character.traits.merits, "traits.merits")}
        </div>
        <div>
          <h4>Недостатки</h4>
          {renderMeritFlawList(dictionaries.flaws, character.traits.flaws, "traits.flaws")}
        </div>
      </div>
    </div>
  );

  const renderStep9 = () => (
    <div className="card">
      <StepHeader title="Финальный обзор" />
      <p>Осталось свободных очков: {freebieState.remaining}</p>
      <p>
        Стартовая человечность: {totalFor(character.traits.virtues["conscience"])} +
        {totalFor(character.traits.virtues["selfControl"])}
      </p>
      <p>Стартовая сила воли: {totalFor(character.traits.virtues["courage"])}</p>
    </div>
  );

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
      case 9:
        return renderStep9();
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
        {currentStep < 9 && (
          <button className="primary" type="button" onClick={handleNext}>
            Далее
          </button>
        )}
        {currentStep === 9 && (
          <button className="primary" type="button" onClick={handleFinish}>
            Завершить
          </button>
        )}
      </div>
    </section>
  );
}
