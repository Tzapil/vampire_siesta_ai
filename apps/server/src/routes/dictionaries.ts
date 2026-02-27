import { Router } from "express";
import {
  AbilityModel,
  AttributeModel,
  BackgroundModel,
  ClanModel,
  DemeanorModel,
  DisciplineModel,
  FlawModel,
  GenerationModel,
  MeritModel,
  NatureModel,
  SectModel,
  VirtueModel
} from "../db";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get(
  "/clans",
  asyncHandler(async (_req, res) => {
    const items = await ClanModel.find()
      .select("key labelRu disciplineKeys rules -_id")
      .lean();
    res.json(items);
  })
);

router.get(
  "/disciplines",
  asyncHandler(async (_req, res) => {
    const items = await DisciplineModel.find()
      .select("key labelRu -_id")
      .lean();
    res.json(items);
  })
);

router.get(
  "/attributes",
  asyncHandler(async (_req, res) => {
    const items = await AttributeModel.find()
      .select("key labelRu group -_id")
      .lean();
    res.json(items);
  })
);

router.get(
  "/abilities",
  asyncHandler(async (_req, res) => {
    const items = await AbilityModel.find()
      .select("key labelRu group -_id")
      .lean();
    res.json(items);
  })
);

router.get(
  "/backgrounds",
  asyncHandler(async (_req, res) => {
    const items = await BackgroundModel.find()
      .select("key labelRu -_id")
      .lean();
    res.json(items);
  })
);

router.get(
  "/virtues",
  asyncHandler(async (_req, res) => {
    const items = await VirtueModel.find().select("key labelRu -_id").lean();
    res.json(items);
  })
);

router.get(
  "/merits",
  asyncHandler(async (_req, res) => {
    const items = await MeritModel.find().select("key labelRu pointCost -_id").lean();
    res.json(items);
  })
);

router.get(
  "/flaws",
  asyncHandler(async (_req, res) => {
    const items = await FlawModel.find().select("key labelRu pointCost -_id").lean();
    res.json(items);
  })
);

router.get(
  "/sects",
  asyncHandler(async (_req, res) => {
    const items = await SectModel.find().select("key labelRu -_id").lean();
    res.json(items);
  })
);

router.get(
  "/natures",
  asyncHandler(async (_req, res) => {
    const items = await NatureModel.find().select("key labelRu -_id").lean();
    res.json(items);
  })
);

router.get(
  "/demeanors",
  asyncHandler(async (_req, res) => {
    const items = await DemeanorModel.find().select("key labelRu -_id").lean();
    res.json(items);
  })
);

router.get(
  "/generations",
  asyncHandler(async (_req, res) => {
    const items = await GenerationModel.find()
      .select("generation bloodPoolMax bloodPerTurn -_id")
      .lean();
    res.json(items);
  })
);

export default router;

