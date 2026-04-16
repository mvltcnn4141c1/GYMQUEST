export type WorkoutDifficulty = "basit" | "orta" | "ileri";

type WorkoutXpInput = {
  sets: number;
  reps: number;
  difficulty: WorkoutDifficulty;
  boostMultiplier?: number;
  reduced?: boolean;
};

const DIFFICULTY_MULTIPLIER: Record<WorkoutDifficulty, number> = {
  basit: 0.9,
  orta: 1,
  ileri: 1.2,
};

export function calculateWorkoutXp(input: WorkoutXpInput): number {
  const sets = Math.max(1, Math.floor(input.sets || 1));
  const reps = Math.max(0, Math.floor(input.reps || 0));
  const difficultyMultiplier = DIFFICULTY_MULTIPLIER[input.difficulty] || 1;
  const boost = Math.max(0, Number(input.boostMultiplier ?? 100) / 100);
  const reducedMult = input.reduced ? 0.5 : 1;
  return Math.max(0, Math.floor(sets * reps * difficultyMultiplier * boost * reducedMult));
}

