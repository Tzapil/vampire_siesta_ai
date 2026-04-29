export type GameModeManeuverTab = "attack" | "defense" | "ranged" | "special";

export type GameModeManeuverApplyMode = "enabled" | "disabled";

export type GameModeManeuverDetailFlag =
  | "aggravated"
  | "sustained"
  | "knockdown"
  | "reducesAttackSuccesses";

export type GameModeManeuverSummary = {
  pool: string;
  difficulty: string;
  damage: string;
  limitation: string;
};

export type GameModeManeuverPreset = {
  attributeKey: string;
  abilityKey: string;
  appliedDifficulty: number;
  diceBonus?: number;
};

export type GameModeCombatManeuver = {
  id: string;
  tab: GameModeManeuverTab;
  title: string;
  summary: GameModeManeuverSummary;
  applyMode: GameModeManeuverApplyMode;
  preset?: GameModeManeuverPreset;
  detailText: string;
  detailFlags: GameModeManeuverDetailFlag[];
  guideSection: GameModeManeuverTab;
};

export type GameModeManeuverTabMeta = {
  id: GameModeManeuverTab;
  label: string;
  description: string;
};

export type GameModeManeuverGuideSectionMeta = {
  id: GameModeManeuverTab;
  title: string;
  intro?: string[];
};

export type GameModeManeuverLegendItem = {
  id: GameModeManeuverDetailFlag;
  shortLabel: string;
  description: string;
};

const preset = (
  attributeKey: string,
  abilityKey: string,
  appliedDifficulty: number,
  diceBonus = 0
): GameModeManeuverPreset => ({
  attributeKey,
  abilityKey,
  appliedDifficulty,
  diceBonus
});

export const GAME_MODE_MANEUVER_TABS: GameModeManeuverTabMeta[] = [
  {
    id: "attack",
    label: "Атака",
    description: "Ближний бой, клинч, укусы и разоружение."
  },
  {
    id: "defense",
    label: "Защита",
    description: "Уклонение, блок, парирование и защитные режимы."
  },
  {
    id: "ranged",
    label: "Дистанция",
    description: "Выстрелы, очереди, перезарядка и модификаторы стрельбы."
  },
  {
    id: "special",
    label: "Особое",
    description: "Сценовые модификаторы и процедурные правила раунда."
  }
];

export const GAME_MODE_MANEUVER_GUIDE_SECTIONS: GameModeManeuverGuideSectionMeta[] = [
  {
    id: "attack",
    title: "Манёвры: ближний бой"
  },
  {
    id: "ranged",
    title: "Манёвры: дистанционный бой",
    intro: [
      "Для огнестрела используется Ловкость + Стрельба, для метательного оружия - Ловкость + Атлетика.",
      "Точность здесь трактуется как бонус самого манёвра к пулу попадания, а не как отдельное свойство оружия."
    ]
  },
  {
    id: "defense",
    title: "Манёвры: защита"
  },
  {
    id: "special",
    title: "Манёвры: особое"
  }
];

export const GAME_MODE_MANEUVER_LEGEND: GameModeManeuverLegendItem[] = [
  {
    id: "aggravated",
    shortLabel: "А",
    description: "Манёвр наносит агравированные повреждения."
  },
  {
    id: "sustained",
    shortLabel: "Д",
    description: "Манёвр длится, пока персонаж набирает успехи."
  },
  {
    id: "knockdown",
    shortLabel: "С",
    description: "Манёвр сбивает с ног."
  },
  {
    id: "reducesAttackSuccesses",
    shortLabel: "У",
    description: "Манёвр уменьшает количество успехов у атакующего."
  }
];

