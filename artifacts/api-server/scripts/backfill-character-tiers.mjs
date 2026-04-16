import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const result = await pool.query(`
    UPDATE public.characters
    SET tier = CASE
      WHEN level >= 51 THEN 'mythic'
      WHEN level >= 41 THEN 'legendary'
      WHEN level >= 31 THEN 'epic'
      WHEN level >= 21 THEN 'rare'
      WHEN level >= 11 THEN 'uncommon'
      ELSE 'common'
    END
    WHERE tier IS NULL
       OR tier NOT IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic');
  `);

  console.log(`Backfilled character tiers: ${result.rowCount ?? 0}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

