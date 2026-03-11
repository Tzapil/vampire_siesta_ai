import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type {
  CharacterSummaryDto,
  ChronicleDto,
  CombatEnemyDto,
  CombatInitiativeDto,
  CombatStateDto,
  LayeredValue
} from "../api/types";
import { useDictionaries } from "../context/DictionariesContext";
import { useToast } from "../context/ToastContext";
import { buildHealthTrack, woundPenalty } from "../utils/health";

type Participant =
  | {
      type: "character";
      id: string;
      name: string;
      avatarUrl?: string;
      playerName: string;
      clanLabel: string;
      generation?: number | null;
      health: { bashing: number; lethal: number; aggravated: number };
      dexterity: number;
      wits: number;
      woundMod: number;
      initiative?: CombatInitiativeDto;
      creationFinished: boolean;
    }
  | {
      type: "enemy";
      id: string;
      name: string;
      dexterity: number;
      wits: number;
      woundMod: number;
      health: { bashing: number; lethal: number; aggravated: number };
      initiative?: CombatInitiativeDto;
      dead: boolean;
    };

function totalFor(layer?: LayeredValue) {
  return layer ? layer.base + layer.freebie + layer.storyteller : 0;
}

function clampHealth(next: { bashing: number; lethal: number; aggravated: number }) {
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
}

function HealthTrackDisplay({ health }: { health: { bashing: number; lethal: number; aggravated: number } }) {
  const track = buildHealthTrack(health);
  return (
    <div className="health-track readonly">
      {track.map((state, index) => (
        <div key={index} className={`health-cell ${state}`} aria-hidden="true">
          {state === "aggravated" ? "X" : state === "lethal" ? "-" : ""}
        </div>
      ))}
    </div>
  );
}

