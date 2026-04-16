import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { charactersTable, authTokensTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { calcTierByLevel } from "../constants/tiers.js";
import { authenticateUser } from "../middlewares/auth.js";
import { generateToken } from "../lib/token.js";
import { isDebugUser } from "../lib/admin.js";

const router: IRouter = Router();

function generateCode(prefix: string, length: number = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = prefix;
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function calcExpToNextLevel(level: number): number {
  return Math.floor(150 * Math.pow(1.1, level - 1));
}

export function processLevelUp(currentExp: number, currentLevel: number, xpGained: number, maxLevel = 100) {
  let newExp = currentExp + xpGained;
  let level = currentLevel;
  let leveledUp = false;
  let expNeeded = calcExpToNextLevel(level);

  while (newExp >= expNeeded && level < maxLevel) {
    newExp -= expNeeded;
    level += 1;
    leveledUp = true;
    expNeeded = calcExpToNextLevel(level);
  }

  return { newExp, newLevel: level, leveledUp };
}

export function calcStats(level: number, charClass: string) {
  const base = { strength: 10, agility: 10, endurance: 10 };
  const gains: Record<string, { strength: number; agility: number; endurance: number }> = {
    barbarian:  { strength: 4, agility: 1, endurance: 3 }, // Replit: STR+4 END+3 AGI+1
    fighter:    { strength: 4, agility: 2, endurance: 2 }, // dengeli ön saflar
    paladin:    { strength: 2, agility: 1, endurance: 4 }, // Replit: END+4 STR+2 AGI+1
    monk:       { strength: 2, agility: 4, endurance: 2 }, // AGI uzmanı
    rogue:      { strength: 1, agility: 4, endurance: 1 }, // Replit: AGI+4 STR+1 END+1
    ranger:     { strength: 2, agility: 4, endurance: 1 }, // menzilli AGI
    wizard:     { strength: 1, agility: 2, endurance: 1 }, // kırılgan caster
    cleric:     { strength: 2, agility: 1, endurance: 4 }, // Replit: END+4 STR+2 AGI+1
    druid:      { strength: 1, agility: 2, endurance: 3 }, // dayanıklı hibrit
    sorcerer:   { strength: 1, agility: 3, endurance: 1 }, // mobil caster
    warlock:    { strength: 1, agility: 2, endurance: 2 }, // kontrollü hibrit
    bard:       { strength: 1, agility: 3, endurance: 2 }, // destek mobilitesi
    warrior:    { strength: 4, agility: 1, endurance: 3 }, // Replit: STR+4 END+3 AGI+1
    mage:       { strength: 1, agility: 2, endurance: 1 }, // temel caster
    archer:     { strength: 1, agility: 4, endurance: 1 }, // Replit: AGI+4 STR+1 END+1
  };
  const g = gains[charClass] || gains.fighter;
  return {
    strength: base.strength + g.strength * (level - 1),
    agility: base.agility + g.agility * (level - 1),
    endurance: base.endurance + g.endurance * (level - 1),
  };
}

export function calcLeague(totalXpEarned: number): string {
  if (totalXpEarned >= 150000) return "sampiyonluk";
  if (totalXpEarned >= 60000) return "platin";
  if (totalXpEarned >= 25000) return "altin";
  if (totalXpEarned >= 10000) return "gumus";
  if (totalXpEarned >= 3000) return "bronz";
  return "demir";
}

router.get("/character", authenticateUser, async (req, res) => {
  const userId = req.user!.id;

  const [char] = await db
    .select()
    .from(charactersTable)
    .where(eq(charactersTable.userId, userId));

  if (!char) {
    res.status(404).json({ error: "Karakter bulunamadı" });
    return;
  }

  const expToNextLevel = calcExpToNextLevel(char.level);
  const league = calcLeague(char.totalXpEarned);

  const streakActive = char.streakActiveUntil
    ? new Date(char.streakActiveUntil) > new Date()
    : false;

  res.json({ ...char, expToNextLevel, league, streakActive, isAdmin: isDebugUser(char.name), isDebugUser: isDebugUser(char.name) });
});

router.post("/character", async (req, res) => {
  const { userId, name, class: charClass, region } = req.body;
  const safeName = typeof name === "string" && name.trim().length > 0 ? name.trim() : "Rookie";

  if (!userId || !charClass) {
    res.status(400).json({ error: "userId ve class zorunludur" });
    return;
  }

  const stats = calcStats(1, charClass);

  const [existing] = await db
    .select()
    .from(charactersTable)
    .where(eq(charactersTable.userId, userId));

  let char;
  if (existing) {
    const [updated] = await db
      .update(charactersTable)
      .set({
        name: safeName,
        class: charClass,
        region: region || "global",
        tier: calcTierByLevel(existing.level ?? 1),
        updatedAt: new Date(),
      })
      .where(eq(charactersTable.userId, userId))
      .returning();
    char = updated;
  } else {
    const referralCode = generateCode("R", 6);
    const friendCode = generateCode("F", 6);
    const [created] = await db
      .insert(charactersTable)
      .values({
        userId,
        name: safeName,
        class: charClass,
        region: region || "global",
        level: 1,
        tier: calcTierByLevel(1),
        exp: 0,
        totalExp: 0,
        league: "demir",
        ...stats,
        totalWorkouts: 0,
        totalXpEarned: 0,
        totalCalories: 0,
        questStreak: 0,
        referralCode,
        friendCode,
      })
      .returning();
    char = created;
  }

  const token = generateToken();
  const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(authTokensTable).values({
    token,
    userId,
    expiresAt: tokenExpiresAt,
  }).onConflictDoUpdate({
    target: authTokensTable.userId,
    set: { token, expiresAt: tokenExpiresAt, createdAt: new Date() },
  });

  if (!existing) {
    try {
      const { trackEvent } = await import("../trackEvent.js");
      trackEvent(userId, "user_signup", { name: safeName, class: charClass, region: region || "global" });
    } catch {}
  }

  const expToNextLevel = calcExpToNextLevel(char.level);
  const league = calcLeague(char.totalXpEarned);
  res.json({
    ...char,
    tier: char.tier || calcTierByLevel(char.level ?? 1),
    expToNextLevel,
    league,
    streakActive: false,
    isAdmin: isDebugUser(char.name),
    isDebugUser: isDebugUser(char.name),
    authToken: token,
  });
});

router.post("/character/profile", authenticateUser, async (req, res) => {
  const userId = req.user!.id;
  const rawName = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const rawInstagram = typeof req.body?.instagramUrl === "string" ? req.body.instagramUrl.trim() : "";
  const rawTwitter = typeof req.body?.twitterUrl === "string" ? req.body.twitterUrl.trim() : "";

  const [updated] = await db
    .update(charactersTable)
    .set({
      ...(rawName ? { name: rawName } : {}),
      instagramUrl: rawInstagram || null,
      twitterUrl: rawTwitter || null,
      updatedAt: new Date(),
    })
    .where(eq(charactersTable.userId, userId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Karakter bulunamadi" });
    return;
  }

  res.json(updated);
});

router.post("/character/accept-disclaimer", authenticateUser, async (req, res) => {
  const userId = req.user!.id;

  const [updated] = await db.update(charactersTable)
    .set({ hasAcceptedDisclaimer: true, updatedAt: new Date() })
    .where(eq(charactersTable.userId, userId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Karakter bulunamadi" });
    return;
  }

  res.json({ hasAcceptedDisclaimer: true });
});

router.post("/character/admin-grant", authenticateUser, async (req, res) => {
  const userId = req.user!.id;
  const isDebug = req.user?.isDebugUser === true || req.user?.isAdmin === true;
  if (!isDebug) {
    res.status(403).json({ error: "Bu islem sadece test admin kullanicilarina aciktir" });
    return;
  }

  const action = String((req.body as any)?.action || "xp").toLowerCase();
  const [char] = await db.select().from(charactersTable).where(eq(charactersTable.userId, userId));
  if (!char) {
    res.status(404).json({ error: "Karakter bulunamadi" });
    return;
  }

  let level = Number(char.level || 1);
  let exp = Number(char.exp || 0);
  if (action === "level") {
    level = Math.min(100, level + 1);
  } else {
    const lv = processLevelUp(exp, level, 5000);
    level = lv.newLevel;
    exp = lv.newExp;
  }

  const stats = calcStats(level, String(char.class || "fighter"));
  const [updated] = await db.update(charactersTable).set({
    level,
    exp,
    tier: calcTierByLevel(level),
    ...stats,
    updatedAt: new Date(),
  }).where(eq(charactersTable.userId, userId)).returning();

  res.json({
    success: true,
    character: {
      ...updated,
      expToNextLevel: calcExpToNextLevel(updated.level || 1),
      league: calcLeague(updated.totalXpEarned || 0),
      streakActive: false,
      isAdmin: true,
      isDebugUser: true,
    },
  });
});

export default router;
