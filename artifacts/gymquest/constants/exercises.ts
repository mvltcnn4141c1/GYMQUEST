import { XP_MULTIPLIER } from "@/constants/xp";
export type ExerciseCategory = "gogus" | "sirt" | "bacak" | "kardiyo" | "fullbody";

export type ExerciseDef = {
  id: string;
  name: string;
  nameEn: string;
  category: ExerciseCategory;
  subMuscle: string;
  icon: string;
  difficulty: "basit" | "orta" | "ileri";
  equipment: string[];
  joint: string;
  instructions: string[];
  unit: "reps" | "minutes" | "km";
  maxReps: number;
  maxSets: number;
  maxMinutes: number;
  maxKm: number;
  xpPerUnit: number;
  tempoSec: number;
};

export const EXERCISE_CATEGORIES: Record<
  ExerciseCategory,
  { label: string; icon: string; color: string }
> = {
  gogus: { label: "Göğüs", icon: "weight-lifter", color: "#EF4444" },
  sirt: { label: "Sırt", icon: "human-handsup", color: "#3B82F6" },
  bacak: { label: "Bacak", icon: "human-male", color: "#22C55E" },
  kardiyo: { label: "Kardiyo", icon: "run", color: "#F97316" },
  fullbody: { label: "Tüm vücut", icon: "arm-flex", color: "#D4AF37" },
};

function ex(p: Partial<ExerciseDef> & Pick<ExerciseDef, "id" | "name" | "nameEn" | "category" | "unit">): ExerciseDef {
  return {
    subMuscle: "Genel",
    icon: "dumbbell",
    difficulty: "orta",
    equipment: ["yok"],
    joint: "Çoklu",
    instructions: ["Isın.", "Tekrarı kontrollü yap.", "Nefesini düzenle."],
    maxReps: 100,
    maxSets: 20,
    maxMinutes: 180,
    maxKm: 42,
    xpPerUnit: 12,
    tempoSec: 3,
    ...p,
  };
}

export const ALL_EXERCISES: ExerciseDef[] = [
  ex({
    id: "push_up",
    name: "Şınav",
    nameEn: "Push-up",
    category: "gogus",
    subMuscle: "Göğüs",
    icon: "arm-flex",
    unit: "reps",
    xpPerUnit: 15,
  }),
  ex({
    id: "pull_up",
    name: "Barfiks",
    nameEn: "Pull-up",
    category: "sirt",
    subMuscle: "Sırt",
    icon: "human-handsup",
    unit: "reps",
    xpPerUnit: 20,
  }),
  ex({
    id: "squat",
    name: "Squat",
    nameEn: "Squat",
    category: "bacak",
    subMuscle: "Ön bacak",
    icon: "human-male",
    unit: "reps",
    xpPerUnit: 20,
  }),
  ex({
    id: "running",
    name: "Koşu",
    nameEn: "Running",
    category: "kardiyo",
    subMuscle: "Kardiyo",
    icon: "run",
    unit: "km",
    xpPerUnit: 8,
    maxKm: 50,
  }),
  ex({
    id: "burpee",
    name: "Burpee",
    nameEn: "Burpee",
    category: "fullbody",
    subMuscle: "Tüm vücut",
    icon: "human-greeting-variant",
    unit: "reps",
    xpPerUnit: 20,
  }),
  ex({
    id: "plank",
    name: "Plank",
    nameEn: "Plank",
    category: "fullbody",
    subMuscle: "Core",
    icon: "human-male-board",
    unit: "minutes",
    xpPerUnit: 10,
    maxMinutes: 60,
  }),
  ex({
    id: "deadlift",
    name: "Deadlift",
    nameEn: "Deadlift",
    category: "sirt",
    subMuscle: "Posterior zincir",
    icon: "weight-lifter",
    unit: "reps",
    xpPerUnit: 25,
  }),
  ex({
    id: "cycling",
    name: "Bisiklet",
    nameEn: "Cycling",
    category: "kardiyo",
    subMuscle: "Kardiyo",
    icon: "bike",
    unit: "km",
    xpPerUnit: 6,
    maxKm: 80,
  }),
];

export const EXERCISE_MAP: Record<string, ExerciseDef> = Object.fromEntries(
  ALL_EXERCISES.map((e) => [e.id, e]),
);

export const EXERCISES_BY_CATEGORY: Record<ExerciseCategory, ExerciseDef[]> = {
  gogus: ALL_EXERCISES.filter((e) => e.category === "gogus"),
  sirt: ALL_EXERCISES.filter((e) => e.category === "sirt"),
  bacak: ALL_EXERCISES.filter((e) => e.category === "bacak"),
  kardiyo: ALL_EXERCISES.filter((e) => e.category === "kardiyo"),
  fullbody: ALL_EXERCISES.filter((e) => e.category === "fullbody"),
};

export function getExerciseXP(
  id: string,
  sets: number,
  reps: number,
  durationMin: number,
  km: number,
  options?: { boostMultiplier?: number; classMultiplier?: number; equipmentMultiplier?: number },
): number {
  const e = EXERCISE_MAP[id];
  if (!e) return 10;

  const SCALE = XP_MULTIPLIER;
  const boost = Number(options?.boostMultiplier ?? 100) / 100;
  const classMult = Number(options?.classMultiplier ?? 1);
  const equipMult = Number(options?.equipmentMultiplier ?? 1);
  // Keep frontend estimation aligned with backend calcRawXp:
  // - time based: floor(base * (duration / 60))
  // - rep based:  floor(base * sets * sqrt(reps))
  const base = e.xpPerUnit;
  if (e.unit === "km" || e.unit === "minutes") {
    const estDurationMin = e.unit === "km" ? Math.round(km * 6) : durationMin;
    return Math.floor(base * (Math.max(0, estDurationMin) / 60) * SCALE * boost * classMult * equipMult);
  }
  return Math.floor(base * Math.max(1, sets) * Math.sqrt(Math.max(0, reps)) * SCALE * boost * classMult * equipMult);
}

export function getExerciseCal(
  id: string,
  sets: number,
  reps: number,
  durationMin: number,
  km: number,
  weightKg = 70,
): number {
  const e = EXERCISE_MAP[id];
  if (!e) return 0;
  const MET_TABLE: Record<string, number> = {
    push_up: 8, pull_up: 8.5, squat: 5, deadlift: 6,
    bench_press: 6, shoulder_press: 5.5, running: 9.5, cycling: 7.5,
    plank: 4, burpee: 8, jump_rope: 10, row: 7, lunge: 5.5, situp: 4.5,
  };
  const key = String(id).toLowerCase();
  const met = MET_TABLE[key] ?? 4;
  const safeWeight = Math.max(35, Number(weightKg) || 70);
  const calc = (min: number) => Math.round((met * 3.5 * safeWeight / 200) * Math.max(0, min));
  if (e.unit === "km") {
    const estDuration = Math.round(Math.max(0, km) * 6);
    return calc(estDuration);
  }
  if (e.unit === "minutes") return calc(durationMin);
  const tempo = Math.max(1, e.tempoSec || 3);
  const estMin = (Math.max(1, sets) * Math.max(0, reps) * tempo + Math.max(1, sets) * 60) / 60;
  return calc(estMin);
}
