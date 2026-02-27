import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { ChronicleDto, CharacterDto } from "../api/types";
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

  const handleCreate = async () => {
    try {
      const character = await api.post<CharacterDto>("/characters");
      navigate(`/c/${character.uuid}`);
    } catch (err: any) {
      pushToast(err?.message ?? "Не удалось создать персонажа", "error");
    }
  };

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
    <section className="page">
      <h1>Главная</h1>
      <div className="card">
        <div className="section-title">Хроники</div>
        {loading ? (
          <p>Загрузка…</p>
        ) : (
          <div className="list">
            {chronicles.map((chronicle) => (
              <Link key={chronicle._id} to={`/chronicles/${chronicle._id}`} className="list-item">
                <span>{chronicle.name}</span>
              </Link>
            ))}
            {chronicles.length === 0 && <p>Пока нет хроник.</p>}
          </div>
        )}
      </div>

      <div className="page-actions">
        <button className="primary" type="button" onClick={handleCreate}>
          Создать персонажа
        </button>
        <button className="secondary" type="button" onClick={() => importInputRef.current?.click()}>
          Импорт
        </button>
      </div>

      <div className="page-links">
        <Link to="/help">Помощь</Link>
      </div>

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
