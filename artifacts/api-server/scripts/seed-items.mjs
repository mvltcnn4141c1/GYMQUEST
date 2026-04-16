import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const ITEMS = [
  {
    id: "itm_dumbbell_basic",
    name: "Dumbbell",
    description: "Temel dambıl seti. Güç antrenmanlarında sadık dostun.",
    category: "equipment",
    icon: "dumbbell",
    priceCoins: 300,
  },
  {
    id: "itm_protein_shake",
    name: "Protein Shake",
    description: "Antrenman sonrası toparlanmayı hızlandıran klasik içecek.",
    category: "consumable",
    icon: "cup-water",
    priceCoins: 120,
  },
  {
    id: "itm_jump_rope_pro",
    name: "Jump Rope",
    description: "Kardiyo ritmini yükseltmek için profesyonel atlama ipi.",
    category: "equipment",
    icon: "jump-rope",
    priceCoins: 220,
  },
];

async function main() {
  await pool.query("BEGIN");
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'equipment',
        icon TEXT NOT NULL DEFAULT 'dumbbell',
        price_coins INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    for (const item of ITEMS) {
      await pool.query(
        `INSERT INTO public.items (id, name, description, category, icon, price_coins, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             description = EXCLUDED.description,
             category = EXCLUDED.category,
             icon = EXCLUDED.icon,
             price_coins = EXCLUDED.price_coins,
             is_active = TRUE`,
        [item.id, item.name, item.description, item.category, item.icon, item.priceCoins],
      );
    }

    await pool.query("COMMIT");
    console.log(`Seeded items: ${ITEMS.map((i) => i.name).join(", ")}`);
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

