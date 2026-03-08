import { Router } from "express";
import { ChronicleImageModel, ChronicleLogModel, ChronicleModel, CharacterModel } from "../db";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
const MAX_CHRONICLE_IMAGE_LENGTH = 7_000_000;

router.get(
  "/chronicles",
  asyncHandler(async (_req, res) => {
    const items = await ChronicleModel.find().lean();
    res.json(items);
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

router.get(
  "/chronicles/:id/characters",
  asyncHandler(async (req, res) => {
    const characters = await CharacterModel.find({
      "meta.chronicleId": req.params.id,
      deleted: false
    })
      .select(
        "uuid meta.name meta.avatarUrl meta.playerName meta.clanKey meta.sectKey meta.generation creationFinished meta.chronicleId"
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

export default router;

