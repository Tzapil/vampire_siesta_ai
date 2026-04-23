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
    delete meta.chronicleId;
    payload.meta = meta;
  }

  return payload;
}

export type ChronicleImportIdentity = {
  uuid: string;
  chronicleId: unknown;
  createdByUserId: unknown;
  createdByDisplayName: string;
  playerName: string;
};

function toPlainRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function sanitizeCharacterForChronicleImport(
  character: Record<string, unknown>,
  identity: ChronicleImportIdentity
) {
  const payload: Record<string, unknown> = { ...character };

  delete payload.uuid;
  delete payload._id;
  delete payload.id;
  delete payload.__v;
  delete payload.version;
  delete payload.createdByUserId;
  delete payload.createdByDisplayName;
  delete payload.createdAt;
  delete payload.updatedAt;
  delete payload.deleted;
  delete payload.deletedAt;

  const meta = { ...toPlainRecord(payload.meta) };
  delete meta.playerName;
  delete meta.chronicleId;

  return {
    ...payload,
    uuid: identity.uuid,
    createdByUserId: identity.createdByUserId,
    createdByDisplayName: identity.createdByDisplayName,
    deleted: false,
    meta: {
      ...meta,
      playerName: identity.playerName,
      chronicleId: identity.chronicleId
    }
  };
}
