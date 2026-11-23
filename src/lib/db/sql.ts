import { AsyncLocalStorage } from "async_hooks";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

export type Row = Record<string, unknown>;

export interface Executor {
  exec(sql: string): Promise<void>;
  get<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
}

export interface Database extends Executor {
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const storage = new AsyncLocalStorage<Executor>();

export function currentExecutor(fallback: Executor): Executor {
  return storage.getStore() ?? fallback;
}

function splitSql(sql: string): string[] {
  return sql
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

class SqliteExecutor implements Executor {
  constructor(private db: DatabaseSync) {}

  async exec(sql: string): Promise<void> {
    for (const statement of splitSql(sql)) this.db.exec(statement);
  }

  async get<T extends Row>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const row = this.db.prepare(sql).get(...(params as SQLInputValue[])) as T | undefined;
    return row ?? undefined;
  }

  async all<T extends Row>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...(params as SQLInputValue[])) as T[];
  }

  async run(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
    const result = this.db.prepare(sql).run(...(params as SQLInputValue[]));
    return { changes: Number(result.changes ?? 0) };
  }
}

export function openSqlite(filename: string): Database {
  const raw = new DatabaseSync(filename);
  raw.exec("PRAGMA journal_mode = WAL");
  raw.exec("PRAGMA foreign_keys = ON");
  const executor = new SqliteExecutor(raw);
  return {
    exec: (sql) => currentExecutor(executor).exec(sql),
    get: (sql, params) => currentExecutor(executor).get(sql, params),
    all: (sql, params) => currentExecutor(executor).all(sql, params),
    run: (sql, params) => currentExecutor(executor).run(sql, params),
    async transaction(fn) {
      if (storage.getStore()) return fn();
      raw.exec("BEGIN");
      try {
        const result = await storage.run(executor, fn);
        raw.exec("COMMIT");
        return result;
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
    async close() {
      raw.close();
    },
  };
}
