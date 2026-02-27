## 1) Схемы MongoDB/Mongoose (TypeScript)

### 1.1 Общие типы

// apps/server/src/db/types.ts  
export type LayeredValue = {  
  base: number;  
  freebie: number;  
  storyteller: number; // может быть отрицательным  
};  
  
export type Health = {  
  bashing: number;  
  lethal: number;  
  aggravated: number;  
};  
  
export type Resources = {  
  bloodPool: { current: number };  
  willpower: { current: number }; // 0..10  
  humanity: { current: number };  // 0..10  
  health: Health;                 // суммарно <= 7  
};  
  
export type WizardState = {  
  currentStep: number; // 1..9  
};  
  
// Приоритеты групп (выбор на экране)  
export type PriorityRank = "primary" | "secondary" | "tertiary";  
export type AttributesPriority = {  
  physical: PriorityRank;  
  social: PriorityRank;  
  mental: PriorityRank;  
};  
export type AbilitiesPriority = {  
  talents: PriorityRank;  
  skills: PriorityRank;  
  knowledges: PriorityRank;  
};  
  
// Служебные данные создания  
export type CreationState = {  
  attributesPriority?: AttributesPriority;  
  abilitiesPriority?: AbilitiesPriority;  
  
  // Сколько freebies “заработали” от flaws с капом 7  
  flawFreebieEarned: number; // 0..7  
  
  // Сколько точек Humanity/Willpower куплено именно freebie’ами в wizard  
  // (чтобы можно было корректно валидировать/откатывать на этапе создания,  
  // даже если потом в игре эти значения менялись)  
  freebieBuys: {  
    humanity: number;   // 0..?  
    willpower: number;  // 0..?  
  };  
};  
  
export type Derived = {  
  bloodPoolMax: number;  
  bloodPerTurn: number;  
  willpowerMax: 10;  
  humanityMax: 10;  
  startingHumanity: number;  
  startingWillpower: number;  
};

---

### 1.2 Справочники (коллекции)

Все справочники живут **в отдельных коллекциях** и отдаются отдельными REST-эндпоинтами.

#### Chronicle

// apps/server/src/db/models/Chronicle.ts  
import { Schema, model, Types } from "mongoose";  
  
const ChronicleSchema = new Schema(  
  {  
    name: { type: String, required: true, trim: true },  
    description: { type: String, default: "" },  
  },  
  { timestamps: true }  
);  
  
export const ChronicleModel = model("Chronicle", ChronicleSchema);

#### Generation (таблица поколений → blood pool)

// apps/server/src/db/models/Generation.ts  
import { Schema, model } from "mongoose";  
  
const GenerationSchema = new Schema(  
  {  
    generation: { type: Number, required: true, min: 8, max: 14, unique: true },  
    bloodPoolMax: { type: Number, required: true, min: 0 },  
    bloodPerTurn: { type: Number, required: true, min: 0 },  
  },  
  { timestamps: true }  
);  
  
export const GenerationModel = model("Generation", GenerationSchema);

#### Clan (клан + дисциплины + правила)

// apps/server/src/db/models/Clan.ts  
import { Schema, model } from "mongoose";  
  
const ClanSchema = new Schema(  
  {  
    key: { type: String, required: true, unique: true, trim: true },  
    labelRu: { type: String, required: true, trim: true },  
  
    disciplineKeys: { type: [String], required: true, default: [] },  
  
    rules: {  
      appearanceFixedTo: { type: Number, required: false }, // для Nosferatu = 0  
    },  
  },  
  { timestamps: true }  
);  
  
export const ClanModel = model("Clan", ClanSchema);

#### Ability / Attribute (важно иметь group для подсчёта 13/9/5 и 7/5/3)

// apps/server/src/db/models/Ability.ts  
import { Schema, model } from "mongoose";  
  
const AbilitySchema = new Schema(  
  {  
    key: { type: String, required: true, unique: true, trim: true },  
    labelRu: { type: String, required: true, trim: true },  
    group: { type: String, enum: ["talents", "skills", "knowledges"], required: true },  
  },  
  { timestamps: true }  
);  
  
export const AbilityModel = model("Ability", AbilitySchema);

// apps/server/src/db/models/Attribute.ts  
import { Schema, model } from "mongoose";  
  
const AttributeSchema = new Schema(  
  {  
    key: { type: String, required: true, unique: true, trim: true },  
    labelRu: { type: String, required: true, trim: true },  
    group: { type: String, enum: ["physical", "social", "mental"], required: true },  
  },  
  { timestamps: true }  
);  
  
export const AttributeModel = model("Attribute", AttributeSchema);

#### Остальные справочники (простые)

// пример: Discipline / Background / Virtue / Sect / Nature / Demeanor  
import { Schema, model } from "mongoose";  
  
export function makeKeyLabelModel(name: string, collection: string) {  
  const schema = new Schema(  
    {  
      key: { type: String, required: true, unique: true, trim: true },  
      labelRu: { type: String, required: true, trim: true },  
    },  
    { timestamps: true, collection }  
  );  
  return model(name, schema);  
}  
  
export const DisciplineModel = makeKeyLabelModel("Discipline", "disciplines");  
export const BackgroundModel = makeKeyLabelModel("Background", "backgrounds");  
export const VirtueModel = makeKeyLabelModel("Virtue", "virtues");  
export const SectModel = makeKeyLabelModel("Sect", "sects");  
export const NatureModel = makeKeyLabelModel("Nature", "natures");  
export const DemeanorModel = makeKeyLabelModel("Demeanor", "demeanors");

#### Merits/Flaws

// apps/server/src/db/models/MeritFlaw.ts  
import { Schema, model } from "mongoose";  
  
