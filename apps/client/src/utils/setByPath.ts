export function setByPath<T>(obj: T, path: string, value: unknown): T {
  const parts = path.split(".");
  const root: any = Array.isArray(obj) ? [...(obj as any)] : { ...(obj as any) };
  let cursor: any = root;
  let source: any = obj as any;

  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    const sourceValue = source?.[key];
    const next = Array.isArray(sourceValue) ? [...sourceValue] : { ...(sourceValue ?? {}) };
    cursor[key] = next;
    cursor = next;
    source = sourceValue;
  }

  cursor[parts[parts.length - 1]] = value as any;
  return root as T;
}
