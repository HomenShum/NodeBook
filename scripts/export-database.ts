import fs from "fs/promises";
import path from "path";

import { end, getDb } from "@/db";
import {
  dataTable,
  graphNodeTable,
  graphRelationTable,
  relationListsTable,
  relationTypeTable,
  userTable,
} from "@/db/schema";
import { env } from "@/envBackend";

async function main(dirOrFilename: string) {
  const connectionString = env.POSTGRES_CONNECTION_STRING;
  const dbName = new URL(connectionString).pathname.slice(1);
  let filename: string;
  if (dirOrFilename) {
    const stats = await fs.stat(dirOrFilename);
    if (stats.isDirectory()) {
      // If it's a directory, create a filename with the current timestamp
      filename = path.join(
        dirOrFilename,
        `${dbName}-export-${new Date().toISOString().replace(/:/g, "-").replace(/\.\d+/, "")}.json`,
      );
    } else {
      // If it's a file, use the provided filename
      filename = dirOrFilename;
    }
  } else {
    // If no argument is provided, use the default filename format
    filename = `${dbName}-export-${new Date().toISOString().replace(/:/g, "-").replace(/\.\d+/, "")}.json`;
  }

  try {
    console.log(`Exporting database ${dbName}`);
    const db = getDb(connectionString);
    const exportData: Record<string, unknown[]> = {
      data: await db.select().from(dataTable),
      users: await db.select().from(userTable),
      graphNodes: await db.select().from(graphNodeTable),
      graphRelations: await db.select().from(graphRelationTable),
      relationTypes: await db.select().from(relationTypeTable),
      relationLists: await db.select().from(relationListsTable),
    };
    await fs.writeFile(filename, JSON.stringify(exportData, null, 2));
    console.log(`Successfully exported database to ${filename}`);
  } catch (error) {
    console.error("Error exporting database:", error);
  } finally {
    await end();
  }
}

if (require.main === module) {
  main(process.argv[2]);
}
