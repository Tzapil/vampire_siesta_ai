import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { CharacterSummaryDto, ChronicleDto } from "../api/types";
import { useDictionaries } from "../context/DictionariesContext";
import { useToast } from "../context/ToastContext";

export default function Home() {
  const [chronicles, setChronicles] = useState<ChronicleDto[]>([]);
  const [characters, setCharacters] = useState<CharacterSummaryDto[]>([]);
  const [chroniclesLoading, setChroniclesLoading] = useState(true);
  const [charactersLoading, setCharactersLoading] = useState(true);
  const [charactersError, setCharactersError] = useState("");
  const { pushToast } = useToast();
  const { dictionaries } = useDictionaries();

  useEffect(() => {
    let active = true;
    async function load() {
      const [chroniclesResult, charactersResult] = await Promise.allSettled([
        api.get<ChronicleDto[]>("/chronicles"),
        api.get<CharacterSummaryDto[]>("/characters?owner=me&creationFinished=true")
      ]);

      if (!active) return;

      if (chroniclesResult.status === "fulfilled") {
        setChronicles(chroniclesResult.value);
      } else {
        const message =
          chroniclesResult.reason instanceof Error
            ? chroniclesResult.reason.message
            : "Не удалось загрузить хроники";
        pushToast(message, "error");
      }

      if (charactersResult.status === "fulfilled") {
        setCharacters(charactersResult.value);
        setCharactersError("");
      } else {
        const message =
          charactersResult.reason instanceof Error
            ? charactersResult.reason.message
            : "Не удалось загрузить персонажей";
        setCharactersError(message);
      }

      setChroniclesLoading(false);
      setCharactersLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [pushToast]);

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
        </div>
      </div>

      <div className="card home-card">
        <div className="card-header">
          <div className="section-title">Мои персонажи</div>
          <span className="tag">{characters.length}</span>
        </div>
        {charactersLoading ? (
          <p>Загрузка…</p>
        ) : charactersError ? (
          <div className="home-empty">{charactersError}</div>
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
        {chroniclesLoading ? (
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
    </section>
  );
}
