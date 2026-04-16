import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  const result = await pool.query(`
    UPDATE public.characters
    SET level = 1,
        xp = 0,
        weekly_xp = 0,
        updated_at = NOW()
    WHERE user_id = 'test_user'
    RETURNING user_id, level, xp, weekly_xp;
  `);
  console.log("test_user reset result:", result.rowCount, result.rows);
} finally {
  await pool.end();
}
