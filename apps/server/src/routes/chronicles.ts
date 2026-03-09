import { Router } from "express";
import {
  ChronicleImageModel,
  ChronicleLogModel,
  ChronicleModel,
  CharacterModel,
  CombatStateModel
} from "../db";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
const MAX_CHRONICLE_IMAGE_LENGTH = 7_000_000;

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
      description: trimmedDescription
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
        "uuid meta.name meta.avatarUrl meta.playerName meta.clanKey meta.sectKey meta.generation creationFinished meta.chronicleId traits.attributes resources.health"
      )
      .lean();

    const sorted = characters.sort((a, b) => {
      const nameA = (a.meta?.name ?? "").trim();
      const nameB = (b.meta?.name ?? "").trim();
      if (!nameA && !nameB) return 0;
      if (!nameA) return 1;
      if (!nameB) return -1;
      return nameA.localeCompare(nameB, "ru");
    });

    res.json(sorted);
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
  "/chronicles/:id/combat",
  asyncHandler(async (req, res) => {
    const chronicleExists = await ChronicleModel.exists({ _id: req.params.id });
    if (!chronicleExists) {
      res.status(404).json({ message: "Хроника не найдена" });
      return;
    }
    const found = await CombatStateModel.findOne({ chronicleId: req.params.id });
    const combat = found ?? (await CombatStateModel.create({ chronicleId: req.params.id }));
    res.json(combat.toObject({ flattenMaps: true }));
  })
);

router.post(
  "/chronicles/:id/combat/start",
  asyncHandler(async (req, res) => {
    const chronicleExists = await ChronicleModel.exists({ _id: req.params.id });
    if (!chronicleExists) {
      res.status(404).json({ message: "Хроника не найдена" });
      return;
    }
    const previous = await CombatStateModel.findOne({ chronicleId: req.params.id }).lean();
    const wasActive = Boolean(previous?.active);
    const combat = await CombatStateModel.findOneAndUpdate(
      { chronicleId: req.params.id },
      { $set: { active: true, initiatives: {}, enemies: [] } },
      { new: true, upsert: true }
    );
    if (!wasActive) {
      await ChronicleLogModel.create({
        chronicleId: req.params.id,
        type: "combat_start",
        message: "Бой начался"
      });
    }
    res.json(combat?.toObject({ flattenMaps: true }) ?? { ok: true });
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
  "/chronicles/:id/combat/enemies",
  asyncHandler(async (req, res) => {
    const { name, dexterity, wits } = req.body ?? {};
    if (!name || typeof name !== "string") {
      res.status(400).json({ message: "Имя обязательно" });
      return;
    }
    const safeName = name.trim().slice(0, 80);
    const dex = Number(dexterity ?? 0);
    const wit = Number(wits ?? 0);
    const combat = await CombatStateModel.findOneAndUpdate(
      { chronicleId: req.params.id },
      {
        $push: {
          enemies: {
            name: safeName,
            dexterity: Number.isFinite(dex) ? dex : 0,
            wits: Number.isFinite(wit) ? wit : 0,
            health: { bashing: 0, lethal: 0, aggravated: 0 },
            dead: false
          }
        }
      },
      { new: true, upsert: true }
    ).lean();
    const enemy = (combat as any)?.enemies?.[(combat as any)?.enemies?.length - 1];
    res.status(201).json(enemy);
  })
);

router.patch(
  "/chronicles/:id/combat/enemies/:enemyId",
  asyncHandler(async (req, res) => {
    const { health, dead, initiative, name } = req.body ?? {};
    const updates: Record<string, unknown> = {};
    if (health && typeof health === "object") {
      updates["enemies.$.health"] = health;
    }
    if (typeof dead === "boolean") {
      updates["enemies.$.dead"] = dead;
    }
    if (initiative && typeof initiative === "object") {
      updates["enemies.$.initiative"] = initiative;
    }
    if (typeof name === "string" && name.trim().length > 0) {
      updates["enemies.$.name"] = name.trim().slice(0, 80);
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: "Нет данных для обновления" });
      return;
    }
    const combat = await CombatStateModel.findOneAndUpdate(
      { chronicleId: req.params.id, "enemies._id": req.params.enemyId },
      { $set: updates },
      { new: true }
    ).lean();
    const enemy = (combat as any)?.enemies?.find(
      (item: any) => String(item._id) === String(req.params.enemyId)
    );
    if (!enemy) {
      res.status(404).json({ message: "Противник не найден" });
      return;
    }
    res.json(enemy);
  })
);

router.delete(
  "/chronicles/:id/combat",
  asyncHandler(async (req, res) => {
    await CombatStateModel.findOneAndUpdate(
      { chronicleId: req.params.id },
      { $set: { initiatives: {}, enemies: [], active: false } },
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

