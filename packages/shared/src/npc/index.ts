export type NpcHealth = {
  bashing: number;
  lethal: number;
  aggravated: number;
};

export type NpcMetaDto = {
  name: string;
  avatarUrl?: string;
  clanKey?: string;
  sectKey?: string;
  generation?: number | null;
};

export type NpcTraitsDto = {
  attributes: Record<string, number>;
  abilities: Record<string, number>;
  disciplines: Record<string, number>;
  virtues: Record<string, number>;
};

export type NpcResourcesDto = {
  bloodPool: { current: number };
  willpower: { current: number };
  humanity: { current: number };
  health: NpcHealth;
};

export type NpcInputDto = {
  meta: NpcMetaDto;
  traits: NpcTraitsDto;
  resources: NpcResourcesDto;
  notes: string;
};

export type NpcDto = NpcInputDto & {
  id: string;
  createdByUserId?: string;
  createdByDisplayName?: string;
  createdAt: string;
  updatedAt: string;
};

export type NpcSummaryDto = {
  id: string;
  meta: NpcMetaDto;
  createdByDisplayName?: string;
  createdAt: string;
  updatedAt: string;
};

export type ChronicleNpcDto = NpcSummaryDto & {
  chronicleId: string;
  linkedAt: string;
  addedByUserId?: string;
};
