import { Router } from "express";
import { isValidObjectId } from "mongoose";
import {
  ChronicleImageModel,
  ChronicleLogModel,
  ChronicleModel,
  ChronicleNpcLinkModel,
  CharacterModel,
  CombatStateModel,
  NpcModel
} from "../db";
import { asyncHandler } from "../utils/asyncHandler";
import {
  createCombatNpcSnapshot,
  getNextNpcCopyOrdinal,
  normalizeCombatNpcPatch
} from "../utils/combatNpc";
import { presentCharacter, presentCharacterList } from "../utils/characterPresenter";
import { sanitizeCharacterForChronicleImport } from "../utils/characterTransfer";
import { findActiveChronicleById, findChronicleForAuthor } from "../utils/chronicleAccess";
import {
  presentCombatNpc,
  presentCombatState,
  presentChronicleNpc,
  presentNpcSummary
} from "../utils/npcPresenter";
import { buildSearchRegex, normalizeSearchQuery } from "../utils/npcValidation";
import { generateUuid } from "../utils/uuid";
import { loadDictionaries, validateAllWizardSteps } from "../validation/characterValidation";

const router = Router();
const MAX_CHRONICLE_IMAGE_LENGTH = 7_000_000;

function collectCharacterStructureErrors(character: any) {
  const errors: Array<{ path: string; message: string }> = [];

  if (!character.traits?.attributes || !character.traits?.abilities || !character.traits?.disciplines) {
    errors.push({ path: "traits", message: "Некорректная структура traits" });
  }
  if (!character.traits?.backgrounds || !character.traits?.virtues) {
    errors.push({ path: "traits", message: "Некорректная структура traits" });
  }
  if (!character.resources) {
    errors.push({ path: "resources", message: "Некорректная структура ресурсов" });
  }
  if (!character.derived) {
    errors.push({ path: "derived", message: "Некорректная структура derived" });
  }

  return errors;
}

function sortByTrimmedName<T>(items: T[], getName: (item: T) => string | null | undefined) {
  return [...items].sort((a, b) => {
    const nameA = (getName(a) ?? "").trim();
    const nameB = (getName(b) ?? "").trim();
    if (!nameA && !nameB) return 0;
    if (!nameA) return 1;
    if (!nameB) return -1;
    return nameA.localeCompare(nameB, "ru");
  });
}

router.get(
  "/chronicles",
  asyncHandler(async (_req, res) => {
    const items = await ChronicleModel.find({ deleted: { $ne: true } }).lean();
    res.json(items);
  })
);

router.post(
  "/chronicles",
  asyncHandler(async (req, res) => {
    const authUser = req.auth?.user;
    if (!authUser) {
      res.status(401).json({ message: "Требуется авторизация" });
      return;
    }

    const { name, description } = req.body ?? {};
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ message: "Название хроники обязательно" });
      return;
    }

    const trimmedName = name.trim().slice(0, 80);
    const trimmedDescription =
      typeof description === "string" ? description.trim().slice(0, 1000) : "";

    const chronicle = await ChronicleModel.create({
      name: trimmedName,
      description: trimmedDescription,
      createdByUserId: authUser.id,
      createdByDisplayName: authUser.displayName
    });

    res.status(201).json(chronicle);
  })
);

router.get(
  "/chronicles/:id",
  asyncHandler(async (req, res) => {
    const item = await ChronicleModel.findById(req.params.id).lean();
    if (!item) {
      res.status(404).json({ message: "Хроника не найдена" });
      return;
    }
    res.json(item);
  })
);

router.post(
  "/chronicles/:id/delete",
  asyncHandler(async (req, res) => {
    const chronicle = await ChronicleModel.findByIdAndUpdate(
      req.params.id,
      { $set: { deleted: true } },
      { new: true }
    ).lean();
    if (!chronicle) {
      res.status(404).json({ message: "Хроника не найдена" });
      return;
    }
    res.json(chronicle);
  })
);

