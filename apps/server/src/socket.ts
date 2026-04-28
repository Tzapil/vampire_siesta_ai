import { Server, Socket } from "socket.io";
import { setByPathMutable } from "@siesta/shared";
import { getAuthErrorMessage } from "./auth/errors";
import type { AuthService } from "./auth/service";
import { CharacterModel, ChronicleModel } from "./db";
import {
  applyClanRules,
  applyGenerationDerived,
  computeFreebieBudget,
  computeFreebieSpent,
  getLayer,
  getStepForPath,
  loadDictionaries,
  recalcFlawFreebie,
  setLayer,
  rollbackFreebies,
  WIZARD_STEPS,
  validateRanges
} from "./validation/characterValidation";
import { characterValidationService } from "./validation/service";

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

function rejectIssues(issues: Array<{ path: string; message: string }>): PatchResult {
  return { ok: false, errors: issues };
}

function getSocketMeta(socket: Socket) {
  return {
    ip: socket.handshake.address || undefined,
    userAgent:
      typeof socket.handshake.headers["user-agent"] === "string"
        ? socket.handshake.headers["user-agent"]
        : undefined
  };
}

export function registerSocket(io: Server, authService: AuthService) {
  io.use(async (socket, next) => {
    try {
      const resolution = await authService.resolveRequest(
        socket.request.headers.cookie,
        getSocketMeta(socket),
        {
          touchSession: true,
          allowCookieRefresh: false
        }
      );

      if (!resolution.auth) {
        next(new Error(getAuthErrorMessage("unauthorized")));
        return;
      }

      socket.data.auth = resolution.auth;
      next();
    } catch (error) {
      next(error as Error);
    }
  });

  io.on("connection", (socket) => {
    socket.use(async (_packet, next) => {
      try {
        const resolution = await authService.resolveRequest(
          socket.request.headers.cookie,
          getSocketMeta(socket),
          {
            touchSession: true,
            allowCookieRefresh: false
          }
        );

        if (!resolution.auth) {
          socket.emit("auth:error", { message: getAuthErrorMessage("unauthorized") });
          socket.disconnect();
          next(new Error(getAuthErrorMessage("unauthorized")));
          return;
        }

        socket.data.auth = resolution.auth;
        next();
      } catch (error) {
        next(error as Error);
      }
    });

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
        if (!patch || typeof patch !== "object") {
          callback(reject("Неверный формат патча"));
          return;
        }
        if (!patch.characterUuid || typeof patch.characterUuid !== "string") {
          callback(reject("Не указан персонаж"));
          return;
        }
        if (patch.op !== "set") {
          callback(reject("Неверный формат патча"));
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

        const dict = await loadDictionaries();

        const preValidation = await characterValidationService.validatePatchStructure({
          patch,
          character,
          dictionaries: dict,
          chronicleExists: async (chronicleId) => Boolean(await ChronicleModel.exists({ _id: chronicleId }))
        });
        if (preValidation.issues.length > 0 || !preValidation.patch) {
          callback(rejectIssues(preValidation.issues.map((item) => ({ path: item.path, message: item.message }))));
          return;
        }
        patch = preValidation.patch;

        if (preValidation.traitPatch) {
          const { group, key } = preValidation.traitPatch;
          const container = character.traits?.[group as keyof typeof character.traits];
          if (container) {
            const current = getLayer(container, key);
            setLayer(container, key, current);
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

        setByPathMutable(character, patch.path, patch.value);

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
          socket.to(patch.characterUuid).emit("patchApplied", {
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
