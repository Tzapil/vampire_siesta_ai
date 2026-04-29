import { useEffect, useRef } from "react";
import {
  GAME_MODE_MANEUVER_LEGEND,
  GAME_MODE_MANEUVER_TABS,
  getGameModeManeuversByTab,
  type GameModeCombatManeuver,
  type GameModeManeuverDetailFlag,
  type GameModeManeuverTab
} from "./gameModeCombatManeuvers";

type GameModeManeuversDrawerProps = {
  open: boolean;
  activeTab: GameModeManeuverTab;
  expandedManeuverId: string | null;
  activeManeuverId: string | null;
  onClose: () => void;
  onTabChange: (tab: GameModeManeuverTab) => void;
  onExpandedManeuverChange: (maneuverId: string | null) => void;
  onApplyManeuver: (maneuver: GameModeCombatManeuver) => void;
};

const legendById = new Map(
  GAME_MODE_MANEUVER_LEGEND.map((item) => [item.id, item] as const)
);

function ManeuverFlagBadges({ flags }: { flags: GameModeManeuverDetailFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <div className="game-mode-maneuver-flags" aria-label="Особые пометки манёвра">
      {flags.map((flag) => {
        const item = legendById.get(flag);
        if (!item) return null;
        return (
          <span
            key={flag}
            className="game-mode-maneuver-flag"
            title={item.description}
            aria-label={item.description}
          >
            {item.shortLabel}
          </span>
        );
      })}
    </div>
  );
}

export function GameModeManeuversDrawer({
  open,
  activeTab,
  expandedManeuverId,
  activeManeuverId,
  onClose,
  onTabChange,
  onExpandedManeuverChange,
  onApplyManeuver
}: GameModeManeuversDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const activeTabMeta =
    GAME_MODE_MANEUVER_TABS.find((tab) => tab.id === activeTab) ?? GAME_MODE_MANEUVER_TABS[0];
  const maneuvers = getGameModeManeuversByTab(activeTab);

  return (
    <div className="game-mode-maneuvers-overlay" onClick={onClose}>
      <div className="game-mode-maneuvers-backdrop" aria-hidden="true" />
      <aside
        id="game-mode-maneuvers-drawer"
        className="game-mode-maneuvers-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-mode-maneuvers-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="game-mode-maneuvers-header">
          <div className="game-mode-maneuvers-heading">
            <span className="game-mode-maneuvers-kicker">Быстрые пресеты роллера</span>
            <h2 id="game-mode-maneuvers-title">Манёвры</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-button game-mode-maneuvers-close"
            onClick={onClose}
            aria-label="Закрыть панель манёвров"
          >
            ✕
          </button>
        </div>

        <div
          className="game-mode-maneuvers-tabs"
          role="tablist"
          aria-label="Категории боевых манёвров"
        >
          {GAME_MODE_MANEUVER_TABS.map((tab) => {
            const selected = tab.id === activeTab;
            const tabId = `game-mode-maneuvers-tab-${tab.id}`;
            const panelId = `game-mode-maneuvers-panel-${tab.id}`;
            return (
              <button
                key={tab.id}
                id={tabId}
                type="button"
                role="tab"
                className={`game-mode-maneuvers-tab ${selected ? "active" : ""}`}
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="game-mode-maneuvers-scroll">
          <div
            id={`game-mode-maneuvers-panel-${activeTab}`}
            className="game-mode-maneuvers-panel"
            role="tabpanel"
            aria-labelledby={`game-mode-maneuvers-tab-${activeTab}`}
          >
            <p className="game-mode-maneuvers-panel-description">{activeTabMeta.description}</p>

            <div className="game-mode-maneuvers-list">
              {maneuvers.map((maneuver) => {
                const expanded = expandedManeuverId === maneuver.id;
                const active = activeManeuverId === maneuver.id;
                const detailsId = `game-mode-maneuver-details-${maneuver.id}`;
                const applyDisabled = maneuver.applyMode === "disabled" || !maneuver.preset;
                return (
                  <article
                    key={maneuver.id}
                    className={`game-mode-maneuver-card ${active ? "active" : ""} ${
                      expanded ? "expanded" : ""
                    }`}
                  >
                    <div className="game-mode-maneuver-card-header">
                      <div>
                        <h3>{maneuver.title}</h3>
                        <ManeuverFlagBadges flags={maneuver.detailFlags} />
                      </div>
                      {active ? <span className="game-mode-maneuver-active-tag">Активен</span> : null}
                    </div>

                    <dl className="game-mode-maneuver-summary">
                      <div>
                        <dt>Пул</dt>
                        <dd>{maneuver.summary.pool}</dd>
                      </div>
                      <div>
                        <dt>Сложность</dt>
                        <dd>{maneuver.summary.difficulty}</dd>
                      </div>
                      <div>
                        <dt>Урон</dt>
                        <dd>{maneuver.summary.damage}</dd>
                      </div>
                      <div>
                        <dt>Ограничение</dt>
                        <dd>{maneuver.summary.limitation}</dd>
                      </div>
                    </dl>

                    <div className="game-mode-maneuver-actions">
                      <button
                        type="button"
                        className="game-mode-maneuver-apply"
                        disabled={applyDisabled}
                        onClick={() => onApplyManeuver(maneuver)}
                      >
                        Подставить в бросок
                      </button>
                      <button
                        type="button"
                        className="game-mode-maneuver-details-toggle"
                        aria-expanded={expanded}
                        aria-controls={detailsId}
                        onClick={() =>
                          onExpandedManeuverChange(expanded ? null : maneuver.id)
                        }
                      >
                        Подробнее
                      </button>
                    </div>

                    {expanded ? (
                      <div id={detailsId} className="game-mode-maneuver-details">
                        <p>{maneuver.detailText}</p>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>

        </div>
      </aside>
    </div>
  );
}
