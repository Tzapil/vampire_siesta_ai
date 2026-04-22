import { UserModel } from "../db";

type CharacterLike = {
  createdByUserId?: unknown;
  createdByDisplayName?: string | null;
  meta?: Record<string, unknown> | null;
};

function normalizeDisplayName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function extractUserId(value: unknown) {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && value !== null && "toString" in value) {
    const stringValue = String(value);
    return stringValue && stringValue !== "[object Object]" ? stringValue : null;
  }
  return null;
}

export function presentCharacterPlayerName<T extends CharacterLike>(
  character: T,
  creatorDisplayName?: string | null
) {
  const playerName =
    normalizeDisplayName(creatorDisplayName) ||
    normalizeDisplayName(character.createdByDisplayName) ||
    normalizeDisplayName(character.meta?.playerName);

  return {
    ...character,
    createdByDisplayName: playerName || character.createdByDisplayName || "",
    meta: {
      ...(character.meta ?? {}),
      playerName
    }
  } as T;
}

async function loadCreatorDisplayNameMap(characters: CharacterLike[]) {
  const creatorIds = Array.from(
    new Set(
      characters
        .map((character) => extractUserId(character.createdByUserId))
        .filter((value): value is string => Boolean(value))
    )
  );

  if (creatorIds.length === 0) {
    return new Map<string, string>();
  }

  const users = await UserModel.find({ _id: { $in: creatorIds } })
    .select("_id displayName")
    .lean();

  return new Map(
    users.map((user) => [String(user._id), normalizeDisplayName(user.displayName)])
  );
}

export async function presentCharacter<T extends CharacterLike>(character: T | null) {
  if (!character) {
    return null;
  }

  const creatorDisplayNameMap = await loadCreatorDisplayNameMap([character]);
  const creatorId = extractUserId(character.createdByUserId);
  return presentCharacterPlayerName(
    character,
    creatorId ? creatorDisplayNameMap.get(creatorId) : null
  );
}

export async function presentCharacterList<T extends CharacterLike>(characters: T[]) {
  if (characters.length === 0) {
    return characters;
  }

  const creatorDisplayNameMap = await loadCreatorDisplayNameMap(characters);

  return characters.map((character) => {
    const creatorId = extractUserId(character.createdByUserId);
    return presentCharacterPlayerName(
      character,
      creatorId ? creatorDisplayNameMap.get(creatorId) : null
    );
  });
}
