import type { ChronicleNpcDto, NpcSummaryDto } from "../api/types";
import { useDictionaries } from "../context/DictionariesContext";
import { getNpcFallbackLetter, getNpcMetaSubtitle } from "../utils/npc";

type NpcPickerItem = ChronicleNpcDto | NpcSummaryDto;

type NpcPickerModalProps = {
  open: boolean;
  title: string;
  search: string;
  loading: boolean;
  items: NpcPickerItem[];
  emptyState: string;
  actionLabel: string;
  busyNpcId?: string | null;
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onPick: (npcId: string) => void;
};

export function NpcPickerModal({
  open,
  title,
  search,
  loading,
  items,
  emptyState,
  actionLabel,
  busyNpcId,
  onClose,
  onSearchChange,
  onPick
}: NpcPickerModalProps) {
  const { dictionaries } = useDictionaries();

  if (!open) {
    return null;
  }

  return (
    <div className="npc-modal" onClick={onClose}>
      <div className="npc-modal-content card" onClick={(event) => event.stopPropagation()}>
        <div className="card-header">
          <div className="section-title">{title}</div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        <label className="field">
          <span>Поиск по имени</span>
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Введите имя NPC"
          />
        </label>

        <div className="npc-picker-list">
          {loading ? (
            <div className="home-empty">Загрузка…</div>
          ) : items.length === 0 ? (
            <div className="home-empty">{emptyState}</div>
          ) : (
            items.map((item) => {
              const name = item.meta.name?.trim() || "(Без имени)";
              const avatarUrl = item.meta.avatarUrl?.trim();
              const subtitle = getNpcMetaSubtitle(item.meta, dictionaries);
              const fallbackLetter = getNpcFallbackLetter(name);
              const isBusy = busyNpcId === item.id;

              return (
                <div key={item.id} className="npc-picker-item">
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
                  <button
                    type="button"
                    className="primary"
                    disabled={isBusy}
                    onClick={() => onPick(item.id)}
                  >
                    {isBusy ? "..." : actionLabel}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
