import type { CharacterClass } from "@/context/GameContext";

export type Race = {
  id: string;
  name: string;
  color: string;
  icon: string;
  specialAbility: string;
  bonuses: { stat: "strength" | "agility" | "endurance"; delta: number }[];
  lore: string;
  classAffinity: CharacterClass[];
};

export const RACES: Race[] = [
  {
    id: "yuce_insan",
    name: "Yüce İnsan",
    color: "#D4AF37",
    icon: "human",
    specialAbility: "Tüm istatistiklerde +1 dengeli bonus.",
    bonuses: [
      { stat: "strength", delta: 1 },
      { stat: "agility", delta: 1 },
      { stat: "endurance", delta: 1 },
    ],
    lore: "Çok yönlü ve uyumlu; her yolda ilerler.",
    classAffinity: ["fighter", "paladin", "cleric"],
  },
  {
    id: "gece_elfi",
    name: "Gece Elfı",
    color: "#7C3AED",
    icon: "run-fast",
    specialAbility: "Dayanıklılık egzersizlerinde ekstra XP potansiyeli.",
    bonuses: [
      { stat: "strength", delta: -1 },
      { stat: "agility", delta: 4 },
      { stat: "endurance", delta: 0 },
    ],
    lore: "Hız ve çeviklik onların silahıdır.",
    classAffinity: ["ranger", "rogue", "monk"],
  },
  {
    id: "dag_cucesi",
    name: "Dağ Cücesi",
    color: "#B45309",
    icon: "weight-lifter",
    specialAbility: "Güç odaklı hareketlerde üstün.",
    bonuses: [
      { stat: "strength", delta: 0 },
      { stat: "agility", delta: -1 },
      { stat: "endurance", delta: 4 },
    ],
    lore: "Dağların iradesi ve sarsılmaz duruş.",
    classAffinity: ["barbarian", "fighter", "paladin"],
  },
];