router.get(
  "/chronicles/:id/characters",
  asyncHandler(async (req, res) => {
    const characters = await CharacterModel.find({
      "meta.chronicleId": req.params.id,
      deleted: false
    })
      .select(
        "uuid createdByUserId createdByDisplayName meta.name meta.avatarUrl meta.playerName meta.clanKey meta.sectKey meta.generation creationFinished meta.chronicleId traits.attributes resources.health"
      )
      .lean();

    const sorted = sortByTrimmedName(characters, (item) => item.meta?.name);
    res.json(await presentCharacterList(sorted));
  })
);

router.post(
  "/chronicles/:id/characters/import",
  asyncHandler(async (req, res) => {
    const authUser = req.auth?.user;
    if (!authUser) {
      res.status(401).json({ message: "Требуется авторизация" });
      return;
    }

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      res.status(400).json({ errors: [{ path: "body", message: "Неверный формат JSON" }] });
      return;
    }

    const chronicle = await ChronicleModel.findOne({
      _id: req.params.id,
      deleted: { $ne: true }
    }).lean();
    if (!chronicle) {
      res.status(404).json({ message: "Хроника не найдена" });
      return;
    }

    const payload = sanitizeCharacterForChronicleImport(req.body as Record<string, unknown>, {
      uuid: generateUuid(),
      chronicleId: chronicle._id,
      createdByUserId: authUser.id,
      createdByDisplayName: authUser.displayName,
      playerName: authUser.displayName
    });
    const character = new CharacterModel(payload);

    const dict = await loadDictionaries();
    const errors = await validateAllWizardSteps(character, dict, {
      mutate: false,
      chronicleExists: async (chronicleId) => String(chronicleId) === String(chronicle._id)
    });
    errors.push(...collectCharacterStructureErrors(character));

    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }

    await character.save();
    const plain = character.toObject({ flattenMaps: true });
    res.status(201).json(await presentCharacter(plain));
  })
);

