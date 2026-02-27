import { buildHealthTrack, healthFromTrack, woundPenalty, type HealthState } from "../utils/health";

const cycleState: Record<HealthState, HealthState> = {
  empty: "bashing",
  bashing: "lethal",
  lethal: "aggravated",
  aggravated: "empty"
};

export function HealthTrack({
  health,
  onChange
}: {
  health: { bashing: number; lethal: number; aggravated: number };
  onChange: (next: { bashing: number; lethal: number; aggravated: number }) => void;
}) {
  const track = buildHealthTrack(health);
  const total = health.bashing + health.lethal + health.aggravated;

  let lastFilled = -1;
  for (let i = track.length - 1; i >= 0; i -= 1) {
    if (track[i] !== "empty") {
      lastFilled = i;
      break;
    }
  }

  const handleClick = (index: number) => {
    const allowed = index === lastFilled || index === lastFilled + 1;
    if (!allowed) return;
    const nextTrack = [...track];
    nextTrack[index] = cycleState[track[index]];
    const nextHealth = healthFromTrack(nextTrack);
    onChange(nextHealth);
  };

  const penalty = woundPenalty(total);

  return (
    <div className="field">
      <div className="health-track">
        {track.map((state, index) => (
          <div
            key={index}
            className={`health-cell ${state}`}
            onClick={() => handleClick(index)}
            role="button"
            aria-label={`Ячейка ${index + 1}`}
          >
            {state === "aggravated" ? "X" : state === "lethal" ? "-" : ""}
          </div>
        ))}
      </div>
      <small>
        Штраф ранений: {total === 0 ? "нет" : `${penalty}`}
      </small>
    </div>
  );
}
