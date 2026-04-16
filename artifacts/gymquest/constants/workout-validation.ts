import type { ExerciseDef } from "@/constants/exercises";

export type WorkoutMode = "free" | "recommended" | "custom";

export type WorkoutExerciseEntry = {
  exercise: ExerciseDef;
  sets: number;
  reps: number;
};

export function validateWorkout(_entries: WorkoutExerciseEntry[]): { warnings: string[] } {
  return { warnings: [] };
}
