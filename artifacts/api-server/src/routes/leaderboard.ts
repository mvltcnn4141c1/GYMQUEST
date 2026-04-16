import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  charactersTable,
  partiesTable,
  partyMembersTable,
  characterAchievementsTable,
  leaderboardSnapshotsTable,
} from "@workspace/db/schema";
import { desc, inArray, eq, sql } from "drizzle-orm";
import { calcLeague as calcLegacyLeague } from "./character.js";
import { calcPartyLeague } from "./party.js";
import { ACHIEVEMENT_MAP } from "../constants/achievements.js";
import { calculateLeague as calculateRankedLeague, PRO_LEAGUE_LABELS, PRO_LEAGUE_ICON_KEYS } from "../constants/pro-leagues.js";
import { authenticateUser } from "../middlewares/auth.js";

const router: IRouter = Router();

function getCharacterXpScore(c: any): number {
  return Number(c.totalXpEarned ?? c.totalExp ?? c.xp ?? 0);
}

function calculateLeague(xp: number) {
  return calculateRankedLeague(xp);
}

function getLeagueName(league: string): string {
  const names: Record<string, string> = {
    demir: "Demir", bronz: "Bronz", gumus: "Gümüş",
    altin: "Altın", platin: "Platin", sampiyonluk: "Şampiyonluk",
    iron: "Iron", bronze: "Bronze", silver: "Silver", gold: "Gold",
    platinum: "Platinum", diamond: "Diamond", master: "Master",
  };
  return names[league] || "Iron";
}

function getLeagueOrder(league: string): number {
  const order: Record<string, number> = {
    sampiyonluk: 6, platin: 5, altin: 4, gumus: 3, bronz: 2, demir: 1,
    master: 7, diamond: 6, platinum: 5, gold: 4, silver: 3, bronze: 2, iron: 1,
  };
  return order[league] || 0;
}

router.get("/leaderboard", async (req, res) => {
  const { region, league: leagueFilter, limit } = req.query as {
    region?: string; league?: string; limit?: string;
  };

  const lim = Math.min(parseInt(limit || "100"), 200);

  const chars = await db
    .select()
    .from(charactersTable)
    .orderBy(desc(charactersTable.xp), desc(charactersTable.level))
    .limit(lim);

  let filtered = region && region !== "global"
    ? chars.filter((c) => c.region === region)
    : chars;

  if (leagueFilter && leagueFilter !== "all") {
    filtered = filtered.filter((c) => calculateLeague(getCharacterXpScore(c)) === leagueFilter);
  }

  const entries = filtered.map((c, i) => {
    const xpScore = getCharacterXpScore(c);
    const league = calculateLeague(xpScore);
    const streakActive = c.streakActiveUntil
      ? new Date(c.streakActiveUntil) > new Date()
      : false;

    return {
      rank: i + 1,
      userId: c.userId,
      characterName: c.name,
      characterClass: c.class,
      level: c.level,
      totalExp: xpScore,
      totalXpEarned: xpScore,
      totalCalories: c.totalCalories || 0,
      region: c.region,
      totalWorkouts: c.totalWorkouts,
      league,
      leagueName: PRO_LEAGUE_LABELS[league],
      leagueOrder: getLeagueOrder(calcLegacyLeague(xpScore)),
      leagueIcon: PRO_LEAGUE_ICON_KEYS[league],
      questStreak: c.questStreak || 0,
      streakActive,
    };
  });

  const leagueGroups: Record<string, typeof entries> = {};
  for (const e of entries) {
    if (!leagueGroups[e.league]) leagueGroups[e.league] = [];
    leagueGroups[e.league].push(e);
  }

  for (const [lg, group] of Object.entries(leagueGroups)) {
    const promotionCount = Math.ceil(group.length * 0.2);
    group.forEach((e, idx) => { (e as any).inPromotionZone = idx < promotionCount; });
  }

  res.json({ entries, leagueGroups: Object.keys(leagueGroups) });
});

