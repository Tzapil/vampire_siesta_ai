import type { HomeScreenDto } from "@siesta/shared";
import { CharacterModel, ChronicleModel } from "../../db";
import { presentCharacterList } from "../../utils/characterPresenter";

function asOptionalString(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  return String(value);
}

function asIsoString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

export async function getHomeScreen(authUserId: string): Promise<HomeScreenDto> {
  const [chronicles, characters] = await Promise.all([
    ChronicleModel.find({ deleted: { $ne: true } }).lean(),
    CharacterModel.find({
      createdByUserId: authUserId,
      creationFinished: true,
      deleted: { $ne: true }
    })
      .select(
        "-_id uuid createdAt createdByUserId createdByDisplayName meta.name meta.avatarUrl meta.playerName meta.clanKey meta.sectKey meta.generation creationFinished meta.chronicleId"
      )
      .sort({ createdAt: -1 })
      .lean()
  ]);

  const chronicleIds = Array.from(
    new Set(
      characters
        .map((character) => character.meta?.chronicleId)
        .filter(Boolean)
        .map((chronicleId) => String(chronicleId))
    )
  );

  const characterChronicles = chronicleIds.length
    ? await ChronicleModel.find({ _id: { $in: chronicleIds }, deleted: { $ne: true } })
        .select("_id name")
        .lean()
    : [];

  const chronicleNameById = new Map(
    characterChronicles.map((chronicle) => [String(chronicle._id), chronicle.name])
  );

  const presentedCharacters = await presentCharacterList(characters);

  return {
    chronicles: chronicles.map((chronicle) => ({
      _id: String(chronicle._id),
      name: chronicle.name,
      description: chronicle.description || undefined,
      createdByUserId: asOptionalString(chronicle.createdByUserId),
      createdByDisplayName: chronicle.createdByDisplayName || undefined,
      deleted: chronicle.deleted || undefined
    })),
    characters: presentedCharacters.map((character) => ({
      uuid: character.uuid,
      creationFinished: character.creationFinished,
      createdAt: asIsoString((character as any).createdAt),
      createdByUserId: asOptionalString(character.createdByUserId),
      createdByDisplayName: character.createdByDisplayName || undefined,
      chronicleName: character.meta?.chronicleId
        ? chronicleNameById.get(String(character.meta.chronicleId))
        : undefined,
      meta: {
        name: character.meta?.name ?? "",
        chronicleId: asOptionalString(character.meta?.chronicleId) ?? "",
        avatarUrl: character.meta?.avatarUrl || undefined,
        playerName: character.meta?.playerName || undefined,
        clanKey: character.meta?.clanKey || undefined,
        sectKey: character.meta?.sectKey || undefined,
        generation:
          typeof character.meta?.generation === "number" ? character.meta.generation : undefined
      },
      traits: character.traits?.attributes
        ? {
            attributes: character.traits.attributes
          }
        : undefined,
      resources: character.resources?.health
        ? {
            health: character.resources.health
          }
        : undefined
    }))
  };
}
