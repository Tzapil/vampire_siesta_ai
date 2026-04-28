import { ChronicleModel } from "../db";

export async function findActiveChronicleById(chronicleId: string) {
  return ChronicleModel.findOne({
    _id: chronicleId,
    deleted: { $ne: true }
  }).lean();
}

export async function findChronicleForAuthor(chronicleId: string, authUserId: string) {
  const chronicle = await findActiveChronicleById(chronicleId);
  if (!chronicle) {
    return { chronicle: null, status: 404 as const, message: "Хроника не найдена" };
  }

  if (!chronicle.createdByUserId || String(chronicle.createdByUserId) !== String(authUserId)) {
    return { chronicle: null, status: 403 as const, message: "Доступ запрещён" };
  }

  return { chronicle, status: 200 as const, message: "" };
}
