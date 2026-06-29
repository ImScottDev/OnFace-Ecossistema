import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, {
  max: parseInt(process.env.DB_POOL_SIZE || "15", 10),
  idle_timeout: 30,
  connect_timeout: 10,
  max_lifetime: 60 * 10,       // recycle connections every 10min (prevents stale)
  fetch_types: false,           // skip type fetching (faster cold start)
});

export const db = drizzle(client, { schema });
