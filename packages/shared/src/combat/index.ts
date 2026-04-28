import type { NpcHealth } from "../npc";

export type CombatInitiativeDto = {
  dexterity: number;
  wits: number;
  base: number;
  roll: number;
  total: number;
};

export type CombatNpcDto = {
  _id: string;
  npcId: string;
  baseName: string;
  displayName: string;
  copyOrdinal: number;
  avatarUrl?: string;
  clanKey?: string;
  sectKey?: string;
  generation?: number | null;
  dexterity: number;
  wits: number;
  health: NpcHealth;
  dead: boolean;
  initiative?: CombatInitiativeDto;
};

export type CombatStateDto = {
  _id: string;
  chronicleId: string;
  initiatives: Record<string, CombatInitiativeDto>;
  npcs: CombatNpcDto[];
  active: boolean;
};
