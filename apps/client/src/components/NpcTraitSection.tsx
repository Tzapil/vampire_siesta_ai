import type { DictItem } from "../api/types";
import { HelpPopoverButton } from "./HelpPopover";
import { buildDictionaryHelpText } from "../utils/dictionaryHelp";

function DotsDisplay({
  total,
  max
}: {
  total: number;
  max: number;
}) {
  return (
    <div className="dots readonly" aria-label={`${total} из ${max}`}>
      {Array.from({ length: max }).map((_, index) => (
        <div
          key={index}
          className={`dot ${index < total ? "filled" : ""} readonly`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function DotsInput({
  value,
  min,
  max,
  onChange
}: {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const allowZero = min === 0;

  return (
    <div className="dots" aria-label={`${value} из ${max}`}>
      {Array.from({ length: max }).map((_, index) => {
        const dotValue = index + 1;
        const filled = dotValue <= value;
        return (
          <div
            key={index}
            className={`dot ${filled ? "filled" : ""}`}
            onClick={() => {
              if (allowZero && dotValue === value) {
                onChange(0);
                return;
              }
              onChange(Math.max(min, dotValue));
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") {
                return;
              }
              event.preventDefault();
              if (allowZero && dotValue === value) {
                onChange(0);
                return;
              }
              onChange(Math.max(min, dotValue));
            }}
            role="button"
            tabIndex={0}
            aria-label={`Установить ${dotValue}`}
            aria-pressed={filled}
          />
        );
      })}
    </div>
  );
}

type NpcTraitSectionProps = {
  title: string;
  items: DictItem[];
  values: Record<string, number>;
  min: number;
  max: number;
  editable?: boolean;
  editMode?: "buttons" | "dots";
  onChange?: (key: string, next: number) => void;
  emptyState?: string;
};

export function NpcTraitSection({
  title,
  items,
  values,
  min,
  max,
  editable = false,
  editMode = "buttons",
  onChange,
  emptyState
}: NpcTraitSectionProps) {
  const visibleItems = items.filter((item) => values[item.key] !== undefined);

  return (
    <div className="wizard-attr-card">
      <div className="wizard-attr-card-header">
        <span>{title}</span>
      </div>
      <div className="wizard-attr-list">
        {visibleItems.length === 0 && <div className="home-empty">{emptyState ?? "Нет значений."}</div>}
        {visibleItems.map((item) => {
          const value = values[item.key] ?? min;
          return (
            <div key={item.key} className="wizard-attr-item">
              <div className="wizard-attr-row st-row">
                <span className="wizard-attr-label">
                  <span>{item.labelRu}</span>
                  <HelpPopoverButton
                    popoverId={`npc-${title}-${item.key}`}
                    text={buildDictionaryHelpText(item)}
                    ariaLabel={`Описание: ${item.labelRu}`}
                  />
                </span>
                {editable && editMode === "dots" ? (
                  <DotsInput
                    value={value}
                    min={min}
                    max={max}
                    onChange={(next) => onChange?.(item.key, next)}
                  />
                ) : (
                  <DotsDisplay total={value} max={max} />
                )}
                {editable && editMode === "buttons" ? (
                  <div className="st-actions">
                    <button
                      type="button"
                      onClick={() => onChange?.(item.key, Math.max(min, value - 1))}
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange?.(item.key, Math.min(max, value + 1))}
                    >
                      +
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