const MeritFlawSchema = new Schema(  
  {  
    key: { type: String, required: true, unique: true, trim: true },  
    labelRu: { type: String, required: true, trim: true },  
    type: { type: String, enum: ["merit", "flaw"], required: true },  
    cost: { type: Number, required: true, min: 1 },  
  },  
  { timestamps: true }  
);  
  
export const MeritFlawModel = model("MeritFlaw", MeritFlawSchema);

---

### 1.3 Character (главная модель)

Ключевые решения:

- `uuid` — строка (v4), уникальная.
    
- Все traits — `Map<string, LayeredValue>` (чтобы хранить “по ключам справочника”).
    
- Merits/Flaws — массивы ключей.
    
- Wizard состояние — `wizard.currentStep` (удаляется после finish).
    
- Soft delete.
    

// apps/server/src/db/models/Character.ts  
import { Schema, model, Types } from "mongoose";  
  
const LayeredValueSchema = new Schema(  
  {  
    base: { type: Number, required: true },  
    freebie: { type: Number, required: true },  
    storyteller: { type: Number, required: true },  
  },  
  { _id: false }  
);  
  
const HealthSchema = new Schema(  
  {  
    bashing: { type: Number, required: true },  
    lethal: { type: Number, required: true },  
    aggravated: { type: Number, required: true },  
  },  
  { _id: false }  
);  
  
const ResourcesSchema = new Schema(  
  {  
    bloodPool: { current: { type: Number, required: true } },  
    willpower: { current: { type: Number, required: true } },  
    humanity: { current: { type: Number, required: true } },  
    health: { type: HealthSchema, required: true },  
  },  
  { _id: false }  
);  
  
const WizardSchema = new Schema(  
  {  
    currentStep: { type: Number, required: true, min: 1, max: 9 },  
  },  
  { _id: false }  
);  
  
const CharacterSchema = new Schema(  
  {  
    uuid: { type: String, required: true, unique: true, index: true },  
  
    version: { type: Number, required: true, default: 1 },  
  
    deleted: { type: Boolean, required: true, default: false, index: true },  
    deletedAt: { type: Date, required: false },  
  
    creationFinished: { type: Boolean, required: true, default: false },  
  
    wizard: { type: WizardSchema, required: false },  
  
    meta: {  
      characterName: { type: String, required: true, default: "", trim: true },  
      playerName: { type: String, required: true, default: "", trim: true },  
  
      concept: { type: String, required: false, default: "", trim: true },  
      sire: { type: String, required: false, default: "", trim: true },  
  
      chronicleId: { type: Schema.Types.ObjectId, ref: "Chronicle", required: true },  
  
      clanKey: { type: String, required: true, default: "" },  
      generation: { type: Number, required: true, default: 13, min: 8, max: 14 },  
  
      sectKey: { type: String, required: true, default: "" },  
      natureKey: { type: String, required: true, default: "" },  
      demeanorKey: { type: String, required: true, default: "" },  
    },  
  
    // Параметры создания и расчёты для wizard/freebies  
    creation: {  
      attributesPriority: {  
        physical: { type: String, enum: ["primary", "secondary", "tertiary"], required: false },  
        social: { type: String, enum: ["primary", "secondary", "tertiary"], required: false },  
        mental: { type: String, enum: ["primary", "secondary", "tertiary"], required: false },  
      },  
      abilitiesPriority: {  
        talents: { type: String, enum: ["primary", "secondary", "tertiary"], required: false },  
        skills: { type: String, enum: ["primary", "secondary", "tertiary"], required: false },  
        knowledges: { type: String, enum: ["primary", "secondary", "tertiary"], required: false },  
      },  
  
      flawFreebieEarned: { type: Number, required: true, default: 0, min: 0, max: 7 },  
  
      freebieBuys: {  
        humanity: { type: Number, required: true, default: 0, min: 0 },  
        willpower: { type: Number, required: true, default: 0, min: 0 },  
      },  
    },  
  
    derived: {  
      bloodPoolMax: { type: Number, required: true, default: 0 },  
      bloodPerTurn: { type: Number, required: true, default: 0 },  
      willpowerMax: { type: Number, required: true, default: 10 },  
      humanityMax: { type: Number, required: true, default: 10 },  
      startingHumanity: { type: Number, required: true, default: 0 },  
      startingWillpower: { type: Number, required: true, default: 0 },  
    },  
  
    traits: {  
      // все карты заполняются при создании (по справочникам)  
      attributes: { type: Map, of: LayeredValueSchema, required: true },  
      abilities: { type: Map, of: LayeredValueSchema, required: true },  
      disciplines: { type: Map, of: LayeredValueSchema, required: true },  
      backgrounds: { type: Map, of: LayeredValueSchema, required: true },  
      virtues: { type: Map, of: LayeredValueSchema, required: true },  
  
      merits: { type: [String], required: true, default: [] }, // keys  
      flaws: { type: [String], required: true, default: [] },  // keys  
    },  
  
    resources: { type: ResourcesSchema, required: true },  
  
    // редактируемые тексты (в игре + ST)  
    notes: { type: String, required: true, default: "" },  
    equipment: { type: String, required: true, default: "" },  
  },  
  { timestamps: true }  
);  
  
export const CharacterModel = model("Character", CharacterSchema);

**Важное про V20 freebies**: стоимостная таблица для freebie-покупок (Attribute 5, Ability 2, Discipline 7, Background 1, Virtue 2, Humanity/Path 2, Willpower 1) — фиксируем в коде согласно общепринятой таблице и ссылкам на V20.  
А базовые пакеты создания (7/5/3, 13/9/5, 3 дисциплины, 5 фонов, 7 добродетелей, 15 freebies) подтверждаются листом/шаблоном V20.