import { performance } from "node:perf_hooks";
import type { ValidationIssue } from "./contracts";

export type ValidationStageName =
  | "preprocess_patch"
  | "build_context"
  | "structural_rules"
  | "domain_rules"
  | "normalize_issues";

export type ValidationPipelineState = {
  issues: ValidationIssue[];
  failFast: boolean;
};

export type ValidationPipelineStage<T extends ValidationPipelineState> = {
  name: ValidationStageName;
  run: (state: T) => Promise<T> | T;
};

export type ValidationPipelineTrace = Array<{
  stage: ValidationStageName;
  durationMs: number;
  issueCount: number;
}>;

export async function runValidationPipeline<T extends ValidationPipelineState>(
  initialState: T,
  stages: Array<ValidationPipelineStage<T>>
) {
  let state = initialState;
  const trace: ValidationPipelineTrace = [];

  for (const stage of stages) {
    const before = state.issues.length;
    const startedAt = performance.now();
    state = await stage.run(state);
    const durationMs = performance.now() - startedAt;
    trace.push({
      stage: stage.name,
      durationMs,
      issueCount: state.issues.length - before
    });

    if (state.failFast && state.issues.length > 0) {
      break;
    }
  }

  return { state, trace };
}
