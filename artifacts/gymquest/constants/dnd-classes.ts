import type { CharacterClass } from "@/context/GameContext";

export type DndClass = {
  id: CharacterClass;
  name: string;
  color: string;
  icon: string;
  description: string;
  attributeLabel: string;
};

export const DND_CLASSES: DndClass[] = [
  { id: "barbarian", name: "Barbar", color: "#DC2626", icon: "axe", description: "Ham güç.", attributeLabel: "Güç" },
  { id: "fighter", name: "Dövüşçü", color: "#B45309", icon: "sword", description: "Dengeli savaşçı.", attributeLabel: "Güç/Çev" },
  { id: "paladin", name: "Paladin", color: "#2563EB", icon: "shield-cross", description: "Savunma ve dayanıklılık.", attributeLabel: "Dayanıklılık" },
  { id: "monk", name: "Keşiş", color: "#059669", icon: "karate", description: "Hız ve akış.", attributeLabel: "Çeviklik" },
  { id: "rogue", name: "Haydut", color: "#6B7280", icon: "knife", description: "Kritik ve çeviklik.", attributeLabel: "Çeviklik" },
  { id: "ranger", name: "Koruyucu", color: "#15803D", icon: "bow-arrow", description: "Uzun mesafe ve koşu.", attributeLabel: "Çeviklik" },
  { id: "wizard", name: "Sihirbaz", color: "#7C3AED", icon: "wizard-hat", description: "Zihin disiplini.", attributeLabel: "Karma" },
  { id: "warrior", name: "Savaşçı", color: "#EF4444", icon: "sword-cross", description: "Klasik tank.", attributeLabel: "Güç" },
  { id: "mage", name: "Büyücü", color: "#A855F7", icon: "auto-fix", description: "Büyülü odak.", attributeLabel: "Karma" },
  { id: "archer", name: "Okçu", color: "#22C55E", icon: "target", description: "İsabet ve tempo.", attributeLabel: "Çeviklik" },
];

export const DND_CLASS_ICONS: Partial<Record<CharacterClass, string>> = Object.fromEntries(
  DND_CLASSES.map((c) => [c.id, c.icon]),
) as Partial<Record<CharacterClass, string>>;
