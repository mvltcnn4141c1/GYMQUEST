import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  workoutsTable, charactersTable,
  partyMembersTable, bossEventsTable, eventContributionsTable,
  characterAchievementsTable, workoutAuditLogsTable,
  purchasesTable,
} from "@workspace/db/schema";
import { eq, desc, and, inArray, gte, sql } from "drizzle-orm";
import { calcExpToNextLevel, calcStats, calcLeague, processLevelUp, isDailyTurboEligible } from "./character.js";
import { calcTierByLevel } from "../constants/tiers.js";
import { XP_MULTIPLIER } from "../constants/xp.js";
import { getActiveBoostMultiplier } from "./store.js";
import { BOSS_MAP } from "../constants/bosses.js";
import { checkAndAwardAchievements } from "../constants/achievements.js";
import { authenticateUser } from "../middlewares/auth.js";
import { rateLimiter } from "../middlewares/rate-limiter.js";
import {
  validateUserAction, validateTimestamp, validateWorkoutConsistency,
  checkXpHourlyCap, checkWorkoutHourlyCap, createEndpointRateLimiter,
  logSuspiciousActivity,
} from "../middlewares/anticheat.js";
import { updateDailyQuestProgress } from "./daily-quests.js";
import { addBattlePassXp } from "./battle-pass.js";
import { processWorkoutReward, type EconomyResult } from "../economy.js";
import { trackDailyActivity } from "./retention.js";
import { calculateWorkoutXp } from "../lib/workout-xp.js";

const router: IRouter = Router();

const workoutRateLimiter = createEndpointRateLimiter(10);

const COOLDOWN_MS = 5 * 60 * 1000;
const SPAM_THRESHOLD_HOURLY = 8;
const SPAM_THRESHOLD_DAILY = 30;
const SPAM_XP_PENALTY = 0.25;
const SPAM_DAILY_XP_PENALTY = 0.10;
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

const SOFT_CAP_TIER1 = 3;
const SOFT_CAP_TIER1_MULT = 0.50;
const SOFT_CAP_TIER2 = 5;
const SOFT_CAP_TIER2_MULT = 0.20;

const BASE_XP = 50;
const MODE_MULT: Record<string, number> = { recommended: 1.0, custom: 0.85, free: 0.7 };
const SETS_BONUS_PER = 2;
const SETS_BONUS_CAP = 200;
const DUR_BONUS_PER = 1;
const DUR_BONUS_CAP = 120;
const LOW_EX_THRESH = 2;
const MIN_SETS = 3;
const MIN_DUR = 5;
const QUALITY_SETS = 15;
const QUALITY_DUR = 20;
const QUALITY_BONUS = 20;
const STREAK_PER_DAY = 5;
const STREAK_CAP = 50;
const COINS_PER_XP = 0.12;
const XP_SCALE_MULTIPLIER = XP_MULTIPLIER;

function checkGlobalCooldown(lastWorkoutAt: Date | null, now: Date): { allowed: boolean; remainingSeconds: number } {
  if (!lastWorkoutAt) return { allowed: true, remainingSeconds: 0 };
  const elapsed = now.getTime() - new Date(lastWorkoutAt).getTime();
  if (elapsed < 0) return { allowed: true, remainingSeconds: 0 };
  const remaining = COOLDOWN_MS - elapsed;
  if (remaining > 0) {
    return { allowed: false, remainingSeconds: Math.ceil(remaining / 1000) };
  }
  return { allowed: true, remainingSeconds: 0 };
}

function getLocalDate(utcDate: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(utcDate);
    return parts;
  } catch {
    const offset = 3 * 60 * 60 * 1000;
    const local = new Date(utcDate.getTime() + offset);
    return local.toISOString().slice(0, 10);
  }
}

