import { Router } from "express";
import dictionariesRouter from "./dictionaries";
import chroniclesRouter from "./chronicles";
import charactersRouter from "./characters";
import {
  getValidationDictionaryCacheStats,
  getValidationMetricsSnapshot,
  invalidateValidationDictionaryCache
} from "../validation/characterValidation";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

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
router.use(chroniclesRouter);
router.use(charactersRouter);

router.use((req, res) => {
  res.status(404).json({ message: "Маршрут не найден" });
});

export default router;

