import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL yok (.env)");
  process.exit(1);
}

const migrationPath = path.join(__dirname, "..", "..", "db", "migrations", "20260418_characters_shaker_turbo.sql");
const migration = fs.readFileSync(migrationPath, "utf8");

const ssl =
  String(url).includes("localhost") || String(url).includes("127.0.0.1")
    ? false
    : { rejectUnauthorized: false };

const client = new pg.Client({ connectionString: url, ssl });
await client.connect();

try {
  await client.query(migration);
  console.log("[1] Migration SQL uygulandi:", migrationPath);

  await client.query(`
    ALTER TABLE characters
    ADD COLUMN IF NOT EXISTS last_workout_at timestamptz
  `);

  const check = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'characters'
      AND column_name IN ('equipped_shaker_tier','last_workout_date','last_workout_at')
    ORDER BY column_name
  `);
  console.log("[2] Sutun kontrolu:");
  console.table(check.rows);

  if (check.rows.length < 3) {
    console.log("[3] Eksik sutun — ADD COLUMN (zaten varsa Postgres hata verecek, yutuluyor)...");
    try {
      await client.query(
        "ALTER TABLE characters ADD COLUMN equipped_shaker_tier integer NOT NULL DEFAULT 0",
      );
      console.log("    equipped_shaker_tier eklendi.");
    } catch (e) {
      console.log("    equipped_shaker_tier:", e.message);
    }
    try {
      await client.query("ALTER TABLE characters ADD COLUMN last_workout_date timestamptz");
      console.log("    last_workout_date eklendi.");
    } catch (e) {
      console.log("    last_workout_date:", e.message);
    }
    try {
      await client.query("ALTER TABLE characters ADD COLUMN last_workout_at timestamptz");
      console.log("    last_workout_at eklendi.");
    } catch (e) {
      console.log("    last_workout_at:", e.message);
    }

    const check2 = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'characters'
        AND column_name IN ('equipped_shaker_tier','last_workout_date','last_workout_at')
      ORDER BY column_name
    `);
    console.table(check2.rows);
    if (check2.rows.length < 3) {
      console.error("HATA: Sutunlar hala eksik. Baglanti dogru veritabanina mi?");
      process.exit(1);
    }
  }

  console.log("[OK] Her iki sutun da public.characters uzerinde mevcut.");
} finally {
  await client.end();
}
