import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const questCount = await pool.query("select count(*)::int as cnt from public.quests");
  const itemCount = await pool.query("select count(*)::int as cnt from public.items");
  const questRows = await pool.query(
    "select id, title, target_value, reward_xp, reward_coins, is_active from public.quests order by id desc limit 5"
  );
  const itemRows = await pool.query(
    "select id, name, price_coins, is_active from public.items order by id"
  );

  console.log("QUEST_COUNT", questCount.rows[0]?.cnt ?? 0);
  console.log("ITEM_COUNT", itemCount.rows[0]?.cnt ?? 0);
  console.log("QUEST_ROWS", JSON.stringify(questRows.rows));
  console.log("ITEM_ROWS", JSON.stringify(itemRows.rows));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
