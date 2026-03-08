import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { CharacterDto, ChronicleDto, DictItem } from "../api/types";
import { useDictionaries } from "../context/DictionariesContext";
import { useToast } from "../context/ToastContext";
import { useCharacterSocket } from "../hooks/useCharacterSocket";
import { setByPath } from "../utils/setByPath";
import NotFound from "./NotFound";

type TraitEntry = {
  key: string;
  label: string;
  layer: { base: number; freebie: number; storyteller: number };
  min: number;
  max: number;
  disabled?: boolean;
  path: string;
};

function DotsDisplay({
  total,
  max
}: {
  total: number;
  max: number;
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

export default function StorytellerPage() {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { dictionaries } = useDictionaries();
  const { pushToast } = useToast();
  const [character, setCharacter] = useState<CharacterDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [chronicle, setChronicle] = useState<ChronicleDto | null>(null);
  const [chronicles, setChronicles] = useState<ChronicleDto[]>([]);

  const fetchCharacter = useCallback(async () => {
    if (!uuid) return;
    try {
      const data = await api.get<CharacterDto>(`/characters/${uuid}`);
      setCharacter(data);
      setNotFound(false);
    } catch (err: any) {
      if (err?.status === 404) {
        setNotFound(true);
      } else {
        pushToast(err?.message ?? "Не удалось загрузить персонажа", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [uuid, pushToast]);

  useEffect(() => {
    fetchCharacter();
  }, [fetchCharacter]);

  useEffect(() => {
    let active = true;
    api
      .get<ChronicleDto[]>("/chronicles")
      .then((items) => {
        if (active) setChronicles(items);
      })
      .catch(() => {
        if (active) setChronicles([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const chronicleId = character?.meta?.chronicleId;
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
  }, [character?.meta?.chronicleId]);

  const applyLocalPatch = useCallback((path: string, value: unknown) => {
    setCharacter((prev) => (prev ? setByPath(prev, path, value) : prev));
  }, []);

  const { sendPatch } = useCharacterSocket(uuid, {
    currentVersion: character?.version,
    onPatchApplied: (payload) => {
      setCharacter((prev) => {
        if (!prev) return prev;
        const next = setByPath(prev, payload.path, payload.value);
        return { ...next, version: payload.version };
      });
    },
    onResync: (payload) => {
      if (payload?.reason === "rollback") {
        pushToast("Часть свободных очков была откатана из-за изменения бюджета", "info");
      } else {
        pushToast("Данные обновлены", "info");
      }
      fetchCharacter();
    },
    onReject: (errors) => {
      pushToast(errors?.[0]?.message ?? "Изменение отклонено", "error");
      fetchCharacter();
    }
  });

  const handlePatch = useCallback(
    (path: string, value: unknown) => {
      if (!character || !uuid) return;
      applyLocalPatch(path, value);
      sendPatch({ characterUuid: uuid, op: "set", path, value });
    },
    [applyLocalPatch, character, sendPatch, uuid]
  );

  const handleDelete = async () => {
    if (!uuid) return;
    const confirmed = window.confirm("Удалить персонажа?");
    if (!confirmed) return;
    try {
      await api.del(`/characters/${uuid}`);
      pushToast("Персонаж удалён", "success");
      navigate("/");
    } catch (err: any) {
      pushToast(err?.message ?? "Не удалось удалить персонажа", "error");
    }
  };

  const clanOptions = dictionaries.clans;
  const currentClan = character?.meta?.clanKey || "";
  const clan = clanOptions.find((item) => item.key === currentClan);

  const buildEntries = useMemo(() => {
    if (!character) {
      return {
        attributes: [] as TraitEntry[],
        abilities: [] as TraitEntry[],
        disciplines: [] as TraitEntry[],
        backgrounds: [] as TraitEntry[],
        virtues: [] as TraitEntry[]
      };
    }

    const buildGroup = (
      items: DictItem[],
      record: Record<string, { base: number; freebie: number; storyteller: number }>,
      min: number,
      max: number,
      category: string,
      disablePredicate?: (item: DictItem) => boolean
    ) =>
      items.map((item) => ({
          key: item.key,
          label: item.labelRu,
          layer: record[item.key] || { base: 0, freebie: 0, storyteller: 0 },
          min,
          max,
          disabled: disablePredicate?.(item),
          path: `traits.${category}.${item.key}.storyteller`
      }));

    const appearanceFixed = clan?.rules?.appearanceFixedTo === 0;
    return {
      attributes: buildGroup(dictionaries.attributes, character.traits.attributes, 1, 5, "attributes", (item) =>
        item.key === "appearance" && appearanceFixed
      ),
      abilities: buildGroup(dictionaries.abilities, character.traits.abilities, 0, 5, "abilities"),
      disciplines: buildGroup(
        dictionaries.disciplines,
        character.traits.disciplines,
        0,
        5,
        "disciplines"
      ),
      backgrounds: buildGroup(dictionaries.backgrounds, character.traits.backgrounds, 0, 5, "backgrounds"),
      virtues: buildGroup(dictionaries.virtues, character.traits.virtues, 1, 5, "virtues")
    };
  }, [character, dictionaries, clan]);

  const handleAdjust = (entry: TraitEntry, delta: number) => {
    if (!entry.layer) return;
    const baseTotal = entry.layer.base + entry.layer.freebie;
    const currentTotal = baseTotal + entry.layer.storyteller;
    let desiredTotal = currentTotal + delta;
    if (entry.key === "appearance" && clan?.rules?.appearanceFixedTo === 0) {
      desiredTotal = 0;
    }
    desiredTotal = Math.min(entry.max, Math.max(entry.min, desiredTotal));
    const storyteller = desiredTotal - baseTotal;
    handlePatch(entry.path, storyteller);
  };

  if (loading) {
    return (
      <section className="page">
        <h1>Режим ведущего</h1>
        <p>Загрузка…</p>
      </section>
    );
  }

  if (notFound || !character) {
    return <NotFound />;
  }

  return (
    <section className="page">
      <div className="card">
        <div className="card-header st-header">
          <div className="card-header-main">
            <div className="section-title">Режим ведущего</div>
            <div className="st-meta">
              <span>Персонаж: {character.meta.name?.trim() || "(Без имени)"}</span>
              <span>Игрок: {character.meta.playerName?.trim() || "—"}</span>
              <span>Хроника: {chronicle?.name || "—"}</span>
            </div>
          </div>
          <div className="page-actions header-actions">
            <button
              type="button"
              className="icon-button danger"
              title="Удалить персонажа"
              aria-label="Удалить персонажа"
              onClick={handleDelete}
            >
              🗑
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="grid-2">
          <div className="field">
            <label>Клан</label>
            <select value={currentClan} onChange={(event) => handlePatch("meta.clanKey", event.target.value)}>
              <option value="">Выберите клан</option>
              {clanOptions.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.labelRu}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Хроника</label>
            <select
              value={character.meta.chronicleId}
              onChange={(event) => handlePatch("meta.chronicleId", event.target.value)}
            >
              <option value="">Выберите хронику</option>
              {chronicles.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Характеристики</div>
        <div className="st-grid">
          <div className="wizard-attr-card">
            <div className="wizard-attr-card-header">
              <span>Атрибуты</span>
            </div>
            <div className="wizard-attr-list">
              {buildEntries.attributes.map((entry) => {
                const total = entry.layer.base + entry.layer.freebie + entry.layer.storyteller;
                return (
                  <div key={entry.path} className="wizard-attr-item">
                    <div className={`wizard-attr-row st-row ${entry.disabled ? "disabled" : ""}`}>
                      <span>{entry.label}</span>
                      <DotsDisplay total={total} max={entry.max} />
                      <div className="st-actions">
                        <button
                          type="button"
                          disabled={entry.disabled}
                          onClick={() => handleAdjust(entry, -1)}
                        >
                          -
                        </button>
                        <button
                          type="button"
                          disabled={entry.disabled}
                          onClick={() => handleAdjust(entry, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="wizard-attr-card">
            <div className="wizard-attr-card-header">
              <span>Способности</span>
            </div>
            <div className="wizard-attr-list">
              {buildEntries.abilities.map((entry) => {
                const total = entry.layer.base + entry.layer.freebie + entry.layer.storyteller;
                return (
                  <div key={entry.path} className="wizard-attr-item">
                    <div className={`wizard-attr-row st-row ${entry.disabled ? "disabled" : ""}`}>
                      <span>{entry.label}</span>
                      <DotsDisplay total={total} max={entry.max} />
                      <div className="st-actions">
                        <button
                          type="button"
                          disabled={entry.disabled}
                          onClick={() => handleAdjust(entry, -1)}
                        >
                          -
                        </button>
                        <button
                          type="button"
                          disabled={entry.disabled}
                          onClick={() => handleAdjust(entry, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="wizard-attr-card">
            <div className="wizard-attr-card-header">
              <span>Дисциплины</span>
            </div>
            <div className="wizard-attr-list">
              {buildEntries.disciplines.map((entry) => {
                const total = entry.layer.base + entry.layer.freebie + entry.layer.storyteller;
                return (
                  <div key={entry.path} className="wizard-attr-item">
                    <div className={`wizard-attr-row st-row ${entry.disabled ? "disabled" : ""}`}>
                      <span>{entry.label}</span>
                      <DotsDisplay total={total} max={entry.max} />
                      <div className="st-actions">
                        <button
                          type="button"
                          disabled={entry.disabled}
                          onClick={() => handleAdjust(entry, -1)}
                        >
                          -
                        </button>
                        <button
                          type="button"
                          disabled={entry.disabled}
                          onClick={() => handleAdjust(entry, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="wizard-attr-card">
            <div className="wizard-attr-card-header">
              <span>Детали биографии</span>
            </div>
            <div className="wizard-attr-list">
              {buildEntries.backgrounds.map((entry) => {
                const total = entry.layer.base + entry.layer.freebie + entry.layer.storyteller;
                return (
                  <div key={entry.path} className="wizard-attr-item">
                    <div className={`wizard-attr-row st-row ${entry.disabled ? "disabled" : ""}`}>
                      <span>{entry.label}</span>
                      <DotsDisplay total={total} max={entry.max} />
                      <div className="st-actions">
                        <button
                          type="button"
                          disabled={entry.disabled}
                          onClick={() => handleAdjust(entry, -1)}
                        >
                          -
                        </button>
                        <button
                          type="button"
                          disabled={entry.disabled}
                          onClick={() => handleAdjust(entry, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="wizard-attr-card">
            <div className="wizard-attr-card-header">
              <span>Добродетели</span>
            </div>
            <div className="wizard-attr-list">
              {buildEntries.virtues.map((entry) => {
                const total = entry.layer.base + entry.layer.freebie + entry.layer.storyteller;
                return (
                  <div key={entry.path} className="wizard-attr-item">
                    <div className={`wizard-attr-row st-row ${entry.disabled ? "disabled" : ""}`}>
                      <span>{entry.label}</span>
                      <DotsDisplay total={total} max={entry.max} />
                      <div className="st-actions">
                        <button
                          type="button"
                          disabled={entry.disabled}
                          onClick={() => handleAdjust(entry, -1)}
                        >
                          -
                        </button>
                        <button
                          type="button"
                          disabled={entry.disabled}
                          onClick={() => handleAdjust(entry, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
