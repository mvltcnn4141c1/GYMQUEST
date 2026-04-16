export const TIER_ORDER = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic",
] as const;

export type TierKey = (typeof TIER_ORDER)[number];

type TierRange = {
  key: TierKey;
  minLevel: number;
  maxLevel: number | null;
};

export const TIER_RANGES: TierRange[] = [
  { key: "common", minLevel: 1, maxLevel: 10 },
  { key: "uncommon", minLevel: 11, maxLevel: 20 },
  { key: "rare", minLevel: 21, maxLevel: 30 },
  { key: "epic", minLevel: 31, maxLevel: 40 },
  { key: "legendary", minLevel: 41, maxLevel: 50 },
  { key: "mythic", minLevel: 51, maxLevel: null },
];

export function calcTierByLevel(level: number): TierKey {
  const safeLevel = Math.max(1, Math.floor(level || 1));
  const matched = TIER_RANGES.find(
    (range) =>
      safeLevel >= range.minLevel &&
      (range.maxLevel === null || safeLevel <= range.maxLevel),
  );
  return matched?.key ?? "common";
}

