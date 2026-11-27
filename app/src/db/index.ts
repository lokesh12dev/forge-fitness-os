import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  __forgeSqlite?: Database.Database;
};

function ensureColumn(db: Database.Database, table: string, col: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

const sqlite =
  globalForDb.__forgeSqlite ??
  (() => {
    const instance = new Database("forge.db");
    instance.pragma("journal_mode = WAL");
    instance.pragma("foreign_keys = ON");
    instance.exec(`
      CREATE TABLE IF NOT EXISTS ai_conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        module TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'complete',
        plan_id TEXT,
        plan_json TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ai_conv_user_module_idx ON ai_conversations(user_id, module);
      CREATE INDEX IF NOT EXISTS ai_conv_user_module_created_idx ON ai_conversations(user_id, module, created_at);

      CREATE TABLE IF NOT EXISTS ai_plans (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        module TEXT NOT NULL,
        title TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        current_version_id TEXT,
        parent_plan_id TEXT,
        provider TEXT NOT NULL DEFAULT 'forge-engine',
        status TEXT NOT NULL DEFAULT 'draft',
        plan_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        applied_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS ai_plans_user_module_idx ON ai_plans(user_id, module);
      CREATE INDEX IF NOT EXISTS ai_plans_user_module_created_idx ON ai_plans(user_id, module, created_at);

      CREATE TABLE IF NOT EXISTS ai_plan_versions (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES ai_plans(id) ON DELETE CASCADE,
        version_no INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        schema_version TEXT NOT NULL DEFAULT '2.0',
        change_summary TEXT NOT NULL DEFAULT 'Initial draft',
        created_by TEXT NOT NULL DEFAULT 'ai',
        created_at INTEGER NOT NULL,
        applied_at INTEGER
      );
      CREATE UNIQUE INDEX IF NOT EXISTS ai_plan_ver_unique_idx ON ai_plan_versions(plan_id, version_no);

      CREATE TABLE IF NOT EXISTS ai_usage (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        module TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        in_tokens INTEGER NOT NULL DEFAULT 0,
        out_tokens INTEGER NOT NULL DEFAULT 0,
        latency_ms INTEGER NOT NULL DEFAULT 0,
        fell_back INTEGER NOT NULL DEFAULT 0,
        error_code TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ai_usage_user_created_idx ON ai_usage(user_id, created_at);

      CREATE TABLE IF NOT EXISTS coach_memory (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        module TEXT NOT NULL,
        kind TEXT NOT NULL,
        key TEXT NOT NULL,
        value_json TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'system',
        confidence REAL NOT NULL DEFAULT 1.0,
        created_at INTEGER NOT NULL,
        expires_at INTEGER
      );
      CREATE UNIQUE INDEX IF NOT EXISTS coach_memory_unique_idx ON coach_memory(user_id, module, kind, key);

      CREATE TABLE IF NOT EXISTS sync_proposals (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        trigger_type TEXT NOT NULL,
        origin_module TEXT NOT NULL,
        target_module TEXT NOT NULL,
        target_entity TEXT NOT NULL DEFAULT 'default',
        causal_chain_id TEXT NOT NULL,
        depth INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'pending',
        title TEXT NOT NULL,
        rationale TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        resolved_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS sync_proposals_user_status_idx ON sync_proposals(user_id, status, created_at);

      CREATE TABLE IF NOT EXISTS ai_apply_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_id TEXT NOT NULL,
        version_no INTEGER NOT NULL DEFAULT 1,
        result_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ai_goals (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        metric TEXT NOT NULL,
        start_value REAL NOT NULL,
        current_value REAL NOT NULL,
        target_value REAL NOT NULL,
        unit TEXT NOT NULL DEFAULT 'kg',
        deadline TEXT,
        related_plan_id TEXT,
        milestones_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ai_goals_user_idx ON ai_goals(user_id);
      CREATE INDEX IF NOT EXISTS ai_goals_user_created_idx ON ai_goals(user_id, created_at);
    `);

    ensureColumn(instance, "ai_conversations", "status", "status TEXT NOT NULL DEFAULT 'complete'");
    ensureColumn(instance, "ai_plans", "current_version_id", "current_version_id TEXT");
    ensureColumn(instance, "ai_plans", "parent_plan_id", "parent_plan_id TEXT");
    ensureColumn(instance, "ai_plans", "provider", "provider TEXT NOT NULL DEFAULT 'forge-engine'");
    return instance;
  })();

if (process.env.NODE_ENV !== "production") globalForDb.__forgeSqlite = sqlite;

export const db = drizzle(sqlite, { schema });
export { schema, sqlite };
