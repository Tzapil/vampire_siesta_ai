import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type {
  ChronicleDto,
  ChronicleImageDto,
  ChronicleLogDto,
  CharacterSummaryDto
} from "../api/types";
import { useDictionaries } from "../context/DictionariesContext";
import { useToast } from "../context/ToastContext";

export default function ChroniclePage() {
  const { id } = useParams();
  const [chronicle, setChronicle] = useState<ChronicleDto | null>(null);
  const [characters, setCharacters] = useState<CharacterSummaryDto[]>([]);
  const [logs, setLogs] = useState<ChronicleLogDto[]>([]);
  const [images, setImages] = useState<ChronicleImageDto[]>([]);
  const [selectedImage, setSelectedImage] = useState<ChronicleImageDto | null>(null);
  const [loading, setLoading] = useState(true);
  const { pushToast } = useToast();
  const { dictionaries } = useDictionaries();
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    async function load() {
      try {
        const [chronicleData, charactersData, logsData, imagesData] = await Promise.all([
          api.get<ChronicleDto>(`/chronicles/${id}`),
          api.get<CharacterSummaryDto[]>(`/chronicles/${id}/characters`),
          api.get<ChronicleLogDto[]>(`/chronicles/${id}/logs?limit=50`),
          api.get<ChronicleImageDto[]>(`/chronicles/${id}/images`)
        ]);
        if (!active) return;
        setChronicle(chronicleData);
        setCharacters(charactersData);
        const sortedLogs = [...logsData].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setLogs(sortedLogs);
        const sortedImages = [...imagesData].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setImages(sortedImages);
      } catch (err: any) {
        pushToast(err?.message ?? "Не удалось загрузить хронику", "error");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [id, pushToast]);

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
        setImages((prev) => {
          const next = [image, ...prev];
          next.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          return next;
        });
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

  return (
    <section className="page">
      <h1>{chronicle.name}</h1>
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
                    <img
                      className="character-avatar"
                      src={avatarUrl}
                      alt={name}
                    />
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
          {images.length === 0 && (
            <div className="chronicle-image-empty">Пока нет картинок.</div>
          )}
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
              <div className="log-time">
                {new Date(log.createdAt).toLocaleString("ru-RU")}
              </div>
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
            <img
              src={selectedImage.dataUrl}
              alt={selectedImage.name || "Картинка хроники"}
            />
            <div className="chronicle-image-modal-meta">
              <span>{selectedImage.name || "Без названия"}</span>
              <span>{new Date(selectedImage.createdAt).toLocaleString("ru-RU")}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
