import { useMemo } from "react";
import type { CharacterDto } from "../api/types";
import { HealthTrack } from "./HealthTrack";

function NumericControl({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="page-actions">
        <button type="button" onClick={() => onChange(Math.max(value - 1, min))}>
          -
        </button>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <button type="button" onClick={() => onChange(Math.min(value + 1, max))}>
          +
        </button>
        <span>
          / {max}
        </span>
      </div>
    </div>
  );
}

export function GameMode({
  character,
  onPatch
}: {
  character: CharacterDto;
  onPatch: (path: string, value: unknown) => void;
}) {
  const maxBlood = character.derived?.bloodPoolMax ?? 0;

  const resources = character.resources;

  const health = useMemo(() => resources.health, [resources.health]);

  return (
    <section className="page">
      <h2>Игровой режим</h2>
      <div className="grid-2">
        <div className="card">
          <div className="section-title">Ресурсы</div>
          <NumericControl
            label="Кровь"
            value={resources.bloodPool.current}
            min={0}
            max={maxBlood}
            onChange={(next) => onPatch("resources.bloodPool.current", next)}
          />
          <NumericControl
            label="Сила воли"
            value={resources.willpower.current}
            min={0}
            max={10}
            onChange={(next) => onPatch("resources.willpower.current", next)}
          />
          <NumericControl
            label="Человечность"
            value={resources.humanity.current}
            min={0}
            max={10}
            onChange={(next) => onPatch("resources.humanity.current", next)}
          />
        </div>

        <div className="card">
          <div className="section-title">Здоровье</div>
          <HealthTrack
            health={health}
            onChange={(next) => onPatch("resources.health", next)}
          />
        </div>
      </div>

      <div className="grid-2">
        <div className="card field">
          <label>Заметки</label>
          <textarea
            rows={6}
            value={character.notes}
            onChange={(event) => onPatch("notes", event.target.value)}
          />
        </div>
        <div className="card field">
          <label>Снаряжение</label>
          <textarea
            rows={6}
            value={character.equipment}
            onChange={(event) => onPatch("equipment", event.target.value)}
          />
        </div>
      </div>
    </section>
  );
}
