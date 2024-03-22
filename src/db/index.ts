import { createPool } from "@vercel/postgres";
import { drizzle, VercelPgDatabase } from "drizzle-orm/vercel-postgres";
import { env } from "../envBackend";
import * as schema from "./schema";

// Originally, I just instantiated and exported the db here instead of using a getter function.
// But that was causing the build to fail. I think cause during the build, the env variables
// aren't set, so the connecting string is empty. So I'm using a getter function to delay
// the instantiation of the db until runtime, when the env variables are set.
let db: VercelPgDatabase<typeof schema>;
export const getDb = () => {
  if (!db) {
    const client = createPool({
      connectionString: env.POSTGRES_CONNECTION_STRING,
    });
    db = drizzle(client, { schema });
  }
  return db;
};
