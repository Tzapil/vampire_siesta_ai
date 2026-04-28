import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { HomeScreenDto } from "../api/types";
import { useDictionaries } from "../context/DictionariesContext";
import { useToast } from "../context/ToastContext";
import { fetchHomeScreen } from "../features/home/api";

export default function Home() {
  const [screen, setScreen] = useState<HomeScreenDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { pushToast } = useToast();
  const { dictionaries } = useDictionaries();

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchHomeScreen();
        if (!active) return;
        setScreen(data);
      } catch (err: any) {
        if (!active) return;
        const message = err?.message ?? "Не удалось загрузить главную страницу";
        setError(message);
        pushToast(message, "error");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [pushToast]);

  const chronicles = screen?.chronicles ?? [];
  const characters = screen?.characters ?? [];

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
            ✓
          </Link>
        </div>
      </div>

      <div className="card home-card">
        <div className="card-header">
          <div className="section-title">Неигровые персонажи</div>
        </div>
        <div className="home-npc-cta">
          <div>
            <strong>Глобальный каталог NPC</strong>
            <p className="home-subtitle">
              Отдельный раздел для создания, просмотра и подготовки неигровых персонажей.
            </p>
          </div>
          <Link to="/npcs" className="primary npc-link-button">
            Открыть каталог
          </Link>
        </div>
      </div>

      <div className="card home-card">
        <div className="card-header">
          <div className="section-title">Мои персонажи</div>
          <span className="tag">{characters.length}</span>
        </div>
        {loading ? (
          <p>Загрузка…</p>
        ) : error ? (
          <div className="home-empty">{error}</div>
        ) : (
          <div className="chronicle-character-grid home-character-grid">
            {characters.map((character) => {
              const name = character.meta?.name?.trim() || "(Без имени)";
              const avatarUrl = character.meta?.avatarUrl?.trim();
              const fallbackLetter =
                name && name !== "(Без имени)" ? name.trim().charAt(0).toUpperCase() : "—";
              const clanLabel =
                dictionaries.clans.find((item) => item.key === character.meta?.clanKey)?.labelRu ||
                "—";
              const sectLabel =
                dictionaries.sects.find((item) => item.key === character.meta?.sectKey)?.labelRu ||
                "";
              const generation =
                typeof character.meta?.generation === "number" ? character.meta.generation : null;
              const chronicleName = character.chronicleName?.trim();

              return (
                <Link key={character.uuid} to={`/c/${character.uuid}`} className="character-card">
                  <div className="character-card-header">
                    {avatarUrl ? (
                      <img className="character-avatar" src={avatarUrl} alt={name} />
                    ) : (
                      <span className="character-avatar placeholder">{fallbackLetter}</span>
                    )}
                    <div className="character-card-title">
                      <div className="character-card-name">{name}</div>
                      <div className="character-card-sub">
                        {clanLabel}
                        {sectLabel ? ` · ${sectLabel}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="character-card-meta">
                    {generation !== null && <span>Поколение: {generation}</span>}
                    {chronicleName && <span>Хроника: {chronicleName}</span>}
                  </div>
                </Link>
              );
            })}
            {characters.length === 0 && (
              <div className="home-empty">Завершённых персонажей пока нет.</div>
            )}
          </div>
        )}
      </div>

      <div className="card home-card">
        <div className="card-header">
          <div className="section-title">Список хроник</div>
          <span className="tag">{chronicles.length}</span>
        </div>
        {loading ? (
          <p>Загрузка…</p>
        ) : error ? (
          <div className="home-empty">{error}</div>
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
                Пока нет хроник. Нажмите ✓, чтобы создать первую.
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="page-footer">
        <Link to="/help">Помощь</Link>
      </footer>
    </section>
  );
}
