import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
async function main() {
  const q = process.argv[2];
  const r = await db.execute(sql.raw(q));
  console.log(JSON.stringify(r, null, 1));
  process.exit(0);
}
main();
