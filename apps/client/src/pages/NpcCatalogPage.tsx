import { useDeferredValue, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { NpcSummaryDto } from "../api/types";
import { api } from "../api/client";
import { useDictionaries } from "../context/DictionariesContext";
import { useToast } from "../context/ToastContext";
import { getNpcFallbackLetter, getNpcMetaSubtitle } from "../utils/npc";

export default function NpcCatalogPage() {
  const { dictionaries } = useDictionaries();
  const { pushToast } = useToast();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [items, setItems] = useState<NpcSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const query = deferredSearch.trim();
        const path = query ? `/npcs?search=${encodeURIComponent(query)}` : "/npcs";
        const data = await api.get<NpcSummaryDto[]>(path);
        if (!active) return;
        setItems(data);
      } catch (err: any) {
        if (!active) return;
        pushToast(err?.message ?? "Не удалось загрузить каталог NPC", "error");
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
  }, [deferredSearch, pushToast]);

  return (
    <section className="page">
      <div className="card">
        <div className="card-header st-header">
          <div className="card-header-main">
            <div className="section-title">Неигровые персонажи</div>
            <div className="st-meta">
              <span>Глобальный каталог NPC</span>
              <span>Поиск по имени на сервере</span>
            </div>
          </div>
          <div className="page-actions header-actions">
            <Link
              to="/npcs/new"
              className="icon-button npc-create-icon-button"
              title="Создать NPC"
              aria-label="Создать NPC"
            >
              +
            </Link>
          </div>
        </div>
      </div>

      <div className="card">
        <label className="field">
          <span>Поиск по имени</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Например, Бандит или Принц"
          />
        </label>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="section-title">Каталог</div>
          <span className="tag">{items.length}</span>
        </div>
        {loading ? (
          <p>Загрузка…</p>
        ) : (
          <div className="chronicle-character-grid npc-catalog-grid">
            {items.map((npc) => {
              const name = npc.meta.name?.trim() || "(Без имени)";
              const avatarUrl = npc.meta.avatarUrl?.trim();
              const subtitle = getNpcMetaSubtitle(npc.meta, dictionaries);
              const fallbackLetter = getNpcFallbackLetter(name);
              return (
                <Link key={npc.id} to={`/npcs/${npc.id}`} className="character-card">
                  <div className="character-card-header">
                    {avatarUrl ? (
                      <img className="character-avatar" src={avatarUrl} alt={name} />
                    ) : (
                      <span className="character-avatar placeholder">{fallbackLetter}</span>
                    )}
                    <div className="character-card-title">
                      <div className="character-card-name">{name}</div>
                      <div className="character-card-sub">{subtitle || "Без клана и секты"}</div>
                    </div>
                  </div>
                  <div className="character-card-meta">
                    <span>Автор: {npc.createdByDisplayName?.trim() || "—"}</span>
                    <span>{new Date(npc.updatedAt).toLocaleString("ru-RU")}</span>
                  </div>
                </Link>
              );
            })}
            {items.length === 0 && (
              <div className="home-empty">
                {deferredSearch.trim()
                  ? "По этому запросу NPC не найдены."
                  : "Каталог NPC пока пуст."}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
