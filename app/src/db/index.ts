import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  __forgeSqlite?: Database.Database;
};

const sqlite =
  globalForDb.__forgeSqlite ??
  (() => {
    const instance = new Database("forge.db");
    instance.pragma("journal_mode = WAL");
    instance.pragma("foreign_keys = ON");
    return instance;
  })();

if (process.env.NODE_ENV !== "production") globalForDb.__forgeSqlite = sqlite;

export const db = drizzle(sqlite, { schema });
export { schema };
