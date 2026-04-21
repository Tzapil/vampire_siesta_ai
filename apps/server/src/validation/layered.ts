export type LayeredValue = { base: number; freebie: number; storyteller: number };

function emptyLayer(): LayeredValue {
  return { base: 0, freebie: 0, storyteller: 0 };
}

export function isMap(value: unknown): value is Map<string, any> {
  return value instanceof Map;
}

export function getLayer(container: any, key: string): LayeredValue {
  if (!container) {
    return emptyLayer();
  }

  const entry = isMap(container) ? container.get(key) : container[key];
  if (!entry) {
    return emptyLayer();
  }

  return {
    base: Number(entry.base ?? 0),
    freebie: Number(entry.freebie ?? 0),
    storyteller: Number(entry.storyteller ?? 0)
  };
}

export function setLayer(container: any, key: string, value: LayeredValue) {
  if (isMap(container)) {
    container.set(key, value);
    return;
  }
  container[key] = value;
}

export function sumLayered(value: LayeredValue) {
  return value.base + value.freebie + value.storyteller;
}

export function sumFreebieDots(container: any) {
  if (!container) {
    return 0;
  }

  const values = isMap(container) ? Array.from(container.values()) : Object.values(container);
  return values.reduce((sum: number, layer: any) => sum + Number(layer?.freebie ?? 0), 0);
}
