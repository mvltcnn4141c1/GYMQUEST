import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { questsTable, userQuestsTable, charactersTable } from "@workspace/db/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { calcExpToNextLevel, calcStats, processLevelUp } from "./character.js";
import { authenticateUser } from "../middlewares/auth.js";
import { calcTierByLevel } from "../constants/tiers.js";

const router: IRouter = Router();

function questExerciseType(title: string): string | null {
  const t = title.toLowerCase();
  if (t.includes("iron will")) return "push_up";
  if (t.includes("squat champion")) return "squat";
  return null;
}

router.get("/quests", authenticateUser, async (req, res) => {
  const userId = req.user!.id;
  const now = new Date();
  const activeQuests = await db
    .select()
    .from(questsTable)
    .where(and(eq(questsTable.isActive, true), gt(questsTable.expiresAt, now)));

  const userQuestData = await db
    .select()
    .from(userQuestsTable)
    .where(eq(userQuestsTable.userId, userId));

  const userQuestMap = new Map(userQuestData.map((uq) => [uq.questId, uq]));

  const quests = await Promise.all(activeQuests.map(async (q) => {
    const uq = userQuestMap.get(q.id);
    const mappedExerciseType = questExerciseType(q.title);
    let progress = Number(uq?.progress || 0);

    if (q.objectiveType === "exercise_reps" && mappedExerciseType) {
      const rows = await db.execute(
        sql`SELECT COALESCE(SUM(reps), 0)::int AS total_reps
            FROM workouts
            WHERE user_id = ${userId} AND exercise_type = ${mappedExerciseType}`
      );
      progress = Number((rows.rows?.[0] as any)?.total_reps || 0);
    }

    const targetValue = Number(q.targetValue || 0);
    const isCompleted = uq?.status === "completed" || uq?.status === "claimed" || progress >= targetValue;
    const isClaimed = uq?.status === "claimed" || !!uq?.claimedAt;

    return {
      id: q.id,
      title: q.title,
      description: q.description,
      type: q.questType,
      exerciseType: mappedExerciseType || "custom",
      targetValue,
      unit: q.objectiveType === "exercise_reps" ? "reps" : "count",
      currentProgress: progress,
      xpReward: q.xpReward,
      coinReward: q.rewardCoins,
      gemReward: q.rewardGems,
      isCompleted,
      isClaimed,
      completedAt: uq?.completedAt ? uq.completedAt.toISOString() : null,
      expiresAt: q.expiresAt.toISOString(),
    };
  }));

  const completedCount = quests.filter((q) => q.isCompleted || q.isClaimed).length;
  res.json({
    quests,
    allCompleted: completedCount === quests.length && quests.length > 0,
    bonusAlreadyClaimed: false,
    bonusXp: 0,
    completedCount,
    questStreak: 0,
    streakActive: false,
  });
});

router.post("/quests/:questId/complete", authenticateUser, async (req, res) => {
  const questId = Number(req.params.questId);
  const userId = req.user!.id;
  if (!Number.isFinite(questId)) {
    res.status(400).json({ error: "Invalid quest id" });
    return;
  }

  const [quest] = await db
    .select()
    .from(questsTable)
    .where(eq(questsTable.id, questId));

  if (!quest) {
    res.status(404).json({ error: "Quest not found" });
    return;
  }

  const [existing] = await db
    .select()
    .from(userQuestsTable)
    .where(and(eq(userQuestsTable.userId, userId), eq(userQuestsTable.questId, questId)));

  if (existing?.status === "claimed") {
    res.status(400).json({ error: "Quest already completed" });
    return;
  }

  if (existing) {
    await db
      .update(userQuestsTable)
      .set({ status: "claimed", completedAt: new Date(), claimedAt: new Date(), progress: quest.targetValue })
      .where(eq(userQuestsTable.id, existing.id));
  } else {
    await db.insert(userQuestsTable).values({
      userId,
      questId: quest.id,
      progress: quest.targetValue,
      status: "claimed",
      completedAt: new Date(),
      claimedAt: new Date(),
    });
  }

  const [char] = await db
    .select()
    .from(charactersTable)
    .where(eq(charactersTable.userId, userId));

  let updatedChar = char;
  const previousTier = char?.tier || null;
  if (char) {
    const currentXp = Number((char as any).exp || 0);
    const currentLevel = Number((char as any).level || 1);
    const lv = processLevelUp(currentXp, currentLevel, quest.xpReward);
    const stats = calcStats(lv.newLevel, char.class);
    const rewardCoins = Number(quest.rewardCoins || 0);
    const [updated] = await db
      .update(charactersTable)
      .set({
        exp: lv.newExp,
        level: lv.newLevel,
        tier: calcTierByLevel(lv.newLevel),
        gymCoins: Number((char as any).gymCoins || 0) + rewardCoins,
        ...stats,
        updatedAt: new Date(),
      })
      .where(eq(charactersTable.userId, userId))
      .returning();
    updatedChar = updated;
  }

  const expToNextLevel = calcExpToNextLevel(updatedChar?.level || 1);

  res.json({
    quest: {
      ...quest,
      currentProgress: quest.targetValue,
      isCompleted: true,
      isClaimed: true,
      expiresAt: quest.expiresAt.toISOString(),
    },
    xpEarned: quest.xpReward,
    coinEarned: quest.rewardCoins ?? 0,
    previousTier,
    character: updatedChar ? { ...updatedChar, expToNextLevel } : null,
  });
});

export default router;
