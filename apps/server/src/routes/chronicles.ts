import { Router } from "express";
import { ChronicleModel, CharacterModel } from "../db";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

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
      .select("uuid meta.name creationFinished meta.chronicleId")
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

export default router;

