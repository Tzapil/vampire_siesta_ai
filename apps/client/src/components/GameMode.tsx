import { useMemo } from "react";
import type { CharacterDto, DictItem, LayeredValue } from "../api/types";
import { useDictionaries } from "../context/DictionariesContext";
import { HealthTrack } from "./HealthTrack";

function NumericControl({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="page-actions">
        <button type="button" onClick={() => onChange(Math.max(value - 1, min))}>
          -
        </button>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <button type="button" onClick={() => onChange(Math.min(value + 1, max))}>
          +
        </button>
        <span>/ {max}</span>
      </div>
    </div>
  );
}

function HealthAdjustButton({
  label,
  ariaLabel,
  onClick,
  className
}: {
  label: string;
  ariaLabel?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={className}>
      {label}
    </button>
  );
}

function DotsDisplay({
  total,
  max = 5
}: {
  total: number;
  max?: number;
}) {
  const dots = Array.from({ length: max });
  return (
    <div className="dots readonly" aria-label={`${total} из ${max}`}>
      {dots.map((_, index) => {
        const filled = index < total;
        return (
          <div
            key={index}
            className={`dot ${filled ? "filled" : ""} readonly`}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

export function GameMode({
  character,
  onPatch
}: {
  character: CharacterDto;
  onPatch: (path: string, value: unknown) => void;
}) {
  const { dictionaries } = useDictionaries();
  const maxBlood = character.derived?.bloodPoolMax ?? 0;

  const resources = character.resources;

  const health = useMemo(() => resources.health, [resources.health]);
  const totalDamage = health.bashing + health.lethal + health.aggravated;
  const totalFor = (layer?: LayeredValue) =>
    layer ? layer.base + layer.freebie + layer.storyteller : 0;

  const renderTraitList = (
    title: string,
    items: DictItem[],
    record: Record<string, LayeredValue>,
    columns = false,
    options?: { hideZero?: boolean }
  ) => {
    const filtered = options?.hideZero
      ? items.filter((item) => totalFor(record[item.key]) > 0)
      : items;
    return (
      <div className="trait-section">
        <div className="trait-title">{title}</div>
        <div className={columns ? "trait-list columns" : "trait-list"}>
          {filtered.length === 0 && <div className="trait-empty">Нет</div>}
          {filtered.map((item) => {
            const total = totalFor(record[item.key]);
            return (
              <div key={item.key} className="trait-row">
                <span>{item.labelRu}</span>
                <DotsDisplay total={total} />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const clanLabel =
    dictionaries.clans.find((item) => item.key === character.meta.clanKey)?.labelRu || "—";
  const sectLabel =
    dictionaries.sects.find((item) => item.key === character.meta.sectKey)?.labelRu || "—";
  const natureLabel =
    dictionaries.natures.find((item) => item.key === character.meta.natureKey)?.labelRu || "—";
  const demeanorLabel =
    dictionaries.demeanors.find((item) => item.key === character.meta.demeanorKey)?.labelRu || "—";

  const clampHealth = (next: { bashing: number; lethal: number; aggravated: number }) => {
    const bashing = Math.max(0, Math.min(7, next.bashing));
    const lethal = Math.max(0, Math.min(7, next.lethal));
    const aggravated = Math.max(0, Math.min(7, next.aggravated));
    const total = Math.min(7, bashing + lethal + aggravated);
    if (total <= 7) {
      return { bashing, lethal, aggravated };
    }
    const overflow = bashing + lethal + aggravated - 7;
    return {
      bashing: Math.max(0, bashing - overflow),
      lethal,
      aggravated
    };
  };

  const adjustHealth = (field: "bashing" | "lethal" | "aggravated", delta: number) => {
    const next = {
      ...health,
      [field]: health[field] + delta
    } as { bashing: number; lethal: number; aggravated: number };
    onPatch("resources.health", clampHealth(next));
  };

  const healAll = () => {
    onPatch("resources.health", { bashing: 0, lethal: 0, aggravated: 0 });
  };

  return (
    <section className="page sheet">
      <div className="sheet-header">
        <div className="sheet-header-left">
          <div className="sheet-title">{character.meta.name || "(Без имени)"}</div>
          <div className="sheet-subtitle">
            {clanLabel} · {sectLabel} · Поколение {character.meta.generation}
          </div>
          <div className="sheet-meta">
            <span>Игрок: {character.meta.playerName || "—"}</span>
            <span>Натура: {natureLabel}</span>
            <span>Поведение: {demeanorLabel}</span>
          </div>
        </div>
        <div className="sheet-header-right">
          <div className="sheet-stats">
            <div className="stat-pill">
              <span className="stat-label">Кровь</span>
              <span className="stat-value">
                {resources.bloodPool.current}
                <span className="stat-max">/{maxBlood}</span>
              </span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">Сила воли</span>
              <span className="stat-value">
                {resources.willpower.current}
                <span className="stat-max">/10</span>
              </span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">Человечность</span>
              <span className="stat-value">
                {resources.humanity.current}
                <span className="stat-max">/10</span>
              </span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">Здоровье</span>
              <span className="stat-value">
                {totalDamage}
                <span className="stat-max">/7</span>
              </span>
              <span className="stat-mini">
                👊 {health.bashing} · 🔪 {health.lethal} · 🐾 {health.aggravated}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="sheet-grid">
        <div className="sheet-col">
          <div className="sheet-card">
            <div className="sheet-card-header">Характеристики</div>
            {renderTraitList("Атрибуты", dictionaries.attributes, character.traits.attributes, true)}
            {renderTraitList("Способности", dictionaries.abilities, character.traits.abilities, true)}
          </div>
        </div>

        <div className="sheet-col">
          <div className="sheet-card">
            <div className="sheet-card-header">Сверхъестественное</div>
            {renderTraitList(
              "Дисциплины",
              dictionaries.disciplines,
              character.traits.disciplines,
              true,
              { hideZero: true }
            )}
            {renderTraitList("Фоны", dictionaries.backgrounds, character.traits.backgrounds, true)}
            {renderTraitList("Добродетели", dictionaries.virtues, character.traits.virtues, true)}
          </div>
          <div className="sheet-card">
            <div className="sheet-card-header">Достоинства / Недостатки</div>
            <div className="trait-section">
              <div className="trait-title">Достоинства</div>
              <div className="trait-list">
                {character.traits.merits.length === 0 && <div className="trait-empty">Нет</div>}
                {character.traits.merits.map((key) => {
                  const merit = dictionaries.merits.find((item) => item.key === key);
                  return (
                    <div key={key} className="trait-row">
                      <span>{merit?.labelRu ?? key}</span>
                      <span className="trait-cost">{merit?.pointCost ?? "—"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="trait-section">
              <div className="trait-title">Недостатки</div>
              <div className="trait-list">
                {character.traits.flaws.length === 0 && <div className="trait-empty">Нет</div>}
                {character.traits.flaws.map((key) => {
                  const flaw = dictionaries.flaws.find((item) => item.key === key);
                  return (
                    <div key={key} className="trait-row">
                      <span>{flaw?.labelRu ?? key}</span>
                      <span className="trait-cost">{flaw?.pointCost ?? "—"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="sheet-col">
          <div className="sheet-card compact-controls">
            <div className="sheet-card-header">Ресурсы</div>
            <div className="compact-controls-grid">
              <NumericControl
                label="Кровь"
                value={resources.bloodPool.current}
                min={0}
                max={maxBlood}
                onChange={(next) => onPatch("resources.bloodPool.current", next)}
              />
              <NumericControl
                label="Сила воли"
                value={resources.willpower.current}
                min={0}
                max={10}
                onChange={(next) => onPatch("resources.willpower.current", next)}
              />
              <NumericControl
                label="Человечность"
                value={resources.humanity.current}
                min={0}
                max={10}
                onChange={(next) => onPatch("resources.humanity.current", next)}
              />
            </div>
          </div>

          <div className="sheet-card compact-health">
            <div className="sheet-card-header">Здоровье</div>
            <HealthTrack health={health} onChange={(next) => onPatch("resources.health", next)} />
            <div className="page-actions health-actions compact">
              <HealthAdjustButton
                label="🧪"
                ariaLabel="Вылечить полностью"
                className="health-action-mini health-heal"
                onClick={healAll}
              />
              <HealthAdjustButton
                label="+1 👊"
                ariaLabel="+1 ударный"
                className="health-action-mini"
                onClick={() => adjustHealth("bashing", 1)}
              />
              <HealthAdjustButton
                label="-1 👊"
                ariaLabel="-1 ударный"
                className="health-action-mini"
                onClick={() => adjustHealth("bashing", -1)}
              />
              <HealthAdjustButton
                label="+1 🔪"
                ariaLabel="+1 летальный"
                className="health-action-mini"
                onClick={() => adjustHealth("lethal", 1)}
              />
              <HealthAdjustButton
                label="-1 🔪"
                ariaLabel="-1 летальный"
                className="health-action-mini"
                onClick={() => adjustHealth("lethal", -1)}
              />
              <HealthAdjustButton
                label="+1 🐾"
                ariaLabel="+1 агравированный"
                className="health-action-mini"
                onClick={() => adjustHealth("aggravated", 1)}
              />
              <HealthAdjustButton
                label="-1 🐾"
                ariaLabel="-1 агравированный"
                className="health-action-mini"
                onClick={() => adjustHealth("aggravated", -1)}
              />
            </div>
          </div>

          <div className="sheet-card">
            <div className="sheet-card-header">Заметки</div>
            <textarea
              className="compact-textarea"
              rows={4}
              value={character.notes}
              onChange={(event) => onPatch("notes", event.target.value)}
            />
          </div>
          <div className="sheet-card">
            <div className="sheet-card-header">Снаряжение</div>
            <textarea
              className="compact-textarea"
              rows={4}
              value={character.equipment}
              onChange={(event) => onPatch("equipment", event.target.value)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
