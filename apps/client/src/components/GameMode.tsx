
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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

function DotsDisplay({ total, max = 5 }: { total: number; max?: number }) {
  const safeTotal = Math.min(Math.max(total, 0), max);
  const dots = Array.from({ length: max });
  return (
    <div className="dots readonly" aria-label={`${safeTotal} из ${max}`}>
      {dots.map((_, index) => {
        const filled = index < safeTotal;
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
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const diceAnimTimeoutRef = useRef<number | null>(null);
  const initiativeAnimTimeoutRef = useRef<number | null>(null);

  const maxBlood = character.derived?.bloodPoolMax ?? 0;
  const maxHealth = 7;
  const resources = character.resources;
  const health = useMemo(() => resources.health, [resources.health]);
  const totalDamage = health.bashing + health.lethal + health.aggravated;

  const totalFor = (layer?: LayeredValue) =>
    layer ? layer.base + layer.freebie + layer.storyteller : 0;

  const clampNumber = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

  const statPercent = (value: number, max: number) => {
    if (max <= 0) return 0;
    return Math.max(0, Math.min(100, (value / max) * 100));
  };

  const bloodPercent = statPercent(resources.bloodPool.current, maxBlood);
  const willpowerPercent = statPercent(resources.willpower.current, 10);
  const humanityPercent = statPercent(resources.humanity.current, 10);
  const healthPercent = statPercent(totalDamage, maxHealth);

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

  const [diceDifficulty, setDiceDifficulty] = useState(6);
  const [diceCount, setDiceCount] = useState(6);
  const [chronicle, setChronicle] = useState<ChronicleDto | null>(null);
  const [chronicleLogs, setChronicleLogs] = useState<ChronicleLogDto[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [combatRulesOpen, setCombatRulesOpen] = useState(false);
  const [meleeOpen, setMeleeOpen] = useState(false);
  const [rangedOpen, setRangedOpen] = useState(false);
  const [defenseOpen, setDefenseOpen] = useState(false);
  const [multiOpen, setMultiOpen] = useState(false);
  const [rollResult, setRollResult] = useState<{
    values: number[];
    successes: number;
    ones: number;
    net: number;
    status: "success" | "failure" | "botch";
  } | null>(null);
  const [initiativeResult, setInitiativeResult] = useState<number | null>(null);
  const [diceRolling, setDiceRolling] = useState(false);
  const [initiativeRolling, setInitiativeRolling] = useState(false);
  const [selectedAttributeKey, setSelectedAttributeKey] = useState<string | null>(null);
  const [selectedAbilityKey, setSelectedAbilityKey] = useState<string | null>(null);

  const selectedAttributeLabel = useMemo(
    () =>
      dictionaries.attributes.find((item) => item.key === selectedAttributeKey)?.labelRu ?? null,
    [dictionaries.attributes, selectedAttributeKey]
  );

  const selectedAbilityLabel = useMemo(
    () =>
      dictionaries.abilities.find((item) => item.key === selectedAbilityKey)?.labelRu ?? null,
    [dictionaries.abilities, selectedAbilityKey]
  );

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
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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
    return () => {
      if (diceAnimTimeoutRef.current) {
        window.clearTimeout(diceAnimTimeoutRef.current);
      }
      if (initiativeAnimTimeoutRef.current) {
        window.clearTimeout(initiativeAnimTimeoutRef.current);
      }
    };
  }, []);

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

  const handleRollDice = () => {
    if (diceAnimTimeoutRef.current) {
      window.clearTimeout(diceAnimTimeoutRef.current);
    }
    setDiceRolling(false);
    requestAnimationFrame(() => setDiceRolling(true));
    diceAnimTimeoutRef.current = window.setTimeout(() => setDiceRolling(false), 600);

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

  const handleRollInitiative = () => {
    if (initiativeAnimTimeoutRef.current) {
      window.clearTimeout(initiativeAnimTimeoutRef.current);
    }
    setInitiativeRolling(false);
    requestAnimationFrame(() => setInitiativeRolling(true));
    initiativeAnimTimeoutRef.current = window.setTimeout(() => setInitiativeRolling(false), 600);

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

  const adjustHealth = (type: "bashing" | "lethal" | "aggravated", delta: number) => {
    if (delta > 0 && totalDamage >= maxHealth) return;
    const allowedDelta = delta > 0 ? Math.min(delta, maxHealth - totalDamage) : delta;
    const next = {
      ...health,
      [type]: clampNumber(health[type] + allowedDelta, 0, maxHealth)
    };
    handleHealthChange(next);
  };

  const healAll = () => {
    handleHealthChange({ bashing: 0, lethal: 0, aggravated: 0 });
  };

  const renderLogMessage = (log: ChronicleLogDto) => {
    if (log.type === "dice_roll" && log.data) {
      const data = log.data as Record<string, unknown>;
      const playerName = String(data.playerName ?? "Неизвестный игрок");
      const characterName = String(data.characterName ?? "Без имени");
      const difficulty = Number(data.difficulty ?? 0);
      const diceCount = Number(data.diceCount ?? 0);
      const status = String(data.status ?? "failure") as "success" | "failure" | "botch";
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
          <span className={`log-status ${kind}`}>{actionLabel}</span> типа {typeLabel}:{" "}
          <span className={`log-amount ${kind}`}>{amount}</span>.
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
    values: Record<string, LayeredValue>,
    grouped: boolean,
    options?: {
      selectable?: boolean;
      selectedKey?: string | null;
      onSelect?: (key: string) => void;
      hideZero?: boolean;
      columns?: boolean;
    }
  ) => {
    const groups = new Map<string, DictItem[]>();
    if (grouped) {
      items.forEach((item) => {
        const groupKey = (item as { group?: string }).group ?? "other";
        const arr = groups.get(groupKey) ?? [];
        arr.push(item);
        groups.set(groupKey, arr);
      });
    } else {
      groups.set("all", items);
    }

    const groupLabels: Record<string, string> = {
      physical: "Физические",
      social: "Социальные",
      mental: "Ментальные",
      talents: "Таланты",
      skills: "Навыки",
      knowledges: "Знания",
      other: "Прочее"
    };

    const order = grouped
      ? ["physical", "social", "mental", "talents", "skills", "knowledges", "other"].filter((key) =>
          groups.has(key)
        )
      : ["all"];

    const listClass = options?.columns ? "trait-list columns" : "trait-list";
    const showGroupTitle = grouped && !(order.length === 1 && order[0] === "other");

    return (
      <div className="trait-section">
        <div className="trait-title">{title}</div>
        {order.map((groupKey) => {
          const groupItems = groups.get(groupKey) ?? [];
          const visibleItems = groupItems.filter((item) => {
            const total = totalFor(values[item.key]);
            return !(options?.hideZero && total === 0);
          });
          if (visibleItems.length === 0) return null;
          return (
            <div key={groupKey} className="trait-group">
              {showGroupTitle && (
                <div className="trait-subtitle">{groupLabels[groupKey] ?? groupKey}</div>
              )}
              <div className={listClass}>
                {visibleItems.map((item) => {
                  const layer = values[item.key];
                  const total = totalFor(layer);
                  const maxDots = typeof item.maxValue === "number" ? item.maxValue : 5;
                  const tooltip = buildTooltip(
                    item.description,
                    (item as { specializationDescription?: string }).specializationDescription,
                    (item as { pageRef?: string }).pageRef
                      ? `Стр. ${(item as { pageRef?: string }).pageRef}`
                      : undefined
                  );
                  const selectable = options?.selectable;
                  const selected = options?.selectedKey === item.key;
                  const rowClass = [
                    "trait-row",
                    selectable ? "selectable" : "",
                    selected ? "selected" : ""
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <div
                      key={item.key}
                      className={rowClass}
                      onClick={() =>
                        selectable && options?.onSelect ? options.onSelect(item.key) : null
                      }
                      role={selectable ? "button" : undefined}
                      aria-pressed={selectable ? selected : undefined}
                    >
                      <span className="trait-label">
                        <span>{item.labelRu}</span>
                        {renderHelpIcon(tooltip)}
                      </span>
                      <DotsDisplay total={total} max={maxDots} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const clanLabel =
    dictionaries.clans.find((item) => item.key === character.meta.clanKey)?.labelRu ?? "—";
  const sectLabel =
    dictionaries.sects.find((item) => item.key === character.meta.sectKey)?.labelRu ?? "—";
  const natureLabel =
    dictionaries.natures.find((item) => item.key === character.meta.natureKey)?.labelRu ?? "—";
  const demeanorLabel =
    dictionaries.demeanors.find((item) => item.key === character.meta.demeanorKey)?.labelRu ?? "—";
  const chronicleName = chronicle?.name ?? "—";

  const avatarUrl = character.meta.avatarUrl?.trim();

  return (
    <section className="page sheet game-mode">
      <div className="sheet-header">
        <div className="sheet-header-main">
          <div className={`sheet-avatar-frame ${avatarUrl ? "" : "empty"}`}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Аватар" />
            ) : (
              <button
                type="button"
                className="secondary"
                onClick={() => avatarInputRef.current?.click()}
              >
                Загрузить
              </button>
            )}
            <button
              type="button"
              className="icon-button avatar-edit"
              title={avatarUrl ? "Изменить" : "Загрузить"}
              aria-label={avatarUrl ? "Изменить" : "Загрузить"}
              onClick={() => avatarInputRef.current?.click()}
            >
              ✎
            </button>
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
        <div className="sheet-header-right">
          <div className="sheet-stats">
            <div className="stat-pill" data-variant="blood">
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
              <div className="stat-bar" aria-hidden="true">
                <span className="stat-bar-fill" style={{ width: `${bloodPercent}%` }} />
              </div>
            </div>
            <div className="stat-pill" data-variant="willpower">
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
              <div className="stat-bar" aria-hidden="true">
                <span className="stat-bar-fill" style={{ width: `${willpowerPercent}%` }} />
              </div>
            </div>
            <div className="stat-pill" data-variant="humanity">
              <span className="stat-icon" title="Человечность" aria-label="Человечность" role="img">
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
              <div className="stat-bar" aria-hidden="true">
                <span className="stat-bar-fill" style={{ width: `${humanityPercent}%` }} />
              </div>
            </div>
          </div>
          <div className="sheet-header-health compact-health">
            <div className="stat-pill health-pill" data-variant="health">
              <span className="stat-icon" title="Здоровье" aria-label="Здоровье" role="img">
                ❤️
              </span>
              <span className="stat-value">
                {totalDamage}
                <span className="stat-max">/{maxHealth}</span>
              </span>
              <span className="stat-detail">
                👊 {health.bashing} · 🔪 {health.lethal} · 🐾 {health.aggravated}
              </span>
              <div className="stat-bar" aria-hidden="true">
                <span className="stat-bar-fill" style={{ width: `${healthPercent}%` }} />
              </div>
            </div>
            <div className="header-health-track">
              <HealthTrack health={health} onChange={handleHealthChange} />
              <div className="page-actions health-actions compact header-health-actions">
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
          </div>
        </div>
      </div>

      <div className="sheet-row">
        <div className="sheet-card action-card dice-row">
          <div className="dice-roller">
            <div
              className={`dice-panel ${diceRolling ? "is-rolling" : ""} ${
                rollResult ? "has-result" : ""
              }`}
            >
              <div className="dice-main">
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
                        setDiceDifficulty(clampNumber(Number(event.target.value || 0), 1, 10))
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
              </div>
              {rollResult && (
                <div className={`dice-result ${rollResult.status} ${diceRolling ? "is-rolling" : ""}`}>
                  <div className="dice-values">
                    {rollResult.values.map((value, index) => {
                      const isSuccess = value >= diceDifficulty;
                      const isOne = value === 1;
                      return (
                        <span
                          key={`${value}-${index}`}
                          className={`dice-die ${isSuccess ? "success" : "fail"} ${isOne ? "one" : ""}`}
                          style={diceRolling ? { animationDelay: `${index * 40}ms` } : undefined}
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
            <div className={`initiative-panel ${initiativeRolling ? "is-rolling" : ""}`}>
              <div className="initiative-title">
                <span className="initiative-icon" aria-hidden="true">
                  ⚡
                </span>
                Инициатива
              </div>
              <button type="button" className="initiative-button" onClick={handleRollInitiative}>
                Бросить
              </button>
              <div className={`initiative-value ${initiativeRolling ? "is-rolling" : ""}`}>
                {initiativeResult === null ? "—" : initiativeResult}
              </div>
              <div className="initiative-formula">Ловкость + Смекалка + d10</div>
            </div>
          </div>
        </div>
      </div>

      <div className="sheet-grid">
        <div className="sheet-col">
          <div className="sheet-card">
            {renderTraitList("Атрибуты", dictionaries.attributes, character.traits.attributes, true, {
              selectable: true,
              selectedKey: selectedAttributeKey,
              onSelect: (key) => setSelectedAttributeKey((prev) => (prev === key ? null : key)),
              columns: true
            })}
          </div>
          <div className="sheet-card">
            <div className="sheet-card-header">Сверхъестественное</div>
            {renderTraitList("Дисциплины", dictionaries.disciplines, character.traits.disciplines, true, {
              hideZero: true
            })}
            {renderTraitList(
              "Детали биографии",
              dictionaries.backgrounds,
              character.traits.backgrounds,
              true
            )}
            {renderTraitList("Добродетели", dictionaries.virtues, character.traits.virtues, true)}
          </div>

          <div className="sheet-card combat-guide">
            <div className="sheet-card-header">Справка по бою</div>
            <div className={`guide-section collapsible-card ${combatRulesOpen ? "" : "collapsed"}`}>
              <div className="collapsible-header guide-header">
                <span>Бой: фазы</span>
                <button
                  type="button"
                  className="icon-button collapsible-toggle"
                  aria-expanded={combatRulesOpen}
                  title={combatRulesOpen ? "Свернуть" : "Развернуть"}
                  onClick={() => setCombatRulesOpen((prev) => !prev)}
                >
                  {combatRulesOpen ? "▾" : "▸"}
                </button>
              </div>
              <div className="collapsible-content rule-block">
                <ol className="rule-list">
                  <li>Инициатива: Ловкость + Смекалка + d10 (при равенстве сравните базу).</li>
                  <li>Декларация действий: от низкой инициативы к высокой.</li>
                  <li>Разрешение действий: от высокой инициативы к низкой.</li>
                  <li>Атака → защита/уклонение (если доступно) → урон.</li>
                  <li>Урон = база + успехи атаки.</li>
                  <li>
                    Поглощение (последовательность):
                    <ul className="rule-list">
                      <li>Определите тип урона (ударный/летальный/агравированный).</li>
                      <li>
                        Соберите пул поглощения: Телосложение + броня/снаряжение + дисциплины (если
                        применимо).
                      </li>
                      <li>Бросьте поглощение, каждый успех снижает урон на 1.</li>
                      <li>Оставшийся урон отмечается на шкале здоровья.</li>
                    </ul>
                  </li>
                  <li>Завершите раунд и переходите к следующему.</li>
                </ol>
              </div>
            </div>

            <div className={`guide-section collapsible-card ${meleeOpen ? "" : "collapsed"}`}>
              <div className="collapsible-header guide-header">
                <span>Манёвры: ближний бой</span>
                <button
                  type="button"
                  className="icon-button collapsible-toggle"
                  aria-expanded={meleeOpen}
                  title={meleeOpen ? "Свернуть" : "Развернуть"}
                  onClick={() => setMeleeOpen((prev) => !prev)}
                >
                  {meleeOpen ? "▾" : "▸"}
                </button>
              </div>
              <div className="collapsible-content rule-block">
                <ul className="rule-list">
                  <li>Удар рукой (Ловкость + Драка); Сл6; Урон: Сила — лёгкий удар.</li>
                  <li>Удар ногой (Ловкость + Драка); Сл7; Урон: Сила +1 — лёгкий удар.</li>
                  <li>
                    Удар оружием (Ловкость + Фехтование); Сл6; Урон: Сила + оружие — тип урона по
                    оружию. Удар в голову даёт тяжёлый урон.
                  </li>
                  <li>
                    Подсечка (Ловкость + Драка/Фехтование); Сл7; Урон: Сила — цель делает
                    рефлекторную проверку Ловкость + Атлетика (Сл8) или падает. Возможна через
                    фехтование, если оружием можно сбить с ног (дубинка/посох/цеп).
                  </li>
                  <li>
                    Бросок (Сила + Драка); Сл7; Урон: Сила +1 — вы и цель делаете рефлекторную
                    проверку Выносливость + Атлетика (Сл7) или падаете. Цель получает +1 к Сл всех
                    действий на следующий ход.
                  </li>
                  <li>
                    Разоружение (Ловкость + Драка/Фехтование); Сл7 — нужно набрать успехи, равные
                    Силе противника. Если выбивать оружие голыми руками, нужно успехов = Сила +
                    урон оружия, иначе получаете урон как от атаки.
                  </li>
                  <li>
                    Клинч (Сила + Драка); Сл6 — взаимный захват, возможны только проверки урона
                    (Сила) или попытки выйти.
                  </li>
                  <li>
                    Захват (Сила + Драка); Сл6 — обездвиживание цели. Любое действие, кроме укуса и
                    шага, разрывает захват.
                  </li>
                  <li>
                    Выход из клинча/захвата (Сила + Драка); Сл6 — взаимная проверка, если цель не
                    отпускает.
                  </li>
                  <li>
                    Ловкий захват/выход (Ловкость + Атлетика) — допускается вместо силы. Минус:
                    захват не даёт управлять движением цели; она может шагать и пытаться выйти.
                  </li>
                  <li>
                    Укус (Ловкость + Драка) +1d10; Сл6; Урон: Сила +1 — только по цели без защиты
                    (в захвате/обездвижена/сбита с ног). Укус сверхъестественных существ наносит
                    губительный урон; можно выпить 1 пункт крови.
                  </li>
                </ul>
              </div>
            </div>

            <div className={`guide-section collapsible-card ${rangedOpen ? "" : "collapsed"}`}>
              <div className="collapsible-header guide-header">
                <span>Манёвры: дистанционный бой</span>
                <button
                  type="button"
                  className="icon-button collapsible-toggle"
                  aria-expanded={rangedOpen}
                  title={rangedOpen ? "Свернуть" : "Развернуть"}
                  onClick={() => setRangedOpen((prev) => !prev)}
                >
                  {rangedOpen ? "▾" : "▸"}
                </button>
              </div>
              <div className="collapsible-content rule-block">
                <ul className="rule-list">
                  <li>
                    Все манёвры с оружием дальнего боя используют проверку Ловкость + Стрельба.
                  </li>
                  <li>Параметр “Точность” = количество кубов, добавляемых к попаданию.</li>
                  <li>Одиночный выстрел: Сл6.</li>
                  <li>
                    Стрельба по‑македонски: Сл+1 для второй проверки; лёгкое оружие в каждой руке;
                    разделите пул между выстрелами.
                  </li>
                  <li>Короткая очередь: Сл+1; Точность +2 — очередь из трёх патронов.</li>
                  <li>
                    Длинная очередь: Сл+2; Точность +10 — весь магазин, нужна перезарядка; в
                    магазине должно быть не менее половины патронов.
                  </li>
                  <li>
                    Обстрел: Сл+2; Точность +10 — полный магазин по зоне ~3 м; успехи распределяются
                    между всеми целями (минимум по одному при наличии успехов), затем урон по каждой.
                  </li>
                  <li>
                    Перезарядка — тратит весь ход. Вариант: проверка Ловкость + Стрельба (Сл7): 1
                    успех для пистолета/ПП, 2 — для автомата/тяжёлого оружия; револьвер без
                    спидлоадера/дробовик — 1 успех за каждый патрон (Сл4).
                  </li>
                  <li>
                    Наведение — даёт +1 куб на следующую проверку стрельбы, можно накапливать до
                    значения Восприятия. Оптический прицел добавляет +2 куба при первом наведении
                    (не учитываются в лимите). Вариант: проверка Восприятие + Стрельба; при провале
                    бонус не даётся.
                  </li>
                  <li>Выстрел в упор: Сл−2 (дистанция меньше 2 м).</li>
                  <li>Выстрел вдаль: Сл+2 (дальность выше максимальной, но не более чем в 2 раза).</li>
                  <li>
                    Прицеливание: средняя цель Сл+1; маленькая Сл+2 и Урон +1; крошечная Сл+3 и
                    Урон +2.
                  </li>
                </ul>
              </div>
            </div>

            <div className={`guide-section collapsible-card ${defenseOpen ? "" : "collapsed"}`}>
              <div className="collapsible-header guide-header">
                <span>Манёвры: защита</span>
                <button
                  type="button"
                  className="icon-button collapsible-toggle"
                  aria-expanded={defenseOpen}
                  title={defenseOpen ? "Свернуть" : "Развернуть"}
                  onClick={() => setDefenseOpen((prev) => !prev)}
                >
                  {defenseOpen ? "▾" : "▸"}
                </button>
              </div>
              <div className="collapsible-content rule-block">
                <ul className="rule-list">
                  <li>
                    Уклонение (Ловкость + Атлетика); Сл6 — позволяет увернуться от атаки ближнего
                    боя при наличии свободного места. В случае окружения со всех сторон не работает.
                  </li>
                  <li>
                    Уклонение от выстрелов (Ловкость + Атлетика) — в V20 требует укрытия или
                    перехода в положение лёжа. Вариант из Revised (Сл зависит от обстановки):
                    <ul className="rule-list">
                      <li>Уже в укрытии (только высунулся) — Сл2.</li>
                      <li>Надёжное укрытие (в 1 м) — Сл4.</li>
                      <li>Надёжное укрытие (в 3 м) — Сл6.</li>
                      <li>Ненадёжное укрытие (в 1 м) — Сл6.</li>
                      <li>Укрытия нет (падение в лёжку) — Сл8.</li>
                    </ul>
                    Адепты стремительности могут сдвигаться на 1 шаг вверх по таблице сложности.
                  </li>
                  <li>
                    Парирование (Ловкость + Фехтование); Сл6 — блок атаки ближнего боя оружием. Если
                    нападающий без холодного оружия, при большем числе успехов можно нанести урон,
                    как при атаке.
                  </li>
                  <li>
                    Блок (Ловкость + Драка); Сл6 — нивелирует успехи противника, как уклонение.
                    Без брони или дисциплины Стойкость таким образом можно нейтрализовать только
                    лёгкие повреждения.
                  </li>
                  <li>
                    Домашнее правило: заменить Ловкость на Выносливость, а при наличии брони или
                    Стойкости разрешить блокировать не только ближний бой, но и пули.
                  </li>
                </ul>
              </div>
            </div>

            <div className={`guide-section collapsible-card ${multiOpen ? "" : "collapsed"}`}>
              <div className="collapsible-header guide-header">
                <span>Манёвры: множественные действия</span>
                <button
                  type="button"
                  className="icon-button collapsible-toggle"
                  aria-expanded={multiOpen}
                  title={multiOpen ? "Свернуть" : "Развернуть"}
                  onClick={() => setMultiOpen((prev) => !prev)}
                >
                  {multiOpen ? "▾" : "▸"}
                </button>
              </div>
              <div className="collapsible-content rule-block">
                <ul className="rule-list">
                  <li>Заявите все действия в фазе декларации.</li>
                  <li>За каждое дополнительное действие уменьшите общий пул на 1 куб.</li>
                  <li>Разделите оставшийся пул между действиями (минимум 1 куб на действие).</li>
                  <li>Каждое действие бросается своим пулом.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="sheet-col">
          <div className="sheet-card">
            {renderTraitList("Способности", dictionaries.abilities, character.traits.abilities, true, {
              selectable: true,
              selectedKey: selectedAbilityKey,
              onSelect: (key) => setSelectedAbilityKey((prev) => (prev === key ? null : key)),
              columns: true
            })}
          </div>
          <div className="sheet-card">
            <div className="sheet-card-header">Достоинства / Недостатки</div>
            <div className="merits-flaws-grid">
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

          <div className="sheet-card">
            <div className="sheet-card-header">Заметки и снаряжение</div>
            <div className="notes-grid">
              <div className="trait-section">
                <div className="trait-title">Заметки</div>
                <textarea
                  className="compact-textarea"
                  rows={4}
                  value={character.notes}
                  onChange={(event) => onPatch("notes", event.target.value)}
                />
              </div>
              <div className="trait-section">
                <div className="trait-title">Снаряжение</div>
                <textarea
                  className="compact-textarea"
                  rows={4}
                  value={character.equipment}
                  onChange={(event) => onPatch("equipment", event.target.value)}
                />
              </div>
            </div>
          </div>

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
              {chronicleLogs.length === 0 && <div className="log-empty">Нет событий.</div>}
              {chronicleLogs.map((log) => (
                <div key={log._id} className="log-item">
                  <div className="log-time">{new Date(log.createdAt).toLocaleString("ru-RU")}</div>
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
