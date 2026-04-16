export type ProLeague =
  | "iron"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "master";

export const PRO_LEAGUE_LABELS: Record<ProLeague, string> = {
  iron: "Iron",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  diamond: "Diamond",
  master: "Master",
};

export const PRO_LEAGUE_ICON_KEYS: Record<ProLeague, string> = {
  iron: "sword",
  bronze: "shield-sword",
  silver: "shield",
  gold: "shield-star",
  platinum: "shield-crown",
  diamond: "diamond-stone",
  master: "crown",
};

export function calculateLeague(xp: number): ProLeague {
  const score = Math.max(0, Number(xp) || 0);
  if (score >= 25000) return "master";
  if (score >= 15000) return "diamond";
  if (score >= 8000) return "platinum";
  if (score >= 3500) return "gold";
  if (score >= 1501) return "silver";
  if (score >= 501) return "bronze";
  return "iron";
}

export const calcProLeagueByXp = calculateLeague;