export default function CombatPage() {
  const { id } = useParams();
  const { pushToast } = useToast();
  const { dictionaries } = useDictionaries();
  const [chronicle, setChronicle] = useState<ChronicleDto | null>(null);
  const [characters, setCharacters] = useState<CharacterSummaryDto[]>([]);
  const [combat, setCombat] = useState<CombatStateDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [enemyName, setEnemyName] = useState("");
  const [enemyDex, setEnemyDex] = useState(0);
  const [enemyWits, setEnemyWits] = useState(0);

  const logCombatEvent = async (payload: { type: string; message: string; data?: Record<string, unknown> }) => {
    if (!id) return;
    try {
      await api.post(`/chronicles/${id}/logs`, payload);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    if (!id) return;
    let active = true;
    async function load() {
      try {
        const [chronicleData, charactersData, combatData] = await Promise.all([
          api.get<ChronicleDto>(`/chronicles/${id}`),
          api.get<CharacterSummaryDto[]>(`/chronicles/${id}/characters`),
          api.get<CombatStateDto>(`/chronicles/${id}/combat`)
        ]);
        if (!active) return;
        setChronicle(chronicleData);
        setCharacters(charactersData);
        setCombat(combatData);
      } catch (err: any) {
        pushToast(err?.message ?? "Не удалось загрузить бой", "error");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [id, pushToast]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const refreshCombat = async () => {
      try {
        const combatData = await api.get<CombatStateDto>(`/chronicles/${id}/combat`);
        if (active) setCombat(combatData);
      } catch {
        // silent
      }
    };
    const interval = window.setInterval(refreshCombat, 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [id]);

  const participants = useMemo<Participant[]>(() => {
    if (!combat?.active) {
      return [];
    }
    const initiatives = combat?.initiatives ?? {};
    const characterEntries: Participant[] = characters
      .filter((character) => character.creationFinished)
      .map((character) => {
        const name = character.meta?.name?.trim() || "(Без имени)";
        const playerName = character.meta?.playerName?.trim() || "Неизвестный игрок";
        const clanLabel =
          dictionaries.clans.find((item) => item.key === character.meta?.clanKey)?.labelRu || "—";
        const dexterity = totalFor(character.traits?.attributes?.dexterity);
        const wits = totalFor(character.traits?.attributes?.wits);
        const health = character.resources?.health ?? { bashing: 0, lethal: 0, aggravated: 0 };
        const woundMod = woundPenalty(health.bashing + health.lethal + health.aggravated);
        return {
          type: "character",
          id: character.uuid,
          name,
          avatarUrl: character.meta?.avatarUrl,
          playerName,
          clanLabel,
          generation: character.meta?.generation ?? null,
          health,
          dexterity,
          wits,
          woundMod,
          initiative: initiatives?.[character.uuid],
          creationFinished: character.creationFinished
        };
      });
    const enemyEntries: Participant[] =
      combat?.enemies?.map((enemy) => {
        const health = enemy.health ?? { bashing: 0, lethal: 0, aggravated: 0 };
        const woundMod = woundPenalty(health.bashing + health.lethal + health.aggravated);
        return {
          type: "enemy",
          id: enemy._id,
          name: enemy.name,
          dexterity: enemy.dexterity ?? 0,
          wits: enemy.wits ?? 0,
          health,
          woundMod,
          initiative: enemy.initiative,
          dead: enemy.dead ?? false
        };
      }) ?? [];

    const all = [...characterEntries, ...enemyEntries];
    return all.sort((a, b) => {
      const aInit = a.initiative?.total ?? -Infinity;
      const bInit = b.initiative?.total ?? -Infinity;
      if (aInit !== bInit) return bInit - aInit;
      const aBase = a.initiative?.base ?? a.dexterity + a.wits;
      const bBase = b.initiative?.base ?? b.dexterity + b.wits;
      if (aBase !== bBase) return bBase - aBase;
      return a.name.localeCompare(b.name, "ru");
    });
  }, [characters, combat, dictionaries]);

  const isActive = combat?.active ?? false;

  const rollInitiative = (dexterity: number, wits: number, woundMod = 0): CombatInitiativeDto => {
    const base = dexterity + wits;
    const roll = 1 + Math.floor(Math.random() * 10);
    return {
      dexterity,
      wits,
      base,
      roll,
      total: base + roll + woundMod
    };
  };

  const handleCharacterInitiative = async (participant: Participant) => {
    if (participant.type !== "character" || !id) return;
    const initiative = rollInitiative(participant.dexterity, participant.wits, participant.woundMod);
    try {
      const result = await api.post<{ characterUuid: string; initiative: CombatInitiativeDto }>(
        `/chronicles/${id}/combat/initiative`,
        { characterUuid: participant.id, initiative }
      );
      setCombat((prev) =>
        prev
          ? {
              ...prev,
              initiatives: { ...(prev.initiatives ?? {}), [result.characterUuid]: result.initiative }
            }
          : prev
      );
    } catch (err: any) {
      pushToast(err?.message ?? "Не удалось бросить инициативу", "error");
    }
  };

  const handleEnemyInitiative = async (
    enemyId: string,
    enemyName: string,
    dexterity: number,
    wits: number,
    woundMod = 0
  ) => {
    if (!id) return;
    const initiative = rollInitiative(dexterity ?? 0, wits ?? 0, woundMod);
    try {
      const updated = await api.patch<CombatEnemyDto>(
        `/chronicles/${id}/combat/enemies/${enemyId}`,
        { initiative }
      );
      setCombat((prev) =>
        prev
          ? {
              ...prev,
              enemies: prev.enemies.map((item) => (item._id === updated._id ? updated : item))
            }
          : prev
      );
      logCombatEvent({
        type: "combat_enemy_initiative",
        message: `Враг ${enemyName}, бросил инициативу: Ловкость ${initiative.dexterity} + Смекалка ${initiative.wits} + d10(${initiative.roll})${woundMod ? ` + штраф ранений ${woundMod}` : ""} = ${initiative.total}.`,
        data: { enemyId, enemyName, initiative, woundMod }
      });
    } catch (err: any) {
      pushToast(err?.message ?? "Не удалось бросить инициативу", "error");
    }
  };

  const handleEnemyHealth = async (
    enemyId: string,
    enemyName: string,
    current: { bashing: number; lethal: number; aggravated: number },
    field: "bashing" | "lethal" | "aggravated",
    delta: number
  ) => {
    if (!id) return;
    const next = clampHealth({
      ...current,
      [field]: (current?.[field] ?? 0) + delta
    });
    try {
      const updated = await api.patch<CombatEnemyDto>(
        `/chronicles/${id}/combat/enemies/${enemyId}`,
        { health: next }
      );
      setCombat((prev) =>
        prev
          ? {
              ...prev,
              enemies: prev.enemies.map((item) => (item._id === updated._id ? updated : item))
            }
          : prev
      );
      const deltas = {
        bashing: next.bashing - current.bashing,
        lethal: next.lethal - current.lethal,
        aggravated: next.aggravated - current.aggravated
      };
      const typeLabels: Record<string, string> = {
        bashing: "ударный",
        lethal: "летальный",
        aggravated: "агравированный"
      };
      (Object.keys(deltas) as Array<keyof typeof deltas>).forEach((key) => {
        const change = deltas[key];
        if (change === 0) return;
        const kind = change > 0 ? "damage" : "heal";
        const amount = Math.abs(change);
        const typeLabel = typeLabels[key] ?? key;
        const actionLabel = kind === "damage" ? "получил урон" : "вылечил урон";
        logCombatEvent({
          type: kind === "damage" ? "combat_enemy_damage" : "combat_enemy_heal",
          message: `Враг ${enemyName} ${actionLabel} типа ${typeLabel}: ${amount}.`,
          data: { enemyId, enemyName, kind, damageType: key, amount }
        });
      });
    } catch (err: any) {
      pushToast(err?.message ?? "Не удалось обновить урон", "error");
    }
  };

  const toggleEnemyDead = async (enemyId: string, enemyName: string, dead: boolean) => {
    if (!id) return;
    try {
      const updated = await api.patch<CombatEnemyDto>(
        `/chronicles/${id}/combat/enemies/${enemyId}`,
        { dead: !dead }
      );
      setCombat((prev) =>
        prev
          ? {
              ...prev,
              enemies: prev.enemies.map((item) => (item._id === updated._id ? updated : item))
            }
          : prev
      );
      logCombatEvent({
        type: "combat_enemy_status",
        message: `Враг ${enemyName} ${updated.dead ? "погиб" : "воскрес"}.`,
        data: { enemyId, enemyName, dead: updated.dead }
      });
    } catch (err: any) {
      pushToast(err?.message ?? "Не удалось обновить статус", "error");
    }
  };

  const handleAddEnemy = async () => {
    if (!id) return;
    const name = enemyName.trim();
    if (!name) {
      pushToast("Имя противника обязательно", "error");
      return;
    }
    try {
      const enemy = await api.post<CombatEnemyDto>(`/chronicles/${id}/combat/enemies`, {
        name,
        dexterity: enemyDex,
        wits: enemyWits
      });
      setCombat((prev) =>
        prev ? { ...prev, enemies: [enemy, ...(prev.enemies ?? [])] } : prev
      );
      setEnemyName("");
      setEnemyDex(0);
      setEnemyWits(0);
    } catch (err: any) {
      pushToast(err?.message ?? "Не удалось добавить противника", "error");
    }
  };

  const handleEndCombat = async () => {
    if (!id) return;
    try {
      await api.del(`/chronicles/${id}/combat`);
      setCombat((prev) =>
        prev ? { ...prev, initiatives: {}, enemies: [], active: false } : prev
      );
      pushToast("Бой завершён", "success");
    } catch (err: any) {
      pushToast(err?.message ?? "Не удалось завершить бой", "error");
    }
  };

  const handleStartCombat = async () => {
    if (!id) return;
    try {
      const started = await api.post<CombatStateDto>(`/chronicles/${id}/combat/start`);
      setCombat(started);
      pushToast("Бой начался", "success");
    } catch (err: any) {
      pushToast(err?.message ?? "Не удалось начать бой", "error");
    }
  };

  if (loading) {
    return (
      <section className="page">
        <h1>Бой</h1>
        <p>Загрузка…</p>
      </section>
    );
  }

  if (!chronicle) {
    return (
      <section className="page">
        <h1>Бой</h1>
        <p>Хроника не найдена.</p>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="card">
        <div className="card-header">
          <div className="card-header-main">
            <div className="section-title">Бой: {chronicle.name}</div>
            <div className="step-counter">Участников: {participants.length}</div>
          </div>
          <div className="page-actions header-actions">
            <Link className="icon-button" to={`/chronicles/${chronicle._id}`} title="Назад">
              ←
            </Link>
            <button
              type="button"
              className="icon-button danger"
              title="Закончить бой"
              aria-label="Закончить бой"
              onClick={handleEndCombat}
              disabled={!isActive}
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {!isActive && (
        <div className="card">
          <div className="section-title">Бой не начат</div>
          <div className="page-actions">
            <button type="button" className="primary" onClick={handleStartCombat}>
              Начать бой
            </button>
          </div>
        </div>
      )}

      {isActive && (
        <>
      <div className="card">
        <div className="section-title">Добавить противника</div>
        <div className="combat-add">
          <label className="field">
            <span>Имя</span>
            <input value={enemyName} onChange={(event) => setEnemyName(event.target.value)} />
          </label>
          <label className="field">
            <span>Ловкость</span>
            <input
              type="number"
              min={0}
              max={10}
              value={enemyDex}
              onChange={(event) => setEnemyDex(Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Смекалка</span>
            <input
              type="number"
              min={0}
              max={10}
              value={enemyWits}
              onChange={(event) => setEnemyWits(Number(event.target.value))}
            />
          </label>
          <button type="button" className="primary" onClick={handleAddEnemy}>
            Добавить
          </button>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Инициатива и здоровье</div>
        <div className="combat-list">
          {participants.map((participant) => {
            const isEnemy = participant.type === "enemy";
            const isDead = participant.type === "enemy" ? participant.dead : false;
            const initiative = participant.initiative;
            const initiativeLabel = initiative ? initiative.total : "—";
            const woundLabel = participant.woundMod ? ` + штраф ранений ${participant.woundMod}` : "";
            const initiativeMeta = initiative
              ? `${initiative.base} + d10(${initiative.roll})${woundLabel}`
              : `Ловкость + Смекалка${woundLabel}`;

            const avatarLetter =
              participant.name && participant.name !== "(Без имени)"
                ? participant.name.trim().charAt(0).toUpperCase()
                : "—";

            return (
              <div
                key={`${participant.type}-${participant.id}`}
                className={`combat-entry ${isEnemy ? "enemy" : "character"} ${
                  isDead ? "dead" : ""
                }`}
              >
                <div className="combat-entry-main">
                  {participant.type === "character" ? (
                    <Link to={`/c/${participant.id}`} className="combat-link">
                      {participant.avatarUrl ? (
                        <img
                          className="combat-avatar"
                          src={participant.avatarUrl}
                          alt={participant.name}
                        />
                      ) : (
                        <span className="combat-avatar placeholder">{avatarLetter}</span>
                      )}
                    </Link>
                  ) : (
                    <span className="combat-avatar placeholder">⚔️</span>
                  )}
                  <div className="combat-entry-title">
                    <div className="combat-entry-name">
                      {participant.type === "character" ? (
                        <Link to={`/c/${participant.id}`} className="combat-link">
                          {participant.name}
                        </Link>
                      ) : (
                        participant.name
                      )}
                      {participant.type === "character" && !participant.creationFinished && (
                        <span className="tag">Черновик ✦</span>
                      )}
                      {participant.type === "enemy" && (
                        <span className="tag">Враг</span>
                      )}
                      {participant.type === "enemy" && participant.dead && (
                        <span className="tag">Погиб</span>
                      )}
                    </div>
                    {participant.type === "character" ? (
                      <div className="combat-entry-sub">
                        Игрок: {participant.playerName} · Клан: {participant.clanLabel}
                        {participant.generation ? ` · Поколение ${participant.generation}` : ""}
                      </div>
                    ) : (
                      <div className="combat-entry-sub">Ловк {participant.dexterity} · Смек {participant.wits}</div>
                    )}
                  </div>
                </div>
                <div className="combat-entry-actions">
                  <div className="combat-initiative">
                    <div className="combat-initiative-value">{initiativeLabel}</div>
                    <div className="combat-initiative-meta">{initiativeMeta}</div>
                    {participant.type === "character" ? (
                      <button
                        type="button"
                        className="icon-button initiative-roll-button"
                        onClick={() => handleCharacterInitiative(participant)}
                        title="Бросить"
                        aria-label="Бросить"
                      >
                        ⚡
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="icon-button initiative-roll-button"
                        onClick={() =>
                          handleEnemyInitiative(
                            participant.id,
                            participant.name,
                            participant.dexterity,
                            participant.wits,
                            participant.woundMod
                          )
                        }
                        title="Бросить"
                        aria-label="Бросить"
                      >
                        ⚡
                      </button>
                    )}
                  </div>

                  <div className="combat-health">
                    {participant.type === "character" ? (
                      <HealthTrackDisplay health={participant.health} />
                    ) : (
                      <div className="combat-enemy-health">
                        <HealthTrackDisplay health={participant.health} />
                        <div className="combat-enemy-actions">
                          <button
                            type="button"
                            className="health-action-mini"
                            onClick={() =>
                              handleEnemyHealth(
                                participant.id,
                                participant.name,
                                participant.health,
                                "bashing",
                                1
                              )
                            }
                          >
                            +👊
                          </button>
                          <button
                            type="button"
                            className="health-action-mini"
                            onClick={() =>
                              handleEnemyHealth(
                                participant.id,
                                participant.name,
                                participant.health,
                                "bashing",
                                -1
                              )
                            }
                          >
                            -👊
                          </button>
                          <button
                            type="button"
                            className="health-action-mini"
                            onClick={() =>
                              handleEnemyHealth(
                                participant.id,
                                participant.name,
                                participant.health,
                                "lethal",
                                1
                              )
                            }
                          >
                            +🔪
                          </button>
                          <button
                            type="button"
                            className="health-action-mini"
                            onClick={() =>
                              handleEnemyHealth(
                                participant.id,
                                participant.name,
                                participant.health,
                                "lethal",
                                -1
                              )
                            }
                          >
                            -🔪
                          </button>
                          <button
                            type="button"
                            className="health-action-mini"
                            onClick={() =>
                              handleEnemyHealth(
                                participant.id,
                                participant.name,
                                participant.health,
                                "aggravated",
                                1
                              )
                            }
                          >
                            +🐾
                          </button>
                          <button
                            type="button"
                            className="health-action-mini"
                            onClick={() =>
                              handleEnemyHealth(
                                participant.id,
                                participant.name,
                                participant.health,
                                "aggravated",
                                -1
                              )
                            }
                          >
                            -🐾
                          </button>
                          <button
                            type="button"
                            className="health-action-mini danger"
                            onClick={() =>
                              toggleEnemyDead(participant.id, participant.name, participant.dead)
                            }
                          >
                            {participant.dead ? "Вернуть" : "Погиб"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {participants.length === 0 && <div className="combat-empty">Пока нет участников.</div>}
        </div>
      </div>
        </>
      )}
    </section>
  );
}
















