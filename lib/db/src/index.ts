import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const missingDatabaseMessage =
  "DATABASE_URL must be set before using database-backed routes.";

function missingDatabaseProxy<T>(): T {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(missingDatabaseMessage);
      },
      apply() {
        throw new Error(missingDatabaseMessage);
      },
    },
  ) as T;
}

export const hasDatabase = Boolean(process.env.DATABASE_URL);
export const pool = hasDatabase
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : missingDatabaseProxy<pg.Pool>();
export const db = hasDatabase
  ? drizzle(pool, { schema })
  : missingDatabaseProxy<ReturnType<typeof drizzle>>();

export * from "./schema";
