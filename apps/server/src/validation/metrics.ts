import type { ValidationIssue } from "./contracts";

type MetricCounters = {
  validations: number;
  totalDurationMs: number;
  dictionaryCacheHits: number;
  dictionaryCacheMisses: number;
  rejectionByCode: Record<string, number>;
};

type MetricsSnapshot = {
  validations: number;
  averageDurationMs: number;
  dictionaryCache: { hits: number; misses: number };
  rejectionByCode: Record<string, number>;
};

class ValidationMetricsCollector {
  private counters: MetricCounters = {
    validations: 0,
    totalDurationMs: 0,
    dictionaryCacheHits: 0,
    dictionaryCacheMisses: 0,
    rejectionByCode: {}
  };

  recordValidation(durationMs: number, issues: ValidationIssue[]) {
    this.counters.validations += 1;
    this.counters.totalDurationMs += durationMs;
    for (const item of issues) {
      this.counters.rejectionByCode[item.code] = (this.counters.rejectionByCode[item.code] ?? 0) + 1;
    }
  }

  recordDictionaryCache(hit: boolean) {
    if (hit) {
      this.counters.dictionaryCacheHits += 1;
      return;
    }
    this.counters.dictionaryCacheMisses += 1;
  }

  snapshot(): MetricsSnapshot {
    const averageDurationMs =
      this.counters.validations === 0 ? 0 : this.counters.totalDurationMs / this.counters.validations;

    return {
      validations: this.counters.validations,
      averageDurationMs,
      dictionaryCache: {
        hits: this.counters.dictionaryCacheHits,
        misses: this.counters.dictionaryCacheMisses
      },
      rejectionByCode: { ...this.counters.rejectionByCode }
    };
  }
}

export const validationMetrics = new ValidationMetricsCollector();
