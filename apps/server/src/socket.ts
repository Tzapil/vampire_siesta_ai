import { Server } from "socket.io";
import { CharacterModel, ChronicleModel } from "./db";
import { setByPath } from "./utils/setByPath";
import {
  applyClanRules,
  applyGenerationDerived,
  computeFreebieBudget,
  computeFreebieSpent,
  getLayer,
  getStepForPath,
  isPatchAllowed,
  loadDictionaries,
  recalcFlawFreebie,
  setLayer,
  rollbackFreebies,
  WIZARD_STEPS,
  validateRanges
} from "./validation/characterValidation";

export type Patch = {
  characterUuid: string;
  baseVersion: number;
  op: "set";
  path: string;
  value: unknown;
};

type PatchResult =
  | { ok: true; newVersion: number; resync?: boolean }
  | { ok: false; errors: Array<{ path: string; message: string }> };

function reject(message: string, path = "patch"): PatchResult {
  return { ok: false, errors: [{ path, message }] };
}

export function registerSocket(io: Server) {
  io.on("connection", (socket) => {
    const queryUuid = socket.handshake.query.uuid;
    if (typeof queryUuid === "string" && queryUuid) {
      socket.join(queryUuid);
      console.log(`Socket joined room ${queryUuid}`);
    }

    socket.on("join", (payload: { uuid?: string }) => {
      if (payload?.uuid) {
        socket.join(payload.uuid);
        console.log(`Socket joined room ${payload.uuid}`);
      }
    });

    socket.on("patch", async (patch: Patch, callback: (result: PatchResult) => void) => {
      try {
        if (!patch || patch.op !== "set") {
          callback(reject("Неверный формат патча"));
          return;
        }
        if (!patch.characterUuid || typeof patch.characterUuid !== "string") {
          callback(reject("Не указан персонаж"));
          return;
        }
        if (!patch.path || typeof patch.path !== "string") {
          callback(reject("Не указан путь"));
          return;
        }

        const character = await CharacterModel.findOne({
          uuid: patch.characterUuid,
          deleted: false
        });

        if (!character) {
          callback(reject("Персонаж не найден"));
          return;
        }

        if (patch.baseVersion !== character.version) {
          callback(reject("Версия не совпадает", "version"));
          return;
        }

        if (!isPatchAllowed(patch.path, character.creationFinished)) {
          callback(reject("Недопустимый путь для изменения", patch.path));
          return;
        }

        const dict = await loadDictionaries();

        const traitMatch = patch.path.match(
          /^traits\.(attributes|abilities|disciplines|backgrounds|virtues)\.([^.]+)\.(base|freebie|storyteller)$/
        );
        if (traitMatch) {
          const [, group, key, layerName] = traitMatch;
          const exists = (() => {
            if (group === "attributes") return dict.attributes.some((item) => item.key === key);
            if (group === "abilities") return dict.abilities.some((item) => item.key === key);
            if (group === "disciplines") return dict.disciplines.some((item) => item.key === key);
            if (group === "backgrounds") return dict.backgrounds.some((item) => item.key === key);
            if (group === "virtues") return dict.virtues.some((item) => item.key === key);
            return false;
          })();
          if (!exists) {
            callback(reject("Неизвестный ключ справочника", patch.path));
            return;
          }

          if (typeof patch.value !== "number" || Number.isNaN(patch.value)) {
            callback(reject("Значение должно быть числом", patch.path));
            return;
          }

          if (layerName === "freebie" && patch.value < 0) {
            callback(reject("Свободные очки не могут быть отрицательными", patch.path));
            return;
          }

          if (layerName === "base") {
            if (group === "attributes") {
              const clan = dict.clans.get(character.meta?.clanKey ?? "");
              const fixedAppearance = clan?.rules?.appearanceFixedTo === 0;
              const minBase = key === "appearance" && fixedAppearance ? 0 : 1;
              if (patch.value < minBase || patch.value > 5) {
                callback(reject("Недопустимая база атрибута", patch.path));
                return;
              }
            } else if (group === "virtues") {
              if (patch.value < 1 || patch.value > 5) {
                callback(reject("Недопустимая база добродетели", patch.path));
                return;
              }
            } else if (group === "disciplines") {
              if (patch.value < 0 || patch.value > 3) {
                callback(reject("База дисциплины должна быть от 0 до 3", patch.path));
                return;
              }
            } else if (patch.value < 0 || patch.value > 5) {
              callback(reject("Недопустимая база", patch.path));
              return;
            }
          }

          const container = character.traits?.[group as keyof typeof character.traits];
          if (container) {
            const current = getLayer(container, key);
            setLayer(container, key, current);
          }
        }

        if (patch.path.startsWith("creation.attributesPriority") || patch.path.startsWith("creation.abilitiesPriority")) {
          const allowed = new Set(["primary", "secondary", "tertiary"]);
          if (typeof patch.value !== "string" || !allowed.has(patch.value)) {
            callback(reject("Недопустимое значение приоритета", patch.path));
            return;
          }
        }

        if (patch.path.startsWith("creation.freebieBuys.")) {
          if (typeof patch.value !== "number" || patch.value < 0 || !Number.isInteger(patch.value)) {
            callback(reject("Значение должно быть неотрицательным целым", patch.path));
            return;
          }
        }

        if (patch.path.startsWith("meta.sectKey")) {
          if (typeof patch.value !== "string" || !dict.sects.has(patch.value)) {
            callback(reject("Недопустимая секта", patch.path));
            return;
          }
        }

        if (patch.path.startsWith("meta.chronicleId")) {
          const exists = await ChronicleModel.exists({ _id: patch.value });
          if (!exists) {
            callback(reject("Хроника не найдена", patch.path));
            return;
          }
        }

        if (patch.path.startsWith("meta.natureKey")) {
          if (typeof patch.value !== "string" || !dict.natures.has(patch.value)) {
            callback(reject("Недопустимая натура", patch.path));
            return;
          }
        }

        if (patch.path.startsWith("meta.demeanorKey")) {
          if (typeof patch.value !== "string" || !dict.demeanors.has(patch.value)) {
            callback(reject("Недопустимое поведение", patch.path));
            return;
          }
        }

        if (patch.path === "traits.merits" || patch.path === "traits.flaws") {
          if (!Array.isArray(patch.value) || patch.value.some((item) => typeof item !== "string")) {
            callback(reject("Неверный формат списка", patch.path));
            return;
          }
        }

        let resync = false;
        let rollback = false;

        const previousStep = character.wizard?.currentStep ?? 1;

        if (!character.creationFinished && character.wizard?.currentStep != null) {
          if (character.wizard.currentStep > WIZARD_STEPS) {
            character.wizard.currentStep = WIZARD_STEPS;
            resync = true;
          }
        }

        setByPath(character, patch.path, patch.value);

        const stepForPath = getStepForPath(patch.path, character.wizard?.currentStep ?? 1);
        if (!character.creationFinished && stepForPath && character.wizard) {
          if (previousStep > stepForPath) {
            character.wizard.currentStep = stepForPath;
            resync = true;
          }
        }

        if (patch.path === "meta.clanKey") {
          if (!dict.clans.has(character.meta?.clanKey ?? "")) {
            callback(reject("Клан обязателен", patch.path));
            return;
          }
          const changed = applyClanRules(character, dict, character.creationFinished ? "st" : "wizard");
          if (changed) resync = true;
        }

        if (patch.path === "meta.generation") {
          const generation = Number(character.meta?.generation ?? 0);
          if (!dict.generations.has(generation)) {
            callback(reject("Поколение должно быть от 8 до 14", patch.path));
            return;
          }
          const changed = applyGenerationDerived(character, dict);
          if (changed) resync = true;
        }

        if (patch.path === "traits.merits") {
          const list = patch.value as string[];
          if (new Set(list).size !== list.length) {
            callback(reject("Повторяющиеся достоинства недопустимы", patch.path));
            return;
          }
          if (list.some((key) => !dict.merits.has(key))) {
            callback(reject("Неизвестное достоинство", patch.path));
            return;
          }
        }

        if (patch.path === "traits.flaws") {
          const list = patch.value as string[];
          if (new Set(list).size !== list.length) {
            callback(reject("Повторяющиеся недостатки недопустимы", patch.path));
            return;
          }
          if (list.some((key) => !dict.flaws.has(key))) {
            callback(reject("Неизвестный недостаток", patch.path));
            return;
          }
        }

        if (!character.creationFinished) {
          recalcFlawFreebie(character, dict);

          const budget = computeFreebieBudget(character, dict);
          const spent = computeFreebieSpent(character, dict);

          if (spent > budget) {
            if (patch.path === "traits.flaws" || (stepForPath && previousStep > stepForPath)) {
              rollback = rollbackFreebies(character, dict);
              if (rollback) resync = true;
            } else {
              callback(reject("Не хватает свободных очков", "creation.freebies"));
              return;
            }
          }
        }

        const rangeErrors = validateRanges(character, dict, {
          allowNonClanDisciplines: character.creationFinished
        });
        if (rangeErrors.length > 0) {
          callback({ ok: false, errors: rangeErrors });
          return;
        }

        character.version += 1;
        await character.save();

        if (resync) {
          io.to(patch.characterUuid).emit("resync", {
            reason: rollback ? "rollback" : "server-change"
          });
        } else {
          io.to(patch.characterUuid).emit("patchApplied", {
            characterUuid: patch.characterUuid,
            path: patch.path,
            value: patch.value,
            version: character.version
          });
        }

        callback({ ok: true, newVersion: character.version, resync });
      } catch (error) {
        console.error("Patch error:", error);
        callback(reject("Внутренняя ошибка сервера"));
      }
    });
  });
}

