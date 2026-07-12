#!/usr/bin/env bun
/**
 * clean-sessions.ts — OpenCode session + framework test data 清理工具
 *
 * Session 存储位置（非项目目录，在 XDG data dir）：
 *   ~/.local/share/opencode/opencode.db
 *
 * Framework test data 位置：
 *   {project}/.opencode/state/framework-state.db
 *
 * Usage:
 *   bun run clean-sessions.ts                    # 全部清理
 *   bun run clean-sessions.ts --dry-run           # 仅列出，不删除
 *   bun run clean-sessions.ts --sdk-only          # 仅清理 session
 *   bun run clean-sessions.ts --framework-only    # 仅清理 framework test data
 *   bun run clean-sessions.ts --project /path     # 指定项目路径
 */

import { Database } from 'bun:sqlite';
import { existsSync } from 'fs';
import { join } from 'path';

// ── Args ──
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const sdkOnly = args.includes('--sdk-only');
const fwOnly = args.includes('--framework-only');
const projectArg = args.indexOf('--project');
const projectDir = projectArg >= 0 ? args[projectArg + 1] : '/home/zhaoge/workspace/opencode/work-one';

const XDG_DB = join(process.env.HOME || '', '.local/share/opencode/opencode.db');
const FW_DB = join(projectDir, '.opencode/state/framework-state.db');

console.log(`\n=== OpenCode Session Cleanup ${dryRun ? '(DRY RUN)' : ''} ===`);
console.log(`Project: ${projectDir}`);
console.log(`SDK DB:  ${XDG_DB} ${existsSync(XDG_DB) ? '✓' : '✗ NOT FOUND'}`);
console.log(`FW DB:   ${FW_DB} ${existsSync(FW_DB) ? '✓' : '✗ NOT FOUND'}\n`);

// ── SDK Sessions ──
if (!fwOnly && existsSync(XDG_DB)) {
  const db = new Database(XDG_DB);
  const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
  const tableNames = tables.map((t: any) => t.name);

  if (tableNames.includes('session')) {
    const sessions = db.query('SELECT id, title, agent, cost FROM session ORDER BY time_created DESC').all() as any[];
    console.log(`── SDK Sessions: ${sessions.length} ──`);
    for (const s of sessions) {
      const title = (s.title || '?').slice(0, 40);
      console.log(`  ${s.id.slice(0, 22)}... | ${s.agent || '?'} | ${title} | $${(s.cost || 0).toFixed(4)}`);
    }

    if (!dryRun && sessions.length > 0) {
      db.run('DELETE FROM session');
      if (tableNames.includes('message')) db.run('DELETE FROM message');
      console.log(`\n  → Deleted ${sessions.length} sessions.`);
    } else if (dryRun) {
      console.log(`\n  → [DRY RUN] Would delete ${sessions.length} sessions.`);
    }
  } else {
    console.log('── SDK DB: no session table ──');
  }

  // Verify
  if (!dryRun && tableNames.includes('session')) {
    const after = db.query('SELECT COUNT(*) as c FROM session').get() as any;
    console.log(`  → Sessions after: ${after.c}`);
  }

  db.close();
} else if (!fwOnly) {
  console.log('── SDK DB not found, skipping ──');
}

// ── Framework Test Data ──
if (!sdkOnly && existsSync(FW_DB)) {
  const db = new Database(FW_DB);

  console.log('\n── Framework Test Data ──');

  const cleanTable = (table: string, where: string, label: string) => {
    const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name=?").all(table);
    if (tables.length === 0) return;

    const before = db.query(`SELECT COUNT(*) as c FROM ${table}`).get() as any;
    const matchCount = db.query(`SELECT COUNT(*) as c FROM ${table} WHERE ${where}`).get() as any;

    console.log(`  ${label}: ${before.c} total, ${matchCount.c} test entries`);

    if (!dryRun && matchCount.c > 0) {
      db.run(`DELETE FROM ${table} WHERE ${where}`);
      const after = db.query(`SELECT COUNT(*) as c FROM ${table}`).get() as any;
      console.log(`    → Deleted ${matchCount.c}, remaining: ${after.c}`);
    } else if (dryRun && matchCount.c > 0) {
      console.log(`    → [DRY RUN] Would delete ${matchCount.c}`);
    }
  };

  cleanTable(
    'tool_enforcement',
    "last_failure_tool IN ('test_e2e_tool', 'test_tool') OR (consecutive_failures = 0 AND stop_injected = 0)",
    'tool_enforcement'
  );

  cleanTable(
    'session_map',
    "agent = 'Orchestrator' AND dag_task_id IS NULL",
    'session_map (test orphans)'
  );

  cleanTable('soft_rejections', '1=1', 'soft_rejections (all)');

  db.close();
} else if (!sdkOnly) {
  console.log('── Framework DB not found, skipping ──');
}

console.log('\n=== Done ===');
