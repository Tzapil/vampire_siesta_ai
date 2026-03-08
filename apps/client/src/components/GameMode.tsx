import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type {
  CharacterDto,
  ChronicleDto,
  ChronicleLogDto,
  DictItem,
  LayeredValue
} from "../api/types";
import { useDictionaries } from "../context/DictionariesContext";
import { useToast } from "../context/ToastContext";
import { HealthTrack } from "./HealthTrack";
import { Link } from "react-router-dom";

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
  const [chronicle, setChronicle] = useState<ChronicleDto | null>(null);
  const [chronicleLogs, setChronicleLogs] = useState<ChronicleLogDto[]>([]);
  const [logOpen, setLogOpen] = useState(true);
  const [rollResult, setRollResult] = useState<{
    values: number[];
    successes: number;
    ones: number;
    net: number;
    status: "success" | "failure" | "botch";
  } | null>(null);
  const [initiativeResult, setInitiativeResult] = useState<number | null>(null);
  const [selectedAttributeKey, setSelectedAttributeKey] = useState<string | null>(null);
  const [selectedAbilityKey, setSelectedAbilityKey] = useState<string | null>(null);

  const handleRollInitiative = () => {
    const dexterity = totalFor(character.traits.attributes["dexterity"]);
    const wits = totalFor(character.traits.attributes["wits"]);
    const base = dexterity + wits;
    const roll = 1 + Math.floor(Math.random() * 10);
    const total = base + roll;
    setInitiativeResult(total);

    const characterName = character.meta.name?.trim() || "(Без имени)";
    const playerName = character.meta.playerName?.trim() || "Неизвестный игрок";
    const message = `Игрок ${playerName}, персонаж ${characterName}, бросил инициативу: Ловкость ${dexterity} + Смекалка ${wits} + d10(${roll}) = ${total}.`;

    logChronicleEvent({
      type: "initiative_roll",
      message,
      data: {
        playerName,
        characterName,
        characterUuid: character.uuid,
        dexterity,
        wits,
        base,
        roll,
        total
      }
    });
  };

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
          const sorted = [...logs].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setChronicleLogs(sorted);
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

  useEffect(() => {
    const chronicleId = character.meta.chronicleId;
    if (!chronicleId) {
      setChronicle(null);
      return;
    }
    let active = true;
    api
      .get<ChronicleDto>(`/chronicles/${chronicleId}`)
      .then((data) => {
        if (active) setChronicle(data);
      })
      .catch(() => {
        if (active) setChronicle(null);
      });
    return () => {
      active = false;
    };
  }, [character.meta.chronicleId]);

  useEffect(() => {
    if (!selectedAttributeKey || !selectedAbilityKey) return;
    const attrTotal = totalFor(character.traits.attributes[selectedAttributeKey]);
    const abilityTotal = totalFor(character.traits.abilities[selectedAbilityKey]);
    const next = clampNumber(attrTotal + abilityTotal, 1, 20);
    setDiceCount(next);
  }, [
    selectedAttributeKey,
    selectedAbilityKey,
    character.traits.attributes,
    character.traits.abilities
  ]);

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

    const characterName = character.meta.name?.trim() || "(Без имени)";
    const playerName = character.meta.playerName?.trim() || "Неизвестный игрок";
    const statusLabel =
      status === "success" ? "успех" : status === "botch" ? "критический провал" : "провал";
    const message = `Игрок ${playerName}, персонаж ${characterName}, бросил проверку сложности ${difficulty} на ${count} куб(ов): ${statusLabel}, успехов ${Math.max(
      net,
      0
    )}.`;

    logChronicleEvent({
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
    });
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

  const logChronicleEvent = (payload: {
    type: string;
    message: string;
    data?: Record<string, unknown>;
  }) => {
    const chronicleId = character.meta.chronicleId;
    if (!chronicleId) return;
    api
      .post<ChronicleLogDto>(`/chronicles/${chronicleId}/logs`, payload)
      .then((entry) => {
        setChronicleLogs((prev) => {
          const next = [entry, ...prev];
          next.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          return next.slice(0, 50);
        });
      })
      .catch(() => {
        pushToast("Не удалось записать событие в лог", "error");
      });
  };

  const handleHealthChange = (next: { bashing: number; lethal: number; aggravated: number }) => {
    const prev = health;
    if (
      prev.bashing === next.bashing &&
      prev.lethal === next.lethal &&
      prev.aggravated === next.aggravated
    ) {
      return;
    }
    onPatch("resources.health", next);

    const characterName = character.meta.name?.trim() || "(Без имени)";
    const playerName = character.meta.playerName?.trim() || "Неизвестный игрок";
    const typeLabels: Record<string, string> = {
      bashing: "ударный",
      lethal: "летальный",
      aggravated: "агравированный"
    };

    const deltas = {
      bashing: next.bashing - prev.bashing,
      lethal: next.lethal - prev.lethal,
      aggravated: next.aggravated - prev.aggravated
    };

    (Object.keys(deltas) as Array<keyof typeof deltas>).forEach((key) => {
      const delta = deltas[key];
      if (delta === 0) return;
      const kind = delta > 0 ? "damage" : "heal";
      const amount = Math.abs(delta);
      const typeLabel = typeLabels[key] ?? key;
      const actionLabel = kind === "damage" ? "получил урон" : "вылечил урон";
      const message = `Игрок ${playerName}, персонаж ${characterName}, ${actionLabel} типа ${typeLabel}: ${amount}.`;
      logChronicleEvent({
        type: "health_change",
        message,
        data: {
          playerName,
          characterName,
          characterUuid: character.uuid,
          kind,
          damageType: key,
          amount
        }
      });
    });
  };

  const handleResourceChange = (
    resourceKey: "bloodPool" | "willpower" | "humanity",
    nextValue: number
  ) => {
    const prevValue = resources[resourceKey].current;
    if (prevValue === nextValue) return;
    onPatch(`resources.${resourceKey}.current`, nextValue);

    const characterName = character.meta.name?.trim() || "(Без имени)";
    const playerName = character.meta.playerName?.trim() || "Неизвестный игрок";
    const labels: Record<typeof resourceKey, string> = {
      bloodPool: "Кровь",
      willpower: "Сила воли",
      humanity: "Человечность"
    };
    const delta = nextValue - prevValue;
    const kind = delta > 0 ? "increase" : "decrease";
    const amount = Math.abs(delta);
    const actionLabel = kind === "increase" ? "увеличил" : "уменьшил";
    const resourceLabel = labels[resourceKey];
    const message = `Игрок ${playerName}, персонаж ${characterName}, ${actionLabel} ${resourceLabel} на ${amount} (теперь ${nextValue}).`;
    logChronicleEvent({
      type: "resource_change",
      message,
      data: {
        playerName,
        characterName,
        characterUuid: character.uuid,
        resourceKey,
        kind,
        amount,
        from: prevValue,
        to: nextValue
      }
    });
  };

  const adjustResource = (
    resourceKey: "bloodPool" | "willpower" | "humanity",
    delta: number,
    min: number,
    max: number
  ) => {
    const next = clampNumber(resources[resourceKey].current + delta, min, max);
    handleResourceChange(resourceKey, next);
  };

  const renderLogMessage = (log: ChronicleLogDto) => {
    if (log.type === "dice_roll" && log.data) {
      const data = log.data as Record<string, unknown>;
      const playerName = String(data.playerName ?? "Неизвестный игрок");
      const characterName = String(data.characterName ?? "Без имени");
      const difficulty = Number(data.difficulty ?? 0);
      const diceCount = Number(data.diceCount ?? 0);
      const status = String(data.status ?? "failure") as
        | "success"
        | "failure"
        | "botch";
      const net = Number(data.net ?? 0);
      const statusLabel =
        status === "success" ? "успех" : status === "botch" ? "критический провал" : "провал";
      const successCount = Math.max(net, 0);
      return (
        <span className="log-text">
          Игрок <strong>{playerName}</strong>, персонаж <strong>{characterName}</strong>, бросил
          проверку сложности {difficulty} на {diceCount} куб(ов):{" "}
          <span className={`log-status ${status}`}>{statusLabel}</span>, успехов{" "}
          <span className={`log-success-count ${successCount > 0 ? "success" : "failure"}`}>
            {successCount}
          </span>
          .
        </span>
      );
    }
    if (log.type === "health_change" && log.data) {
      const data = log.data as Record<string, unknown>;
      const playerName = String(data.playerName ?? "Неизвестный игрок");
      const characterName = String(data.characterName ?? "Без имени");
      const kind = String(data.kind ?? "damage") as "damage" | "heal";
      const damageType = String(data.damageType ?? "");
      const amount = Number(data.amount ?? 0);
      const typeLabels: Record<string, string> = {
        bashing: "ударный",
        lethal: "летальный",
        aggravated: "агравированный"
      };
      const typeLabel = typeLabels[damageType] ?? damageType;
      const actionLabel = kind === "damage" ? "получил урон" : "вылечил урон";
      return (
        <span className="log-text">
          Игрок <strong>{playerName}</strong>, персонаж <strong>{characterName}</strong>,{" "}
          <span className={`log-status ${kind}`}>
            {actionLabel}
          </span>{" "}
          типа {typeLabel}:{" "}
          <span className={`log-amount ${kind}`}>{amount}</span>
          .
        </span>
      );
    }
    if (log.type === "resource_change" && log.data) {
      const data = log.data as Record<string, unknown>;
      const playerName = String(data.playerName ?? "Неизвестный игрок");
      const characterName = String(data.characterName ?? "Без имени");
      const resourceKey = String(data.resourceKey ?? "");
      const kind = String(data.kind ?? "increase") as "increase" | "decrease";
      const amount = Number(data.amount ?? 0);
      const toValue = Number(data.to ?? 0);
      const labels: Record<string, string> = {
        bloodPool: "Кровь",
        willpower: "Сила воли",
        humanity: "Человечность"
      };
      const resourceLabel = labels[resourceKey] ?? resourceKey;
      const actionLabel = kind === "increase" ? "увеличил" : "уменьшил";
      return (
        <span className="log-text">
          Игрок <strong>{playerName}</strong>, персонаж <strong>{characterName}</strong>,{" "}
          <span className={`log-status ${kind}`}>{actionLabel}</span> {resourceLabel} на{" "}
          <span className={`log-amount ${kind}`}>{amount}</span> (теперь {toValue}).
        </span>
      );
    }
    if (log.type === "initiative_roll" && log.data) {
      const data = log.data as Record<string, unknown>;
      const playerName = String(data.playerName ?? "Неизвестный игрок");
      const characterName = String(data.characterName ?? "Без имени");
      const dexterity = Number(data.dexterity ?? 0);
      const wits = Number(data.wits ?? 0);
      const roll = Number(data.roll ?? 0);
      const total = Number(data.total ?? dexterity + wits + roll);
      return (
        <span className="log-text">
          Игрок <strong>{playerName}</strong>, персонаж <strong>{characterName}</strong>, бросил
          инициативу: Ловкость {dexterity} + Смекалка {wits} + d10({roll}) ={" "}
          <span className="log-success-count success">{total}</span>.
        </span>
      );
    }
    return <span className="log-text">{log.message}</span>;
  };

  const renderTraitList = (
    title: string,
    items: DictItem[],
    record: Record<string, LayeredValue>,
    columns = false,
    options?: {
      hideZero?: boolean;
      selectable?: boolean;
      selectedKey?: string | null;
      onSelect?: (key: string) => void;
    }
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
            const selectable = Boolean(options?.onSelect);
            const isSelected = options?.selectedKey === item.key;
            return (
              <div
                key={item.key}
                className={`trait-row${selectable ? " selectable" : ""}${
                  isSelected ? " selected" : ""
                }`}
                onClick={
                  selectable
                    ? () => options?.onSelect?.(item.key)
                    : undefined
                }
                role={selectable ? "button" : undefined}
                tabIndex={selectable ? 0 : undefined}
                onKeyDown={
                  selectable
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          options?.onSelect?.(item.key);
                        }
                      }
                    : undefined
                }
              >
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
  const chronicleName = chronicle?.name?.trim() || "—";
  const selectedAttributeLabel = selectedAttributeKey
    ? dictionaries.attributes.find((item) => item.key === selectedAttributeKey)?.labelRu
    : null;
  const selectedAbilityLabel = selectedAbilityKey
    ? dictionaries.abilities.find((item) => item.key === selectedAbilityKey)?.labelRu
    : null;

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
    handleHealthChange(clampHealth(next));
  };

  const healAll = () => {
    handleHealthChange({ bashing: 0, lethal: 0, aggravated: 0 });
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
                <span>
                  Хроника:{" "}
                  {character.meta.chronicleId ? (
                    <Link className="inline-link" to={`/chronicles/${character.meta.chronicleId}`}>
                      {chronicleName}
                    </Link>
                  ) : (
                    "—"
                  )}
                </span>
                <span>Натура: {natureLabel}</span>
                <span>Поведение: {demeanorLabel}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="sheet-header-right">
          <div className="sheet-stats">
            <div className="stat-pill">
              <span className="stat-icon" title="Кровь" aria-label="Кровь" role="img">
                🩸
              </span>
              <span className="stat-value">
                {resources.bloodPool.current}
                <span className="stat-max">/{maxBlood}</span>
              </span>
              <div className="stat-controls">
                <button
                  type="button"
                  className="stat-btn"
                  aria-label="Убавить кровь"
                  title="Убавить кровь"
                  onClick={() => adjustResource("bloodPool", -1, 0, maxBlood)}
                >
                  −
                </button>
                <button
                  type="button"
                  className="stat-btn"
                  aria-label="Добавить кровь"
                  title="Добавить кровь"
                  onClick={() => adjustResource("bloodPool", 1, 0, maxBlood)}
                >
                  +
                </button>
              </div>
            </div>
            <div className="stat-pill">
              <span className="stat-icon" title="Сила воли" aria-label="Сила воли" role="img">
                🧠
              </span>
              <span className="stat-value">
                {resources.willpower.current}
                <span className="stat-max">/10</span>
              </span>
              <div className="stat-controls">
                <button
                  type="button"
                  className="stat-btn"
                  aria-label="Убавить силу воли"
                  title="Убавить силу воли"
                  onClick={() => adjustResource("willpower", -1, 0, 10)}
                >
                  −
                </button>
                <button
                  type="button"
                  className="stat-btn"
                  aria-label="Добавить силу воли"
                  title="Добавить силу воли"
                  onClick={() => adjustResource("willpower", 1, 0, 10)}
                >
                  +
                </button>
              </div>
            </div>
            <div className="stat-pill">
              <span
                className="stat-icon"
                title="Человечность"
                aria-label="Человечность"
                role="img"
              >
                😇
              </span>
              <span className="stat-value">
                {resources.humanity.current}
                <span className="stat-max">/10</span>
              </span>
              <div className="stat-controls">
                <button
                  type="button"
                  className="stat-btn"
                  aria-label="Убавить человечность"
                  title="Убавить человечность"
                  onClick={() => adjustResource("humanity", -1, 0, 10)}
                >
                  −
                </button>
                <button
                  type="button"
                  className="stat-btn"
                  aria-label="Добавить человечность"
                  title="Добавить человечность"
                  onClick={() => adjustResource("humanity", 1, 0, 10)}
                >
                  +
                </button>
              </div>
            </div>
            <div className="stat-pill">
              <span className="stat-icon" title="Здоровье" aria-label="Здоровье" role="img">
                ❤️
              </span>
              <span className="stat-value">
                {totalDamage}
                <span className="stat-max">/7</span>
              </span>
              <span className="stat-detail">
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
            {renderTraitList("Атрибуты", dictionaries.attributes, character.traits.attributes, true, {
              selectable: true,
              selectedKey: selectedAttributeKey,
              onSelect: (key) =>
                setSelectedAttributeKey((prev) => (prev === key ? null : key))
            })}
            {renderTraitList("Способности", dictionaries.abilities, character.traits.abilities, true, {
              selectable: true,
              selectedKey: selectedAbilityKey,
              onSelect: (key) =>
                setSelectedAbilityKey((prev) => (prev === key ? null : key))
            })}
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
            {renderTraitList("Детали биографии", dictionaries.backgrounds, character.traits.backgrounds, true)}
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
              <div className="dice-panel">
                <div className="dice-title">
                  <span className="dice-icon" aria-hidden="true">
                    🎲
                  </span>
                  Бросок кубиков
                </div>
                <div className="dice-controls">
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
                  <button
                    type="button"
                    className="icon-button dice-roll-button"
                    onClick={handleRollDice}
                    title="Бросить"
                    aria-label="Бросить"
                  >
                    🎲
                  </button>
                </div>
                <div className="dice-selection">
                  {selectedAttributeLabel && selectedAbilityLabel ? (
                    <>
                      Выбор: <strong>{selectedAttributeLabel}</strong> +{" "}
                      <strong>{selectedAbilityLabel}</strong>
                    </>
                  ) : (
                    "Кликните по атрибуту и способности, чтобы подставить кубики"
                  )}
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
              <div className="initiative-panel">
                <div className="initiative-title">
                  <span className="initiative-icon" aria-hidden="true">
                    ⚡
                  </span>
                  Инициатива
                </div>
                <button type="button" className="initiative-button" onClick={handleRollInitiative}>
                  Бросить
                </button>
                <div className="initiative-value">
                  {initiativeResult === null ? "—" : initiativeResult}
                </div>
                <div className="initiative-formula">Ловкость + Смекалка + d10</div>
              </div>
            </div>
          </div>
          <div className="sheet-card compact-health">
            <div className="sheet-card-header">Здоровье</div>
            <HealthTrack health={health} onChange={handleHealthChange} />
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
                  <div className="log-message">{renderLogMessage(log)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
