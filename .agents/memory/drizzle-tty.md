---
name: Drizzle push TTY issue
description: drizzle-kit push fails in non-interactive shells when schema has column conflicts; workaround is direct SQL
---

When `drizzle-kit push` (or `push-force`) encounters a column conflict (rename, type change), it tries to open an interactive prompt and crashes with:
> "Interactive prompts require a TTY terminal"

This happens even with `--force` flag.

**Why:** drizzle-kit's conflict resolver uses an interactive TUI that requires stdin/stdout to be a real terminal. Replit's bash tool is non-interactive.

**How to apply:** For any schema migration involving column renames, type changes, or new tables that might conflict:
1. Use `executeSql` in the code_execution notebook to run raw `ALTER TABLE` / `CREATE TABLE` statements directly
2. For brand-new tables with no conflicts, `drizzle-kit push` works fine
3. After manual SQL migration, the Drizzle ORM schema file still works correctly — the ORM just maps to whatever the DB actually has
