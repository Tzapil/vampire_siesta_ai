export function setByPathImmutable<T>(obj: T, path: string, value: unknown): T {
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

export function setByPathMutable(target: any, path: string, value: unknown) {
  const parts = path.split(".");
  let obj: any = target;

  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (obj instanceof Map) {
      if (!obj.has(key)) {
        obj.set(key, {});
      }
      obj = obj.get(key);
      continue;
    }

    if (obj[key] === undefined) {
      obj[key] = {};
    }
    obj = obj[key];
  }

  const last = parts[parts.length - 1];
  if (obj instanceof Map) {
    obj.set(last, value);
  } else {
    obj[last] = value;
  }
}
