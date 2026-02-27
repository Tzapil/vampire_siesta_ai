import { GenerationModel } from "../db";

export async function deriveFromGeneration(generation: number) {
  const record = await GenerationModel.findOne({ generation }).lean();
  if (!record) {
    throw new Error("Поколение не найдено");
  }
  return {
    bloodPoolMax: record.bloodPoolMax,
    bloodPerTurn: record.bloodPerTurn,
    willpowerMax: 10,
    humanityMax: 10,
    startingHumanity: 0,
    startingWillpower: 0
  };
}