function dayDiff(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00Z').getTime();
  const b = new Date(dateB + 'T00:00:00Z').getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function computeStreak(
  lastWorkoutAt: Date | null,
  currentStreak: number,
  lastStreakDate: string | null,
  now: Date,
  timezone: string,
) {
  const todayLocal = getLocalDate(now, timezone);

  if (!lastWorkoutAt) {
    return { newStreak: 1, streakContinued: false, streakBroken: false, newStreakDate: todayLocal, debug: { todayLocal, lastStreakDate, daysSinceLast: null } };
  }

  const alreadyIncrementedToday = lastStreakDate === todayLocal;
  if (alreadyIncrementedToday) {
    return { newStreak: currentStreak, streakContinued: false, streakBroken: false, newStreakDate: todayLocal, debug: { todayLocal, lastStreakDate, daysSinceLast: 0, sameDay: true } };
  }

  const lastLocal = lastStreakDate || getLocalDate(new Date(lastWorkoutAt), timezone);
  const daysSince = dayDiff(lastLocal, todayLocal);

  if (daysSince === 1) {
    return { newStreak: currentStreak + 1, streakContinued: true, streakBroken: false, newStreakDate: todayLocal, debug: { todayLocal, lastStreakDate: lastLocal, daysSinceLast: daysSince } };
  }
  if (daysSince === 2) {
    return { newStreak: currentStreak, streakContinued: false, streakBroken: false, newStreakDate: todayLocal, debug: { todayLocal, lastStreakDate: lastLocal, daysSinceLast: daysSince, gracePeriod: true } };
  }
  if (daysSince > 2) {
    return { newStreak: 1, streakContinued: false, streakBroken: true, newStreakDate: todayLocal, debug: { todayLocal, lastStreakDate: lastLocal, daysSinceLast: daysSince } };
  }

  return { newStreak: currentStreak, streakContinued: false, streakBroken: false, newStreakDate: todayLocal, debug: { todayLocal, lastStreakDate: lastLocal, daysSinceLast: daysSince } };
}

function checkMinimumEffort(totalSets: number, durationMinutes: number): { meetsEffort: boolean; reason?: string } {
  if (totalSets < MIN_SETS && durationMinutes < MIN_DUR) {
    return { meetsEffort: false, reason: `Minimum efor karsilanmadi: en az ${MIN_SETS} set veya ${MIN_DUR} dakika gerekli` };
  }
  if (totalSets < MIN_SETS) {
    return { meetsEffort: false, reason: `Minimum set sayisi karsilanmadi: en az ${MIN_SETS} set gerekli` };
  }
  if (durationMinutes < MIN_DUR) {
    return { meetsEffort: false, reason: `Minimum sure karsilanmadi: en az ${MIN_DUR} dakika gerekli` };
  }
  return { meetsEffort: true };
}

function applySoftCap(xp: number, dailyWorkoutCount: number): { xp: number; capApplied: string | null } {
  if (dailyWorkoutCount >= SOFT_CAP_TIER2) {
    return { xp: Math.floor(xp * SOFT_CAP_TIER2_MULT), capApplied: `Gunluk ${dailyWorkoutCount}. antrenman — XP %${Math.round(SOFT_CAP_TIER2_MULT * 100)}` };
  }
  if (dailyWorkoutCount >= SOFT_CAP_TIER1) {
    return { xp: Math.floor(xp * SOFT_CAP_TIER1_MULT), capApplied: `Gunluk ${dailyWorkoutCount}. antrenman — XP %${Math.round(SOFT_CAP_TIER1_MULT * 100)}` };
  }
  return { xp, capApplied: null };
}

function applyXPModifiers(rawXp: number, mode: string, totalSets: number, durationMinutes: number, exercisesCount: number) {
  const cSets = Math.min(Math.max(0, totalSets), 100);
  const cDur = Math.min(Math.max(0, durationMinutes), 180);

  const isLowEx = exercisesCount < LOW_EX_THRESH;
  const meetsMinimumEffort = cSets >= MIN_SETS && cDur >= MIN_DUR;

  const setsBonus = Math.min(cSets * SETS_BONUS_PER, SETS_BONUS_CAP);
  const durationBonus = Math.min(cDur * DUR_BONUS_PER, DUR_BONUS_CAP);

  const isQuality = cSets >= QUALITY_SETS && cDur >= QUALITY_DUR;
  const qualityBonus = isQuality ? QUALITY_BONUS : 0;

  let penaltyFactor = 1;
  if (isLowEx) penaltyFactor -= 0.25;
  penaltyFactor = Math.max(0.5, penaltyFactor);

  const modeMultiplier = MODE_MULT[mode] ?? 0.7;
  const finalMultiplier = modeMultiplier * penaltyFactor;

  const modified = (rawXp + setsBonus + durationBonus + qualityBonus) * finalMultiplier;
  const xp = Math.max(0, Math.floor(modified));

  return {
    xp,
    meetsMinimumEffort,
    breakdown: {
      rawBase: rawXp,
      setsBonus,
      durationBonus,
      qualityBonus,
      multipliers: { mode: modeMultiplier, penaltyFactor, finalMultiplier },
    },
  };
}

function applyStreakBonus(baseXP: number, streakDays: number, meetsEffort: boolean) {
  const streakBonus = meetsEffort ? Math.min(Math.max(0, streakDays) * STREAK_PER_DAY, STREAK_CAP) : 0;
  const totalXP = Math.max(0, Math.floor(baseXP + streakBonus));
  return { totalXP, breakdown: { baseXP, streakBonus } };
}

interface SpamCheck {
  hourlySpam: boolean;
  dailySpam: boolean;
  hourlyCount: number;
  dailyCount: number;
  isDuplicate: boolean;
  xpMultiplier: number;
}

async function checkSpam(userId: string, exerciseType?: string): Promise<SpamCheck> {
  const now = Date.now();
  const oneHourAgo = new Date(now - 60 * 60 * 1000);
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const dupWindow = new Date(now - DUPLICATE_WINDOW_MS);

  const recentWorkouts = await db.select({
    id: workoutsTable.id,
    exerciseType: workoutsTable.exerciseType,
    createdAt: workoutsTable.createdAt,
  })
    .from(workoutsTable)
    .where(and(
      eq(workoutsTable.userId, userId),
      gte(workoutsTable.createdAt, oneDayAgo),
    ));

  const hourlyCount = recentWorkouts.filter(w => new Date(w.createdAt!) >= oneHourAgo).length;
  const dailyCount = recentWorkouts.length;

  const isDuplicate = exerciseType
    ? recentWorkouts.some(w => w.exerciseType === exerciseType && new Date(w.createdAt!) >= dupWindow)
    : false;

  const hourlySpam = hourlyCount >= SPAM_THRESHOLD_HOURLY - 1;
  const dailySpam = dailyCount >= SPAM_THRESHOLD_DAILY;

  let xpMultiplier = 1;
  if (dailySpam) {
    xpMultiplier = SPAM_DAILY_XP_PENALTY;
  } else if (hourlySpam) {
    xpMultiplier = SPAM_XP_PENALTY;
  }
  if (isDuplicate) {
    xpMultiplier = Math.min(xpMultiplier, 0.5);
  }

  return { hourlySpam, dailySpam, hourlyCount, dailyCount, isDuplicate, xpMultiplier };
}

async function logAudit(userId: string, workoutId: string | null, eventType: string, details: string) {
  try {
    await db.insert(workoutAuditLogsTable).values({
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId,
      workoutId,
      eventType,
      details,
    });
  } catch {}
}


const GOLDEN_RULE_XP_TABLE: Record<string, number> = {
  push_up: 15, pull_up: 20, squat: 20, deadlift: 25,
  bench_press: 22, shoulder_press: 18, running: 2, cycling: 1,
  plank: 10, burpee: 20, jump_rope: 2, row: 18,
  lunge: 12, situp: 10, other: 8,
};

const MET_TABLE: Record<string, number> = {
  push_up: 8, pull_up: 8.5, squat: 5, deadlift: 6,
  bench_press: 6, shoulder_press: 5.5, running: 9.5, cycling: 7.5,
  plank: 4, burpee: 8, jump_rope: 10, row: 7,
  lunge: 5.5, situp: 4.5, other: 4,
};

const DURATION_TABLE: Record<string, number> = {
  push_up: 2, pull_up: 3, squat: 2.5, deadlift: 4,
  bench_press: 3, shoulder_press: 3, running: 1, cycling: 1,
  plank: 1, burpee: 5, jump_rope: 1, row: 1,
  lunge: 2, situp: 2, other: 2,
};

const EXERCISE_MASTERY_CATEGORY: Record<string, "STR" | "AGI" | "END"> = {
  push_up: "STR",
  pull_up: "STR",
  squat: "STR",
  deadlift: "STR",
  bench_press: "STR",
  shoulder_press: "STR",
  burpee: "STR",
  row: "STR",
  lunge: "STR",
  situp: "END",
  plank: "END",
  running: "AGI",
  cycling: "AGI",
  jump_rope: "AGI",
};

const CLASS_MASTERY_CATEGORY: Record<string, "STR" | "AGI" | "END"> = {
  barbarian: "STR",
  fighter: "STR",
  paladin: "END",
  monk: "AGI",
  rogue: "AGI",
  ranger: "AGI",
  wizard: "AGI",
  cleric: "END",
  druid: "END",
  sorcerer: "AGI",
  warlock: "END",
  bard: "AGI",
  warrior: "STR",
  mage: "AGI",
  archer: "AGI",
};

const SUSPICIOUS_THRESHOLDS: Record<string, { maxReps?: number; maxSets?: number; maxDuration?: number }> = {
  push_up: { maxReps: 80, maxSets: 15 }, pull_up: { maxReps: 50, maxSets: 12 },
  squat: { maxReps: 80, maxSets: 15 }, deadlift: { maxReps: 30, maxSets: 8 },
  bench_press: { maxReps: 50, maxSets: 12 }, shoulder_press: { maxReps: 50, maxSets: 12 },
  running: { maxDuration: 100 }, cycling: { maxDuration: 200 },
  plank: { maxDuration: 45 }, burpee: { maxReps: 60, maxSets: 10 },
  jump_rope: { maxDuration: 90 }, row: { maxDuration: 90 },
  lunge: { maxReps: 80, maxSets: 12 }, situp: { maxReps: 80, maxSets: 15 },
  other: { maxReps: 300, maxSets: 30 },
};

function normalizeExerciseType(exerciseType?: string): string {
  return String(exerciseType || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function isSuspicious(exerciseType: string, sets: number, reps: number, duration: number): boolean {
  const key = normalizeExerciseType(exerciseType);
  const t = SUSPICIOUS_THRESHOLDS[key] || {};
  if (t.maxReps && reps > t.maxReps) return true;
  if (t.maxSets && sets > t.maxSets) return true;
  if (t.maxDuration && duration > t.maxDuration) return true;
  return false;
}

function isPhysicallyImpossible(sets: number, reps: number, durationMin: number): boolean {
  const totalReps = Math.max(0, sets) * Math.max(0, reps);
  if (durationMin <= 0) return totalReps > 200;
  const repsPerMinute = totalReps / Math.max(1, durationMin);
  return repsPerMinute > 80 || totalReps > 600;
}

function isSuspiciousBySpeed(sets: number, reps: number, durationSeconds: number): boolean {
  const totalReps = Math.max(0, sets) * Math.max(0, reps);
  if (durationSeconds <= 0 || totalReps <= 0) return false;
  const repsPerSecond = totalReps / durationSeconds;
  return repsPerSecond > 0.5;
}

function resolveExerciseBucket(exerciseType: string): "strength" | "cardio" | "core" {
  const key = normalizeExerciseType(exerciseType);
  if (["running", "cycling", "jump_rope"].includes(key)) return "cardio";
  if (["plank", "situp"].includes(key)) return "core";
  return "strength";
}

async function getEquipmentXpMultiplier(userId: string, exerciseType: string): Promise<number> {
  const bucket = resolveExerciseBucket(exerciseType);
  const owned = await db
    .select({ itemId: purchasesTable.itemId })
    .from(purchasesTable)
    .where(eq(purchasesTable.userId, userId));

  const ownedSet = new Set(owned.map((x) => x.itemId));
  let multiplier = 1;
  if (ownedSet.has("itm_dumbbell_basic") && bucket === "strength") multiplier += 0.05;
  if (ownedSet.has("itm_jump_rope_pro") && bucket === "cardio") multiplier += 0.05;
  if (ownedSet.has("itm_protein_shake")) multiplier += 0.1;
  return Math.max(1, multiplier);
}

function resolveMasteryCategory(exerciseType: string, exerciseCategory?: string): "STR" | "AGI" | "END" | null {
  const normalized = String(exerciseCategory || "").trim().toUpperCase();
  if (normalized === "STR" || normalized === "AGI" || normalized === "END") {
    return normalized;
  }
  return EXERCISE_MASTERY_CATEGORY[normalizeExerciseType(exerciseType)] || null;
}

function applyClassMasteryBonus(
  xp: number,
  charClass?: string,
  exerciseType?: string,
  exerciseCategory?: string,
): number {
  if (!charClass || !exerciseType) return xp;
  const classCategory = CLASS_MASTERY_CATEGORY[String(charClass).toLowerCase()];
  const workoutCategory = resolveMasteryCategory(exerciseType, exerciseCategory);
  if (!classCategory || !workoutCategory) return xp;
  if (classCategory !== workoutCategory) return xp;
  return Math.floor(xp * 1.1);
}

function calcRawXp(
  exerciseType: string,
  sets: number,
  reps: number,
  duration: number,
  xpPerUnit?: number,
  charClass?: string,
  exerciseCategory?: string,
): number {
  const key = normalizeExerciseType(exerciseType);
  const goldenBase = GOLDEN_RULE_XP_TABLE[key];
  // Golden-rule moves always use server-defined base XP values.
  const base = goldenBase ?? xpPerUnit ?? 8;
  const raw = duration > 0 && reps === 0
    ? Math.floor(base * (duration / 60))
    : Math.floor(base * sets * Math.sqrt(reps));
  const masteryAdjusted = applyClassMasteryBonus(raw, charClass, key, exerciseCategory);
  return Math.max(0, Math.floor(masteryAdjusted * XP_SCALE_MULTIPLIER));
}

function calcCalories(exerciseType: string, sets: number, reps: number, durationSec: number, weightKg = 70, tempoSec = 3): number {
  const met = MET_TABLE[normalizeExerciseType(exerciseType)] || 4;
  const durationMin = durationSec > 0
    ? durationSec
    : Math.round((Math.max(1, sets) * Math.max(0, reps) * tempoSec + Math.max(1, sets) * 60) / 60);
  const safeWeight = Math.max(35, Number(weightKg) || 70);
  const calories = (met * 3.5 * safeWeight / 200) * durationMin;
  return Math.max(0, Math.round(calories));
}

function calcDurationMin(exerciseType: string, sets: number, reps: number, duration: number): number {
  if (duration > 0 && reps === 0) return duration;
  const secPerRep = DURATION_TABLE[normalizeExerciseType(exerciseType)] || 2;
  return Math.round((sets * reps * secPerRep + sets * 60) / 60);
}

const CLASS_XP_BONUSES: Record<string, { categories: string[]; multiplier: number }> = {
  barbarian:  { categories: ['gogus', 'sirt', 'omuz', 'ust_bacak', 'arka_bacak', 'tam_vucut'], multiplier: 1.30 },
  fighter:    { categories: ['gogus', 'sirt', 'omuz', 'biseps', 'triseps', 'tam_vucut'], multiplier: 1.25 },
  paladin:    { categories: ['gogus', 'sirt', 'omuz', 'tam_vucut', 'kardiyo'], multiplier: 1.20 },
  monk:       { categories: ['kardiyo', 'tam_vucut', 'esneklik', 'karin', 'ust_bacak'], multiplier: 1.25 },
  rogue:      { categories: ['kardiyo', 'karin', 'ust_bacak', 'arka_bacak', 'esneklik'], multiplier: 1.25 },
  ranger:     { categories: ['kardiyo', 'arka_bacak', 'ust_bacak', 'karin'], multiplier: 1.25 },
  wizard:     { categories: ['esneklik', 'karin', 'kardiyo'], multiplier: 1.20 },
  cleric:     { categories: ['tam_vucut', 'kardiyo', 'esneklik', 'karin'], multiplier: 1.20 },
  druid:      { categories: ['esneklik', 'kardiyo', 'tam_vucut', 'karin'], multiplier: 1.20 },
  sorcerer:   { categories: ['kardiyo', 'esneklik', 'karin'], multiplier: 1.20 },
  warlock:    { categories: ['karin', 'esneklik', 'kardiyo'], multiplier: 1.20 },
  bard:       { categories: ['kardiyo', 'esneklik', 'karin', 'tam_vucut'], multiplier: 1.20 },
};

type LiftoffGoal = "yag_yakim" | "guc" | "kondisyon";

type LiftoffTemplate = {
  id: string;
  exerciseType: string;
  exerciseName: string;
  category: string;
  sets: number;
  reps: number;
  durationMin: number;
  intensity: "basit" | "orta" | "ileri";
  note: string;
  howToTip: string;
  goals: LiftoffGoal[];
};

const LIFTOFF_BY_CLASS: Record<string, LiftoffTemplate[]> = {
  barbarian: [
    { id: "bar-guc-1", exerciseType: "deadlift", exerciseName: "Deadlift", category: "sirt", sets: 5, reps: 5, durationMin: 0, intensity: "ileri", note: "Barbar guc protokolu: posterior chain odakli agir seri.", howToTip: "Bari bacağa yakin tut, nefesle core kilitle, bar yerden kalkarken kalca ve gogus ayni anda yuksel.", goals: ["guc"] },
    { id: "bar-guc-2", exerciseType: "squat", exerciseName: "Back Squat", category: "bacak", sets: 5, reps: 5, durationMin: 0, intensity: "ileri", note: "Maksimum alt vucut kuvveti ve sinir sistemi aktivasyonu.", howToTip: "Ayaklar omuz genisligi, dizler ayak ucunu izlesin, asagida bel kavsini kaybetmeden kalk.", goals: ["guc"] },
    { id: "bar-guc-3", exerciseType: "bench_press", exerciseName: "Bench Press", category: "gogus", sets: 5, reps: 4, durationMin: 0, intensity: "ileri", note: "Ust vucut itis gucunu artis odakli setler.", howToTip: "Kurekleri bankta sabitle, ayaklarla zeminden itis al, bari kontrollu hizda indir-kaldir.", goals: ["guc"] },
    { id: "bar-kond-1", exerciseType: "row", exerciseName: "Row Erg Intervals", category: "karsilasma_kardiyo", sets: 6, reps: 1, durationMin: 2, intensity: "orta", note: "Laktat toleransi ve cekis dayanikliligi.", howToTip: "Her cekise bacaktan basla, govdeyi acele ettirme, toparlanmada nefesi sakinlestir.", goals: ["kondisyon"] },
    { id: "bar-kond-2", exerciseType: "burpee", exerciseName: "Burpee", category: "karsilasma_kardiyo", sets: 5, reps: 10, durationMin: 0, intensity: "ileri", note: "Tam vucut kondisyonu ve patlayici gecisler.", howToTip: "Yere iniste coreu birakma, ayaga kalkista kalca-gogus koordinasyonunu koru.", goals: ["kondisyon", "yag_yakim"] },
    { id: "bar-kond-3", exerciseType: "jump_rope", exerciseName: "Jump Rope", category: "karsilasma_kardiyo", sets: 8, reps: 1, durationMin: 1, intensity: "orta", note: "Kisa dinlenmeli tempo koruma drilleri.", howToTip: "Bilekten cevir, az yuksel, omuzlari rahat birak ve ritmi bozma.", goals: ["kondisyon", "yag_yakim"] },
    { id: "bar-fat-1", exerciseType: "running", exerciseName: "Incline Running", category: "kardiyo", sets: 1, reps: 0, durationMin: 24, intensity: "orta", note: "Yag yakimina odakli nabiz bolgesi calismasi.", howToTip: "Konusabilecek tempoda kos, omuzlarini serbest tut, adim frekansini sabit tut.", goals: ["yag_yakim"] },
    { id: "bar-fat-2", exerciseType: "lunge", exerciseName: "Walking Lunge", category: "bacak", sets: 4, reps: 14, durationMin: 0, intensity: "orta", note: "Metabolik stresle bacak hacmi ve enerji tuketimi.", howToTip: "Dizleri iceri kacirma, govdeyi dik tut, adim uzunlugunu dengeyi bozmayacak sekilde sec.", goals: ["yag_yakim", "kondisyon"] },
    { id: "bar-fat-3", exerciseType: "push_up", exerciseName: "Push-Up Density", category: "gogus", sets: 5, reps: 18, durationMin: 0, intensity: "orta", note: "Kisa dinlenmeli yogun setlerle kalori harcamasini artirir.", howToTip: "Plank hatti koru, dirsek acisini 45 derece civari tut, tekrar temposunu sabit tut.", goals: ["yag_yakim"] },
  ],
  fighter: [
    { id: "fig-guc-1", exerciseType: "bench_press", exerciseName: "Speed Bench Press", category: "gogus", sets: 8, reps: 3, durationMin: 0, intensity: "ileri", note: "Patlayici itis gucu ve bar hizi gelisimi.", howToTip: "Orta agirlik sec, her tekrari hizli it, negatif fazi kontrollu tut.", goals: ["guc", "kondisyon"] },
    { id: "fig-guc-2", exerciseType: "deadlift", exerciseName: "Trap Bar Deadlift", category: "sirt", sets: 6, reps: 3, durationMin: 0, intensity: "ileri", note: "Hizli kuvvet cikisi ve guclu kalca aktivasyonu.", howToTip: "Kollar dik kalsin, diz-kalca esit acilsin, zeminden patlayici kalkis yap.", goals: ["guc"] },
    { id: "fig-guc-3", exerciseType: "squat", exerciseName: "Jump Squat", category: "bacak", sets: 5, reps: 6, durationMin: 0, intensity: "ileri", note: "Alt vucutta patlayici kuvvet odagi.", howToTip: "Hafif yukle inis yumusak olsun, dizleri kontrol ederek dikey patla.", goals: ["guc", "kondisyon"] },
    { id: "fig-con-1", exerciseType: "burpee", exerciseName: "Burpee + Sprawl", category: "karsilasma_kardiyo", sets: 6, reps: 10, durationMin: 0, intensity: "ileri", note: "Fighter kondisyonu icin round tabanli yuksek tempo.", howToTip: "Round basinda hizi degil ritmi kur, son tekrarlar icin nefesini koru.", goals: ["kondisyon", "yag_yakim"] },
    { id: "fig-con-2", exerciseType: "jump_rope", exerciseName: "Boxer Jump Rope", category: "karsilasma_kardiyo", sets: 10, reps: 1, durationMin: 1, intensity: "orta", note: "Ayak koordinasyonu ve ring temposu gelisimi.", howToTip: "Sag-sol agirlik transferini yumusak yap, omuzlari gevsek tut.", goals: ["kondisyon", "yag_yakim"] },
    { id: "fig-con-3", exerciseType: "running", exerciseName: "Sprint Intervals", category: "kardiyo", sets: 10, reps: 1, durationMin: 1, intensity: "ileri", note: "Anaerobik kapasiteyi fighter seviyesinde yukari tasir.", howToTip: "Sprintte diz cekisini yuksek tut, dinlenmede tam nefes toparla.", goals: ["kondisyon"] },
    { id: "fig-fat-1", exerciseType: "row", exerciseName: "Row Erg Pyramids", category: "karsilasma_kardiyo", sets: 5, reps: 1, durationMin: 3, intensity: "orta", note: "Yag yakimi icin nabiz dalgalandirici interval yapi.", howToTip: "Ilk setleri kontrollu ac, son setlerde pace'i teknik bozmadan artir.", goals: ["yag_yakim", "kondisyon"] },
    { id: "fig-fat-2", exerciseType: "push_up", exerciseName: "Combat Push-Up", category: "gogus", sets: 6, reps: 15, durationMin: 0, intensity: "orta", note: "Ust vucut dayanikliligi ve kalori harcamasini birlikte artirir.", howToTip: "Tekrar boyunca coreu sIk, tekrar sonlarinda beli cukurtme.", goals: ["yag_yakim"] },
    { id: "fig-fat-3", exerciseType: "cycling", exerciseName: "Air Bike Intervals", category: "kardiyo", sets: 8, reps: 1, durationMin: 2, intensity: "ileri", note: "Yuksek kalori harcatan tum-vucut interval protokolu.", howToTip: "Her intervalde ilk 20 sn hizlan, sonraki bolumde ritmi stabil tut.", goals: ["yag_yakim", "kondisyon"] },
  ],
  warrior: [],
  mage: [
    { id: "mg-1", exerciseType: "running", exerciseName: "Tempo Run", category: "kardiyo", sets: 1, reps: 0, durationMin: 20, intensity: "orta", note: "Agility tabanli enerji acilisi.", howToTip: "Nefes ritmini 3:2 tut, adim frekansini bozmadan tempo koru.", goals: ["yag_yakim", "kondisyon"] },
    { id: "mg-2", exerciseType: "jump_rope", exerciseName: "Jump Rope", category: "kardiyo", sets: 4, reps: 1, durationMin: 3, intensity: "orta", note: "Refleks ve ritim odagi.", howToTip: "Bilekten cevir, az yuksel, her sette ayni ritmi yakala.", goals: ["kondisyon"] },
    { id: "mg-3", exerciseType: "plank", exerciseName: "Plank", category: "karin", sets: 3, reps: 1, durationMin: 6, intensity: "basit", note: "Durus ve denge icin core.", howToTip: "Kalca ve omuzu ayni hizada tut, beli ne coker ne yukselirak kilitle.", goals: ["guc", "kondisyon"] },
  ],
  wizard: [
    { id: "wz-1", exerciseType: "running", exerciseName: "Kosu", category: "kardiyo", sets: 1, reps: 0, durationMin: 18, intensity: "orta", note: "Hiz ve dayaniklilik.", howToTip: "Adim uzunlugunu zorlamadan kadansi yukselt, omuzlari rahat birak.", goals: ["yag_yakim", "kondisyon"] },
    { id: "wz-2", exerciseType: "cycling", exerciseName: "Bisiklet", category: "kardiyo", sets: 1, reps: 0, durationMin: 22, intensity: "basit", note: "Sabit tempo stamina.", howToTip: "Sele yuksekligini ayarla, pedal cevirisini diz acisini bozmadan surdur.", goals: ["yag_yakim"] },
    { id: "wz-3", exerciseType: "situp", exerciseName: "Sit-Up", category: "karin", sets: 3, reps: 20, durationMin: 0, intensity: "orta", note: "Merkez bolge guclendirme.", howToTip: "Belini yere carpma, karinla yuksel, boyna cekis uygulama.", goals: ["guc", "kondisyon"] },
  ],
};

LIFTOFF_BY_CLASS.warrior = [
  ...LIFTOFF_BY_CLASS.barbarian.slice(0, 5).map((item, idx) => ({ ...item, id: `war-${idx + 1}` })),
  ...LIFTOFF_BY_CLASS.fighter.slice(0, 4).map((item, idx) => ({ ...item, id: `war-${idx + 6}` })),
];

function getWeekKey(date = new Date()): number {
  const utcMidnight = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcMidnight.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const monday = new Date(utcMidnight);
  monday.setUTCDate(utcMidnight.getUTCDate() - daysSinceMonday);
  return Number(monday.toISOString().slice(0, 10).replace(/-/g, ""));
}

function rotateTemplates<T>(items: T[], shift: number): T[] {
  if (items.length <= 1) return items;
  const normalized = ((shift % items.length) + items.length) % items.length;
  return [...items.slice(normalized), ...items.slice(0, normalized)];
}

function getLiftoffTemplates(charClass: string, goal: LiftoffGoal | "all", userId: string) {
  const base = LIFTOFF_BY_CLASS[charClass] || LIFTOFF_BY_CLASS.fighter;
  const goalFiltered = goal === "all" ? base : base.filter((x) => x.goals.includes(goal));
  const safe = goalFiltered.length > 0 ? goalFiltered : base;
  const weekKey = getWeekKey();
  const seed = userId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const shift = weekKey + seed;
  return rotateTemplates(safe, shift);
}

function getClassXPMultiplier(charClass: string, exerciseCategory: string): number {
  const bonus = CLASS_XP_BONUSES[charClass];
  if (!bonus) return 1;
  return bonus.categories.includes(exerciseCategory) ? bonus.multiplier : 1;
}

const CATEGORY_ALIASES: Record<string, string> = {
  gogus: "gogus",
  "göğüs": "gogus",
  gögüs: "gogus",
  chest: "gogus",
  sirt: "sirt",
  "sırt": "sirt",
  back: "sirt",
  bacak: "bacak",
  leg: "bacak",
  legs: "bacak",
  kardiyo: "kardiyo",
  cardio: "kardiyo",
  fullbody: "fullbody",
  "tum_vucut": "fullbody",
  "tüm_vücut": "fullbody",
  "karsilasma_kardiyo": "fullbody",
};

function normalizeExerciseCategoryKey(raw: string): string {
  return CATEGORY_ALIASES[String(raw || "").trim().toLowerCase()] || "fullbody";
}

router.get("/exercises/:category", authenticateUser, async (req, res) => {
  const requestedCategory = String(req.params.category || "");
  const normalizedCategory = normalizeExerciseCategoryKey(requestedCategory);
  const dbCategories = normalizedCategory === "fullbody"
    ? ["karsilasma_kardiyo", "fullbody", "tam_vucut"]
    : [normalizedCategory];

  try {
    const whereIn = sql.join(dbCategories.map((x) => sql`${x}`), sql`, `);
    const rows = await db.execute(sql`
      SELECT
        slug,
        exercise_name,
        exercise_type,
        muscle_group,
        category,
        default_sets,
        default_reps,
        default_duration_min,
        how_to_tip
      FROM exercise_library
      WHERE is_active = TRUE
        AND muscle_group IN (${whereIn})
      ORDER BY exercise_name ASC
    `);

    const exercises = (rows.rows || []).map((row: any) => ({
      id: row.exercise_type || row.slug,
      slug: row.slug,
      name: row.exercise_name,
      nameEn: row.exercise_name,
      category: normalizedCategory,
      subMuscle: row.muscle_group,
      unit: Number(row.default_duration_min || 0) > 0 ? "minutes" : "reps",
      defaultSets: Number(row.default_sets || 3),
      defaultReps: Number(row.default_reps || 10),
      defaultDurationMin: Number(row.default_duration_min || 0),
      howToTip: row.how_to_tip,
    }));

    res.json({
      requestedCategory,
      normalizedCategory,
      count: exercises.length,
      exercises,
    });
  } catch (err: any) {
    console.error("[GET /exercises/:category] query failed", {
      requestedCategory,
      normalizedCategory,
      dbCategories,
      message: err?.message,
      code: err?.code ?? err?.cause?.code,
      detail: err?.detail ?? err?.cause?.detail,
      stack: err?.stack,
      err,
    });
    res.status(500).json({ error: "Egzersiz listesi yuklenemedi" });
  }
});

router.get("/workouts/liftoff", authenticateUser, async (req, res) => {
  const userId = req.user!.id;
  const rawGoal = String((req.query as { goal?: string }).goal || "all").toLowerCase();
  const goal: LiftoffGoal | "all" =
    rawGoal === "yag_yakim" || rawGoal === "guc" || rawGoal === "kondisyon" ? rawGoal : "all";
  const [char] = await db.select().from(charactersTable).where(eq(charactersTable.userId, userId));
  if (!char) {
    res.status(404).json({ error: "Karakter bulunamadi" });
    return;
  }
  const classKey = String(char.class || "fighter").toLowerCase();
  const templates = getLiftoffTemplates(classKey, goal, userId);
  res.json({
    class: classKey,
    title: "Quick Start (Liftoff)",
    goal,
    rotationWeek: getWeekKey(),
    templates: templates.map((item) => ({
      ...item,
      isLiftoffTemplate: true,
    })),
  });
});

function validateWorkoutServer(
  exerciseType: string,
  sets: number,
  reps: number,
  duration: number,
  mode: string,
  wasRecommendedUsed: boolean,
  wasModified: boolean,
) {
  const warnings: string[] = [];
  let spamDetected = false;

  if (sets > 25) warnings.push(`Toplam set sayisi cok yuksek: ${sets}`);
  if (reps > 30 && duration === 0) warnings.push(`Tekrar sayisi cok yuksek: ${reps}`);
  if (sets > 50 || reps > 200) {
    warnings.push("Asiri yuksek hacim — olasi veri manipulasyonu");
    spamDetected = true;
  }
  if (duration > 300) {
    warnings.push("5 saatten uzun sure — olasi veri manipulasyonu");
    spamDetected = true;
  }
  if (mode === "recommended" && wasModified) {
    warnings.push("Mod 'recommended' olarak isaretli ancak degisiklik yapilmis — 'custom' olarak duzeltildi");
  }

  return { warnings, spamDetected };
}

router.get("/workouts", authenticateUser, rateLimiter, async (req, res) => {
  const userId = req.user!.id;
  const { limit } = req.query as { limit?: string };
  const lim = Math.min(parseInt(limit || "20"), 100);
  const workouts = await db.select().from(workoutsTable)
    .where(eq(workoutsTable.userId, userId))
    .orderBy(desc(workoutsTable.createdAt))
    .limit(lim);
  res.json(
    workouts.map((w) => ({
      ...w,
      isPendingApproval: w.intensity === "pending",
      isVerified: w.intensity !== "pending",
      duration: w.durationSec,
      xpEarned: w.earnedXp,
    })),
  );
});

router.post("/workouts", authenticateUser, rateLimiter, workoutRateLimiter, validateUserAction, validateTimestamp, validateWorkoutConsistency, async (req, res) => {
  const userId = req.user!.id;
  const isDebugUser = req.user?.isDebugUser === true || req.user?.isAdmin === true;
  const { exerciseType, exerciseName, exerciseCategory, xpPerUnit, tempoSec, sets, reps, duration, weight, healthSource, clientHealthVerified, mode, wasRecommendedUsed, wasModified, isLiftoffTemplate } = req.body;
  const difficulty = (req.body?.difficulty as "basit" | "orta" | "ileri" | undefined) || "orta";

  if (!exerciseType || !exerciseName) {
    res.status(400).json({ error: "exerciseType, exerciseName gereklidir" });
    return;
  }

  try {

  const workoutHourlyCap = await checkWorkoutHourlyCap(userId);
  if (!workoutHourlyCap.allowed) {
    await logSuspiciousActivity(userId, "workout_hourly_cap", "warning", {
      count: workoutHourlyCap.count, cap: 5,
    }, "/workouts");
    res.status(429).json({
      error: "Saatlik antrenman limiti asildi. Biraz dinlenin.",
      code: "WORKOUT_HOURLY_CAP",
      count: workoutHourlyCap.count,
    });
    return;
  }

  const xpHourlyCap = await checkXpHourlyCap(userId);
  if (!xpHourlyCap.allowed) {
    await logSuspiciousActivity(userId, "xp_hourly_cap", "warning", {
      currentXp: xpHourlyCap.currentXp, cap: 2000,
    }, "/workouts");
    res.status(429).json({
      error: "Saatlik XP limiti asildi. Dinlenme zamani.",
      code: "XP_HOURLY_CAP",
      currentXp: xpHourlyCap.currentXp,
    });
    return;
  }

  const s = Math.min(Math.max(Math.floor(Number(sets) || 1), 1), 100);
  const r = Math.min(Math.max(Math.floor(Number(reps) || 0), 0), 500);
  const d = Math.min(Math.max(Math.floor(Number(duration) || 0), 0), 600);

  let workoutMode = ['recommended', 'custom', 'free'].includes(mode) ? mode : 'free';
  const modifiedFlag = wasModified === true;
  const recommendedFlag = wasRecommendedUsed === true;

  if (workoutMode === 'recommended' && modifiedFlag) {
    workoutMode = 'custom';
  }

  const serverValidation = validateWorkoutServer(exerciseType, s, r, d, workoutMode, recommendedFlag, modifiedFlag);

  const normalizedXpPerUnit = xpPerUnit ? Math.min(Math.max(Number(xpPerUnit), 1), 100) : undefined;
  const ts = tempoSec ? Math.min(Math.max(Number(tempoSec), 1), 10) : 3;
  const estimatedCalories = calcCalories(exerciseType, s, r, d, Number(weight || 70), ts);
  const estimatedDurationMin = calcDurationMin(exerciseType, s, r, d);
  const suspicious = isSuspicious(exerciseType, s, r, d);
  const suspiciousBySpeed = isSuspiciousBySpeed(s, r, Math.max(1, estimatedDurationMin * 60));
  const physicallyImpossible = isPhysicallyImpossible(s, r, estimatedDurationMin);

  const effortCheck = checkMinimumEffort(s, estimatedDurationMin);
  if (!effortCheck.meetsEffort) {
    res.status(400).json({ error: effortCheck.reason, code: "INSUFFICIENT_EFFORT", xpEarned: 0 });
    return;
  }

  const isVerified = clientHealthVerified === true;
  const isPendingApproval = physicallyImpossible || suspiciousBySpeed || (suspicious && !isVerified);
  const source = healthSource || "manual";
  const halfXp = isPendingApproval || clientHealthVerified === false;
  const now = new Date();

  let boostMultiplier = 100;
  try {
    boostMultiplier = await getActiveBoostMultiplier(userId);
  } catch {}

  const workoutId = `wk_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  const txResult = await db.transaction(async (tx) => {
    const charRows = await tx.execute(
      sql`SELECT * FROM characters WHERE user_id = ${userId} FOR UPDATE`
    );
    const charCheck = charRows.rows?.[0] as any;
    if (!charCheck) throw { status: 404, error: "Karakter bulunamadi" };

    if (!charCheck.has_accepted_disclaimer) throw { status: 403, error: "Saglik feragatnamesi kabul edilmelidir", code: "DISCLAIMER_REQUIRED" };

    const cooldown = checkGlobalCooldown(charCheck.last_workout_at, now);
    if (!isDebugUser && !cooldown.allowed) {
      throw { status: 429, error: `Dinlenme suresi dolmadi. ${Math.ceil(cooldown.remainingSeconds / 60)} dakika bekleyin.`, code: "COOLDOWN_ACTIVE", remainingSeconds: cooldown.remainingSeconds };
    }

    const tz = charCheck.timezone || 'Europe/Istanbul';
    const todayLocal = getLocalDate(now, tz);

    const spamRows = await tx.execute(
      sql`SELECT id, exercise_type, created_at FROM workouts WHERE user_id = ${userId} AND created_at >= ${new Date(now.getTime() - 24 * 60 * 60 * 1000)}`
    );
    const recentWorkouts = (spamRows.rows || []) as any[];
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dupWindow = new Date(now.getTime() - DUPLICATE_WINDOW_MS);
    const hourlyCount = recentWorkouts.filter((w: any) => new Date(w.created_at) >= oneHourAgo).length;
    const dailyCount = recentWorkouts.filter((w: any) => getLocalDate(new Date(w.created_at), tz) === todayLocal).length;
    const totalRecentCount = recentWorkouts.length;
    const isDuplicate = recentWorkouts.some((w: any) => w.exercise_type === exerciseType && new Date(w.created_at) >= dupWindow);

    const hourlySpam = hourlyCount >= SPAM_THRESHOLD_HOURLY - 1;
    const dailySpam = totalRecentCount >= SPAM_THRESHOLD_DAILY;
    let spamXpMult = 1;
    if (dailySpam) spamXpMult = SPAM_DAILY_XP_PENALTY;
    else if (hourlySpam) spamXpMult = SPAM_XP_PENALTY;
    if (isDuplicate) spamXpMult = Math.min(spamXpMult, 0.5);

    const spamPenalty = hourlySpam || dailySpam;
    const warnings = [...serverValidation.warnings];
    if (suspiciousBySpeed) warnings.push("Analiz Ediliyor: Supheli Aktivite");
    if (dailySpam) warnings.push(`Son 24 saatte ${totalRecentCount} antrenman — XP %${Math.round(SPAM_DAILY_XP_PENALTY * 100)} olarak verilecek`);
    else if (hourlySpam) warnings.push(`Son 1 saatte ${hourlyCount} antrenman — XP %${Math.round(SPAM_XP_PENALTY * 100)} olarak verilecek`);
    if (isDuplicate) warnings.push(`Ayni egzersiz 2 dakika icinde tekrarlandi — XP dusuruldu`);

    const effectiveDailyCount = dailyCount + 1;
    const softCapPreview = applySoftCap(1, effectiveDailyCount);
    if (softCapPreview.capApplied) warnings.push(softCapPreview.capApplied);

    const classMultiplier = getClassXPMultiplier(charCheck.class, exerciseCategory || '');
    const equipmentMultiplier = await getEquipmentXpMultiplier(userId, exerciseType);

    const rawXp = calculateWorkoutXp({
      sets: s,
      reps: r,
      difficulty,
      boostMultiplier,
      reduced: halfXp,
    });
    let boostedXp = rawXp;
    if (serverValidation.spamDetected) boostedXp = Math.floor(boostedXp * 0.1);
    // Explicit Warrior mastery bonus shown in UI toast.
    const classMasteryBonusXp = String(charCheck.class || "").toLowerCase() === "warrior"
      ? Math.floor(boostedXp * 0.1)
      : 0;
    const boostedWithMastery = boostedXp + classMasteryBonusXp;

    const streakResult = computeStreak(charCheck.last_workout_at, charCheck.streak_days || 0, charCheck.last_streak_date, now, tz);
    const finalXP = applyStreakBonus(boostedWithMastery, streakResult.newStreak, true);

    let finalXpAwarded = finalXP.totalXP;
    if (physicallyImpossible) finalXpAwarded = 0;
    if (spamPenalty) finalXpAwarded = Math.floor(finalXpAwarded * spamXpMult);
    const softCapResult = applySoftCap(finalXpAwarded, effectiveDailyCount);
    finalXpAwarded = softCapResult.xp;

    const currentXp = Number(charCheck.xp ?? charCheck.exp ?? 0);
    const currentLevel = Number(charCheck.level ?? 1);
    const currentWeeklyXp = Number(charCheck.weekly_xp ?? charCheck.weeklyXp ?? 0);
    const currentCoins = Number(charCheck.gym_coins ?? charCheck.gymCoins ?? 0);
    const charClass = String(charCheck.class || "fighter");

    const turboEligible = isDailyTurboEligible(
      charCheck.last_workout_date ?? charCheck.lastWorkoutDate,
      charCheck.last_workout_at ?? charCheck.lastWorkoutAt,
      tz,
      now,
    );
    const lv = processLevelUp(currentXp, currentLevel, finalXpAwarded, {
      applyDailyTurbo: turboEligible && finalXpAwarded > 0,
    });
    const effectiveXpEarned = lv.effectiveXpGained;
    if (lv.dailyTurboApplied) {
      warnings.push("Gunluk turbo: Ilk antrenman — +%10 XP");
    }

    const rawCoinCalc = effectiveXpEarned > 0 ? Math.max(1, Math.floor(effectiveXpEarned * COINS_PER_XP)) : 0;
    const warningsJson = warnings.length > 0 ? JSON.stringify(warnings) : null;

    const [workout] = await tx.insert(workoutsTable).values({
      userId,
      exerciseType,
      isLiftoffTemplate: isLiftoffTemplate === true,
      reps: r,
      durationSec: d,
      intensity: isPendingApproval ? "pending" : workoutMode,
      earnedXp: effectiveXpEarned,
      earnedCoins: rawCoinCalc,
    }).returning();

    const stats = calcStats(lv.newLevel, charClass);
    const newLeague = calcLeague(currentWeeklyXp + effectiveXpEarned);

    let updated: any;
    try {
      const [updatedRow] = await tx.update(charactersTable).set({
        xp: lv.newExp,
        level: lv.newLevel,
        tier: calcTierByLevel(lv.newLevel),
        league: newLeague,
        weeklyXp: sql`${charactersTable.weeklyXp} + ${effectiveXpEarned}`,
        gymCoins: currentCoins,
        lastWorkoutAt: now,
        lastWorkoutDate: now,
        ...stats,
        updatedAt: now,
      }).where(eq(charactersTable.userId, userId)).returning();
      updated = updatedRow;
    } catch (updateErr) {
      console.error("characters update failed after workout", {
        userId,
        finalXpAwarded: effectiveXpEarned,
        nextLevel: lv.newLevel,
        newExp: lv.newExp,
        sqlState: (updateErr as any)?.cause?.code ?? (updateErr as any)?.code,
        sqlMessage: (updateErr as any)?.cause?.message ?? (updateErr as any)?.message,
        err: updateErr,
      });
      throw updateErr;
    }

    if (!updated) {
      console.error("characters update returned no row", {
        userId,
        finalXpAwarded: effectiveXpEarned,
        nextLevel: lv.newLevel,
        newExp: lv.newExp,
      });
      throw new Error("Characters row not updated");
    }
    console.info("characters xp persisted", {
      userId,
      xpDelta: effectiveXpEarned,
      level: updated.level,
      xp: updated.xp,
      gymCoins: updated.gymCoins,
    });

    return {
      workout, updatedChar: updated, leveledUp: lv.leveledUp, newLevel: lv.newLevel,
      spamPenalty, xpReductionApplied: spamPenalty || serverValidation.spamDetected || isDuplicate || softCapResult.capApplied !== null,
      warnings, warningsJson, streakResult, finalXP: effectiveXpEarned, rawXp, boostedXp, classMasteryBonusXp,
      rawCoinCalc, charLevel: lv.newLevel,
      currentCoins: charCheck.gym_coins || 0, currentGems: charCheck.gems || 0,
      tz, equipmentMultiplier, physicallyImpossible,
      dailyTurboApplied: lv.dailyTurboApplied,
      xpBeforeDailyTurbo: finalXpAwarded,
    };
  });

  const { workout, updatedChar, leveledUp, newLevel } = txResult;

  try {
    const { trackEvent } = await import("../trackEvent.js");
    trackEvent(userId, "workout_completed", { exerciseType, sets: s, reps: r, xp: txResult.finalXP, workoutId });
    if (txResult.finalXP > 0) {
      trackEvent(userId, "xp_gained", { xp: txResult.finalXP, source: "workout", exerciseType });
    }
    if (leveledUp) {
      trackEvent(userId, "level_up", { oldLevel: newLevel - 1, newLevel });
    }
    trackEvent(userId, "streak_updated", { streakDays: txResult.streakResult.newStreak });
  } catch {}

  if (txResult.warnings.length > 0) {
    await logAudit(userId, workoutId, "validation_warnings", txResult.warningsJson || "");
  }
  if (serverValidation.spamDetected) {
    await logAudit(userId, workoutId, "suspicious_activity", `Spam algilandi`);
  }

  const expToNextLevel = calcExpToNextLevel(updatedChar.level || 1);
  const streakActive = updatedChar.streakActiveUntil
    ? new Date(updatedChar.streakActiveUntil) > new Date()
    : false;

  let bossContribution: { damageDealt: number; bossDefeated: boolean; newHp: number; bossName: string } | null = null;
  let newAchievements: any[] = [];

  if (updatedChar) {
    try {
      const [partyMembership] = await db
        .select()
        .from(partyMembersTable)
        .where(eq(partyMembersTable.userId, userId));

      if (partyMembership) {
        const [activeEvent] = await db
          .select()
          .from(bossEventsTable)
          .where(and(
            eq(bossEventsTable.partyId, partyMembership.partyId),
            eq(bossEventsTable.status, "active"),
          ));

        if (activeEvent && new Date(activeEvent.endsAt) > new Date()) {
          const boss = BOSS_MAP[activeEvent.bossKey];
          let baseDamage = Math.floor(txResult.finalXP * 0.6);
          if (boss && boss.weakClass.includes(updatedChar.class)) {
            baseDamage = Math.floor(baseDamage * 1.3);
          }

          const [existingContrib] = await db
            .select()
            .from(eventContributionsTable)
            .where(and(
              eq(eventContributionsTable.eventId, activeEvent.id),
              eq(eventContributionsTable.userId, userId),
            ));

          if (existingContrib) {
            await db.update(eventContributionsTable)
              .set({
                damageDealt: existingContrib.damageDealt + baseDamage,
                workoutsCount: existingContrib.workoutsCount + 1,
                contributedAt: new Date(),
              })
              .where(eq(eventContributionsTable.id, existingContrib.id));
          } else {
            await db.insert(eventContributionsTable).values({
              id: `contrib_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
              eventId: activeEvent.id,
              characterId: updatedChar.id,
              userId,
              damageDealt: baseDamage,
              workoutsCount: 1,
            });
          }

          const newHp = Math.max(0, activeEvent.bossHpCurrent - baseDamage);
          let newStatus = activeEvent.status;
          let bossDefeated = false;

          if (newHp <= 0) {
            newStatus = "defeated";
            bossDefeated = true;
          }

          await db.update(bossEventsTable)
            .set({ bossHpCurrent: newHp, status: newStatus })
            .where(eq(bossEventsTable.id, activeEvent.id));

          bossContribution = {
            damageDealt: baseDamage,
            bossDefeated,
            newHp,
            bossName: boss?.name || activeEvent.bossKey,
          };

          if (bossDefeated && !activeEvent.rewardClaimed) {
            await db.update(bossEventsTable)
              .set({ rewardClaimed: true })
              .where(eq(bossEventsTable.id, activeEvent.id));

            const members = await db
              .select()
              .from(partyMembersTable)
              .where(eq(partyMembersTable.partyId, activeEvent.partyId));

            for (const member of members) {
              const [memberChar] = await db
                .select()
                .from(charactersTable)
                .where(eq(charactersTable.userId, member.userId));
              if (!memberChar) continue;
              const rewardXp = boss?.rewardXp || 1000;
              const rewardCoins = boss?.rewardCoins || 300;
              const bossLv = processLevelUp(memberChar.exp, memberChar.level, rewardXp);
              const bossStats = calcStats(bossLv.newLevel, memberChar.class);
              await db.update(charactersTable)
                .set({
                  totalXpEarned: memberChar.totalXpEarned + rewardXp,
                  exp: bossLv.newExp,
                  level: bossLv.newLevel,
                  tier: calcTierByLevel(bossLv.newLevel),
                  gymCoins: memberChar.gymCoins + rewardCoins,
                  ...bossStats,
                  updatedAt: new Date(),
                })
                .where(eq(charactersTable.id, memberChar.id));
            }
          }
        }
      }

      const [latestChar] = await db.select().from(charactersTable).where(eq(charactersTable.userId, userId));
      const achChar = latestChar || updatedChar;
      newAchievements = await checkAndAwardAchievements(db, {
        ...achChar,
        league: calcLeague(achChar.totalXpEarned),
      }, { characterAchievementsTable, charactersTable }, eq);

      try {
        const { challengesTable } = await import("@workspace/db/schema");
        const { or } = await import("drizzle-orm");
        const activeChallenges = await db.select().from(challengesTable).where(
          and(
            or(eq(challengesTable.challengerId, userId), eq(challengesTable.challengedId, userId)),
            eq(challengesTable.status, "active")
          )
        );
        for (const ch of activeChallenges) {
          if (new Date(ch.endsAt) < new Date()) continue;
          const isChallenger = ch.challengerId === userId;
          await db.update(challengesTable).set(
            isChallenger
              ? { challengerScore: sql`${challengesTable.challengerScore} + ${txResult.finalXP}` }
              : { challengedScore: sql`${challengesTable.challengedScore} + ${txResult.finalXP}` }
          ).where(eq(challengesTable.id, ch.id));
        }
      } catch (challengeErr) {
        console.error("Challenge score update error:", challengeErr);
      }

    } catch (err) {
      console.error("Post-workout processing error:", err);
    }
  }

  let economyResult: EconomyResult | null = null;
  try {
    economyResult = await processWorkoutReward(
      userId,
      txResult.rawCoinCalc,
      txResult.finalXP,
      txResult.charLevel,
      txResult.currentCoins,
      txResult.currentGems,
      txResult.tz
    );
    if (economyResult.coins > 0) {
      await db.update(charactersTable)
        .set({ gymCoins: sql`${charactersTable.gymCoins} + ${economyResult.coins}`, updatedAt: new Date() })
        .where(eq(charactersTable.userId, userId));
    }
  } catch (err) {
    console.error("Economy processing error:", err);
    economyResult = { coins: txResult.rawCoinCalc, gems: 0, xp: txResult.finalXP, reductions: [], dailyCoinsEarned: 0, dailyGemsEarned: 0, dailyCoinCap: 2000, dailyGemCap: 20, coinCapReached: false, gemCapReached: false };
    await db.update(charactersTable)
      .set({ gymCoins: sql`${charactersTable.gymCoins} + ${txResult.rawCoinCalc}`, updatedAt: new Date() })
      .where(eq(charactersTable.userId, userId));
  }

  let questsCompleted: string[] = [];
  try {
    const charTz = updatedChar?.timezone || 'Europe/Istanbul';
    questsCompleted = await updateDailyQuestProgress(userId, charTz, {
      exerciseType,
      sets: s,
      reps: r,
      durationMin: estimatedDurationMin,
    });
  } catch (err) {
    console.error("Daily quest progress error:", err);
  }

  try {
    if (txResult.finalXP > 0) {
      await addBattlePassXp(userId, txResult.finalXP);
    }
  } catch (err) {
    console.error("Battle pass XP error:", err);
  }

  try {
    const charTz2 = updatedChar?.timezone || 'Europe/Istanbul';
    await trackDailyActivity(userId, charTz2);
  } catch (err) {
    console.error("Track daily activity error:", err);
  }

  const freshChar = updatedChar ? await db.select().from(charactersTable).where(eq(charactersTable.userId, userId)).then(r => r[0] || updatedChar) : updatedChar;
  const freshExpToNextLevel = calcExpToNextLevel(freshChar?.level || 1);
  const charTzResp = freshChar?.timezone || "Europe/Istanbul";

  res.json({
    workout,
    xpEarned: txResult.finalXP,
    rawXpEarned: txResult.rawXp,
    boosted: boostMultiplier > 100,
    boostMultiplier,
    classMasteryBonusXp: txResult.classMasteryBonusXp,
    gymCoinsEarned: economyResult?.coins ?? txResult.rawCoinCalc,
    estimatedCalories,
    estimatedDurationMin,
    isVerified,
    isPendingApproval,
    verificationStatus: txResult.physicallyImpossible || suspiciousBySpeed ? "pending" : "verified",
    verificationMessage: txResult.physicallyImpossible || suspiciousBySpeed
      ? "Analiz Ediliyor: Supheli Aktivite"
      : "Verified Workout",
    healthSource: source,
    dailyTurboApplied: Boolean(txResult.dailyTurboApplied),
    xpBeforeDailyTurbo: txResult.xpBeforeDailyTurbo,
    character: freshChar
      ? {
          ...freshChar,
          expToNextLevel: freshExpToNextLevel,
          streakActive,
          league: calcLeague(Number((freshChar as any).weeklyXp ?? (freshChar as any).weekly_xp ?? 0)),
          isTurboActive: isDailyTurboEligible(
            (freshChar as any).lastWorkoutDate ?? (freshChar as any).last_workout_date,
            (freshChar as any).lastWorkoutAt ?? (freshChar as any).last_workout_at,
            String(charTzResp),
            new Date(),
          ),
          equippedShakerTier: Number(
            (freshChar as any).equippedShakerTier ?? (freshChar as any).equipped_shaker_tier ?? 0,
          ),
        }
      : null,
    leveledUp,
    newLevel,
    bossContribution,
    newAchievements,
    questsCompleted,
    serverWarnings: txResult.warnings,
    spamPenalty: txResult.spamPenalty,
    xpReductionApplied: txResult.xpReductionApplied,
    streak: {
      days: txResult.streakResult.newStreak,
      continued: txResult.streakResult.streakContinued,
      broken: txResult.streakResult.streakBroken,
      debug: txResult.streakResult.debug,
    },
    economy: economyResult ? {
      dailyCoinsEarned: economyResult.dailyCoinsEarned,
      dailyGemsEarned: economyResult.dailyGemsEarned,
      coinCap: economyResult.dailyCoinCap,
      gemCap: economyResult.dailyGemCap,
      coinCapReached: economyResult.coinCapReached,
      gemCapReached: economyResult.gemCapReached,
      reductions: economyResult.reductions,
    } : null,
    antiCheatWarning: (req as any).antiCheatWarning || null,
  });

  } catch (err: any) {
    if (err?.status) {
      const { status, ...body } = err;
      res.status(status).json(body);
      return;
    }
    console.error("Workout error:", err);
    res.status(500).json({ error: "Antrenman kaydedilemedi" });
  }
});

