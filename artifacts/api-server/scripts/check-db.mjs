import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const dbInfo = await pool.query(
    "select current_database() as db, current_schema() as schema",
  );
  const tableInfo = await pool.query(
    "select to_regclass('public.characters') as public_characters, to_regclass('characters') as search_path_characters",
  );
  const cols = await pool.query(
    "select column_name from information_schema.columns where table_schema='public' and table_name='characters' order by ordinal_position",
  );
  const workoutCols = await pool.query(
    "select column_name from information_schema.columns where table_schema='public' and table_name='workouts' order by ordinal_position",
  );
  const penaltiesCols = await pool.query(
    "select column_name from information_schema.columns where table_schema='public' and table_name='user_penalties' order by ordinal_position",
  );
  const suspiciousCols = await pool.query(
    "select column_name from information_schema.columns where table_schema='public' and table_name='suspicious_activity' order by ordinal_position",
  );
  const activeBoostCols = await pool.query(
    "select column_name from information_schema.columns where table_schema='public' and table_name='active_boosts' order by ordinal_position",
  );
  const latestBoosts = await pool.query(
    "select user_id, boost_type, multiplier, starts_at, expires_at from public.active_boosts order by starts_at desc limit 5",
  );

  console.log(
    JSON.stringify(
      {
        db: dbInfo.rows[0],
        tables: tableInfo.rows[0],
        charactersColumns: cols.rows.map((r) => r.column_name),
        workoutsColumns: workoutCols.rows.map((r) => r.column_name),
        userPenaltiesColumns: penaltiesCols.rows.map((r) => r.column_name),
        suspiciousActivityColumns: suspiciousCols.rows.map((r) => r.column_name),
        activeBoostsColumns: activeBoostCols.rows.map((r) => r.column_name),
        latestActiveBoosts: latestBoosts.rows,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
