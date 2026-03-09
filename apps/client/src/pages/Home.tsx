import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { CharacterDto, ChronicleDto } from "../api/types";
import { useToast } from "../context/ToastContext";

export default function Home() {
  const [chronicles, setChronicles] = useState<ChronicleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await api.get<ChronicleDto[]>("/chronicles");
        if (!active) return;
        setChronicles(data);
      } catch (err: any) {
        pushToast(err?.message ?? "Не удалось загрузить хроники", "error");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [pushToast]);

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const character = await api.post<CharacterDto>("/characters");
      await api.post(`/characters/${character.uuid}/import`, json);
      pushToast("Импорт выполнен", "success");
      navigate(`/c/${character.uuid}`);
    } catch (err: any) {
      const message = err?.errors?.[0]?.message || err?.message || "Ошибка импорта";
      pushToast(message, "error");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <section className="page home-page">
      <div className="home-hero">
        <div className="home-hero-main">
          <h1>Хроники</h1>
          <p className="home-subtitle">
            Управляйте хрониками, переходите в боевой режим и следите за журналом событий.
          </p>
        </div>
        <div className="home-actions">
          <Link
            to="/chronicles/new"
            className="icon-button"
            title="Создать хронику"
            aria-label="Создать хронику"
          >
            ✚
          </Link>
          <button
            className="icon-button"
            type="button"
            title="Импорт персонажа"
            aria-label="Импорт персонажа"
            onClick={() => importInputRef.current?.click()}
          >
            ⤒
          </button>
        </div>
      </div>
      <div className="card home-card">
        <div className="card-header">
          <div className="section-title">Список хроник</div>
          <span className="tag">{chronicles.length}</span>
        </div>
        {loading ? (
          <p>Загрузка…</p>
        ) : (
          <div className="list home-list">
            {chronicles.map((chronicle) => (
              <Link key={chronicle._id} to={`/chronicles/${chronicle._id}`} className="list-item">
                <span>{chronicle.name}</span>
                <span className="tag">Открыть</span>
              </Link>
            ))}
            {chronicles.length === 0 && (
              <div className="home-empty">
                Пока нет хроник. Нажмите ✚, чтобы создать первую.
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="page-footer">
        <Link to="/help">Помощь</Link>
      </footer>

      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={handleImportFile}
      />
    </section>
  );
}