router.post("/workout/complete", authenticateUser, rateLimiter, workoutRateLimiter, validateUserAction, validateTimestamp, async (req, res) => {
  const userId = (req as any).user?.id;
  const isDebugUser = req.user?.isDebugUser === true || req.user?.isAdmin === true;
  if (!userId) return res.status(401).json({ error: "Yetkisiz erisim" });

  const { workoutSummary } = req.body;
  if (!workoutSummary) return res.status(400).json({ error: "workoutSummary gerekli" });

  const rawMode = workoutSummary.mode;
  const rawExCount = workoutSummary.exercisesCount;
  const rawSets = workoutSummary.totalSets;
  const rawDur = workoutSummary.durationMinutes;

  if (!rawMode || rawExCount == null || rawSets == null || rawDur == null) {
    return res.status(400).json({ error: "Eksik alanlar: mode, exercisesCount, totalSets, durationMinutes" });
  }

  const validMode = ['recommended', 'custom', 'free'].includes(rawMode) ? rawMode : 'free';
  const exercisesCount = Math.min(Math.max(0, Math.floor(Number(rawExCount) || 0)), 50);
  const totalSets = Math.min(Math.max(0, Math.floor(Number(rawSets) || 0)), 100);
  const durationMinutes = Math.min(Math.max(0, Math.floor(Number(rawDur) || 0)), 180);

  const now = new Date();

  try {

  const workoutHourlyCapCheck = await checkWorkoutHourlyCap(userId);
  if (!workoutHourlyCapCheck.allowed) {
    await logSuspiciousActivity(userId, "workout_hourly_cap", "warning", {
      count: workoutHourlyCapCheck.count, cap: 5,
    }, "/workout/complete");
    return res.status(429).json({
      error: "Saatlik antrenman limiti asildi. Biraz dinlenin.",
      code: "WORKOUT_HOURLY_CAP",
      count: workoutHourlyCapCheck.count,
    });
  }

  const xpHourlyCapCheck = await checkXpHourlyCap(userId);
  if (!xpHourlyCapCheck.allowed) {
    await logSuspiciousActivity(userId, "xp_hourly_cap", "warning", {
      currentXp: xpHourlyCapCheck.currentXp, cap: 2000,
    }, "/workout/complete");
    return res.status(429).json({
      error: "Saatlik XP limiti asildi. Dinlenme zamani.",
      code: "XP_HOURLY_CAP",
      currentXp: xpHourlyCapCheck.currentXp,
    });
  }

  if (totalSets > 30 && durationMinutes < 5 && durationMinutes > 0) {
    await logSuspiciousActivity(userId, "workout_consistency", "warning", {
      flags: ["high_sets_low_duration"], totalSets, durationMinutes,
    }, "/workout/complete");
  }
    const txResult = await db.transaction(async (tx) => {
      const charRows = await tx.execute(
        sql`SELECT * FROM characters WHERE user_id = ${userId} FOR UPDATE`
      );
      const char = charRows.rows?.[0] as any;
      if (!char) throw { status: 404, error: "Karakter bulunamadi" };

      if (!char.has_accepted_disclaimer) throw { status: 403, error: "Saglik feragatnamesi kabul edilmelidir", code: "DISCLAIMER_REQUIRED" };

      const cooldown = checkGlobalCooldown(char.last_workout_at, now);
      if (!isDebugUser && !cooldown.allowed) {
        throw { status: 429, error: `Dinlenme suresi dolmadi. ${Math.ceil(cooldown.remainingSeconds / 60)} dakika bekleyin.`, code: "COOLDOWN_ACTIVE", remainingSeconds: cooldown.remainingSeconds };
      }

      const effortCheck = checkMinimumEffort(totalSets, durationMinutes);
      if (!effortCheck.meetsEffort) {
        throw { status: 400, error: effortCheck.reason, code: "INSUFFICIENT_EFFORT", xpEarned: 0 };
      }

      const tz = char.timezone || 'Europe/Istanbul';
      const todayLocal = getLocalDate(now, tz);

      const spamRows = await tx.execute(
        sql`SELECT id, created_at FROM workouts WHERE user_id = ${userId} AND created_at >= ${new Date(now.getTime() - 24 * 60 * 60 * 1000)}`
      );
      const recentWorkouts = (spamRows.rows || []) as any[];
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const hourlyCount = recentWorkouts.filter((w: any) => new Date(w.created_at) >= oneHourAgo).length;
      const dailyCount = recentWorkouts.filter((w: any) => getLocalDate(new Date(w.created_at), tz) === todayLocal).length;
      const totalRecentCount = recentWorkouts.length;
      const hourlySpam = hourlyCount >= SPAM_THRESHOLD_HOURLY - 1;
      const dailySpam = totalRecentCount >= SPAM_THRESHOLD_DAILY;
      let spamXpMult = 1;
      if (dailySpam) spamXpMult = SPAM_DAILY_XP_PENALTY;
      else if (hourlySpam) spamXpMult = SPAM_XP_PENALTY;

      let spamWarnings: string[] = [];
      if (dailySpam) spamWarnings.push(`Son 24 saatte ${totalRecentCount} antrenman — XP %${Math.round(SPAM_DAILY_XP_PENALTY * 100)}`);
      else if (hourlySpam) spamWarnings.push(`Son 1 saatte ${hourlyCount} antrenman — XP %${Math.round(SPAM_XP_PENALTY * 100)}`);

      const effectiveDailyCount = dailyCount + 1;

      const xpResult = applyXPModifiers(BASE_XP, validMode, totalSets, durationMinutes, exercisesCount);
      const streakResult = computeStreak(char.last_workout_at, char.streak_days || 0, char.last_streak_date, now, tz);

      const spamAdjustedXp = Math.floor(xpResult.xp * spamXpMult);
      const finalResult = applyStreakBonus(spamAdjustedXp, streakResult.newStreak, xpResult.meetsMinimumEffort);
      let xpGained = finalResult.totalXP;

      const softCapResult = applySoftCap(xpGained, effectiveDailyCount);
      xpGained = softCapResult.xp;
      if (softCapResult.capApplied) spamWarnings.push(softCapResult.capApplied);

      const currentXp = Number(char.xp ?? char.exp ?? 0);
      const currentLevel = Number(char.level ?? 1);
      const currentWeeklyXp = Number(char.weekly_xp ?? char.weeklyXp ?? 0);
      const charClass = String(char.class || "fighter");

      const turboEligible = isDailyTurboEligible(
        char.last_workout_date ?? char.lastWorkoutDate,
        char.last_workout_at ?? char.lastWorkoutAt,
        tz,
        now,
      );
      const lv = processLevelUp(currentXp, currentLevel, xpGained, {
        applyDailyTurbo: turboEligible && xpGained > 0,
      });
      const effectiveSessionXp = lv.effectiveXpGained;
      if (lv.dailyTurboApplied) {
        spamWarnings.push("Gunluk turbo: Ilk antrenman — +%10 XP");
      }

      const stats = calcStats(lv.newLevel, charClass);
      const newLeague = calcLeague(currentWeeklyXp + effectiveSessionXp);

      const [updated] = await tx.update(charactersTable).set({
        xp: lv.newExp,
        level: lv.newLevel,
        tier: calcTierByLevel(lv.newLevel),
        league: newLeague,
        weeklyXp: sql`${charactersTable.weeklyXp} + ${effectiveSessionXp}`,
        lastWorkoutAt: now,
        lastWorkoutDate: now,
        ...stats,
        updatedAt: now,
      }).where(eq(charactersTable.userId, userId)).returning();

      return {
        updated,
        leveledUp: lv.leveledUp,
        xpGained: effectiveSessionXp,
        spamWarnings,
        xpResult,
        streakResult,
        finalResult,
        tz,
        totalSets,
        durationMinutes,
      };
    });

    let questsCompleted: string[] = [];
    try {
      questsCompleted = await updateDailyQuestProgress(userId, txResult.tz, {
        exerciseType: "session_complete",
        sets: txResult.totalSets,
        reps: 0,
        durationMin: txResult.durationMinutes,
      });
    } catch (err) {
      console.error("Daily quest progress error (complete):", err);
    }

    try {
      if (txResult.xpGained > 0) {
        await addBattlePassXp(userId, txResult.xpGained);
      }
    } catch (err) {
      console.error("Battle pass XP error (complete):", err);
    }

    try {
      const completeTz = txResult.updated?.timezone || 'Europe/Istanbul';
      await trackDailyActivity(userId, completeTz);
    } catch (err) {
      console.error("Track daily activity error (complete):", err);
    }

    res.json({
      xpGained: txResult.xpGained,
      totalXP: txResult.updated.xp,
      level: txResult.updated.level,
      streakDays: txResult.streakResult.newStreak,
      leveledUp: txResult.leveledUp,
      spamWarnings: txResult.spamWarnings,
      questsCompleted,
      breakdown: {
        workout: txResult.xpResult.breakdown,
        final: txResult.finalResult.breakdown,
        streak: {
          continued: txResult.streakResult.streakContinued,
          broken: txResult.streakResult.streakBroken,
          debug: txResult.streakResult.debug,
        },
      },
    });
  } catch (err: any) {
    if (err?.status) {
      const { status, ...body } = err;
      res.status(status).json(body);
      return;
    }
    console.error("Workout complete error:", err);
    res.status(500).json({ error: "Antrenman tamamlanamadi" });
  }
});

export default router;
