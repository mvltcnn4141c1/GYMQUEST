import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const tokenRow = await pool.query(
    "select user_id, token from public.auth_tokens order by created_at desc limit 1"
  );
  const auth = tokenRow.rows[0];
  if (!auth?.token) throw new Error("No auth token found");

  const headers = {
    Authorization: `Bearer ${auth.token}`,
    "Content-Type": "application/json",
  };

  const beforeRes = await fetch("http://127.0.0.1:3000/api/character", { headers });
  const before = await beforeRes.json();
  const xpBefore = Number(before?.character?.exp ?? 0);

  const workoutRes = await fetch("http://127.0.0.1:3000/api/workouts", {
    method: "POST",
    headers,
    body: JSON.stringify({
      exerciseType: "push_up",
      exerciseName: "Sinav",
      sets: 3,
      reps: 12,
      duration: 0,
      exerciseCategory: "STR",
    }),
  });
  const workoutJson = await workoutRes.json();

  const afterRes = await fetch("http://127.0.0.1:3000/api/character", { headers });
  const after = await afterRes.json();
  const xpAfter = Number(after?.character?.exp ?? 0);

  console.log("WORKOUT_STATUS", workoutRes.status);
  console.log("WORKOUT_BODY", JSON.stringify(workoutJson));
  console.log("WORKOUT_XP_GAINED", workoutJson?.xpGained ?? null);
  console.log("XP_BEFORE", xpBefore);
  console.log("XP_AFTER", xpAfter);
  console.log("XP_DELTA", xpAfter - xpBefore);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
