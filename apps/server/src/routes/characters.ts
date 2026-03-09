import { Router } from "express";
import {
  AbilityModel,
  AttributeModel,
  BackgroundModel,
  CharacterModel,
  ChronicleModel,
  DisciplineModel,
  VirtueModel
} from "../db";
import { asyncHandler } from "../utils/asyncHandler";
import { generateUuid } from "../utils/uuid";
import { deriveFromGeneration } from "../utils/derived";
import {
  WIZARD_STEPS,
  computeRemainingFreebies,
  getLayer,
  loadDictionaries,
  validateAllWizardSteps,
  validateWizardStep
} from "../validation/characterValidation";

const router = Router();

function buildLayeredRecord(keys: string[], base: number) {
  return Object.fromEntries(
    keys.map((key) => [key, { base, freebie: 0, storyteller: 0 }])
  );
}

router.post(
  "/characters",
  asyncHandler(async (_req, res) => {
    const requestedChronicleId =
      typeof _req.body?.chronicleId === "string" ? _req.body.chronicleId.trim() : "";
    let chronicle = null;
    if (requestedChronicleId) {
      chronicle = await ChronicleModel.findById(requestedChronicleId);
      if (!chronicle) {
        res.status(404).json({ message: "Хроника не найдена" });
        return;
      }
    } else {
      chronicle = await ChronicleModel.findOne({ name: "Без хроники" });
      if (!chronicle) {
        chronicle = await ChronicleModel.create({ name: "Без хроники" });
      }
    }

    const [attributes, abilities, disciplines, backgrounds, virtues] =
      await Promise.all([
        AttributeModel.find().lean(),
        AbilityModel.find().lean(),
        DisciplineModel.find().lean(),
        BackgroundModel.find().lean(),
        VirtueModel.find().lean()
      ]);

    const traits = {
      attributes: buildLayeredRecord(
        attributes.map((a) => a.key),
        1
      ),
      abilities: buildLayeredRecord(abilities.map((a) => a.key), 0),
      disciplines: buildLayeredRecord(disciplines.map((d) => d.key), 0),
      backgrounds: buildLayeredRecord(backgrounds.map((b) => b.key), 0),
      virtues: buildLayeredRecord(virtues.map((v) => v.key), 1),
      merits: [],
      flaws: []
    };

    const derived = await deriveFromGeneration(13);

    const character = await CharacterModel.create({
      uuid: generateUuid(),
      creationFinished: false,
      wizard: { currentStep: 1 },
      meta: {
        name: "",
        playerName: "",
        concept: "",
        sire: "",
        chronicleId: chronicle._id,
        clanKey: "",
        generation: 13,
        sectKey: "",
        natureKey: "",
        demeanorKey: ""
      },
      creation: {
        attributesPriority: {
          physical: "primary",
          social: "secondary",
          mental: "tertiary"
        },
        abilitiesPriority: {
          talents: "primary",
          skills: "secondary",
          knowledges: "tertiary"
        },
        flawFreebieEarned: 0,
        freebieBuys: { humanity: 0, willpower: 0 }
      },
      derived,
      traits,
      resources: {
        bloodPool: { current: 0 },
        willpower: { current: 0 },
        humanity: { current: 0 },
        health: { bashing: 0, lethal: 0, aggravated: 0 }
      },
      notes: "",
      equipment: ""
    });

    res.json(character);
  })
);

router.get(
  "/characters/:uuid",
  asyncHandler(async (req, res) => {
    const character = await CharacterModel.findOne({
      uuid: req.params.uuid,
      deleted: false
    }).lean();

    if (!character) {
      res.status(404).json({ message: "Персонаж не найден" });
      return;
    }

    res.json(character);
  })
);

router.delete(
  "/characters/:uuid",
  asyncHandler(async (req, res) => {
    const updated = await CharacterModel.findOneAndUpdate(
      { uuid: req.params.uuid, deleted: false },
      { deleted: true, deletedAt: new Date() },
      { new: true }
    ).lean();

    if (!updated) {
      res.status(404).json({ message: "Персонаж не найден" });
      return;
    }

    res.json({ ok: true });
  })
);

router.get(
  "/characters/:uuid/export",
  asyncHandler(async (req, res) => {
    const character = await CharacterModel.findOne({
      uuid: req.params.uuid,
      deleted: false
    }).lean();

    if (!character) {
      res.status(404).json({ message: "Персонаж не найден" });
      return;
    }

    const { uuid, _id, __v, ...rest } = character as any;
    res.json(rest);
  })
);