export const GAME_MODE_COMBAT_MANEUVERS: GameModeCombatManeuver[] = [
  {
    id: "attack-punch",
    tab: "attack",
    title: "Удар рукой",
    summary: {
      pool: "Ловкость + Драка",
      difficulty: "6",
      damage: "Сила",
      limitation: "—"
    },
    applyMode: "enabled",
    preset: preset("dexterity", "brawl", 6),
    detailText: "Базовый рукопашный удар без дополнительных условий.",
    detailFlags: [],
    guideSection: "attack"
  },
  {
    id: "attack-kick",
    tab: "attack",
    title: "Удар ногой",
    summary: {
      pool: "Ловкость + Драка",
      difficulty: "7",
      damage: "Сила +1",
      limitation: "—"
    },
    applyMode: "enabled",
    preset: preset("dexterity", "brawl", 7),
    detailText: "Сильнее удара рукой, но чуть сложнее по исполнению.",
    detailFlags: [],
    guideSection: "attack"
  },
  {
    id: "attack-weapon-strike",
    tab: "attack",
    title: "Удар оружием",
    summary: {
      pool: "Ловкость + Фехтование",
      difficulty: "6",
      damage: "Сила + оружие",
      limitation: "тип урона по оружию"
    },
    applyMode: "enabled",
    preset: preset("dexterity", "melee", 6),
    detailText: "Тип и дополнительный модификатор урона определяются самим оружием.",
    detailFlags: [],
    guideSection: "attack"
  },
  {
    id: "attack-trip",
    tab: "attack",
    title: "Подножка",
    summary: {
      pool: "Ловкость + Драка",
      difficulty: "7",
      damage: "Сила",
      limitation: "цель делает рефлекторную проверку Ловкость + Атлетика (Сл8) или падает"
    },
    applyMode: "enabled",
    preset: preset("dexterity", "brawl", 7),
    detailText:
      "После успешной атаки цель делает рефлекторную проверку Ловкость + Атлетика со сложностью 8. При провале она падает.",
    detailFlags: ["knockdown"],
    guideSection: "attack"
  },
  {
    id: "attack-weapon-trip",
    tab: "attack",
    title: "Подсечка оружием",
    summary: {
      pool: "Ловкость + Фехтование",
      difficulty: "7",
      damage: "Сила",
      limitation: "нужно оружие, которым можно сбить с ног"
    },
    applyMode: "enabled",
    preset: preset("dexterity", "melee", 7),
    detailText:
      "Работает только оружием, которым реально можно сбить противника с ног, например дубинкой, посохом или цепом. На успехе цель проходит ту же рефлекторную проверку Ловкость + Атлетика со сложностью 8 или падает.",
    detailFlags: ["knockdown"],
    guideSection: "attack"
  },
  {
    id: "attack-throw",
    tab: "attack",
    title: "Бросок",
    summary: {
      pool: "Сила + Драка",
      difficulty: "7",
      damage: "Сила +1",
      limitation: "цель может быть сбита с ног; у detail есть дополнительная рефлекторная проверка"
    },
    applyMode: "enabled",
    preset: preset("strength", "brawl", 7),
    detailText:
      "После атаки и вы, и цель делаете рефлекторную проверку Ловкость + Атлетика со сложностью 7 или падаете. Даже если цель устояла, она теряет равновесие и получает +1 к сложности действий на следующий ход.",
    detailFlags: ["knockdown"],
    guideSection: "attack"
  },
  {
    id: "attack-clinch",
    tab: "attack",
    title: "Клинч",
    summary: {
      pool: "Сила + Драка",
      difficulty: "6",
      damage: "Сила",
      limitation: "первый ход входит в клинч"
    },
    applyMode: "enabled",
    preset: preset("strength", "brawl", 6),
    detailText:
      "На успешной атаке вы входите в клинч. В первый ход можно бросить урон Сила, а в следующие ходы либо автоматически наносить урон Сила, либо пытаться вырваться.",
    detailFlags: ["sustained"],
    guideSection: "attack"
  },
  {
    id: "attack-grapple",
    tab: "attack",
    title: "Захват/удержание",
    summary: {
      pool: "Сила + Драка",
      difficulty: "6",
      damage: "нет",
      limitation: "цель обездвижена"
    },
    applyMode: "enabled",
    preset: preset("strength", "brawl", 6),
    detailText:
      "Урона не наносит. На успехе цель обездвижена до своего следующего действия, а затем оба бросают встречный Сила + Драка, пока цель не наберет больше успехов, чем атакующий.",
    detailFlags: ["sustained"],
    guideSection: "attack"
  },
  {
    id: "attack-break-free",
    tab: "attack",
    title: "Выход из клинча/захвата",
    summary: {
      pool: "Сила + Драка",
      difficulty: "6",
      damage: "нет",
      limitation: "встречная проверка"
    },
    applyMode: "enabled",
    preset: preset("strength", "brawl", 6),
    detailText:
      "Это встречная проверка против удерживающего. Если у вырывающегося больше успехов, он освобождается.",
    detailFlags: [],
    guideSection: "attack"
  },
  {
    id: "attack-bite",
    tab: "attack",
    title: "Укус",
    summary: {
      pool: "Ловкость + Драка",
      difficulty: "6",
      damage: "Сила +1",
      limitation: "только после успешного клинча/захвата и на следующем ходу"
    },
    applyMode: "enabled",
    preset: preset("dexterity", "brawl", 6),
    detailText:
      "Доступен только после успешного клинча, захвата/удержания или сходного удержания цели и обычно выполняется на следующем ходу. Вместо урона можно начать пить кровь и при желании затем зализать след укуса.",
    detailFlags: ["aggravated"],
    guideSection: "attack"
  },
  {
    id: "attack-claws",
    tab: "attack",
    title: "Удар когтями",
    summary: {
      pool: "Ловкость + Драка",
      difficulty: "6",
      damage: "Сила +1",
      limitation: "нужны доступные когти"
    },
    applyMode: "enabled",
    preset: preset("dexterity", "brawl", 6),
    detailText:
      "Новый манёвр для атак когтями. Используйте его, когда существо или дисциплина позволяют наносить агравированный урон когтями.",
    detailFlags: ["aggravated"],
    guideSection: "attack"
  },
  {
    id: "attack-disarm-weapon",
    tab: "attack",
    title: "Разоружение (оружием)",
    summary: {
      pool: "Ловкость + Фехтование",
      difficulty: "7",
      damage: "как обычная атака",
      limitation: "оружие выбивается при достаточном результате урона"
    },
    applyMode: "enabled",
    preset: preset("dexterity", "melee", 7),
    detailText:
      "На успешной атаке бросьте урон как обычно. Если успехов на уроне больше Силы противника, урон не наносится, но оружие выбито; иначе противник остается с оружием и получает обычный урон.",
    detailFlags: [],
    guideSection: "attack"
  },
  {
    id: "attack-disarm-brawl",
    tab: "attack",
    title: "Разоружение (голыми руками)",
    summary: {
      pool: "Ловкость + Драка",
      difficulty: "7",
      damage: "Сила",
      limitation: "противник теряет оружие"
    },
    applyMode: "enabled",
    preset: preset("dexterity", "brawl", 7),
    detailText:
      "Новый манёвр для выбивания оружия без своего клинка. На успехе вы вырываете или сбиваете оружие у цели; место, куда оно отлетает, определяется сценой.",
    detailFlags: [],
    guideSection: "attack"
  },
  {
    id: "defense-dodge",
    tab: "defense",
    title: "Уклонение",
    summary: {
      pool: "Ловкость + Атлетика",
      difficulty: "6",
      damage: "нет",
      limitation: "нужно свободное место; при полном окружении не работает"
    },
    applyMode: "enabled",
    preset: preset("dexterity", "athletics", 6),
    detailText:
      "Позволяет увернуться от атаки ближнего боя, если есть пространство для движения. При полном окружении со всех сторон манёвр не работает.",
    detailFlags: ["reducesAttackSuccesses"],
    guideSection: "defense"
  },
  {
    id: "defense-parry",
    tab: "defense",
    title: "Парирование",
    summary: {
      pool: "Ловкость + Фехтование",
      difficulty: "6",
      damage: "нет",
      limitation: "нужен melee weapon; против безоружного нападающего возможен контрурон"
    },
    applyMode: "enabled",
    preset: preset("dexterity", "melee", 6),
    detailText:
      "Блокирует атаку ближнего боя оружием. Если нападающий без холодного оружия, при большем числе успехов можно нанести контрурон как при атаке.",
    detailFlags: ["reducesAttackSuccesses"],
    guideSection: "defense"
  },
  {
    id: "defense-block",
    tab: "defense",
    title: "Блок",
    summary: {
      pool: "Ловкость + Драка",
      difficulty: "6",
      damage: "нет",
      limitation: "нивелирует успехи атаки"
    },
    applyMode: "enabled",
    preset: preset("dexterity", "brawl", 6),
    detailText:
      "Как и уклонение, этот манёвр убирает успехи атаки. Без брони или дисциплины Стойкость таким образом обычно нейтрализуют только легкие повреждения. Домашнее правило: заменить Ловкость на Выносливость, а при наличии брони или Стойкости разрешить блокировать не только ближний бой, но и пули.",
    detailFlags: ["reducesAttackSuccesses"],
    guideSection: "defense"
  },
  {
    id: "defense-full-defense",
    tab: "defense",
    title: "Глухая оборона",
    summary: {
      pool: "контекстный",
      difficulty: "контекстная",
      damage: "нет",
      limitation: "весь ход уходит в защиту; первый бросок полным пулом, затем -1 куб на каждый следующий"
    },
    applyMode: "disabled",
    detailText:
      "Весь ход уходит только на защиту. Обычные правила множественных действий не применяются: первый блок, уклонение или парирование бросается полным пулом, каждый следующий защитный бросок в том же ходу получает кумулятивный штраф -1 куб.",
    detailFlags: [],
    guideSection: "defense"
  },
  {
    id: "defense-dodge-firearms",
    tab: "defense",
    title: "Уклонение от выстрелов",
    summary: {
      pool: "Ловкость + Атлетика",
      difficulty: "зависит от укрытия",
      damage: "нет",
      limitation: "в V20 требует укрытия или падения в лёжку"
    },
    applyMode: "disabled",
    detailText:
      "В V20 уклонение от выстрелов требует укрытия или падения в лёжку. Вариант из Revised: уже в укрытии - Сл2, надежное укрытие в 1 м - Сл4, в 3 м - Сл6, ненадежное укрытие в 1 м - Сл6, без укрытия - Сл8; Стремительность позволяет сдвигаться на шаг вверх по этой таблице.",
    detailFlags: [],
    guideSection: "defense"
  },
  {
    id: "ranged-shot",
    tab: "ranged",
    title: "Выстрел",
    summary: {
      pool: "Ловкость + Стрельба",
      difficulty: "6",
      damage: "оружие",
      limitation: "базовый режим"
    },
    applyMode: "enabled",
    preset: preset("dexterity", "firearms", 6),
    detailText:
      "Это базовый режим одиночного выстрела. Огнестрел против вампиров обычно наносит ударный урон, а прицельный выстрел в голову переводит его в летальный.",
    detailFlags: [],
    guideSection: "ranged"
  },
  {
    id: "ranged-thrown-weapon",
    tab: "ranged",
    title: "Бросок оружия",
    summary: {
      pool: "Ловкость + Атлетика",
      difficulty: "6",
      damage: "оружие",
      limitation: "для ножей, топоров, кольев и других метаемых предметов"
    },
    applyMode: "enabled",
    preset: preset("dexterity", "athletics", 6),
    detailText:
      "Новый манёвр для метательного оружия. Дальность, доступность следующего броска и тип урона определяются самим предметом и сценой.",
    detailFlags: [],
    guideSection: "ranged"
  },
  {
    id: "ranged-short-burst",
    tab: "ranged",
    title: "Короткая очередь",
    summary: {
      pool: "Ловкость + Стрельба",
      difficulty: "7",
      damage: "оружие",
      limitation: "+2 куба от манёвра; очередь из трёх патронов"
    },
    applyMode: "enabled",
    preset: preset("dexterity", "firearms", 7, 2),
    detailText:
      "Очередь из трех патронов. Бонус +2 к пулу приходит именно от выбранного манёвра.",
    detailFlags: [],
    guideSection: "ranged"
  },
  {
    id: "ranged-long-burst",
    tab: "ranged",
    title: "Длинная очередь",
    summary: {
      pool: "Ловкость + Стрельба",
      difficulty: "8",
      damage: "оружие",
      limitation: "+10 кубов от манёвра; весь магазин; потом нужна перезарядка"
    },
    applyMode: "enabled",
    preset: preset("dexterity", "firearms", 8, 10),
    detailText:
      "Используется весь магазин. После такой атаки требуется перезарядка, а в магазине должно быть не меньше половины патронов до начала манёвра.",
    detailFlags: [],
    guideSection: "ranged"
  },
  {
    id: "ranged-suppressive-fire",
    tab: "ranged",
    title: "Атака по площади (Обстрел)",
    summary: {
      pool: "Ловкость + Стрельба",
      difficulty: "8",
      damage: "оружие",
      limitation: "+10 кубов от манёвра; зона ~3 м; успехи распределяются между целями"
    },
    applyMode: "enabled",
    preset: preset("dexterity", "firearms", 8, 10),
    detailText:
      "Полный магазин уходит в зону примерно в три метра. Успехи распределяются между всеми целями в зоне, минимум по одному при наличии успехов, а затем по каждой цели считается отдельный урон.",
    detailFlags: [],
    guideSection: "ranged"
  },
  {
    id: "ranged-fast-reload",
    tab: "ranged",
    title: "Быстрая перезарядка",
    summary: {
      pool: "Ловкость + Стрельба",
      difficulty: "7",
      damage: "нет",
      limitation: "1 успех для пистолета/ПП, 2 успеха для автомата/тяжёлого оружия"
    },
    applyMode: "enabled",
    preset: preset("dexterity", "firearms", 7),
    detailText:
      "Это активная проверка вместо целого хода на перезарядку. Один успех хватает для пистолета или ПП, два - для автомата и тяжелого оружия.",
    detailFlags: [],
    guideSection: "ranged"
  },
  {
    id: "ranged-fast-reload-revolver-shotgun",
    tab: "ranged",
    title: "Быстрая перезарядка (револьвер/дробовик)",
    summary: {
      pool: "Ловкость + Стрельба",
      difficulty: "4",
      damage: "нет",
      limitation: "1 успех за каждый патрон"
    },
    applyMode: "enabled",
    preset: preset("dexterity", "firearms", 4),
    detailText:
      "Новый пресет для револьверов без спидлоадера и дробовиков. Считайте отдельный успех за каждый загруженный патрон.",
    detailFlags: [],
    guideSection: "ranged"
  },
  {
    id: "ranged-dual-wield",
    tab: "ranged",
    title: "Стрельба по-македонски",
    summary: {
      pool: "делится между двумя выстрелами",
      difficulty: "вторая проверка = базовая +1",
      damage: "оружие",
      limitation: "нужно лёгкое оружие в каждой руке"
    },
    applyMode: "disabled",
    detailText:
      "Разделите пул между двумя выстрелами. Для второй проверки сложность повышается на 1, а использовать можно только достаточно легкое оружие в каждой руке.",
    detailFlags: [],
    guideSection: "ranged"
  },
  {
    id: "ranged-aiming",
    tab: "ranged",
    title: "Наведение",
    summary: {
      pool: "контекстный",
      difficulty: "контекстная",
      damage: "нет",
      limitation: "даёт бонус к следующему выстрелу, а не является самостоятельной атакой"
    },
    applyMode: "disabled",
    detailText:
      "Даёт +1 куб к следующей проверке стрельбы и может накапливаться до значения Восприятия. Оптический прицел добавляет +2 куба при первом наведении и не считается в этот лимит; вариант с проверкой Восприятие + Стрельба при провале просто не даёт бонус.",
    detailFlags: [],
    guideSection: "ranged"
  },
  {
    id: "ranged-point-blank",
    tab: "ranged",
    title: "Выстрел в упор",
    summary: {
      pool: "как у выбранного выстрела",
      difficulty: "обычная -2",
      damage: "оружие",
      limitation: "дистанция меньше 2 м"
    },
    applyMode: "disabled",
    detailText:
      "Это модификатор уже выбранного режима стрельбы для дистанции меньше двух метров.",
    detailFlags: [],
    guideSection: "ranged"
  },
  {
    id: "ranged-long-range-shot",
    tab: "ranged",
    title: "Выстрел вдаль",
    summary: {
      pool: "как у выбранного выстрела",
      difficulty: "обычная +2",
      damage: "оружие",
      limitation: "дальность выше максимальной, но не более чем в 2 раза"
    },
    applyMode: "disabled",
    detailText:
      "Это модификатор уже выбранного выстрела для дистанции выше максимальной, но не более чем вдвое.",
    detailFlags: [],
    guideSection: "ranged"
  },
  {
    id: "ranged-called-shot",
    tab: "ranged",
    title: "Прицеливание",
    summary: {
      pool: "как у выбранного выстрела",
      difficulty: "+1 / +2 / +3 по размеру цели",
      damage: "оружие, иногда +1/+2",
      limitation: "это модификатор другого выстрела, а не самостоятельный бросок"
    },
    applyMode: "disabled",
    detailText:
      "Средняя цель дает +1 к сложности, маленькая - +2 и +1 к урону, крошечная - +3 и +2 к урону. Это модификатор уже выбранного выстрела, а не отдельная атака.",
    detailFlags: [],
    guideSection: "ranged"
  },
  {
    id: "special-surrounded",
    tab: "special",
    title: "Окружение",
    summary: {
      pool: "нет",
      difficulty: "+1 за каждого противника после первого, максимум +4",
      damage: "нет",
      limitation: "глобальный модификатор сцены"
    },
    applyMode: "disabled",
    detailText:
      "Персонаж, который в ближнем бою сражается против нескольких соперников, получает +1 к сложности атаки и защиты за каждого противника после первого, максимум +4.",
    detailFlags: [],
    guideSection: "special"
  },
  {
    id: "special-multiple-actions",
    tab: "special",
    title: "Множественные действия",
    summary: {
      pool: "делится на все действия",
      difficulty: "по выбранным действиям",
      damage: "зависит от действия",
      limitation: "процедурное правило декларации, а не один основной бросок"
    },
    applyMode: "disabled",
    detailText:
      "Заявите все действия в фазе декларации, определите наименьший пул среди них и разделите его между всеми действиями, минимум по одному кубу на действие. Если весь ход уходит только на защиту, вместо этого используйте глухую оборону.",
    detailFlags: [],
    guideSection: "special"
  }
];

export const getGameModeManeuversByTab = (tab: GameModeManeuverTab) =>
  GAME_MODE_COMBAT_MANEUVERS.filter((maneuver) => maneuver.tab === tab);

export const getGameModeManeuversByGuideSection = (section: GameModeManeuverTab) =>
  GAME_MODE_COMBAT_MANEUVERS.filter((maneuver) => maneuver.guideSection === section);

export const getGameModeManeuverById = (id: string) =>
  GAME_MODE_COMBAT_MANEUVERS.find((maneuver) => maneuver.id === id);
