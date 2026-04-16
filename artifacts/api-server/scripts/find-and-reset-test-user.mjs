import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  const tableScan = await pool.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('username', 'email', 'id', 'user_id', 'name')
    ORDER BY table_name, column_name;
  `);
  console.log("Candidate identity columns:", tableScan.rows);

  const usersResult = await pool.query(`
    SELECT user_id AS id, name AS username, NULL::text AS email
    FROM public.characters
    WHERE name ILIKE '%test%'
       OR name ILIKE '%Mevlut%'
       OR user_id ILIKE '%test%'
       OR user_id ILIKE '%Mevlut%'
    LIMIT 5;
  `);

  console.log("Matched users:", usersResult.rows);

  if (usersResult.rows.length === 0) {
    console.log("No candidate users found.");
    process.exit(0);
  }

  const selected = usersResult.rows[0];
  const userId = selected.id;
  console.log("Selected user id for reset:", userId);

  const resetResult = await pool.query(
    `
    UPDATE public.characters
    SET level = 1,
        xp = 0,
        weekly_xp = 0,
        updated_at = NOW()
    WHERE user_id = $1
    RETURNING user_id, level, xp, weekly_xp;
    `,
    [String(userId)],
  );

  console.log("Character reset result:", resetResult.rowCount, resetResult.rows);
} finally {
  await pool.end();
}
