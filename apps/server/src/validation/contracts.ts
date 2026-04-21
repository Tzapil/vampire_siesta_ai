import type { Dictionaries } from "./dictionaryProvider";

export type ValidationSeverity = "error" | "warning";

export type ValidationIssue = {
  code: string;
  path: string;
  message: string;
  severity: ValidationSeverity;
};

export type ValidationError = {
  path: string;
  message: string;
};

export type ValidationResult = {
  issues: ValidationIssue[];
  durationMs: number;
};

export type ChronicleExistsFn = (chronicleId: unknown) => Promise<boolean>;

export type ValidationContext = {
  character: any;
  dictionaries: Dictionaries;
  mutate: boolean;
  allowNonClanDisciplines: boolean;
  chronicleExists?: ChronicleExistsFn;
};

export function issue(code: string, path: string, message: string, severity: ValidationSeverity = "error"): ValidationIssue {
  return { code, path, message, severity };
}

export function toValidationErrors(issues: ValidationIssue[]): ValidationError[] {
  return issues
    .filter((item) => item.severity === "error")
    .map((item) => ({ path: item.path, message: item.message }));
}
