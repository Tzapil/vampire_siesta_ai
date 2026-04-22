export function sanitizeCharacterForExport(character: Record<string, unknown>) {
  const payload: Record<string, unknown> = { ...character };

  delete payload.uuid;
  delete payload._id;
  delete payload.__v;
  delete payload.createdByUserId;
  delete payload.createdByDisplayName;

  if (payload.meta && typeof payload.meta === "object" && !Array.isArray(payload.meta)) {
    const meta = { ...(payload.meta as Record<string, unknown>) };
    delete meta.playerName;
    payload.meta = meta;
  }

  return payload;
}
