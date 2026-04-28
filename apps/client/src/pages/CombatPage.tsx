import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type {
  CharacterSummaryDto,
  ChronicleDto,
  ChronicleNpcDto,
  CombatInitiativeDto,
  CombatNpcDto,
  CombatStateDto,
  LayeredValue
} from "../api/types";
import { NpcPickerModal } from "../components/NpcPickerModal";
import { useAuth } from "../context/AuthContext";
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
      type: "npc";
      id: string;
      npcId: string;
      name: string;
      avatarUrl?: string;
      clanLabel: string;
      sectLabel: string;
      generation?: number | null;
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

function HealthTrackDisplay({
  health
}: {
  health: { bashing: number; lethal: number; aggravated: number };
}) {
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
  const { user } = useAuth();
  const { pushToast } = useToast();
  const { dictionaries } = useDictionaries();
  const [chronicle, setChronicle] = useState<ChronicleDto | null>(null);
  const [characters, setCharacters] = useState<CharacterSummaryDto[]>([]);
  const [combat, setCombat] = useState<CombatStateDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [npcModalOpen, setNpcModalOpen] = useState(false);
  const [chronicleNpcs, setChronicleNpcs] = useState<ChronicleNpcDto[]>([]);
  const [npcSearch, setNpcSearch] = useState("");
  const deferredNpcSearch = useDeferredValue(npcSearch);
  const [npcLoading, setNpcLoading] = useState(false);
  const [busyNpcId, setBusyNpcId] = useState<string | null>(null);

  const logCombatEvent = async (payload: {
    type: string;
    message: string;
    data?: Record<string, unknown>;
  }) => {
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
    void load();
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

  const isChronicleAuthor =
    chronicle && user ? String(chronicle.createdByUserId ?? "") === user.id : false;

  useEffect(() => {
    if (!id || !isChronicleAuthor || !npcModalOpen) {
      setChronicleNpcs([]);
      setNpcLoading(false);
      return;
    }

    let active = true;

    async function loadChronicleNpcs() {
      setNpcLoading(true);
      try {
        const query = deferredNpcSearch.trim();
        const path = query
          ? `/chronicles/${id}/npcs?search=${encodeURIComponent(query)}`
          : `/chronicles/${id}/npcs`;
        const data = await api.get<ChronicleNpcDto[]>(path);
        if (!active) return;
        setChronicleNpcs(data);
      } catch (err: any) {
        if (!active) return;
        pushToast(err?.message ?? "Не удалось загрузить NPC хроники", "error");
      } finally {
        if (active) {
          setNpcLoading(false);
        }
      }
    }

    void loadChronicleNpcs();
    return () => {
      active = false;
    };
  }, [deferredNpcSearch, id, isChronicleAuthor, npcModalOpen, pushToast]);

  const participants = useMemo<Participant[]>(() => {
    if (!combat?.active) {
      return [];
    }
    const initiatives = combat.initiatives ?? {};
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
          initiative: initiatives[character.uuid],
          creationFinished: character.creationFinished
        };
      });

    const npcEntries: Participant[] = combat.npcs.map((npc) => {
      const health = npc.health ?? { bashing: 0, lethal: 0, aggravated: 0 };
      const woundMod = woundPenalty(health.bashing + health.lethal + health.aggravated);
      return {
        type: "npc",
        id: npc._id,
        npcId: npc.npcId,
        name: npc.displayName,
        avatarUrl: npc.avatarUrl,
        clanLabel:
          dictionaries.clans.find((item) => item.key === npc.clanKey)?.labelRu || "",
        sectLabel:
          dictionaries.sects.find((item) => item.key === npc.sectKey)?.labelRu || "",
        generation: npc.generation ?? null,
        dexterity: npc.dexterity ?? 0,
        wits: npc.wits ?? 0,
        health,
        woundMod,
        initiative: npc.initiative,
        dead: npc.dead ?? false
      };
    });

    return [...characterEntries, ...npcEntries].sort((a, b) => {
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

  const rollInitiative = (
    dexterity: number,
    wits: number,
    woundMod = 0
  ): CombatInitiativeDto => {
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
              initiatives: {
                ...(prev.initiatives ?? {}),
                [result.characterUuid]: result.initiative
              }
            }
          : prev
      );
    } catch (err: any) {
      pushToast(err?.message ?? "Не удалось бросить инициативу", "error");
    }
  };

  const updateNpcInCombat = (updated: CombatNpcDto) => {
    setCombat((prev) =>
      prev
        ? {
            ...prev,
            npcs: prev.npcs.map((item) => (item._id === updated._id ? updated : item))
          }
        : prev
    );
  };

  const handleNpcInitiative = async (participant: Extract<Participant, { type: "npc" }>) => {
    if (!id) return;
    const initiative = rollInitiative(participant.dexterity, participant.wits, participant.woundMod);
    try {
      const updated = await api.patch<CombatNpcDto>(
        `/chronicles/${id}/combat/npcs/${participant.id}`,
        { initiative }
      );
      updateNpcInCombat(updated);
      void logCombatEvent({
        type: "combat_npc_initiative",
        message: `NPC ${participant.name} бросил инициативу: Ловкость ${initiative.dexterity} + Смекалка ${initiative.wits} + d10(${initiative.roll})${participant.woundMod ? ` + штраф ранений ${participant.woundMod}` : ""} = ${initiative.total}.`,
        data: { combatNpcId: participant.id, npcId: participant.npcId, initiative }
      });
    } catch (err: any) {
      pushToast(err?.message ?? "Не удалось бросить инициативу", "error");
    }
  };

  const handleNpcHealth = async (
    participant: Extract<Participant, { type: "npc" }>,
    field: "bashing" | "lethal" | "aggravated",
    delta: number
  ) => {
    if (!id) return;
    const next = clampHealth({
      ...participant.health,
      [field]: (participant.health?.[field] ?? 0) + delta
    });
    try {
      const updated = await api.patch<CombatNpcDto>(
        `/chronicles/${id}/combat/npcs/${participant.id}`,
        { health: next }
      );
      updateNpcInCombat(updated);
      const amount = Math.abs(next[field] - participant.health[field]);
      if (amount > 0) {
        const kind = next[field] > participant.health[field] ? "damage" : "heal";
        void logCombatEvent({
          type: kind === "damage" ? "combat_npc_damage" : "combat_npc_heal",
          message: `NPC ${participant.name} ${kind === "damage" ? "получил урон" : "вылечил урон"}: ${amount}.`,
          data: { combatNpcId: participant.id, npcId: participant.npcId, field, amount, kind }
        });
      }
    } catch (err: any) {
      pushToast(err?.message ?? "Не удалось обновить здоровье NPC", "error");
    }
  };

  const toggleNpcDead = async (participant: Extract<Participant, { type: "npc" }>) => {
    if (!id) return;
    try {
      const updated = await api.patch<CombatNpcDto>(
        `/chronicles/${id}/combat/npcs/${participant.id}`,
        { dead: !participant.dead }
      );
      updateNpcInCombat(updated);
      void logCombatEvent({
        type: "combat_npc_status",
        message: `NPC ${participant.name} ${updated.dead ? "погиб" : "вернулся в строй"}.`,
        data: { combatNpcId: participant.id, npcId: participant.npcId, dead: updated.dead }
      });
    } catch (err: any) {
      pushToast(err?.message ?? "Не удалось обновить статус NPC", "error");
    }
  };

  const handleAddNpc = async (npcId: string) => {
    if (!id) return;
    setBusyNpcId(npcId);
    try {
      const created = await api.post<CombatNpcDto>(`/chronicles/${id}/combat/npcs`, { npcId });
      setCombat((prev) => (prev ? { ...prev, npcs: [...prev.npcs, created] } : prev));
      setNpcSearch("");
      setNpcModalOpen(false);
      pushToast("NPC добавлен в бой", "success");
    } catch (err: any) {
      pushToast(err?.message ?? "Не удалось добавить NPC в бой", "error");
    } finally {
      setBusyNpcId(null);
    }
  };

  const handleRemoveNpc = async (combatNpcId: string) => {
    if (!id) return;
    setBusyNpcId(combatNpcId);
    try {
      await api.del(`/chronicles/${id}/combat/npcs/${combatNpcId}`);
      setCombat((prev) =>
        prev ? { ...prev, npcs: prev.npcs.filter((item) => item._id !== combatNpcId) } : prev
      );
      pushToast("NPC убран из боя", "success");
    } catch (err: any) {
      pushToast(err?.message ?? "Не удалось убрать NPC из боя", "error");
    } finally {
      setBusyNpcId(null);
    }
  };

  const handleEndCombat = async () => {
    if (!id) return;
    try {
      await api.del(`/chronicles/${id}/combat`);
      setCombat((prev) =>
        prev ? { ...prev, initiatives: {}, npcs: [], active: false } : prev
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
          {isChronicleAuthor && (
            <div className="card">
              <div className="card-header">
                <div className="card-header-main">
                  <div className="section-title">NPC в бою</div>
                  <div className="st-meta">
                    <span>Только привязанные к хронике NPC</span>
                    <span>Каждое добавление создаёт snapshot-копию</span>
                  </div>
                </div>
                <div className="page-actions">
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      setNpcSearch("");
                      setNpcModalOpen(true);
                    }}
                  >
                    Добавить NPC в бой
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="section-title">Инициатива и здоровье</div>
            <div className="combat-list">
              {participants.map((participant) => {
                const isNpc = participant.type === "npc";
                const isDead = participant.type === "npc" ? participant.dead : false;
                const initiative = participant.initiative;
                const initiativeLabel = initiative ? initiative.total : "—";
                const woundLabel = participant.woundMod
                  ? ` + штраф ранений ${participant.woundMod}`
                  : "";
                const initiativeMeta = initiative
                  ? `${initiative.base} + d10(${initiative.roll})${woundLabel}`
                  : `Ловкость + Смекалка${woundLabel}`;

                const avatarLetter =
                  participant.name && participant.name !== "(Без имени)"
                    ? participant.name.trim().charAt(0).toUpperCase()
                    : "—";

                const npcMeta =
                  participant.type === "npc"
                    ? [participant.clanLabel, participant.sectLabel, participant.generation ? `Поколение ${participant.generation}` : ""]
                        .filter(Boolean)
                        .join(" · ")
                    : "";

                return (
                  <div
                    key={`${participant.type}-${participant.id}`}
                    className={`combat-entry ${isNpc ? "enemy" : "character"} ${isDead ? "dead" : ""}`}
                  >
                    <div className="combat-entry-main">
                      {participant.type === "character" ? (
                        <Link to={`/c/${participant.id}`} className="combat-link">
                          {participant.avatarUrl ? (
                            <img className="combat-avatar" src={participant.avatarUrl} alt={participant.name} />
                          ) : (
                            <span className="combat-avatar placeholder">{avatarLetter}</span>
                          )}
                        </Link>
                      ) : participant.avatarUrl ? (
                        <Link to={`/npcs/${participant.npcId}`} className="combat-link">
                          <img className="combat-avatar" src={participant.avatarUrl} alt={participant.name} />
                        </Link>
                      ) : (
                        <Link to={`/npcs/${participant.npcId}`} className="combat-link">
                          <span className="combat-avatar placeholder">{avatarLetter}</span>
                        </Link>
                      )}
                      <div className="combat-entry-title">
                        <div className="combat-entry-name">
                          {participant.type === "character" ? (
                            <Link to={`/c/${participant.id}`} className="combat-link">
                              {participant.name}
                            </Link>
                          ) : (
                            <Link to={`/npcs/${participant.npcId}`} className="combat-link">
                              {participant.name}
                            </Link>
                          )}
                          {participant.type === "character" && !participant.creationFinished && (
                            <span className="tag">Черновик ✦</span>
                          )}
                          {participant.type === "npc" && <span className="tag">NPC</span>}
                          {participant.type === "npc" && participant.dead && (
                            <span className="tag">Погиб</span>
                          )}
                        </div>
                        {participant.type === "character" ? (
                          <div className="combat-entry-sub">
                            Игрок: {participant.playerName} · Клан: {participant.clanLabel}
                            {participant.generation ? ` · Поколение ${participant.generation}` : ""}
                          </div>
                        ) : (
                          <div className="combat-entry-sub">
                            {npcMeta || "Без клана и секты"} · Ловк {participant.dexterity} · Смек {participant.wits}
                          </div>
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
                        ) : isChronicleAuthor ? (
                          <button
                            type="button"
                            className="icon-button initiative-roll-button"
                            onClick={() => handleNpcInitiative(participant)}
                            title="Бросить"
                            aria-label="Бросить"
                          >
                            ⚡
                          </button>
                        ) : null}
                      </div>

                      <div className="combat-health">
                        {participant.type === "character" ? (
                          <HealthTrackDisplay health={participant.health} />
                        ) : isChronicleAuthor ? (
                          <div className="combat-enemy-health">
                            <HealthTrackDisplay health={participant.health} />
                            <div className="combat-enemy-actions">
                              <button
                                type="button"
                                className="health-action-mini"
                                onClick={() => handleNpcHealth(participant, "bashing", 1)}
                              >
                                +👊
                              </button>
                              <button
                                type="button"
                                className="health-action-mini"
                                onClick={() => handleNpcHealth(participant, "bashing", -1)}
                              >
                                -👊
                              </button>
                              <button
                                type="button"
                                className="health-action-mini"
                                onClick={() => handleNpcHealth(participant, "lethal", 1)}
                              >
                                +🔪
                              </button>
                              <button
                                type="button"
                                className="health-action-mini"
                                onClick={() => handleNpcHealth(participant, "lethal", -1)}
                              >
                                -🔪
                              </button>
                              <button
                                type="button"
                                className="health-action-mini"
                                onClick={() => handleNpcHealth(participant, "aggravated", 1)}
                              >
                                +🐾
                              </button>
                              <button
                                type="button"
                                className="health-action-mini"
                                onClick={() => handleNpcHealth(participant, "aggravated", -1)}
                              >
                                -🐾
                              </button>
                              <button
                                type="button"
                                className="health-action-mini danger"
                                onClick={() => toggleNpcDead(participant)}
                              >
                                {participant.dead ? "Вернуть" : "Погиб"}
                              </button>
                              <button
                                type="button"
                                className="health-action-mini"
                                disabled={busyNpcId === participant.id}
                                onClick={() => handleRemoveNpc(participant.id)}
                              >
                                Убрать
                              </button>
                            </div>
                          </div>
                        ) : (
                          <HealthTrackDisplay health={participant.health} />
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

      <NpcPickerModal
        open={npcModalOpen}
        title="Добавить NPC в бой"
        search={npcSearch}
        loading={npcLoading}
        items={chronicleNpcs}
        emptyState="Нет NPC, привязанных к этой хронике."
        actionLabel="Добавить"
        busyNpcId={busyNpcId}
        onClose={() => setNpcModalOpen(false)}
        onSearchChange={setNpcSearch}
        onPick={handleAddNpc}
      />
    </section>
  );
}