router.get("/leaderboard/groups", async (req, res) => {
  const { league: leagueFilter, limit } = req.query as {
    league?: string; limit?: string;
  };

  const lim = Math.min(parseInt(limit || "100"), 200);

  const parties = await db
    .select()
    .from(partiesTable)
    .orderBy(desc(partiesTable.totalXp))
    .limit(lim);

  let filtered = parties;
  if (leagueFilter && leagueFilter !== "all") {
    filtered = parties.filter((p) => calcPartyLeague(p.totalXp) === leagueFilter);
  }

  const enriched = await Promise.all(filtered.map(async (party, i) => {
    const members = await db
      .select()
      .from(partyMembersTable)
      .where(eq(partyMembersTable.partyId, party.id));

    const characterIds = members.map((m) => m.characterId);
    const chars = characterIds.length > 0
      ? await db.select().from(charactersTable).where(inArray(charactersTable.id, characterIds))
      : [];

    const league = calcPartyLeague(party.totalXp);

    return {
      rank: i + 1,
      partyId: party.id,
      partyName: party.name,
      memberCount: members.length,
      totalXp: party.totalXp,
      league,
      leagueName: getLeagueName(league),
      leagueOrder: getLeagueOrder(league),
      avgLevel: chars.length > 0 ? Math.round(chars.reduce((s, c) => s + c.level, 0) / chars.length) : 1,
      members: chars.map((c) => ({
        name: c.name,
        class: c.class,
        level: c.level,
      })),
    };
  }));

  res.json({ entries: enriched });
});

router.get("/leaderboard/clans", async (req, res) => {
  const { limit } = req.query as { limit?: string };
  const lim = Math.min(parseInt(limit || "100"), 200);
  const clans = await db.select().from(partiesTable).limit(lim);

  const enriched = await Promise.all(clans.map(async (clan) => {
    const members = await db
      .select()
      .from(partyMembersTable)
      .where(eq(partyMembersTable.partyId, clan.id));
    const characterIds = members.map((m) => m.characterId);
    const chars = characterIds.length > 0
      ? await db.select().from(charactersTable).where(inArray(charactersTable.id, characterIds))
      : [];
    const totalXp = chars.reduce((sum, c: any) => sum + Number(c.totalXpEarned || c.xp || 0), 0);
    const battlePoints = Number((clan as any).clanBattlePoints || 0);
    const warWins = Number((clan as any).clanWarWins || 0);
    const score = totalXp + (battlePoints * 1000);
    return {
      clanId: clan.id,
      clanName: (clan as any).name,
      memberCount: members.length,
      totalXp,
      battlePoints,
      warWins,
      score,
    };
  }));

  const ranked = enriched.sort((a, b) => b.score - a.score).map((x, i) => ({ ...x, rank: i + 1 }));
  const now = new Date();
  const top3ClanIds = ranked.slice(0, 3).map((c) => c.clanId);
  const top3Members = await Promise.all(top3ClanIds.map(async (partyId) => {
    const members = await db.select().from(partyMembersTable).where(eq(partyMembersTable.partyId, partyId as any));
    return members.map((m) => m.userId);
  }));
  const top3UserIds = Array.from(new Set(top3Members.flat()));
  const eliteEndsAt = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  for (const userId of top3UserIds) {
    await db.update(charactersTable).set({ eliteTierUntil: eliteEndsAt, updatedAt: now }).where(eq(charactersTable.userId, userId));
  }

  res.json({ entries: ranked });
});

router.get("/leaderboard/top100", async (req, res) => {
  const chars = await db
    .select()
    .from(charactersTable)
    .orderBy(desc(charactersTable.xp), desc(charactersTable.level))
    .limit(100);

  const entries = await Promise.all(chars.map(async (c, i) => {
    const xpScore = getCharacterXpScore(c);
    const league = calculateLeague(xpScore);
    const streakActive = c.streakActiveUntil
      ? new Date(c.streakActiveUntil) > new Date()
      : false;

    const achievements = await db
      .select()
      .from(characterAchievementsTable)
      .where(eq(characterAchievementsTable.userId, c.userId));

    const topAchievements = achievements
      .map((a) => ACHIEVEMENT_MAP[a.achievementKey])
      .filter(Boolean)
      .sort((a, b) => {
        const rarityOrder = { legendary: 4, epic: 3, rare: 2, common: 1 };
        return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
      })
      .slice(0, 3);

    return {
      rank: i + 1,
      userId: c.userId,
      characterName: c.name,
      characterClass: c.class,
      level: c.level,
      totalXpEarned: xpScore,
      totalWorkouts: c.totalWorkouts,
      totalCalories: c.totalCalories || 0,
      league,
      leagueName: PRO_LEAGUE_LABELS[league],
      leagueOrder: getLeagueOrder(calcLegacyLeague(xpScore)),
      leagueIcon: PRO_LEAGUE_ICON_KEYS[league],
      questStreak: c.questStreak || 0,
      streakActive,
      topAchievements,
      achievementCount: achievements.length,
    };
  }));

  const topParties = await db
    .select()
    .from(partiesTable)
    .orderBy(desc(partiesTable.totalXp))
    .limit(100);

  const topPartyEntries = await Promise.all(topParties.map(async (p, i) => {
    const members = await db
      .select()
      .from(partyMembersTable)
      .where(eq(partyMembersTable.partyId, p.id));
    const characterIds = members.map((m) => m.characterId);
    const chars2 = characterIds.length > 0
      ? await db.select().from(charactersTable).where(inArray(charactersTable.id, characterIds))
      : [];
    return {
      rank: i + 1,
      partyId: p.id,
      partyName: p.name,
      memberCount: members.length,
      totalXp: p.totalXp,
      league: calcPartyLeague(p.totalXp),
      avgLevel: chars2.length > 0 ? Math.round(chars2.reduce((s, c) => s + c.level, 0) / chars2.length) : 1,
      topMembers: chars2.slice(0, 3).map((c) => ({ name: c.name, class: c.class, level: c.level })),
    };
  }));

  res.json({ entries, individuals: entries, parties: topPartyEntries });
});

