import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for @workspace/db");
}

export const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });
