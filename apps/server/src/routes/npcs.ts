import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { ChronicleNpcLinkModel, NpcModel } from "../db";
import { asyncHandler } from "../utils/asyncHandler";
import { presentNpc, presentNpcSummary } from "../utils/npcPresenter";
import {
  buildSearchRegex,
  normalizeNpcInput,
  normalizeSearchQuery
} from "../utils/npcValidation";

const router = Router();

router.get(
  "/npcs",
  asyncHandler(async (req, res) => {
    const search = normalizeSearchQuery(req.query.search);
    const filter: Record<string, unknown> = {
      deleted: { $ne: true }
    };

    if (search) {
      filter["meta.name"] = buildSearchRegex(search);
    }

    const npcs = await NpcModel.find(filter).sort({ createdAt: -1 }).lean();
    res.json(npcs.map((item) => presentNpcSummary(item)));
  })
);

router.post(
  "/npcs",
  asyncHandler(async (req, res) => {
    const authUser = req.auth?.user;
    if (!authUser) {
      res.status(401).json({ message: "Требуется авторизация" });
      return;
    }

    const { value, errors } = await normalizeNpcInput(req.body);
    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }

    const npc = await NpcModel.create({
      ...value,
      createdByUserId: authUser.id,
      createdByDisplayName: authUser.displayName
    });

    res.status(201).json(presentNpc(npc.toObject({ flattenMaps: true })));
  })
);

router.get(
  "/npcs/:id",
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      res.status(404).json({ message: "NPC не найден" });
      return;
    }

    const npc = await NpcModel.findOne({
      _id: req.params.id,
      deleted: { $ne: true }
    }).lean();

    if (!npc) {
      res.status(404).json({ message: "NPC не найден" });
      return;
    }

    res.json(presentNpc(npc));
  })
);

router.put(
  "/npcs/:id",
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      res.status(404).json({ message: "NPC не найден" });
      return;
    }

    const { value, errors } = await normalizeNpcInput(req.body);
    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }

    const npc = await NpcModel.findOneAndUpdate(
      {
        _id: req.params.id,
        deleted: { $ne: true }
      },
      { $set: value },
      { new: true }
    ).lean();

    if (!npc) {
      res.status(404).json({ message: "NPC не найден" });
      return;
    }

    res.json(presentNpc(npc));
  })
);

router.patch(
  "/npcs/:id",
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      res.status(404).json({ message: "NPC не найден" });
      return;
    }

    const { value, errors } = await normalizeNpcInput(req.body);
    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }

    const npc = await NpcModel.findOneAndUpdate(
      {
        _id: req.params.id,
        deleted: { $ne: true }
      },
      { $set: value },
      { new: true }
    ).lean();

    if (!npc) {
      res.status(404).json({ message: "NPC не найден" });
      return;
    }

    res.json(presentNpc(npc));
  })
);

router.delete(
  "/npcs/:id",
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      res.status(404).json({ message: "NPC не найден" });
      return;
    }

    const npc = await NpcModel.findOneAndUpdate(
      {
        _id: req.params.id,
        deleted: { $ne: true }
      },
      {
        $set: {
          deleted: true,
          deletedAt: new Date()
        }
      },
      { new: true }
    ).lean();

    if (!npc) {
      res.status(404).json({ message: "NPC не найден" });
      return;
    }

    await ChronicleNpcLinkModel.deleteMany({ npcId: req.params.id });

    res.json({ ok: true });
  })
);

export default router;
