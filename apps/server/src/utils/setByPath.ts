export function setByPath(target: any, path: string, value: unknown) {
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