router.get(
  "/chronicles/:id/logs",
  asyncHandler(async (req, res) => {
    const limitRaw = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
    const logs = await ChronicleLogModel.find({ chronicleId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json(logs);
  })
);

router.post(
  "/chronicles/:id/logs",
  asyncHandler(async (req, res) => {
    const { type, message, data } = req.body ?? {};
    if (!type || typeof type !== "string") {
      res.status(400).json({ message: "Неверный тип события" });
      return;
    }
    if (!message || typeof message !== "string") {
      res.status(400).json({ message: "Сообщение обязательно" });
      return;
    }
    const exists = await ChronicleModel.exists({ _id: req.params.id });
    if (!exists) {
      res.status(404).json({ message: "Хроника не найдена" });
      return;
    }

    const trimmedMessage = message.trim().slice(0, 1000);
    const log = await ChronicleLogModel.create({
      chronicleId: req.params.id,
      type: type.trim(),
      message: trimmedMessage,
      data
    });

    res.status(201).json(log);
  })
);

router.get(
  "/chronicles/:id/images",
  asyncHandler(async (req, res) => {
    const images = await ChronicleImageModel.find({ chronicleId: req.params.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(images);
  })
);

router.post(
  "/chronicles/:id/images",
  asyncHandler(async (req, res) => {
    const { dataUrl, name } = req.body ?? {};
    if (!dataUrl || typeof dataUrl !== "string") {
      res.status(400).json({ message: "Картинка обязательна" });
      return;
    }
    const trimmedUrl = dataUrl.trim();
    if (!trimmedUrl.startsWith("data:image/")) {
      res.status(400).json({ message: "Неверный формат изображения" });
      return;
    }
    if (trimmedUrl.length > MAX_CHRONICLE_IMAGE_LENGTH) {
      res.status(400).json({ message: "Файл слишком большой" });
      return;
    }

    const exists = await ChronicleModel.exists({ _id: req.params.id });
    if (!exists) {
      res.status(404).json({ message: "Хроника не найдена" });
      return;
    }

    const safeName =
      typeof name === "string" && name.trim().length > 0
        ? name.trim().slice(0, 200)
        : undefined;

    const image = await ChronicleImageModel.create({
      chronicleId: req.params.id,
      dataUrl: trimmedUrl,
      name: safeName
    });

    res.status(201).json(image);
  })
);

router.delete(
  "/chronicles/:id/images/:imageId",
  asyncHandler(async (req, res) => {
    const deleted = await ChronicleImageModel.findOneAndDelete({
      _id: req.params.imageId,
      chronicleId: req.params.id
    }).lean();
    if (!deleted) {
      res.status(404).json({ message: "Картинка не найдена" });
      return;
    }
    res.status(204).end();
  })
);

router.get(
  "/chronicles/:id/npcs",
  asyncHandler(async (req, res) => {
    const authUser = req.auth?.user;
    if (!authUser) {
      res.status(401).json({ message: "Требуется авторизация" });
      return;
    }

    const access = await findChronicleForAuthor(req.params.id, authUser.id);
    if (!access.chronicle) {
      res.status(access.status).json({ message: access.message });
      return;
    }

    const search = normalizeSearchQuery(req.query.search);
    const links = await ChronicleNpcLinkModel.find({ chronicleId: req.params.id }).lean();

    if (links.length === 0) {
      res.json([]);
      return;
    }

    const filter: Record<string, unknown> = {
      _id: { $in: links.map((item) => item.npcId) },
      deleted: { $ne: true }
    };
    if (search) {
      filter["meta.name"] = buildSearchRegex(search);
    }

    const npcs = await NpcModel.find(filter).lean();
    const linkByNpcId = new Map(links.map((item) => [String(item.npcId), item]));
    const sorted = sortByTrimmedName(npcs, (item) => item.meta?.name);

    res.json(
      sorted.map((npc) => presentChronicleNpc(npc, linkByNpcId.get(String(npc._id))))
    );
  })
);

router.get(
  "/chronicles/:id/npcs/available",
  asyncHandler(async (req, res) => {
    const authUser = req.auth?.user;
    if (!authUser) {
      res.status(401).json({ message: "Требуется авторизация" });
      return;
    }

    const access = await findChronicleForAuthor(req.params.id, authUser.id);
    if (!access.chronicle) {
      res.status(access.status).json({ message: access.message });
      return;
    }

    const search = normalizeSearchQuery(req.query.search);
    const existingLinks = await ChronicleNpcLinkModel.find({ chronicleId: req.params.id })
      .select("npcId")
      .lean();

    const filter: Record<string, unknown> = {
      deleted: { $ne: true }
    };
    if (existingLinks.length > 0) {
      filter._id = { $nin: existingLinks.map((item) => item.npcId) };
    }
    if (search) {
      filter["meta.name"] = buildSearchRegex(search);
    }

    const npcs = await NpcModel.find(filter).lean();
    const sorted = sortByTrimmedName(npcs, (item) => item.meta?.name);
    res.json(sorted.map((npc) => presentNpcSummary(npc)));
  })
);

router.post(
  "/chronicles/:id/npcs",
  asyncHandler(async (req, res) => {
    const authUser = req.auth?.user;
    if (!authUser) {
      res.status(401).json({ message: "Требуется авторизация" });
      return;
    }

    const access = await findChronicleForAuthor(req.params.id, authUser.id);
    if (!access.chronicle) {
      res.status(access.status).json({ message: access.message });
      return;
    }

    const npcId = typeof req.body?.npcId === "string" ? req.body.npcId.trim() : "";
    if (!npcId || !isValidObjectId(npcId)) {
      res.status(400).json({ message: "npcId обязателен" });
      return;
    }

    const npc = await NpcModel.findOne({
      _id: npcId,
      deleted: { $ne: true }
    }).lean();
    if (!npc) {
      res.status(404).json({ message: "NPC не найден" });
      return;
    }

    const result = await ChronicleNpcLinkModel.updateOne(
      { chronicleId: req.params.id, npcId },
      { $setOnInsert: { addedByUserId: authUser.id } },
      { upsert: true }
    );

    const link = await ChronicleNpcLinkModel.findOne({
      chronicleId: req.params.id,
      npcId
    }).lean();

    if (!link) {
      res.status(500).json({ message: "Не удалось привязать NPC к хронике" });
      return;
    }

    res
      .status(result.upsertedCount > 0 ? 201 : 200)
      .json(presentChronicleNpc(npc, link));
  })
);

router.delete(
  "/chronicles/:id/npcs/:npcId",
  asyncHandler(async (req, res) => {
    const authUser = req.auth?.user;
    if (!authUser) {
      res.status(401).json({ message: "Требуется авторизация" });
      return;
    }

    const access = await findChronicleForAuthor(req.params.id, authUser.id);
    if (!access.chronicle) {
      res.status(access.status).json({ message: access.message });
      return;
    }

    if (!isValidObjectId(req.params.npcId)) {
      res.status(404).json({ message: "Привязка NPC не найдена" });
      return;
    }

    const deleted = await ChronicleNpcLinkModel.findOneAndDelete({
      chronicleId: req.params.id,
      npcId: req.params.npcId
    }).lean();

    if (!deleted) {
      res.status(404).json({ message: "Привязка NPC не найдена" });
      return;
    }

    res.status(204).end();
  })
);

router.get(
  "/chronicles/:id/combat",
  asyncHandler(async (req, res) => {
    const chronicle = await findActiveChronicleById(req.params.id);
    if (!chronicle) {
      res.status(404).json({ message: "Хроника не найдена" });
      return;
    }

    let combat = await CombatStateModel.findOne({ chronicleId: req.params.id });
    if (!combat) {
      combat = await CombatStateModel.create({ chronicleId: req.params.id });
    }

    res.json(presentCombatState(combat.toObject({ flattenMaps: true })));
  })
);

router.post(
  "/chronicles/:id/combat/start",
  asyncHandler(async (req, res) => {
    const chronicle = await findActiveChronicleById(req.params.id);
    if (!chronicle) {
      res.status(404).json({ message: "Хроника не найдена" });
      return;
    }

    const previous = await CombatStateModel.findOne({ chronicleId: req.params.id }).lean();
    const wasActive = Boolean(previous?.active);
    const combat = await CombatStateModel.findOneAndUpdate(
      { chronicleId: req.params.id },
      {
        $set: {
          active: true,
          initiatives: {},
          npcs: [],
          npcCopyCounters: {},
          enemies: []
        }
      },
      { new: true, upsert: true }
    );

    if (!wasActive) {
      await ChronicleLogModel.create({
        chronicleId: req.params.id,
        type: "combat_start",
        message: "Бой начался"
      });
    }

    res.json(
      presentCombatState(
        combat?.toObject({ flattenMaps: true }) ?? {
          chronicleId: req.params.id,
          initiatives: {},
          npcs: [],
          active: true
        }
      )
    );
  })
);

router.post(
  "/chronicles/:id/combat/initiative",
  asyncHandler(async (req, res) => {
    const { characterUuid, initiative } = req.body ?? {};
    if (!characterUuid || typeof characterUuid !== "string") {
      res.status(400).json({ message: "characterUuid обязателен" });
      return;
    }
    if (!initiative || typeof initiative !== "object") {
      res.status(400).json({ message: "initiative обязателен" });
      return;
    }
    const combat = await CombatStateModel.findOneAndUpdate(
      { chronicleId: req.params.id },
      { $set: { [`initiatives.${characterUuid}`]: initiative } },
      { new: true, upsert: true }
    );
    const plain = combat?.toObject({ flattenMaps: true });
    res.json({
      characterUuid,
      initiative: (plain as any)?.initiatives?.[characterUuid] ?? initiative
    });
  })
);

router.post(
  "/chronicles/:id/combat/npcs",
  asyncHandler(async (req, res) => {
    const authUser = req.auth?.user;
    if (!authUser) {
      res.status(401).json({ message: "Требуется авторизация" });
      return;
    }

    const access = await findChronicleForAuthor(req.params.id, authUser.id);
    if (!access.chronicle) {
      res.status(access.status).json({ message: access.message });
      return;
    }

    const npcId = typeof req.body?.npcId === "string" ? req.body.npcId.trim() : "";
    if (!npcId || !isValidObjectId(npcId)) {
      res.status(400).json({ message: "npcId обязателен" });
      return;
    }

    const linkExists = await ChronicleNpcLinkModel.exists({
      chronicleId: req.params.id,
      npcId
    });
    if (!linkExists) {
      res.status(404).json({ message: "NPC не привязан к этой хронике" });
      return;
    }

    const npc = await NpcModel.findOne({
      _id: npcId,
      deleted: { $ne: true }
    }).lean();
    if (!npc) {
      res.status(404).json({ message: "NPC не найден" });
      return;
    }

    const combat = await CombatStateModel.findOne({ chronicleId: req.params.id });
    if (!combat || !combat.active) {
      res.status(409).json({ message: "Бой не активен" });
      return;
    }

    const plainCombat = combat.toObject({ flattenMaps: true });
    const nextOrdinal = getNextNpcCopyOrdinal(plainCombat.npcCopyCounters, npcId);
    const snapshot = createCombatNpcSnapshot(npc, nextOrdinal);

    combat.set(`npcCopyCounters.${npcId}`, nextOrdinal);
    (combat.get("npcs") as any[]).push(snapshot);
    await combat.save();

    const updatedCombat = combat.toObject({ flattenMaps: true });
    const createdNpc = updatedCombat.npcs[updatedCombat.npcs.length - 1];

    res.status(201).json(presentCombatNpc(createdNpc));
  })
);

router.patch(
  "/chronicles/:id/combat/npcs/:combatNpcId",
  asyncHandler(async (req, res) => {
    const authUser = req.auth?.user;
    if (!authUser) {
      res.status(401).json({ message: "Требуется авторизация" });
      return;
    }

    const access = await findChronicleForAuthor(req.params.id, authUser.id);
    if (!access.chronicle) {
      res.status(access.status).json({ message: access.message });
      return;
    }

    const { value, errors } = normalizeCombatNpcPatch(req.body);
    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }

    const combat = await CombatStateModel.findOne({ chronicleId: req.params.id });
    if (!combat || !combat.active) {
      res.status(409).json({ message: "Бой не активен" });
      return;
    }

    const combatNpc = (combat.get("npcs") as any)?.id?.(req.params.combatNpcId);
    if (!combatNpc) {
      res.status(404).json({ message: "NPC в бою не найден" });
      return;
    }

    if (value.health) {
      combatNpc.health = value.health;
    }
    if (typeof value.dead === "boolean") {
      combatNpc.dead = value.dead;
    }
    if (value.initiative) {
      combatNpc.initiative = value.initiative;
    }

    await combat.save();
    res.json(presentCombatNpc(combatNpc.toObject()));
  })
);

router.delete(
  "/chronicles/:id/combat/npcs/:combatNpcId",
  asyncHandler(async (req, res) => {
    const authUser = req.auth?.user;
    if (!authUser) {
      res.status(401).json({ message: "Требуется авторизация" });
      return;
    }

    const access = await findChronicleForAuthor(req.params.id, authUser.id);
    if (!access.chronicle) {
      res.status(access.status).json({ message: access.message });
      return;
    }

    const combat = await CombatStateModel.findOne({ chronicleId: req.params.id });
    if (!combat || !combat.active) {
      res.status(409).json({ message: "Бой не активен" });
      return;
    }

    const combatNpc = (combat.get("npcs") as any)?.id?.(req.params.combatNpcId);
    if (!combatNpc) {
      res.status(404).json({ message: "NPC в бою не найден" });
      return;
    }

    combatNpc.deleteOne();
    await combat.save();
    res.status(204).end();
  })
);

router.post(
  "/chronicles/:id/combat/enemies",
  asyncHandler(async (_req, res) => {
    res.status(410).json({
      message: "Ручные противники отключены. Используйте NPC, привязанных к хронике."
    });
  })
);

router.patch(
  "/chronicles/:id/combat/enemies/:enemyId",
  asyncHandler(async (_req, res) => {
    res.status(410).json({
      message: "Ручные противники отключены. Используйте NPC, привязанных к хронике."
    });
  })
);

router.delete(
  "/chronicles/:id/combat",
  asyncHandler(async (req, res) => {
    await CombatStateModel.findOneAndUpdate(
      { chronicleId: req.params.id },
      {
        $set: {
          initiatives: {},
          npcs: [],
          npcCopyCounters: {},
          enemies: [],
          active: false
        }
      },
      { upsert: true }
    );
    await ChronicleLogModel.create({
      chronicleId: req.params.id,
      type: "combat_end",
      message: "Бой окончился"
    });
    res.json({ ok: true });
  })
);

export default router;
