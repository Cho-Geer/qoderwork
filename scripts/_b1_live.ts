// B1 live regression: drive the REAL production skill-summary handler with
// 12 task intents × (Chinese + English) prompts, capture the
// SKILL-SUMMARY-INJECTED log, and assert CN==EN + actual==expected boost.
//
// ⚠️ 本脚本不适用 serve-api skill §1.1 (本脚本是 in-process handler test，
//    在验证显式 OPENCODE_ROOT 后动态加载 work-one handler，不经过 serve API)
//
// Run: OPENCODE_ROOT=${WORK_ONE_ROOT} \
//      ${HOME}/.bun/bin/bun run ${QODERWORK_ROOT}/scripts/_b1_live.ts

import { isAbsolute, join } from "node:path";

type SkillSummaryModule = {
  captureUserMessage(sessionID: string, prompt: string): unknown;
  handle(input: { sessionID: string }, context: Record<string, never>): Promise<unknown>;
};

export function resolveSkillSummaryModulePath(opencodeRoot: string): string {
  if (!opencodeRoot || !opencodeRoot.trim() || !isAbsolute(opencodeRoot)) {
    throw new Error("OPENCODE_ROOT must be a non-empty absolute path before handler loading");
  }
  return join(opencodeRoot, ".opencode", "plugin-handlers", "system", "skill-summary.ts");
}

async function loadSkillSummaryModule(opencodeRoot: string): Promise<SkillSummaryModule> {
  const modulePath = resolveSkillSummaryModulePath(opencodeRoot);
  return import(modulePath) as Promise<SkillSummaryModule>;
}

type Case = { id: number; lang: "CN" | "EN"; prompt: string; expected: string[] };

const CASES: Case[] = [
  // 1 — architecture / clarify
  { id: 1, lang: "CN", prompt: "需求不清，先帮我澄清到底要做什么", expected: ["brainstorming"] },
  { id: 1, lang: "EN", prompt: "The requirements are unclear — help me clarify what we actually need to build", expected: ["brainstorming"] },
  // 2 — source-edit
  { id: 2, lang: "CN", prompt: "修改 `.opencode/tools/safe_edit.ts` 的实现逻辑", expected: ["codegraph-first"] },
  { id: 2, lang: "EN", prompt: "Modify the implementation logic in `.opencode/tools/safe_edit.ts`", expected: ["codegraph-first"] },
  // 3 — framework hook edit (source-edit via 修改/Edit)
  { id: 3, lang: "CN", prompt: "修改 OpenCode 框架的 before hook 做路径校验", expected: ["codegraph-first"] },
  { id: 3, lang: "EN", prompt: "Edit the OpenCode framework's before hook to add path validation", expected: ["codegraph-first"] },
  // 4 — dispatch subtask (dispatch-protocol is BASE, no keyword boost)
  { id: 4, lang: "CN", prompt: "把一个子任务 dispatch 给 build agent 去执行", expected: [] },
  { id: 4, lang: "EN", prompt: "Dispatch a subtask to the build agent for execution", expected: [] },
  // 5 — deliverable acceptance (deliverable-contract is BASE, no keyword boost)
  { id: 5, lang: "CN", prompt: "交付前帮我做验收，确认产出达标", expected: [] },
  { id: 5, lang: "EN", prompt: "Before delivery, help me do acceptance and confirm the output meets the bar", expected: [] },
  // 6 — cicd pipeline
  { id: 6, lang: "CN", prompt: "给项目加一条 CI 流水线，跑 lint 和测试", expected: ["ci-cd-guardrails", "cross-directory-ci"] },
  { id: 6, lang: "EN", prompt: "Add a CI pipeline to the project that runs lint and tests", expected: ["ci-cd-guardrails", "cross-directory-ci"] },
  // 7 — database migration
  { id: 7, lang: "CN", prompt: "数据库迁移：把用户表拆成两张并迁移数据", expected: ["cicd-database-seeding", "sqlite-bloat-investigation"] },
  { id: 7, lang: "EN", prompt: "Database migration: split the user table into two and migrate the data", expected: ["cicd-database-seeding", "sqlite-bloat-investigation"] },
  // 8 — library/dep version lookup
  { id: 8, lang: "CN", prompt: "查一下当前 axios 最新版本和 breaking change", expected: ["context7-first"] },
  { id: 8, lang: "EN", prompt: "Check the latest axios version and its breaking changes", expected: ["context7-first"] },
  // 9 — root-cause investigation (investigation-evidence NOT a keyword skill → expected [])
  { id: 9, lang: "CN", prompt: "这个偶发崩溃根因一直查不清，帮我系统调查", expected: [] },
  { id: 9, lang: "EN", prompt: "This intermittent crash's root cause is hard to pin down — help me investigate systematically", expected: [] },
  // 10 — conflicting docs (API → library-dep → context7-first)
  { id: 10, lang: "CN", prompt: "多份文档对同一个 API 行为说法冲突，帮我定论", expected: ["context7-first"] },
  { id: 10, lang: "EN", prompt: "Multiple docs conflict on the same API's behavior — help me settle it", expected: ["context7-first"] },
  // 11 — framework source edit
  { id: 11, lang: "CN", prompt: "修改框架源码：在 `before/codegraph.ts` 加一行日志", expected: ["codegraph-first"] },
  { id: 11, lang: "EN", prompt: "Edit framework source: add a log line in `before/codegraph.ts`", expected: ["codegraph-first"] },
  // 12 — trivial Q&A (no boost, risk trivial)
  { id: 12, lang: "CN", prompt: "一句话问答：Git 怎么看当前分支", expected: [] },
  { id: 12, lang: "EN", prompt: "Quick question: how do I see the current Git branch?", expected: [] },
];

async function main() {
  const skillSummary = await loadSkillSummaryModule(process.env.OPENCODE_ROOT ?? "");
  for (const c of CASES) {
    const sid = `B1-live-${c.id}-${c.lang}`;
    try {
      skillSummary.captureUserMessage(sid, c.prompt);
      await skillSummary.handle({ sessionID: sid }, {});
    } catch (e: any) {
      console.error(`[ERR] ${sid}: ${e?.message?.slice(0, 160)}`);
    }
  }
  // Print a compact map so the bash step can grep logs by SID.
  console.log("CASES_EMITTED=" + CASES.length);
  for (const c of CASES) {
    console.log(`SID=B1-live-${c.id}-${c.lang} EXPECTED=${c.expected.join("|")}`);
  }
}

if (import.meta.main) await main();