router.post(
  "/characters/:uuid/import",
  asyncHandler(async (req, res) => {
    const character = await CharacterModel.findOne({ uuid: req.params.uuid, deleted: false });
    if (!character) {
      res.status(404).json({ message: "Персонаж не найден" });
      return;
    }

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      res.status(400).json({ errors: [{ path: "body", message: "Неверный формат JSON" }] });
      return;
    }

    const payload = { ...(req.body as any) };
    delete payload.uuid;
    delete payload._id;
    delete payload.__v;

    character.overwrite({
      ...payload,
      uuid: character.uuid,
      deleted: false,
      deletedAt: undefined,
      version: character.version
    });

    const dict = await loadDictionaries();
    const errors = await validateAllWizardSteps(character, dict, { mutate: false });

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

    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }

    character.version += 1;
    await character.save();
    res.json({ ok: true });
  })
);

router.post(
  "/characters/:uuid/wizard/next",
  asyncHandler(async (req, res) => {
    const character = await CharacterModel.findOne({ uuid: req.params.uuid, deleted: false });
    if (!character || character.creationFinished) {
      res.status(404).json({ message: "Мастер создания недоступен" });
      return;
    }

    const dict = await loadDictionaries();
    const step = character.wizard?.currentStep ?? 1;
    const errors = await validateWizardStep(character, step, dict);

    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }

    const nextStep = Math.min(step + 1, WIZARD_STEPS);
    character.wizard = { currentStep: nextStep };
    character.version += 1;
    await character.save();

    res.json({ ok: true, currentStep: nextStep, version: character.version });
  })
);

router.post(
  "/characters/:uuid/wizard/back",
  asyncHandler(async (req, res) => {
    const character = await CharacterModel.findOne({ uuid: req.params.uuid, deleted: false });
    if (!character || character.creationFinished) {
      res.status(404).json({ message: "Мастер создания недоступен" });
      return;
    }

    const current = character.wizard?.currentStep ?? 1;
    const nextStep = Math.max(current - 1, 1);
    character.wizard = { currentStep: nextStep };
    character.version += 1;
    await character.save();

    res.json({ ok: true, currentStep: nextStep, version: character.version });
  })
);

router.post(
  "/characters/:uuid/wizard/goto",
  asyncHandler(async (req, res) => {
    const character = await CharacterModel.findOne({ uuid: req.params.uuid, deleted: false });
    if (!character || character.creationFinished) {
      res.status(404).json({ message: "Мастер создания недоступен" });
      return;
    }

    const targetStep = Number(req.body?.targetStep ?? 0);
    const current = character.wizard?.currentStep ?? 1;
    if (Number.isNaN(targetStep) || targetStep < 1 || targetStep > current) {
      res.status(400).json({ message: "Недопустимый шаг" });
      return;
    }

    character.wizard = { currentStep: targetStep };
    character.version += 1;
    await character.save();

    res.json({ ok: true, currentStep: targetStep, version: character.version });
  })
);

router.post(
  "/characters/:uuid/wizard/finish",
  asyncHandler(async (req, res) => {
    const character = await CharacterModel.findOne({ uuid: req.params.uuid, deleted: false });
    if (!character || character.creationFinished) {
      res.status(404).json({ message: "Мастер создания недоступен" });
      return;
    }

    const dict = await loadDictionaries();
    const errors = await validateAllWizardSteps(character, dict);
    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }

    const remaining = computeRemainingFreebies(character, dict);
    if (remaining > 0 && !req.body?.confirmBurn) {
      res.json({ warning: true, message: "Остались непотраченные очки" });
      return;
    }

    const conscience = getLayer(character.traits?.virtues, "conscience");
    const selfControl = getLayer(character.traits?.virtues, "selfControl");
    const courage = getLayer(character.traits?.virtues, "courage");

    const totalConscience = conscience.base + conscience.freebie + conscience.storyteller;
    const totalSelfControl = selfControl.base + selfControl.freebie + selfControl.storyteller;
    const totalCourage = courage.base + courage.freebie + courage.storyteller;

    if (!character.derived) {
      character.derived = await deriveFromGeneration(character.meta?.generation ?? 13);
    }

    character.derived.startingHumanity = totalConscience + totalSelfControl;
    character.derived.startingWillpower = totalCourage;
    character.resources = {
      bloodPool: { current: character.derived.bloodPoolMax ?? 0 },
      willpower: { current: character.derived.startingWillpower },
      humanity: { current: character.derived.startingHumanity },
      health: character.resources?.health ?? { bashing: 0, lethal: 0, aggravated: 0 }
    };
    character.creationFinished = true;
    character.wizard = undefined;
    character.version += 1;

    await character.save();
    res.json({ ok: true });
  })
);

export default router;

