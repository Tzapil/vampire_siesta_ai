import "dotenv/config";
import { connectToDatabase } from "./db/connection";
import {
  AbilityModel,
  AttributeModel,
  BackgroundModel,
  ClanModel,
  ChronicleModel,
  DemeanorModel,
  DisciplineModel,
  FlawModel,
  GenerationModel,
  MeritModel,
  NatureModel,
  SectModel,
  VirtueModel
} from "./db";

async function upsertByKey(model: any, items: Array<Record<string, any>>) {
  await Promise.all(
    items.map((item) =>
      model.updateOne({ key: item.key }, { $set: item }, { upsert: true })
    )
  );
}

async function seed() {
  await connectToDatabase(process.env.MONGO_URL);

  await ChronicleModel.updateOne(
    { name: "Без хроники" },
    { $setOnInsert: { name: "Без хроники" } },
    { upsert: true }
  );

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

  await upsertByKey(DisciplineModel, [
    { key: "animalism", labelRu: "Анимализм" },
    { key: "obfuscate", labelRu: "Обфускация" },
    { key: "potence", labelRu: "Потенция" },
    { key: "celerity", labelRu: "Скорость" },
    { key: "presence", labelRu: "Присутствие" }
  ]);

  await upsertByKey(ClanModel, [
    {
      key: "nosferatu",
      labelRu: "Носферату",
      disciplineKeys: ["animalism", "obfuscate", "potence"],
      rules: { appearanceFixedTo: 0 }
    },
    {
      key: "brujah",
      labelRu: "Бруха",
      disciplineKeys: ["celerity", "potence", "presence"]
    }
  ]);

  await upsertByKey(AttributeModel, [
    { key: "strength", labelRu: "Сила", group: "physical" },
    { key: "dexterity", labelRu: "Ловкость", group: "physical" },
    { key: "stamina", labelRu: "Выносливость", group: "physical" },
    { key: "charisma", labelRu: "Харизма", group: "social" },
    { key: "manipulation", labelRu: "Манипуляция", group: "social" },
    { key: "appearance", labelRu: "Внешность", group: "social" },
    { key: "perception", labelRu: "Восприятие", group: "mental" },
    { key: "intelligence", labelRu: "Интеллект", group: "mental" },
    { key: "wits", labelRu: "Сообразительность", group: "mental" }
  ]);

  await upsertByKey(AbilityModel, [
    { key: "alertness", labelRu: "Бдительность", group: "talents" },
    { key: "athletics", labelRu: "Атлетика", group: "talents" },
    { key: "brawl", labelRu: "Драка", group: "talents" },
    { key: "empathy", labelRu: "Эмпатия", group: "talents" },
    { key: "expression", labelRu: "Самовыражение", group: "talents" },
    { key: "intimidation", labelRu: "Запугивание", group: "talents" },
    { key: "leadership", labelRu: "Лидерство", group: "talents" },
    { key: "streetwise", labelRu: "Уличная смекалка", group: "talents" },
    { key: "subterfuge", labelRu: "Уловки", group: "talents" },

    { key: "animalKen", labelRu: "Обращение с животными", group: "skills" },
    { key: "crafts", labelRu: "Ремёсла", group: "skills" },
    { key: "drive", labelRu: "Вождение", group: "skills" },
    { key: "etiquette", labelRu: "Этикет", group: "skills" },
    { key: "firearms", labelRu: "Огнестрел", group: "skills" },
    { key: "melee", labelRu: "Ближний бой", group: "skills" },
    { key: "performance", labelRu: "Выступления", group: "skills" },
    { key: "security", labelRu: "Безопасность", group: "skills" },
    { key: "stealth", labelRu: "Скрытность", group: "skills" },
    { key: "survival", labelRu: "Выживание", group: "skills" },

    { key: "academics", labelRu: "Академические знания", group: "knowledges" },
    { key: "computer", labelRu: "Компьютеры", group: "knowledges" },
    { key: "finance", labelRu: "Финансы", group: "knowledges" },
    { key: "investigation", labelRu: "Расследование", group: "knowledges" },
    { key: "law", labelRu: "Право", group: "knowledges" },
    { key: "linguistics", labelRu: "Лингвистика", group: "knowledges" },
    { key: "medicine", labelRu: "Медицина", group: "knowledges" },
    { key: "occult", labelRu: "Оккультизм", group: "knowledges" },
    { key: "politics", labelRu: "Политика", group: "knowledges" },
    { key: "science", labelRu: "Наука", group: "knowledges" }
  ]);

  await upsertByKey(BackgroundModel, [
    { key: "allies", labelRu: "Союзники" },
    { key: "contacts", labelRu: "Контакты" },
    { key: "resources", labelRu: "Ресурсы" },
    { key: "status", labelRu: "Статус" },
    { key: "mentor", labelRu: "Наставник" }
  ]);

  await upsertByKey(VirtueModel, [
    { key: "conscience", labelRu: "Совесть" },
    { key: "selfControl", labelRu: "Самообладание" },
    { key: "courage", labelRu: "Мужество" }
  ]);

  await upsertByKey(SectModel, [
    { key: "camarilla", labelRu: "Камарилья" },
    { key: "sabbat", labelRu: "Шабаш" }
  ]);

  await upsertByKey(NatureModel, [
    { key: "survivor", labelRu: "Выживший" },
    { key: "visionary", labelRu: "Мечтатель" }
  ]);

  await upsertByKey(DemeanorModel, [
    { key: "stoic", labelRu: "Стоик" },
    { key: "bonVivant", labelRu: "Бон виван" }
  ]);

  await upsertByKey(MeritModel, [
    { key: "acuteSense", labelRu: "Острое чувство", pointCost: 1 },
    { key: "catlikeBalance", labelRu: "Кошачья грация", pointCost: 2 }
  ]);

  await upsertByKey(FlawModel, [
    { key: "nightmares", labelRu: "Кошмары", pointCost: 1 },
    { key: "darkSecret", labelRu: "Тёмная тайна", pointCost: 2 }
  ]);

  console.log("Seed завершён");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed завершился с ошибкой:", error);
  process.exit(1);
});

