import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const QUESTS = [
  {
    title: "Iron Will",
    description: "Complete 50 push-ups",
    questType: "special",
    objectiveType: "exercise_reps",
    targetValue: 50,
    rewardXp: 100,
    rewardCoins: 50,
    rewardGems: 0,
    difficulty: "normal",
    dayNumber: 1,
  },
  {
    title: "Squat Champion",
    description: "Complete 100 squats",
    questType: "special",
    objectiveType: "exercise_reps",
    targetValue: 100,
    rewardXp: 100,
    rewardCoins: 50,
    rewardGems: 0,
    difficulty: "normal",
    dayNumber: 1,
  },
];

async function main() {
  await pool.query("BEGIN");
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.quests (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        quest_type TEXT NOT NULL DEFAULT 'daily',
        objective_type TEXT NOT NULL DEFAULT 'workout_count',
        target_value INTEGER NOT NULL DEFAULT 1,
        reward_xp INTEGER NOT NULL DEFAULT 50,
        reward_coins INTEGER NOT NULL DEFAULT 25,
        reward_gems INTEGER NOT NULL DEFAULT 0,
        difficulty TEXT NOT NULL DEFAULT 'normal',
        day_number INTEGER NOT NULL DEFAULT 1,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        starts_at TIMESTAMP NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    const titles = QUESTS.map((q) => q.title);
    await pool.query("DELETE FROM public.quests WHERE title = ANY($1::text[])", [titles]);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    for (const quest of QUESTS) {
      await pool.query(
        `INSERT INTO public.quests
          (title, description, quest_type, objective_type, target_value, reward_xp, reward_coins, reward_gems, difficulty, day_number, is_active, starts_at, expires_at, created_at)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, $11, $12, $11)`,
        [
          quest.title,
          quest.description,
          quest.questType,
          quest.objectiveType,
          quest.targetValue,
          quest.rewardXp,
          quest.rewardCoins,
          quest.rewardGems,
          quest.difficulty,
          quest.dayNumber,
          now,
          expiresAt,
        ],
      );
    }

    await pool.query("COMMIT");
    console.log(`Seeded quests: ${QUESTS.map((q) => q.title).join(", ")}`);
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

