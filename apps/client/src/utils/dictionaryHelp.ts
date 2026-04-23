import type { DictItem } from "../api/types";

type DictionaryHelpSource = Partial<
  Pick<DictItem, "description" | "category"> & {
    specializationAt: number;
    specializationDescription: string;
    pageRef: string;
  }
>;

const DISCIPLINE_CATEGORY_LABELS: Record<string, string> = {
  physical: "Физическая",
  mental: "Ментальная",
  unique: "Уникальная"
};

export function joinHelpParts(...parts: Array<string | undefined | null>) {
  const text = parts
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join("\n\n");

  return text.length > 0 ? text : null;
}

export function formatSpecialization(at?: number, text?: string) {
  if (!text) return undefined;
  const prefix = at ? `Специализация (от ${at}): ` : "Специализация: ";
  return `${prefix}${text}`;
}

export function formatDictionaryCategory(category?: string) {
  if (!category) return undefined;
  return DISCIPLINE_CATEGORY_LABELS[category] ?? category;
}

export function buildDictionaryHelpText(item?: DictionaryHelpSource | null) {
  if (!item) return null;

  return joinHelpParts(
    item.description,
    formatSpecialization(item.specializationAt, item.specializationDescription),
    item.category ? `Категория: ${formatDictionaryCategory(item.category)}` : undefined,
    item.pageRef ? `Источник: ${item.pageRef}` : undefined
  );
}
