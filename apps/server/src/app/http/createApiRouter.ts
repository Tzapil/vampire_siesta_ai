import { Router } from "express";
import type { AuthService } from "../../auth/service";
import { attachRequestAuth, requireAuth } from "../../middleware/auth";
import { createAuthRouter } from "../../routes/auth";
import charactersRouter from "../../routes/characters";
import chroniclesRouter from "../../routes/chronicles";
import dictionariesRouter from "../../routes/dictionaries";
import homeRouter from "../../routes/home";
import npcsRouter from "../../routes/npcs";
import {
  getValidationDictionaryCacheStats,
  getValidationMetricsSnapshot,
  invalidateValidationDictionaryCache
} from "../../validation/characterValidation";

export function createApiRouter(authService: AuthService) {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  router.use("/auth", createAuthRouter(authService));
  router.use(attachRequestAuth(authService), requireAuth);

  router.get("/validation/metrics", (_req, res) => {
    res.json({
      metrics: getValidationMetricsSnapshot(),
      dictionaryCache: getValidationDictionaryCacheStats()
    });
  });

  router.post("/validation/dictionaries/invalidate", (_req, res) => {
    invalidateValidationDictionaryCache();
    res.json({ ok: true });
  });

  router.use(dictionariesRouter);
  router.use(homeRouter);
  router.use(chroniclesRouter);
  router.use(npcsRouter);
  router.use(charactersRouter);

  router.use((req, res) => {
    res.status(404).json({ message: "Маршрут не найден" });
  });

  return router;
}