router.get("/leaderboard/weekly", async (req, res) => {
  const { region, limit } = req.query as { region?: string; limit?: string };
  const lim = Math.min(parseInt(limit || "100"), 200);

  const chars = await db
    .select()
    .from(charactersTable)
    .orderBy(desc(charactersTable.weeklyXp))
    .limit(lim);

  let filtered = region && region !== "global"
    ? chars.filter((c) => c.region === region)
    : chars;

  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);

  const entries = filtered.map((c, i) => ({
    rank: i + 1,
    userId: c.userId,
    characterName: c.name,
    characterClass: c.class,
    level: c.level,
    weeklyXp: c.weeklyXp,
    league: calculateLeague(getCharacterXpScore(c)),
  }));

  res.json({
    entries,
    weekStart: monday.toISOString(),
    weekEnd: nextMonday.toISOString(),
    resetsIn: nextMonday.getTime() - now.getTime(),
  });
});

router.get("/leaderboard/streak", async (req, res) => {
  const { limit } = req.query as { limit?: string };
  const lim = Math.min(parseInt(limit || "50"), 100);

  const chars = await db
    .select()
    .from(charactersTable)
    .orderBy(desc(charactersTable.streakDays))
    .limit(lim);

  const entries = chars
    .filter((c) => c.streakDays > 0)
    .map((c, i) => ({
      rank: i + 1,
      userId: c.userId,
      characterName: c.name,
      characterClass: c.class,
      level: c.level,
      streakDays: c.streakDays,
      league: calculateLeague(getCharacterXpScore(c)),
    }));

  res.json({ entries });
});

router.get("/share-card", authenticateUser, async (req, res) => {
  const userId = req.user!.id;

  const [char] = await db.select().from(charactersTable).where(eq(charactersTable.userId, userId));
  if (!char) {
    res.status(404).json({ error: "Karakter bulunamadı" });
    return;
  }

  const charXpScore = getCharacterXpScore(char);
  const league = calculateLeague(charXpScore);
  const achievements = await db
    .select()
    .from(characterAchievementsTable)
    .where(eq(characterAchievementsTable.userId, userId));

  const topAchievements = achievements
    .map((a) => ACHIEVEMENT_MAP[a.achievementKey])
    .filter(Boolean)
    .sort((a, b) => {
      const order = { legendary: 4, epic: 3, rare: 2, common: 1 } as Record<string, number>;
      return (order[b.rarity] || 0) - (order[a.rarity] || 0);
    })
    .slice(0, 3);

  const allChars = await db
    .select({ userId: charactersTable.userId })
    .from(charactersTable)
    .orderBy(desc(charactersTable.xp), desc(charactersTable.level));
  const globalRank = allChars.findIndex((c) => c.userId === userId) + 1;

  res.json({
    name: char.name,
    class: char.class,
    level: char.level,
    totalXpEarned: charXpScore,
    totalWorkouts: char.totalWorkouts,
    streakDays: char.streakDays,
    league,
    leagueName: PRO_LEAGUE_LABELS[league],
    leagueIcon: PRO_LEAGUE_ICON_KEYS[league],
    globalRank,
    totalPlayers: allChars.length,
    achievementCount: achievements.length,
    topAchievements: topAchievements.map((a) => ({ name: a.name, icon: a.icon, rarity: a.rarity })),
    referralCode: char.referralCode,
    shareText: `GymQuest'te ${char.name} - Seviye ${char.level} ${getLeagueName(league)} Lig'inde! ${char.totalWorkouts} antrenman tamamladım. Sen de katıl! Referans: ${char.referralCode || ""}`,
  });
});

export default router;
