export type HealthState = "empty" | "bashing" | "lethal" | "aggravated";

export function buildHealthTrack(health: { bashing: number; lethal: number; aggravated: number }): HealthState[] {
  const track: HealthState[] = [];
  for (let i = 0; i < health.bashing; i += 1) track.push("bashing");
  for (let i = 0; i < health.lethal; i += 1) track.push("lethal");
  for (let i = 0; i < health.aggravated; i += 1) track.push("aggravated");
  while (track.length < 7) track.push("empty");
  return track.slice(0, 7);
}

export function healthFromTrack(track: HealthState[]) {
  return {
    bashing: track.filter((s) => s === "bashing").length,
    lethal: track.filter((s) => s === "lethal").length,
    aggravated: track.filter((s) => s === "aggravated").length
  };
}

export function woundPenalty(total: number) {
  if (total <= 0) return 0;
  if (total <= 2) return -1;
  if (total <= 4) return -2;
  if (total <= 6) return -5;
  return -5;
}
