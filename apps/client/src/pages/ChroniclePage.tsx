import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { ChronicleDto, ChronicleLogDto, CharacterSummaryDto } from "../api/types";
import { useToast } from "../context/ToastContext";

export default function ChroniclePage() {
  const { id } = useParams();
  const [chronicle, setChronicle] = useState<ChronicleDto | null>(null);
  const [characters, setCharacters] = useState<CharacterSummaryDto[]>([]);
  const [logs, setLogs] = useState<ChronicleLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const { pushToast } = useToast();

  useEffect(() => {
    if (!id) return;
    let active = true;
    async function load() {
      try {
        const [chronicleData, charactersData, logsData] = await Promise.all([
          api.get<ChronicleDto>(`/chronicles/${id}`),
          api.get<CharacterSummaryDto[]>(`/chronicles/${id}/characters`),
          api.get<ChronicleLogDto[]>(`/chronicles/${id}/logs?limit=50`)
        ]);
        if (!active) return;
        setChronicle(chronicleData);
        setCharacters(charactersData);
        setLogs(logsData);
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

  return (
    <section className="page">
      <h1>{chronicle.name}</h1>
      <div className="card">
        <div className="section-title">Персонажи</div>
        <div className="list">
          {characters.map((character) => {
            const name = character.meta?.name?.trim() || "(Без имени)";
            return (
              <Link key={character.uuid} to={`/c/${character.uuid}`} className="list-item">
                <span>
                  {name}
                  {!character.creationFinished && <span className="tag">Черновик ✦</span>}
                </span>
              </Link>
            );
          })}
          {characters.length === 0 && <p>Пока нет персонажей.</p>}
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
              <div className="log-message">{log.message}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
