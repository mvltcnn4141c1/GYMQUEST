/** Mirrors `Workout` in `app/(tabs)/profile.tsx` for typed offline cache. */
export type CachedWorkout = {
  id: string;
  exerciseName: string;
  exerciseType: string;
  sets: number;
  reps: number;
  duration: number;
  xpEarned: number;
  estimatedCalories: number;
  estimatedDurationMin: number;
  isVerified: boolean;
  isPendingApproval: boolean;
  createdAt: string;
};

export async function cacheWorkouts(_workouts: CachedWorkout[]): Promise<void> {
  /* optional persistence */
}

export async function getCachedWorkouts(): Promise<CachedWorkout[] | null> {
  return null;
}
