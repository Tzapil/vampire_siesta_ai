import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type { CharacterDto, ChronicleLogDto, DictItem, LayeredValue } from "../api/types";
import { useDictionaries } from "../context/DictionariesContext";
import { useToast } from "../context/ToastContext";
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
  const { pushToast } = useToast();
  const maxBlood = character.derived?.bloodPoolMax ?? 0;
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const avatarUrl = character.meta.avatarUrl?.trim();

  const resources = character.resources;

  const health = useMemo(() => resources.health, [resources.health]);
  const totalDamage = health.bashing + health.lethal + health.aggravated;
  const totalFor = (layer?: LayeredValue) =>
    layer ? layer.base + layer.freebie + layer.storyteller : 0;
  const buildTooltip = (...parts: Array<string | undefined | null>) => {
    const text = parts
      .map((part) => (part ?? "").trim())
      .filter(Boolean)
      .join("\n");
    return text.length > 0 ? text : null;
  };
  const renderHelpIcon = (text?: string | null) =>
    text ? (
      <span className="help-icon" title={text} aria-label={text}>
        ?
      </span>
    ) : null;

  const clampNumber = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

  const [diceDifficulty, setDiceDifficulty] = useState(6);
  const [diceCount, setDiceCount] = useState(6);
  const [chronicleLogs, setChronicleLogs] = useState<ChronicleLogDto[]>([]);
  const [logOpen, setLogOpen] = useState(true);
  const [rollResult, setRollResult] = useState<{
    values: number[];
    successes: number;
    ones: number;
    net: number;
    status: "success" | "failure" | "botch";
  } | null>(null);

  useEffect(() => {
    const chronicleId = character.meta.chronicleId;
    if (!chronicleId) {
      setChronicleLogs([]);
      return;
    }
    let active = true;
    async function loadLogs() {
      try {
        const logs = await api.get<ChronicleLogDto[]>(`/chronicles/${chronicleId}/logs?limit=50`);
        if (active) {
          setChronicleLogs(logs);
        }
      } catch {
        if (active) setChronicleLogs([]);
      }
    }
    loadLogs();
    return () => {
      active = false;
    };
  }, [character.meta.chronicleId]);

  const handleRollDice = () => {
    const difficulty = clampNumber(diceDifficulty, 1, 10);
    const count = clampNumber(diceCount, 1, 20);
    setDiceDifficulty(difficulty);
    setDiceCount(count);

    const values = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * 10));
    const successes = values.filter((value) => value >= difficulty).length;
    const ones = values.filter((value) => value === 1).length;
    const net = successes - ones;

    let status: "success" | "failure" | "botch" = "failure";
    if (net > 0) {
      status = "success";
    } else if (successes === 0 && ones > 0) {
      status = "botch";
    }

    const result = { values, successes, ones, net, status };
    setRollResult(result);

    const chronicleId = character.meta.chronicleId;
    if (chronicleId) {
      const characterName = character.meta.name?.trim() || "(Без имени)";
      const playerName = character.meta.playerName?.trim() || "Неизвестный игрок";
      const statusLabel =
        status === "success" ? "успех" : status === "botch" ? "критический провал" : "провал";
      const message = `Игрок ${playerName}, персонаж ${characterName}, бросил проверку сложности ${difficulty} на ${count} куб(ов): ${statusLabel}, успехов ${Math.max(
        net,
        0
      )}.`;

      api
        .post<ChronicleLogDto>(`/chronicles/${chronicleId}/logs`, {
          type: "dice_roll",
          message,
          data: {
            playerName,
            characterName,
            characterUuid: character.uuid,
            difficulty,
            diceCount: count,
            values,
            successes,
            ones,
            net,
            status
          }
        })
        .then((entry) => {
          setChronicleLogs((prev) => [entry, ...prev].slice(0, 50));
        })
        .catch(() => {
          pushToast("Не удалось записать бросок в лог", "error");
        });
    }
  };

  const handleAvatarFile = async (file?: File | null) => {
    if (!file) return;
    const maxBytes = 2_000_000;
    if (file.size > maxBytes) {
      pushToast("Файл слишком большой (макс. 2 МБ)", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        pushToast("Не удалось прочитать файл", "error");
        return;
      }
      onPatch("meta.avatarUrl", result);
    };
    reader.onerror = () => {
      pushToast("Не удалось прочитать файл", "error");
    };
    reader.readAsDataURL(file);
  };

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
          <div className="sheet-header-main">
            <div className={`sheet-avatar-frame ${avatarUrl ? "has-image" : "empty"}`}>
              {avatarUrl ? (
                <>
                  <img src={avatarUrl} alt={character.meta.name || "Аватар"} />
                  <button
                    type="button"
                    className="icon-button avatar-edit"
                    title="Изменить картинку"
                    aria-label="Изменить картинку"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    🖼️
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  Загрузить картинку
                </button>
              )}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  handleAvatarFile(file);
                  event.target.value = "";
                }}
              />
            </div>
            <div className="sheet-header-text">
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
                  const tooltip = buildTooltip(merit?.description);
                  return (
                    <div key={key} className="trait-row">
                      <span className="trait-label">
                        <span>{merit?.labelRu ?? key}</span>
                        {renderHelpIcon(tooltip)}
                      </span>
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
                  const tooltip = buildTooltip(flaw?.description);
                  return (
                    <div key={key} className="trait-row">
                      <span className="trait-label">
                        <span>{flaw?.labelRu ?? key}</span>
                        {renderHelpIcon(tooltip)}
                      </span>
                      <span className="trait-cost">{flaw?.pointCost ?? "—"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="sheet-col">
          <div className="sheet-card">
            <div className="sheet-card-header">Бросок кубиков</div>
            <div className="dice-roller">
              <div className="dice-inputs">
                <label className="dice-field">
                  <span>Сложность</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={diceDifficulty}
                    onChange={(event) =>
                      setDiceDifficulty(
                        clampNumber(Number(event.target.value || 0), 1, 10)
                      )
                    }
                  />
                </label>
                <label className="dice-field">
                  <span>Кубиков</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={diceCount}
                    onChange={(event) =>
                      setDiceCount(clampNumber(Number(event.target.value || 0), 1, 20))
                    }
                  />
                </label>
                <button type="button" className="primary" onClick={handleRollDice}>
                  Бросить
                </button>
              </div>
              {rollResult && (
                <div className={`dice-result ${rollResult.status}`}>
                  <div className="dice-values">
                    {rollResult.values.map((value, index) => {
                      const isSuccess = value >= diceDifficulty;
                      const isOne = value === 1;
                      return (
                        <span
                          key={`${value}-${index}`}
                          className={`dice-die ${isSuccess ? "success" : "fail"} ${
                            isOne ? "one" : ""
                          }`}
                        >
                          {value}
                        </span>
                      );
                    })}
                  </div>
                  <div className="dice-summary">
                    <span>Успехи: {Math.max(0, rollResult.net)}</span>
                    <span>Единицы: {rollResult.ones}</span>
                    <span className="dice-status">
                      {rollResult.status === "success"
                        ? "Успех"
                        : rollResult.status === "botch"
                          ? "Критический провал"
                          : "Провал"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
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

        <div className="sheet-col sheet-col-log">
          <div className={`sheet-card log-panel ${logOpen ? "" : "collapsed"}`}>
            <div className="sheet-card-header log-header">
              <span>Лог хроники</span>
              <button
                type="button"
                className="icon-button log-toggle"
                aria-expanded={logOpen}
                title={logOpen ? "Свернуть" : "Развернуть"}
                onClick={() => setLogOpen((prev) => !prev)}
              >
                {logOpen ? "▾" : "▸"}
              </button>
            </div>
            <div className="log-list">
              {chronicleLogs.length === 0 && (
                <div className="log-empty">Нет событий.</div>
              )}
              {chronicleLogs.map((log) => (
                <div key={log._id} className="log-item">
                  <div className="log-time">
                    {new Date(log.createdAt).toLocaleString("ru-RU")}
                  </div>
                  <div className="log-message">{log.message}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
