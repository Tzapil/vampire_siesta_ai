import fs from "fs";
import path from "path";
import { connectToDatabase } from "./db/connection";
import { loadEnv } from "./utils/loadEnv";
import {
  AbilityModel,
  AttributeModel,
  BackgroundModel,
  ClanModel,
  DemeanorModel,
  DisciplineModel,
  FlawModel,
  GenerationModel,
  MeritModel,
  NatureModel,
  SectModel,
  VirtueModel
} from "./db";

type AbilityJsonItem = {
  id: string;
  name: string;
  specializationAt?: number;
  specializationDescription?: string;
  description?: string;
  pageRef?: string;
};

type AttributeJsonItem = AbilityJsonItem;

type DisciplineJsonItem = {
  id: string;
  name: string;
  category?: string;
  description?: string;
};

type ClanJsonItem = {
  id: string;
  name: string;
  disciplines: string[];
  weakness?: string;
};

type BackgroundJsonItem = {
  id: string;
  name: string;
  description?: string;
  maxValue?: number;
};

type ArchetypeJsonItem = {
  id: string;
  name: string;
  description?: string;
};

type KeyLabelJsonItem = {
  id: string;
  name: string;
  description?: string;
};

type MeritFlawJsonItem = {
  id: string;
  name: string;
  cost: number | "variable";
  minCost?: number;
  maxCost?: number;
  description?: string;
};

const DATA_DIR = path.resolve(__dirname, "../../../data");
function readJson<T>(fileName: string): T {
  const filePath = path.join(DATA_DIR, fileName);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

async function syncByKey(model: any, items: Array<Record<string, any>>) {
  const keys = items.map((item) => item.key);
  if (keys.length > 0) {
    await model.deleteMany({ key: { $nin: keys } });
  }
  await Promise.all(
    items.map((item) => model.updateOne({ key: item.key }, { $set: item }, { upsert: true }))
  );
}

function extractMeritsOrFlaws(data: Record<string, unknown>) {
  const items: Array<Record<string, any>> = [];
  for (const value of Object.values(data)) {
    if (!Array.isArray(value)) continue;
    for (const item of value as MeritFlawJsonItem[]) {
      const isVariable = item.cost === "variable";
      const minCost = isVariable ? item.minCost : undefined;
      const maxCost = isVariable ? item.maxCost : undefined;
      const pointCost = typeof item.cost === "number" ? item.cost : minCost ?? 1;
      items.push({
        key: item.id,
        labelRu: item.name,
        pointCost,
        description: item.description ?? "",
        minCost,
        maxCost
      });
    }
  }
  return items;
}

loadEnv();

async function seed() {
  await connectToDatabase(process.env.MONGO_URL);

  const generations = [
    { generation: 8, bloodPoolMax: 15, bloodPerTurn: 3 },
    { generation: 9, bloodPoolMax: 14, bloodPerTurn: 2 },
    { generation: 10, bloodPoolMax: 13, bloodPerTurn: 2 },
    { generation: 11, bloodPoolMax: 12, bloodPerTurn: 1 },
    { generation: 12, bloodPoolMax: 11, bloodPerTurn: 1 },
    { generation: 13, bloodPoolMax: 10, bloodPerTurn: 1 },
    { generation: 14, bloodPoolMax: 10, bloodPerTurn: 1 }
  ];

  await Promise.all(
    generations.map((item) =>
      GenerationModel.updateOne(
        { generation: item.generation },
        { $set: item },
        { upsert: true }
      )
    )
  );

  const disciplinesData = readJson<Record<string, DisciplineJsonItem[]>>("disciplines.json");
  const disciplines = Object.values(disciplinesData)
    .flat()
    .map((item) => ({
      key: item.id,
      labelRu: item.name,
      category: item.category,
      description: item.description ?? ""
    }));

  await syncByKey(DisciplineModel, disciplines);

  const clansData = readJson<ClanJsonItem[]>("clans.json");
  const clans = clansData.map((item) => ({
    key: item.id,
    labelRu: item.name,
    disciplineKeys: item.disciplines,
    weakness: item.weakness ?? "",
    rules: item.id === "nosferatu" ? { appearanceFixedTo: 0 } : {}
  }));

  await syncByKey(ClanModel, clans);

  const attributesData = readJson<Record<string, AttributeJsonItem[]>>("attributes.json");
  const attributes = Object.entries(attributesData).flatMap(([group, items]) =>
    items.map((item) => ({
      key: item.id,
      labelRu: item.name,
      group,
      specializationAt: item.specializationAt,
      specializationDescription: item.specializationDescription ?? "",
      description: item.description ?? "",
      pageRef: item.pageRef ?? ""
    }))
  );

  await syncByKey(AttributeModel, attributes);

  const abilitiesData = readJson<Record<string, AbilityJsonItem[]>>("abilities.json");
  const abilities = Object.entries(abilitiesData).flatMap(([group, items]) =>
    items.map((item) => ({
      key: item.id,
      labelRu: item.name,
      group,
      specializationAt: item.specializationAt,
      specializationDescription: item.specializationDescription ?? "",
      description: item.description ?? "",
      pageRef: item.pageRef ?? ""
    }))
  );

  await syncByKey(AbilityModel, abilities);

  const backgroundsData = readJson<BackgroundJsonItem[]>("backgrounds.json");
  const backgrounds = backgroundsData.map((item) => ({
    key: item.id,
    labelRu: item.name,
    description: item.description ?? "",
    maxValue: item.maxValue
  }));

  await syncByKey(BackgroundModel, backgrounds);

  const virtuesData = readJson<KeyLabelJsonItem[]>("virtues.json");
  const virtues = virtuesData.map((item) => ({
    key: item.id,
    labelRu: item.name,
    description: item.description ?? ""
  }));
  await syncByKey(VirtueModel, virtues);

  const sectsData = readJson<KeyLabelJsonItem[]>("sects.json");
  const sects = sectsData.map((item) => ({
    key: item.id,
    labelRu: item.name,
    description: item.description ?? ""
  }));
  await syncByKey(SectModel, sects);

  const archetypesData = readJson<ArchetypeJsonItem[]>("archetypes.json");
  const archetypes = archetypesData.map((item) => ({
    key: item.id,
    labelRu: item.name,
    description: item.description ?? ""
  }));

  await syncByKey(NatureModel, archetypes);
  await syncByKey(DemeanorModel, archetypes);

  const meritsData = readJson<Record<string, unknown>>("merits.json");
  await syncByKey(MeritModel, extractMeritsOrFlaws(meritsData));

  const flawsData = readJson<Record<string, unknown>>("flaws.json");
  await syncByKey(FlawModel, extractMeritsOrFlaws(flawsData));

  console.log("Seed завершён");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed завершился с ошибкой:", error);
  process.exit(1);
});
