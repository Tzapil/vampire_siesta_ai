
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type {
  CharacterDto,
  ChronicleDto,
  ChronicleLogDto,
  CombatInitiativeDto,
  CombatStateDto,
  DictItem,
  LayeredValue
} from "../api/types";
import { useDictionaries } from "../context/DictionariesContext";
import { useToast } from "../context/ToastContext";
import { HelpPopoverButton, HelpPopoverGroup } from "./HelpPopover";
import { HealthTrack } from "./HealthTrack";
import { GameModeManeuversDrawer } from "./GameModeManeuversDrawer";
import {
  GAME_MODE_MANEUVER_GUIDE_SECTIONS,
  GAME_MODE_MANEUVER_LEGEND,
  getGameModeManeuverById,
  getGameModeManeuversByGuideSection,
  type GameModeCombatManeuver,
  type GameModeManeuverTab
} from "./gameModeCombatManeuvers";
import { buildDictionaryHelpText } from "../utils/dictionaryHelp";
import { woundPenalty } from "../utils/health";

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

const maneuverLegendById = new Map(
  GAME_MODE_MANEUVER_LEGEND.map((item) => [item.id, item] as const)
);

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
  const woundMod = woundPenalty(totalDamage);

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

  const [diceDifficulty, setDiceDifficulty] = useState(6);
  const [diceCount, setDiceCount] = useState(6);
  const [chronicle, setChronicle] = useState<ChronicleDto | null>(null);
  const [chronicleLogs, setChronicleLogs] = useState<ChronicleLogDto[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [combatRulesOpen, setCombatRulesOpen] = useState(false);
  const [combatResolutionOpen, setCombatResolutionOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState<Record<GameModeManeuverTab, boolean>>({
    attack: false,
    defense: false,
    ranged: false,
    special: false
  });
  const [maneuversOpen, setManeuversOpen] = useState(false);
  const [activeManeuverTab, setActiveManeuverTab] = useState<GameModeManeuverTab>("attack");
  const [expandedManeuverId, setExpandedManeuverId] = useState<string | null>(null);
  const [activeManeuverId, setActiveManeuverId] = useState<string | null>(null);
  const [rollResult, setRollResult] = useState<{
    values: number[];
    successes: number;
    ones: number;
    net: number;
    difficulty: number;
    diceCount: number;
    status: "success" | "failure" | "botch";
  } | null>(null);
  const [initiativeResult, setInitiativeResult] = useState<CombatInitiativeDto | null>(null);
  const [diceRolling, setDiceRolling] = useState(false);
  const [initiativeRolling, setInitiativeRolling] = useState(false);
  const [initiativeEditOpen, setInitiativeEditOpen] = useState(false);
  const [initiativeDraft, setInitiativeDraft] = useState("");
  const [selectedAttributeKey, setSelectedAttributeKey] = useState<string | null>(null);
  const [selectedAbilityKey, setSelectedAbilityKey] = useState<string | null>(null);
  const initiativeFormula = initiativeResult?.manual
    ? "Ручное"
    : `Ловк + Смек + d10${woundMod !== 0 ? ` · ${woundMod > 0 ? "+" : ""}${woundMod}` : ""}`;
  const rollStatusLabel = rollResult
    ? rollResult.status === "success"
      ? "Успех"
      : rollResult.status === "botch"
        ? "Критический провал"
        : "Провал"
    : "Ожидание";

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

  const activeManeuver = useMemo(
    () => (activeManeuverId ? getGameModeManeuverById(activeManeuverId) ?? null : null),
    [activeManeuverId]
  );

  const activeManeuverBonus = activeManeuver?.preset?.diceBonus ?? 0;
  const diceSelectionText = useMemo(() => {
    if (!selectedAttributeLabel || !selectedAbilityLabel) {
      return "Выберите атрибут и способность";
    }

    const parts = [`${selectedAttributeLabel} + ${selectedAbilityLabel}`];

    if (activeManeuver) {
      parts.push(
        activeManeuverBonus !== 0
          ? `${activeManeuver.title} ${activeManeuverBonus > 0 ? "+" : ""}${activeManeuverBonus}`
          : activeManeuver.title
      );
    }

    if (woundMod !== 0) {
      parts.push(`ранения ${woundMod > 0 ? "+" : ""}${woundMod}`);
    }

    return parts.join(" · ");
  }, [
    activeManeuver,
    activeManeuverBonus,
    selectedAbilityLabel,
    selectedAttributeLabel,
    woundMod
  ]);

  useEffect(() => {
    if (!selectedAttributeKey || !selectedAbilityKey) return;
    const attrTotal = totalFor(character.traits.attributes[selectedAttributeKey]);
    const abilityTotal = totalFor(character.traits.abilities[selectedAbilityKey]);
    const next = clampNumber(attrTotal + abilityTotal + woundMod + activeManeuverBonus, 1, 20);
    setDiceCount(next);
  }, [
    selectedAttributeKey,
    selectedAbilityKey,
    character.traits.attributes,
    character.traits.abilities,
    woundMod,
    activeManeuverBonus
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
    const chronicleId = character.meta.chronicleId;
    if (!chronicleId) {
      setInitiativeResult(null);
      return;
    }
    let active = true;
    const loadInitiative = async () => {
      try {
        const combat = await api.get<CombatStateDto>(`/chronicles/${chronicleId}/combat`);
        if (!active) return;
        const stored = combat?.initiatives?.[character.uuid];
        setInitiativeResult(stored ?? null);
      } catch {
        if (active) {
          setInitiativeResult((prev) => prev ?? null);
        }
      }
    };
    loadInitiative();
    const interval = window.setInterval(loadInitiative, 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [character.meta.chronicleId, character.uuid]);

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

  const updateDiceDifficulty = (value: number) => {
    setDiceDifficulty(clampNumber(value, 1, 10));
  };

  const updateDiceCount = (value: number) => {
    setDiceCount(clampNumber(value, 1, 20));
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

    const result = { values, successes, ones, net, difficulty, diceCount: count, status };
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

  const persistInitiative = async (initiative: CombatInitiativeDto, errorMessage: string) => {
    const previous = initiativeResult;
    setInitiativeResult(initiative);

    const chronicleId = character.meta.chronicleId;
    if (!chronicleId) {
      return true;
    }

    try {
      const response = await api.post<{ characterUuid: string; initiative: CombatInitiativeDto }>(
        `/chronicles/${chronicleId}/combat/initiative`,
        { characterUuid: character.uuid, initiative }
      );
      setInitiativeResult(response?.initiative ?? initiative);
      return true;
    } catch {
      setInitiativeResult(previous);
      pushToast(errorMessage, "error");
      return false;
    }
  };

  const createManualInitiative = (total: number): CombatInitiativeDto => {
    const dexterity = totalFor(character.traits.attributes["dexterity"]);
    const wits = totalFor(character.traits.attributes["wits"]);
    return {
      dexterity,
      wits,
      base: dexterity + wits,
      roll: 0,
      total,
      manual: true
    };
  };

  const handleInitiativeEditStart = () => {
    setInitiativeDraft(initiativeResult ? String(initiativeResult.total) : "");
    setInitiativeEditOpen(true);
  };

  const handleInitiativeEditCancel = () => {
    setInitiativeEditOpen(false);
    setInitiativeDraft("");
  };

  const handleInitiativeEditSave = async () => {
    const trimmed = initiativeDraft.trim();
    setInitiativeEditOpen(false);
    setInitiativeDraft("");

    if (!trimmed) {
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      pushToast("Введите корректное значение инициативы", "error");
      return;
    }

    await persistInitiative(
      createManualInitiative(Math.trunc(parsed)),
      "Не удалось сохранить инициативу для боя"
    );
  };

  const handleInitiativeInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      handleInitiativeEditCancel();
    }
  };

  const rollInitiative = () => {
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
    const total = base + woundMod + roll;
    const initiative: CombatInitiativeDto = {
      dexterity,
      wits,
      base,
      roll,
      total
    };
    setInitiativeResult(initiative);

    const characterName = character.meta.name?.trim() || "(Без имени)";
    const playerName = character.meta.playerName?.trim() || "Неизвестный игрок";
    const woundLabel = woundMod !== 0 ? ` + штраф ранений ${woundMod}` : "";
    const message = `Игрок ${playerName}, персонаж ${characterName}, бросил инициативу: Ловкость ${dexterity} + Смекалка ${wits} + d10(${roll})${woundLabel} = ${total}.`;

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
        total,
        woundMod
      }
    });
    void persistInitiative(initiative, "Не удалось сохранить инициативу для боя");
  };
  const handleRollInitiative = () => rollInitiative();

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

  const toggleGuideSection = (section: GameModeManeuverTab) => {
    setGuideOpen((prev) => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleAttributeSelection = (key: string) => {
    setActiveManeuverId(null);
    setSelectedAttributeKey((prev) => (prev === key ? null : key));
  };

  const handleAbilitySelection = (key: string) => {
    setActiveManeuverId(null);
    setSelectedAbilityKey((prev) => (prev === key ? null : key));
  };

  const handleOpenManeuvers = () => {
    if (activeManeuver) {
      setActiveManeuverTab(activeManeuver.tab);
    }
    setManeuversOpen(true);
  };

  const handleApplyManeuver = (maneuver: GameModeCombatManeuver) => {
    if (maneuver.applyMode === "disabled" || !maneuver.preset) {
      return;
    }
    const { attributeKey, abilityKey, appliedDifficulty, diceBonus = 0 } = maneuver.preset;
    const attrTotal = totalFor(character.traits.attributes[attributeKey]);
    const abilityTotal = totalFor(character.traits.abilities[abilityKey]);
    const nextDiceCount = clampNumber(attrTotal + abilityTotal + woundMod + diceBonus, 1, 20);
    setSelectedAttributeKey(attributeKey);
    setSelectedAbilityKey(abilityKey);
    setDiceDifficulty(appliedDifficulty);
    setDiceCount(nextDiceCount);
    setActiveManeuverId(maneuver.id);
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
      const woundMod = Number(data.woundMod ?? 0);
      const ignoreWoundPenalty = Boolean(data.ignoreWoundPenalty ?? false);
      const woundLabel = ignoreWoundPenalty
        ? " без штрафа ранений"
        : woundMod !== 0
          ? ` + штраф ранений ${woundMod}`
          : "";
      return (
        <span className="log-text">
          Игрок <strong>{playerName}</strong>, персонаж <strong>{characterName}</strong>, бросил
          инициативу: Ловкость {dexterity} + Смекалка {wits} + d10({roll})
          {woundLabel} ={" "}
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
                          <HelpPopoverButton
                            popoverId={`game-trait-${groupKey}-${item.key}`}
                            text={buildDictionaryHelpText(item)}
                            ariaLabel={`Описание: ${item.labelRu}`}
                          />
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

  const renderManeuverFlags = (flags: GameModeCombatManeuver["detailFlags"]) => {
    if (flags.length === 0) return null;
    return (
      <span className="game-mode-guide-flags" aria-label="Особые пометки манёвра">
        {flags.map((flag) => {
          const legendItem = maneuverLegendById.get(flag);
          if (!legendItem) return null;
          return (
            <span
              key={flag}
              className="game-mode-maneuver-flag"
              title={legendItem.description}
              aria-label={legendItem.description}
            >
              {legendItem.shortLabel}
            </span>
          );
        })}
      </span>
    );
  };

  const renderManeuverGuideSection = (
    section: (typeof GAME_MODE_MANEUVER_GUIDE_SECTIONS)[number]
  ) => {
    const isOpen = guideOpen[section.id];
    const maneuvers = getGameModeManeuversByGuideSection(section.id);
    return (
      <div
        key={section.id}
        className={`guide-section collapsible-card ${isOpen ? "" : "collapsed"}`}
      >
        <div className="collapsible-header guide-header">
          <span>{section.title}</span>
          <button
            type="button"
            className="icon-button collapsible-toggle"
            aria-expanded={isOpen}
            title={isOpen ? "Свернуть" : "Развернуть"}
            onClick={() => toggleGuideSection(section.id)}
          >
            {isOpen ? "▾" : "▸"}
          </button>
        </div>
        <div className="collapsible-content rule-block">
          {section.intro?.length ? (
            <div className="guide-section-intro">
              {section.intro.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          ) : null}
          <ul className="rule-list">
            {maneuvers.map((maneuver) => (
              <li key={maneuver.id}>
                <strong>{maneuver.title}</strong>
                {renderManeuverFlags(maneuver.detailFlags)} ({maneuver.summary.pool}); Сложность:{" "}
                {maneuver.summary.difficulty}; Урон: {maneuver.summary.damage}.{" "}
                {maneuver.detailText}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  const clanLabel =
    dictionaries.clans.find((item) => item.key === character.meta.clanKey)?.labelRu ?? "—";
  const selectedSect = dictionaries.sects.find((item) => item.key === character.meta.sectKey);
  const selectedNature = dictionaries.natures.find((item) => item.key === character.meta.natureKey);
  const selectedDemeanor = dictionaries.demeanors.find(
    (item) => item.key === character.meta.demeanorKey
  );
  const sectLabel = selectedSect?.labelRu ?? "—";
  const natureLabel = selectedNature?.labelRu ?? "—";
  const demeanorLabel = selectedDemeanor?.labelRu ?? "—";
  const chronicleName = chronicle?.name ?? "—";

  const avatarUrl = character.meta.avatarUrl?.trim();

  return (
    <HelpPopoverGroup>
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
                <span className="sheet-meta-item">
                  <span>Натура: {natureLabel}</span>
                  <HelpPopoverButton
                    popoverId="game-meta-nature"
                    text={buildDictionaryHelpText(selectedNature)}
                    ariaLabel="Описание натуры"
                    showWhenEmpty
                  />
                </span>
                <span className="sheet-meta-item">
                  <span>Поведение: {demeanorLabel}</span>
                  <HelpPopoverButton
                    popoverId="game-meta-demeanor"
                    text={buildDictionaryHelpText(selectedDemeanor)}
                    ariaLabel="Описание поведения"
                    showWhenEmpty
                  />
                </span>
                <span className="sheet-meta-item">
                  <span>Секта: {sectLabel}</span>
                  <HelpPopoverButton
                    popoverId="game-meta-sect"
                    text={buildDictionaryHelpText(selectedSect)}
                    ariaLabel="Описание секты"
                    showWhenEmpty
                  />
                </span>
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
          <div className="game-mode-dice-toolbar">
            <div className="dice-title">
              <span className="dice-icon" aria-hidden="true">
                🎲
              </span>
              Бросок кубиков
            </div>
            <button
              type="button"
              className="game-mode-maneuvers-button"
              onClick={handleOpenManeuvers}
              aria-expanded={maneuversOpen}
              aria-controls="game-mode-maneuvers-drawer"
            >
              ⚔ Манёвры
            </button>
          </div>
          <div className="dice-roller">
            <div className={`dice-panel ${diceRolling ? "is-rolling" : ""}`}>
              <div className="dice-main">
                <div className="dice-controls">
                  <div className="dice-field">
                    <span>Сложность</span>
                    <span className="dice-input-shell">
                      <input
                        type="number"
                        min={1}
                        max={10}
                        inputMode="numeric"
                        aria-label="Сложность броска"
                        value={diceDifficulty}
                        onChange={(event) => updateDiceDifficulty(Number(event.target.value || 0))}
                      />
                      <span className="dice-stepper-actions">
                        <button
                          type="button"
                          className="icon-button dice-stepper-button"
                          onClick={() => updateDiceDifficulty(diceDifficulty - 1)}
                          disabled={diceDifficulty <= 1}
                          aria-label="Уменьшить сложность"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          className="icon-button dice-stepper-button"
                          onClick={() => updateDiceDifficulty(diceDifficulty + 1)}
                          disabled={diceDifficulty >= 10}
                          aria-label="Увеличить сложность"
                        >
                          +
                        </button>
                      </span>
                    </span>
                  </div>
                  <div className="dice-field">
                    <span>Кубиков</span>
                    <span className="dice-input-shell">
                      <input
                        type="number"
                        min={1}
                        max={20}
                        inputMode="numeric"
                        aria-label="Количество кубиков"
                        value={diceCount}
                        onChange={(event) => updateDiceCount(Number(event.target.value || 0))}
                      />
                      <span className="dice-stepper-actions">
                        <button
                          type="button"
                          className="icon-button dice-stepper-button"
                          onClick={() => updateDiceCount(diceCount - 1)}
                          disabled={diceCount <= 1}
                          aria-label="Уменьшить количество кубиков"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          className="icon-button dice-stepper-button"
                          onClick={() => updateDiceCount(diceCount + 1)}
                          disabled={diceCount >= 20}
                          aria-label="Увеличить количество кубиков"
                        >
                          +
                        </button>
                      </span>
                    </span>
                  </div>
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
                <div className="dice-selection" title={diceSelectionText}>
                  {selectedAttributeLabel && selectedAbilityLabel ? (
                    <>
                      <strong>{selectedAttributeLabel}</strong> + <strong>{selectedAbilityLabel}</strong>
                      {activeManeuver ? (
                        <>
                          {" · "}
                          {activeManeuver.title}
                          {activeManeuverBonus !== 0
                            ? ` ${activeManeuverBonus > 0 ? "+" : ""}${activeManeuverBonus}`
                            : ""}
                        </>
                      ) : null}
                      {woundMod !== 0 ? (
                        <>{" · "}ранения {woundMod > 0 ? "+" : ""}{woundMod}</>
                      ) : null}
                    </>
                  ) : (
                    "Выберите атрибут и способность"
                  )}
                </div>
              </div>
              <div
                className={`dice-result ${rollResult?.status ?? "idle"} ${
                  diceRolling ? "is-rolling" : ""
                } ${rollResult ? "has-roll" : "is-empty"}`}
              >
                <div className="dice-result-meta-line">
                  <span className="dice-result-status">{rollStatusLabel}</span>
                  <span className="dice-result-stat dice-result-summary-successes">
                    Успехи: <strong>{rollResult ? Math.max(0, rollResult.net) : "—"}</strong>
                  </span>
                  <span className="dice-result-stat dice-result-summary-ones">
                    Единицы: <strong>{rollResult?.ones ?? "—"}</strong>
                  </span>
                </div>
                <div className="dice-values-board">
                  {rollResult ? (
                    <div className="dice-values">
                      {rollResult.values.map((value, index) => {
                        const isSuccess = value >= rollResult.difficulty;
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
                  ) : (
                    <div className="dice-result-placeholder">Результат появится после броска</div>
                  )}
                </div>
              </div>
            </div>
            <div className={`initiative-panel ${initiativeRolling ? "is-rolling" : ""}`}>
              <div className="initiative-title">
                <span className="initiative-icon" aria-hidden="true">
                  ⚡
                </span>
                Инициатива
              </div>
              <div className="initiative-actions">
                <button
                  type="button"
                  className="icon-button initiative-roll-button"
                  onClick={handleRollInitiative}
                  title="Бросить"
                  aria-label="Бросить"
                >
                  ⚡
                </button>
                <button
                  type="button"
                  className="icon-button initiative-edit-button"
                  onClick={handleInitiativeEditStart}
                  title="Редактировать инициативу"
                  aria-label="Редактировать инициативу"
                >
                  ✎
                </button>
              </div>
              {initiativeEditOpen ? (
                <input
                  type="number"
                  inputMode="numeric"
                  autoFocus
                  className="initiative-input"
                  value={initiativeDraft}
                  onChange={(event) => setInitiativeDraft(event.target.value)}
                  onBlur={() => {
                    void handleInitiativeEditSave();
                  }}
                  onKeyDown={handleInitiativeInputKeyDown}
                  aria-label="Текущее значение инициативы"
                />
              ) : (
                <div className={`initiative-value ${initiativeRolling ? "is-rolling" : ""}`}>
                  {initiativeResult === null ? "—" : initiativeResult.total}
                </div>
              )}
              <div className="initiative-formula">{initiativeFormula}</div>
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
              onSelect: handleAttributeSelection,
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
                  <li>
                    Инициатива: Ловкость + Смекалка + d10, обычно со штрафом ранений (при
                    равенстве сравните базу).
                  </li>
                  <li>Декларация действий: от низкой инициативы к высокой.</li>
                  <li>
                    Разрешение действий: от высокой инициативы к низкой; дополнительные
                    физические действия от Стремительности приходят в конце хода.
                  </li>
                  <li>Атака → защита/уклонение (если доступно) → урон.</li>
                  <li>Урон = база + успехи атаки.</li>
                  <li>
                    Типы урона:
                    <ul className="rule-list">
                      <li>Ударный ("лёгкий"): кулаки, пинки, тупое оружие, огнестрел по вампирам.</li>
                      <li>Летальный ("тяжёлый"): клинки, пули по смертным, выстрел в голову по вампиру.</li>
                      <li>Агравированный: огонь, солнце, клыки и когти сверхъестественных существ.</li>
                    </ul>
                  </li>
                  <li>
                    Поглощение (soak):
                    <ul className="rule-list">
                      <li>Смертные поглощают только ударный урон: Телосложение.</li>
                      <li>Вампиры поглощают ударный и летальный урон: Телосложение.</li>
                      <li>Стойкость добавляется к поглощению ударного и летального урона.</li>
                      <li>Агравированный урон поглощается только Стойкостью.</li>
                      <li>
                        Броня добавляет кубы к поглощению ударного, летального и агравированного
                        урона от клыков/когтей, но не защищает от огня и солнца.
                      </li>
                      <li>Бросьте поглощение, каждый успех снижает урон на 1.</li>
                      <li>После поглощения оставшийся ударный урон по вампиру делится пополам вниз.</li>
                      <li>Оставшийся урон отмечается на шкале здоровья.</li>
                    </ul>
                  </li>
                  <li>Завершите раунд и переходите к следующему.</li>
                </ol>
              </div>
            </div>

            <div className={`guide-section collapsible-card ${combatResolutionOpen ? "" : "collapsed"}`}>
              <div className="collapsible-header guide-header">
                <span>Попадание, защита, урон, soak</span>
                <button
                  type="button"
                  className="icon-button collapsible-toggle"
                  aria-expanded={combatResolutionOpen}
                  title={combatResolutionOpen ? "Свернуть" : "Развернуть"}
                  onClick={() => setCombatResolutionOpen((prev) => !prev)}
                >
                  {combatResolutionOpen ? "▾" : "▸"}
                </button>
              </div>
              <div className="collapsible-content rule-block">
                <ol className="rule-list">
                  <li>
                    До броска объявите всё, что меняет действие: множественные действия, глухую
                    оборону, прицеливание, трату крови, трату Силы воли и дисциплины. Если вы уже
                    заявили другое действие, уйти в защиту можно через abort: успешный бросок Силы
                    воли (Сл6) или трата пункта Силы воли.
                  </li>
                  <li>
                    Попадание: бросьте обычный пул атаки. Здесь работают штрафы ранений,
                    множественных действий, окружения, укрытия, прицельного выстрела и прочие
                    модификаторы сцены.
                  </li>
                  <li>
                    Защита: блок, парирование или уклонение убирают успехи атаки. Если после
                    защитного броска успехов не осталось, попадания и урона нет.
                  </li>
                  <li>
                    Урон: если хотя бы один успех атаки остался, бросьте базовый урон
                    манёвра/оружия + чистые успехи атаки. Если сила или кровь меняют тип урона или
                    добавляют кубы, объявляйте это до броска попадания.
                  </li>
                  <li>
                    Soak: после урона цель бросает поглощение. Каждый успех снимает 1 уровень
                    урона. Штрафы ранений сюда не идут, потому что soak — рефлекторный бросок.
                  </li>
                  <li>
                    После soak отметьте остаток на треке здоровья. Ударный урон по вампиру после
                    поглощения делится пополам вниз.
                  </li>
                  <li>
                    Где штрафы ранений есть, а где нет:
                    <ul className="rule-list">
                      <li>Есть: инициатива, попадание, активная защита, большинство бросков активации сил.</li>
                      <li>
                        Нет: soak, большинство бросков Добродетелей/Силы воли и другие чисто
                        рефлекторные пулы.
                      </li>
                      <li>Пункт Силы воли можно потратить, чтобы игнорировать штрафы ранений на 1 ход.</li>
                    </ul>
                  </li>
                  <li>
                    Сила воли и сверхъестественное:
                    <ul className="rule-list">
                      <li>
                        1 пункт Силы воли до броска даёт 1 автоуспех на одно заявленное действие
                        или активацию силы; не задним числом и не больше одного такого автоуспеха
                        за ход.
                      </li>
                      <li>
                        Другие траты Силы воли по правилам силы или для abort в защиту считаются
                        отдельно.
                      </li>
                      <li>Стойкость работает на soak, в том числе против агравированного урона.</li>
                      <li>
                        Стремительность позволяет в начале хода купить кровью дополнительные
                        физические действия в конце хода; потраченные на это точки в тот же ход не
                        дают бонусных кубов к броскам Ловкости.
                      </li>
                      <li>
                        Мощь усиливает силовые броски и рукопашный урон; если переводите её в
                        автоуспехи за кровь, решайте это до бросков действия.
                      </li>
                      <li>
                        Если дисциплина требует отдельного броска вместо атаки, она идёт как
                        обычное действие по инициативе и получает свои обычные модификаторы.
                      </li>
                    </ul>
                  </li>
                </ol>
              </div>
            </div>

            {GAME_MODE_MANEUVER_GUIDE_SECTIONS.map(renderManeuverGuideSection)}
          </div>
        </div>

        <div className="sheet-col">
          <div className="sheet-card">
            {renderTraitList("Способности", dictionaries.abilities, character.traits.abilities, true, {
              selectable: true,
              selectedKey: selectedAbilityKey,
              onSelect: handleAbilitySelection,
              columns: true
            })}
          </div>
          <div className="sheet-card">
            <div className="merits-flaws-grid">
              <div className="trait-section">
                <div className="trait-title">Достоинства</div>
                <div className="trait-list">
                  {character.traits.merits.length === 0 && <div className="trait-empty">Нет</div>}
                  {character.traits.merits.map((key) => {
                    const merit = dictionaries.merits.find((item) => item.key === key);
                    return (
                      <div key={key} className="trait-row">
                        <span className="trait-label">
                          <span>{merit?.labelRu ?? key}</span>
                          <HelpPopoverButton
                            popoverId={`game-merit-${key}`}
                            text={buildDictionaryHelpText(merit)}
                            ariaLabel={`Описание достоинства ${merit?.labelRu ?? key}`}
                          />
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
                    return (
                      <div key={key} className="trait-row">
                        <span className="trait-label">
                          <span>{flaw?.labelRu ?? key}</span>
                          <HelpPopoverButton
                            popoverId={`game-flaw-${key}`}
                            text={buildDictionaryHelpText(flaw)}
                            ariaLabel={`Описание недостатка ${flaw?.labelRu ?? key}`}
                          />
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
      <GameModeManeuversDrawer
        open={maneuversOpen}
        activeTab={activeManeuverTab}
        expandedManeuverId={expandedManeuverId}
        activeManeuverId={activeManeuverId}
        onClose={() => setManeuversOpen(false)}
        onTabChange={setActiveManeuverTab}
        onExpandedManeuverChange={setExpandedManeuverId}
        onApplyManeuver={handleApplyManeuver}
      />
    </HelpPopoverGroup>
  );
}
