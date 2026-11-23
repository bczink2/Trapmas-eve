import fs from "fs";
import path from "path";
import { ensureReady } from "@/lib/db/repo";
import { openSqlite, type Database } from "@/lib/db/sql";

const globalStore = globalThis as unknown as { trapmasDb?: Database };

export function databaseKind(): "sqlite" {
  return "sqlite";
}

export function openDatabase(filename = ":memory:"): Database {
  return openSqlite(filename);
}

export async function getDb(): Promise<Database> {
  if (!globalStore.trapmasDb) {
    const file = process.env.SQLITE_PATH || path.join(process.cwd(), "data", "trapmas.db");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    globalStore.trapmasDb = openSqlite(file);
  }
  await ensureReady(globalStore.trapmasDb);
  return globalStore.trapmasDb;
}
