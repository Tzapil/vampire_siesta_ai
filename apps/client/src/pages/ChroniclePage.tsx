import { useDeferredValue, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type {
  CharacterDto,
  CharacterSummaryDto,
  ChronicleDto,
  ChronicleImageDto,
  ChronicleLogDto,
  ChronicleNpcDto,
  CombatStateDto,
  NpcSummaryDto
} from "../api/types";
import { NpcPickerModal } from "../components/NpcPickerModal";
import { useAuth } from "../context/AuthContext";
import { useDictionaries } from "../context/DictionariesContext";
import { useToast } from "../context/ToastContext";
import { getNpcFallbackLetter, getNpcMetaSubtitle } from "../utils/npc";

function sortByName<T>(items: T[], getName: (item: T) => string | undefined) {
  return [...items].sort((a, b) => {
    const nameA = (getName(a) ?? "").trim();
    const nameB = (getName(b) ?? "").trim();
    if (!nameA && !nameB) return 0;
    if (!nameA) return 1;
    if (!nameB) return -1;
    return nameA.localeCompare(nameB, "ru");
  });
}

export default function ChroniclePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chronicle, setChronicle] = useState<ChronicleDto | null>(null);
  const [characters, setCharacters] = useState<CharacterSummaryDto[]>([]);
  const [logs, setLogs] = useState<ChronicleLogDto[]>([]);
  const [images, setImages] = useState<ChronicleImageDto[]>([]);
  const [selectedImage, setSelectedImage] = useState<ChronicleImageDto | null>(null);
  const [combat, setCombat] = useState<CombatStateDto | null>(null);
  const [chronicleNpcs, setChronicleNpcs] = useState<ChronicleNpcDto[]>([]);
  const [availableNpcs, setAvailableNpcs] = useState<NpcSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [npcLoading, setNpcLoading] = useState(false);
  const [availableNpcLoading, setAvailableNpcLoading] = useState(false);
  const [npcSearch, setNpcSearch] = useState("");
  const [availableNpcSearch, setAvailableNpcSearch] = useState("");
  const [npcModalOpen, setNpcModalOpen] = useState(false);
  const [busyNpcId, setBusyNpcId] = useState<string | null>(null);
  const deferredNpcSearch = useDeferredValue(npcSearch);
  const deferredAvailableNpcSearch = useDeferredValue(availableNpcSearch);
  const { pushToast } = useToast();
  const { dictionaries } = useDictionaries();
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    async function load() {
      try {
        const [chronicleData, charactersData, logsData, imagesData, combatData] = await Promise.all([
          api.get<ChronicleDto>(`/chronicles/${id}`),
          api.get<CharacterSummaryDto[]>(`/chronicles/${id}/characters`),
          api.get<ChronicleLogDto[]>(`/chronicles/${id}/logs?limit=50`),
          api.get<ChronicleImageDto[]>(`/chronicles/${id}/images`),
          api.get<CombatStateDto>(`/chronicles/${id}/combat`)
        ]);
        if (!active) return;
        setChronicle(chronicleData);
        setCharacters(charactersData);
        setLogs(
          [...logsData].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
        setImages(
          [...imagesData].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
        setCombat(combatData);
      } catch (err: any) {
        pushToast(err?.message ?? "Не удалось загрузить хронику", "error");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [id, pushToast]);

  const isChronicleAuthor =
    chronicle && user ? String(chronicle.createdByUserId ?? "") === user.id : false;

  useEffect(() => {
    if (!id || !isChronicleAuthor) {
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
  }, [deferredNpcSearch, id, isChronicleAuthor, pushToast]);

  useEffect(() => {
    if (!id || !isChronicleAuthor || !npcModalOpen) {
      setAvailableNpcs([]);
      setAvailableNpcLoading(false);
      return;
    }

    let active = true;

    async function loadAvailableNpcs() {
      setAvailableNpcLoading(true);
      try {
        const query = deferredAvailableNpcSearch.trim();
        const path = query
          ? `/chronicles/${id}/npcs/available?search=${encodeURIComponent(query)}`
          : `/chronicles/${id}/npcs/available`;
        const data = await api.get<NpcSummaryDto[]>(path);
        if (!active) return;
        setAvailableNpcs(data);
      } catch (err: any) {
        if (!active) return;
        pushToast(err?.message ?? "Не удалось загрузить доступных NPC", "error");
      } finally {
        if (active) {
          setAvailableNpcLoading(false);
        }
      }
    }

    void loadAvailableNpcs();
    return () => {
      active = false;
    };
  }, [deferredAvailableNpcSearch, id, isChronicleAuthor, npcModalOpen, pushToast]);

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

  const handleImageFile = (file?: File | null) => {
    if (!file || !id) return;
    const maxBytes = 5_000_000;
    if (file.size > maxBytes) {
      pushToast("Файл слишком большой (макс. 5 МБ)", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        pushToast("Не удалось прочитать файл", "error");
        return;
      }
      try {
        const image = await api.post<ChronicleImageDto>(`/chronicles/${id}/images`, {
          dataUrl: result,
          name: file.name
        });
        setImages((prev) =>
          [...prev, image].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
      } catch (err: any) {
        pushToast(err?.message ?? "Не удалось загрузить картинку", "error");
      }
    };
    reader.onerror = () => {
      pushToast("Не удалось прочитать файл", "error");
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!id) return;
    try {
      await api.del(`/chronicles/${id}/images/${imageId}`);
      setImages((prev) => prev.filter((item) => item._id !== imageId));
    } catch (err: any) {
      pushToast(err?.message ?? "Не удалось удалить картинку", "error");
    }
  };

  const handleImportFile = async (file?: File | null) => {
    if (!file || !chronicle) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const character = await api.post<CharacterDto>(
        `/chronicles/${chronicle._id}/characters/import`,
        json
      );
      pushToast("Импорт выполнен", "success");
      navigate(`/c/${character.uuid}`);
    } catch (err: any) {
      const message = err?.errors?.[0]?.message || err?.message || "Ошибка импорта";
      pushToast(message, "error");
    }
  };

  const handleDeleteChronicle = async () => {
    if (!chronicle) return;
    const confirmDelete = window.confirm("Удалить хронику? Она исчезнет с главной страницы.");
    if (!confirmDelete) return;
    try {
      await api.post(`/chronicles/${chronicle._id}/delete`);
      pushToast("Хроника удалена", "success");
      navigate("/");
    } catch (err: any) {
      pushToast(err?.message ?? "Не удалось удалить хронику", "error");
    }
  };

  const handleBindNpc = async (npcId: string) => {
    if (!id) return;
    setBusyNpcId(npcId);
    try {
      const created = await api.post<ChronicleNpcDto>(`/chronicles/${id}/npcs`, { npcId });
      setChronicleNpcs((prev) =>
        sortByName(
          [...prev.filter((item) => item.id !== created.id), created],
          (item) => item.meta.name
        )
      );
      setAvailableNpcs((prev) => prev.filter((item) => item.id !== created.id));
      setAvailableNpcSearch("");
      setNpcModalOpen(false);
      pushToast("NPC привязан к хронике", "success");
    } catch (err: any) {
      pushToast(err?.message ?? "Не удалось привязать NPC", "error");
    } finally {
      setBusyNpcId(null);
    }
  };

  const handleUnbindNpc = async (npcId: string) => {
    if (!id) return;
    setBusyNpcId(npcId);
    try {
      await api.del(`/chronicles/${id}/npcs/${npcId}`);
      setChronicleNpcs((prev) => prev.filter((item) => item.id !== npcId));
      pushToast("NPC убран из хроники", "success");
    } catch (err: any) {
      pushToast(err?.message ?? "Не удалось убрать NPC из хроники", "error");
    } finally {
      setBusyNpcId(null);
    }
  };

  if (loading) {
    return (
      <section className="page">
        <h1>Хроника</h1>
        <p>Загрузка…</p>
      </section>
    );
  }

  if (!chronicle) {
    return (
      <section className="page">
        <h1>Хроника</h1>
        <p>Не удалось загрузить хронику.</p>
      </section>
    );
  }

  return (
    <section className="page">
      <h1>{chronicle.name}</h1>
      {chronicle.description?.trim() && (
        <div className="card">
          <div className="section-title">Описание</div>
          <p className="chronicle-description">{chronicle.description}</p>
        </div>
      )}
      <div className="card">
        <div className="card-header">
          <div className="section-title">Инструменты хроники</div>
          <div className="page-actions header-actions">
            <button
              type="button"
              className="icon-button"
              title="Создать персонажа"
              aria-label="Создать персонажа"
              onClick={async () => {
                try {
                  const character = await api.post<CharacterDto>("/characters", {
                    chronicleId: chronicle._id
                  });
                  navigate(`/c/${character.uuid}`);
                } catch (err: any) {
                  pushToast(err?.message ?? "Не удалось создать персонажа", "error");
                }
              }}
            >
              ➕
            </button>
            <button
              type="button"
              className="icon-button"
              title="Импортировать персонажа JSON"
              aria-label="Импортировать персонажа JSON"
              onClick={() => importInputRef.current?.click()}
            >
              ⤒
            </button>
            <button
              type="button"
              className="icon-button"
              title={combat?.active ? "Перейти к бою" : "Начать бой"}
              aria-label={combat?.active ? "Перейти к бою" : "Начать бой"}
              onClick={async () => {
                if (combat?.active) {
                  navigate(`/chronicles/${chronicle._id}/combat`);
                  return;
                }
                try {
                  const started = await api.post<CombatStateDto>(
                    `/chronicles/${chronicle._id}/combat/start`
                  );
                  setCombat(started);
                  navigate(`/chronicles/${chronicle._id}/combat`);
                } catch (err: any) {
                  pushToast(err?.message ?? "Не удалось начать бой", "error");
                }
              }}
            >
              ⚔️
            </button>
            <button
              type="button"
              className="icon-button danger"
              title="Удалить хронику"
              aria-label="Удалить хронику"
              onClick={handleDeleteChronicle}
            >
              {"\uD83D\uDDD1"}
            </button>
          </div>
        </div>
        {combat && (
          <div className="chronicle-combat-status">
            {combat.active ? "Бой активен" : "Бой не начат"}
          </div>
        )}
        <input
          ref={importInputRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            handleImportFile(file);
            event.target.value = "";
          }}
        />
      </div>
      <div className="card">
        <div className="section-title">Персонажи</div>
        <div className="chronicle-character-grid">
          {characters.map((character) => {
            const name = character.meta?.name?.trim() || "(Без имени)";
            const avatarUrl = character.meta?.avatarUrl?.trim();
            const fallbackLetter =
              name && name !== "(Без имени)" ? name.trim().charAt(0).toUpperCase() : "—";
            const playerName = character.meta?.playerName?.trim() || "—";
            const clanLabel =
              dictionaries.clans.find((item) => item.key === character.meta?.clanKey)?.labelRu ||
              "—";
            const sectLabel =
              dictionaries.sects.find((item) => item.key === character.meta?.sectKey)?.labelRu ||
              "";
            const generation =
              typeof character.meta?.generation === "number" ? character.meta.generation : null;
            return (
              <Link key={character.uuid} to={`/c/${character.uuid}`} className="character-card">
                <div className="character-card-header">
                  {avatarUrl ? (
                    <img className="character-avatar" src={avatarUrl} alt={name} />
                  ) : (
                    <span className="character-avatar placeholder">{fallbackLetter}</span>
                  )}
                  <div className="character-card-title">
                    <div className="character-card-name">
                      {name}
                      {!character.creationFinished && <span className="tag">Черновик ✦</span>}
                    </div>
                    <div className="character-card-sub">
                      {clanLabel}
                      {sectLabel ? ` · ${sectLabel}` : ""}
                    </div>
                  </div>
                </div>
                <div className="character-card-meta">
                  <span>Игрок: {playerName}</span>
                  {generation !== null && <span>Поколение: {generation}</span>}
                </div>
              </Link>
            );
          })}
          {characters.length === 0 && <p>Пока нет персонажей.</p>}
        </div>
      </div>

      {isChronicleAuthor && (
        <div className="card">
          <div className="card-header">
            <div className="section-title">NPC хроники</div>
            <div className="page-actions header-actions">
              <button
                type="button"
                className="icon-button npc-create-icon-button"
                title="Добавить NPC"
                aria-label="Добавить NPC"
                onClick={() => {
                  setAvailableNpcSearch("");
                  setNpcModalOpen(true);
                }}
              >
                +
              </button>
            </div>
          </div>
          <label className="field">
            <span>Поиск по привязанным NPC</span>
            <input
              value={npcSearch}
              onChange={(event) => setNpcSearch(event.target.value)}
              placeholder="Введите имя NPC"
            />
          </label>
          <div className="npc-inline-list">
            {npcLoading ? (
              <div className="home-empty">Загрузка…</div>
            ) : chronicleNpcs.length === 0 ? (
              <div className="home-empty">
                {deferredNpcSearch.trim()
                  ? "По этому запросу NPC в хронике не найдены."
                  : "К этой хронике пока не привязан ни один NPC."}
              </div>
            ) : (
              chronicleNpcs.map((npc) => {
                const name = npc.meta.name?.trim() || "(Без имени)";
                const avatarUrl = npc.meta.avatarUrl?.trim();
                const subtitle = getNpcMetaSubtitle(npc.meta, dictionaries);
                const fallbackLetter = getNpcFallbackLetter(name);
                return (
                  <div key={npc.id} className="npc-inline-item">
                    <Link to={`/npcs/${npc.id}`} className="npc-inline-link">
                      <div className="character-card-header">
                        {avatarUrl ? (
                          <img className="character-avatar" src={avatarUrl} alt={name} />
                        ) : (
                          <span className="character-avatar placeholder">{fallbackLetter}</span>
                        )}
                        <div className="character-card-title">
                          <div className="character-card-name">{name}</div>
                          <div className="character-card-sub">
                            {subtitle || "Без клана и секты"}
                          </div>
                        </div>
                      </div>
                    </Link>
                    <button
                      type="button"
                      className="icon-button danger"
                      title="Убрать из хроники"
                      aria-label="Убрать из хроники"
                      disabled={busyNpcId === npc.id}
                      onClick={() => handleUnbindNpc(npc.id)}
                    >
                      {"\uD83D\uDDD1"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="section-title">Картинки хроники</div>
          <button
            type="button"
            className="icon-button"
            title="Загрузить картинку"
            aria-label="Загрузить картинку"
            onClick={() => imageInputRef.current?.click()}
          >
            🖼️
          </button>
        </div>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            handleImageFile(file);
            event.target.value = "";
          }}
        />
        <div className="chronicle-image-list">
          {images.length === 0 && <div className="chronicle-image-empty">Пока нет картинок.</div>}
          {images.map((image) => (
            <div key={image._id} className="chronicle-image-card">
              <button
                type="button"
                className="icon-button danger chronicle-image-delete"
                title="Удалить"
                aria-label="Удалить"
                onClick={(event) => {
                  event.stopPropagation();
                  handleDeleteImage(image._id);
                }}
              >
                🗑
              </button>
              <button
                type="button"
                className="chronicle-image-thumb"
                onClick={() => setSelectedImage(image)}
                aria-label={image.name || "Открыть картинку"}
                title="Открыть"
              >
                <img src={image.dataUrl} alt={image.name || "Картинка хроники"} />
              </button>
              <div className="chronicle-image-meta">
                <span>{image.name || "Без названия"}</span>
                <span>{new Date(image.createdAt).toLocaleString("ru-RU")}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="section-title">Лог хроники</div>
        <div className="log-list">
          {logs.length === 0 && <div className="log-empty">Нет событий.</div>}
          {logs.map((log) => (
            <div key={log._id} className="log-item">
              <div className="log-time">{new Date(log.createdAt).toLocaleString("ru-RU")}</div>
              <div className="log-message">{renderLogMessage(log)}</div>
            </div>
          ))}
        </div>
      </div>
      {selectedImage && (
        <div className="chronicle-image-modal" onClick={() => setSelectedImage(null)}>
          <div
            className="chronicle-image-modal-content"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="icon-button chronicle-image-close"
              title="Закрыть"
              aria-label="Закрыть"
              onClick={() => setSelectedImage(null)}
            >
              ✕
            </button>
            <img src={selectedImage.dataUrl} alt={selectedImage.name || "Картинка хроники"} />
            <div className="chronicle-image-modal-meta">
              <span>{selectedImage.name || "Без названия"}</span>
              <span>{new Date(selectedImage.createdAt).toLocaleString("ru-RU")}</span>
            </div>
          </div>
        </div>
      )}
      <NpcPickerModal
        open={npcModalOpen}
        title="Добавить NPC в хронику"
        search={availableNpcSearch}
        loading={availableNpcLoading}
        items={availableNpcs}
        emptyState="Нет NPC, доступных для привязки."
        actionLabel="Добавить"
        busyNpcId={busyNpcId}
        onClose={() => setNpcModalOpen(false)}
        onSearchChange={setAvailableNpcSearch}
        onPick={handleBindNpc}
      />
    </section>
  );
}
