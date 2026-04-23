import type { DictItem } from "../dictionaries";

export type LayeredValue = {
  base: number;
  freebie: number;
  storyteller: number;
};

export type ChronicleDto = {
  _id: string;
  name: string;
  description?: string;
  createdByUserId?: string;
  createdByDisplayName?: string;
  deleted?: boolean;
};

export type CharacterSummaryDto = {
  uuid: string;
  creationFinished: boolean;
  createdAt?: string;
  createdByUserId?: string;
  createdByDisplayName?: string;
  chronicleName?: string;
  meta: {
    name: string;
    chronicleId: string;
    avatarUrl?: string;
    playerName?: string;
    clanKey?: string;
    sectKey?: string;
    generation?: number;
  };
  traits?: {
    attributes?: Record<string, LayeredValue>;
  };
  resources?: {
    health?: { bashing: number; lethal: number; aggravated: number };
  };
};

export type HomeScreenDto = {
  chronicles: ChronicleDto[];
  characters: CharacterSummaryDto[];
  dictionaryHints?: {
    clans?: DictItem[];
    sects?: DictItem[];
  };
};
