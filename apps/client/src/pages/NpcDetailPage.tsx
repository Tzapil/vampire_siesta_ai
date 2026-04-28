import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { NpcDto } from "../api/types";
import { api } from "../api/client";
import { NpcTraitSection } from "../components/NpcTraitSection";
import { HelpPopoverGroup } from "../components/HelpPopover";
import { useDictionaries } from "../context/DictionariesContext";
import { useToast } from "../context/ToastContext";
import NotFound from "./NotFound";
import { buildHealthTrack } from "../utils/health";
import { getNpcFallbackLetter, getNpcMetaSubtitle } from "../utils/npc";

function ReadonlyHealthTrack({
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

export default function NpcDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { dictionaries } = useDictionaries();
  const { pushToast } = useToast();
  const [npc, setNpc] = useState<NpcDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;

    async function load() {
      try {
        const data = await api.get<NpcDto>(`/npcs/${id}`);
        if (!active) return;
        setNpc(data);
        setNotFound(false);
      } catch (err: any) {
        if (!active) return;
        if (err?.status === 404) {
          setNotFound(true);
          return;
        }
        pushToast(err?.message ?? "Не удалось загрузить NPC", "error");
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
  }, [id, pushToast]);

  if (loading) {
    return (
      <section className="page">
        <h1>NPC</h1>
        <p>Загрузка…</p>
      </section>
    );
  }

  if (notFound || !npc) {
    return <NotFound />;
  }

  const name = npc.meta.name?.trim() || "(Без имени)";
  const subtitle = getNpcMetaSubtitle(npc.meta, dictionaries);
  const fallbackLetter = getNpcFallbackLetter(name);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Удалить NPC? Он исчезнет из каталога и отвяжется от всех хроник."
    );
    if (!confirmed) return;

    try {
      await api.del(`/npcs/${npc.id}`);
      pushToast("NPC удалён", "success");
      navigate("/npcs");
    } catch (err: any) {
      pushToast(err?.message ?? "Не удалось удалить NPC", "error");
    }
  };

  return (
    <HelpPopoverGroup>
      <section className="page">
        <div className="card">
          <div className="card-header st-header">
            <div className="card-header-main">
              <div className="section-title">NPC</div>
              <div className="st-meta">
                <span>{name}</span>
                <span>{subtitle || "Без клана и секты"}</span>
                <span>Автор: {npc.createdByDisplayName?.trim() || "—"}</span>
              </div>
            </div>
            <div className="page-actions header-actions">
              <Link to="/npcs" className="icon-button" title="Назад к каталогу">
                ←
              </Link>
              <Link
                to={`/npcs/${npc.id}/edit`}
                className="icon-button"
                title="Редактировать NPC"
                aria-label="Редактировать NPC"
              >
                ✎
              </Link>
              <button
                type="button"
                className="icon-button danger"
                title="Удалить NPC"
                aria-label="Удалить NPC"
                onClick={handleDelete}
              >
                🗑
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="npc-summary">
            {npc.meta.avatarUrl?.trim() ? (
              <img className="npc-detail-avatar" src={npc.meta.avatarUrl} alt={name} />
            ) : (
              <span className="npc-detail-avatar placeholder">{fallbackLetter}</span>
            )}
            <div className="npc-summary-body">
              <h1>{name}</h1>
              <p className="home-subtitle">
                {subtitle || "Опциональные вампирские метки не заполнены."}
              </p>
              <div className="st-meta">
                <span>Создан: {new Date(npc.createdAt).toLocaleString("ru-RU")}</span>
                <span>Обновлён: {new Date(npc.updatedAt).toLocaleString("ru-RU")}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="section-title">Ресурсы</div>
          <div className="grid-2 npc-resource-grid">
            <div className="npc-stat-card">
              <span className="npc-stat-label">Кровь</span>
              <strong>{npc.resources.bloodPool.current}</strong>
            </div>
            <div className="npc-stat-card">
              <span className="npc-stat-label">Сила воли</span>
              <strong>{npc.resources.willpower.current}</strong>
            </div>
            <div className="npc-stat-card">
              <span className="npc-stat-label">Человечность</span>
              <strong>{npc.resources.humanity.current}</strong>
            </div>
            <div className="npc-stat-card npc-health-card">
              <span className="npc-stat-label">Здоровье</span>
              <ReadonlyHealthTrack health={npc.resources.health} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="section-title">Черты</div>
          <div className="st-grid">
            <NpcTraitSection
              title="Атрибуты"
              items={dictionaries.attributes}
              values={npc.traits.attributes}
              min={1}
              max={5}
            />
            <NpcTraitSection
              title="Способности"
              items={dictionaries.abilities}
              values={npc.traits.abilities}
              min={0}
              max={5}
            />
            <NpcTraitSection
              title="Дисциплины"
              items={dictionaries.disciplines}
              values={npc.traits.disciplines}
              min={0}
              max={5}
            />
            <NpcTraitSection
              title="Добродетели"
              items={dictionaries.virtues}
              values={npc.traits.virtues}
              min={1}
              max={5}
            />
          </div>
        </div>

        <div className="card">
          <div className="section-title">Заметки</div>
          <p className="chronicle-description">
            {npc.notes?.trim() || "Пока нет заметок."}
          </p>
        </div>
      </section>
    </HelpPopoverGroup>
  );
}
