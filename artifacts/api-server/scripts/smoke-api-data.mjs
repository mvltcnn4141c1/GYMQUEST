import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const tokenRow = await pool.query(
    "select token from public.auth_tokens order by created_at desc limit 1"
  );
  const token = tokenRow.rows[0]?.token;
  if (!token) {
    throw new Error("No auth token found in auth_tokens table.");
  }

  const headers = { Authorization: `Bearer ${token}` };

  const questsRes = await fetch("http://127.0.0.1:3000/api/quests", { headers });
  const questsJson = await questsRes.json();
  console.log("QUESTS_STATUS", questsRes.status);
  console.log("QUESTS_COUNT", Array.isArray(questsJson?.quests) ? questsJson.quests.length : 0);

  const storeRes = await fetch("http://127.0.0.1:3000/api/store", { headers });
  const storeJson = await storeRes.json();
  console.log("STORE_STATUS", storeRes.status);
  console.log("STORE_ITEM_CATALOG_COUNT", Array.isArray(storeJson?.itemCatalog) ? storeJson.itemCatalog.length : 0);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
