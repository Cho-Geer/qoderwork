# Blueprint: Agent 强制文档读取硬约束方案

**创建日期**: 2026-07-12
**更新日期**: 2026-07-28
**状态**: 已完成
**相关蓝图**: 被取代（机制吸收） ← blueprint-permission-template-driven-enforcement.md

**版本**: 1.0.0  
**日期**: 2026-07-01  
**原状态（PHASE-03 前自述）**: 待实施  
**优先级**: P0

---

## 一、问题背景

### 1.1 问题描述

Agent（特别是 Orchestrator）在执行任务时，经常跳过关键的 skill 和 rule 文档读取，导致：
- 不理解正确的工作流（如 compliance_gate → dispatch_subagent → Task）
- 直接尝试使用工具，被 enforcement chain 阻断
- 累积 orphan blocks，触发 anti-bypass 锁定 session

### 1.2 根因分析

**直接原因**：
- `execution-preflight-check` skill 包含 mandatory 工作流指令
- 但 skill 内容不自动注入 agent context
- Agent 必须主动调用 `read_skill()` 才能获取指令
- 没有硬约束强制 agent 读取 skills/rules

**根本原因**：
- 框架依赖 agent 自觉遵循 rules 和加载 skills
- 没有代码级别的强制执行机制
- 现有的 `config_read_attest` 只检查 3 个配置文件，不检查 skills/rules

### 1.3 实测验证

通过 serve session 端到端测试验证：
- Agent 成功通过 dispatch_payload → preflight → read_attest 阶段
- 卡在 gate_armed 阶段，因为没有调用 compliance_gate 工具
- Agent 直接尝试使用 `task` 工具，被 `task.ts` before-hook 阻断
- 累积 3 次 orphan blocks，session 被锁定

**结论**：这不是 serve session 特有问题，web UI session 同样会发生。

---

## 二、解决方案

### 2.1 方案概述

**方案选择**：Option A + B + Hash 同步 + Phase 0 强制时序

| 需求 | 解决方案 |
|------|---------|
| 硬约束 | Phase 0 + checklist 阻断 + 最小化 passthrough（只有 read） |
| 全量读取验证 | Option A: content_length/file_size >= 0.8 |
| 内容验证 | Option B: key_phrase 必须存在于文件中 |
| 文件变更同步 | file_hash 比对，变更则 read 失效 |
| 时序保证 | Phase 0 必须在所有其他 phase 之前完成 |
| 上下文优化 | config_read_attest 从 3 文件减少到 1 文件 |

### 2.2 核心设计

#### 2.2.1 Phase 0: initial_read

新增 checklist phase，强制在所有工具使用前完成文档读取：

```typescript
// .opencode/service/gate/checklist-phase.ts

export const PHASE_ITEMS = {
  initial_read: [  // 新增 Phase 0
    {
      key: "agent_config_read_attested",
      verifier: "config_read_attest",
      remediation: "Read .opencode/agents/<Agent>.md, then call config_read_attest(task_id).",
    },
    {
      key: "skills_read_attested",
      verifier: "skill_read_attest",
      remediation: "Read required skills, then call skill_read_attest(task_id, key_phrase).",
    },
    {
      key: "rules_read_attested",
      verifier: "rule_read_attest",
      remediation: "Read required rules, then call rule_read_attest(task_id, key_phrase).",
    },
  ],
  // ... 其他 phases
};

export const PHASE_ORDER = [
  "initial_read",      // 新增：Phase 0
  "dispatch_payload",
  "preflight",
  "read_attest",
  "gate_armed",
  "execute",
  "deliver",
  "close",
];
```

#### 2.2.2 Phase 0 期间的 Passthrough 限制

```typescript
// .opencode/service/gate/checklist-validate.ts

export function validateChecklistBefore(input: any, output: any) {
  // ...
  
  // Phase 0 特殊处理：只允许 read 工具
  if (run.phase === "initial_read") {
    if (toolName !== "read" && toolName !== "Read") {
      return {
        blocked: true,
        message: `[FW-ENFORCE][PHASE-0] Tool "${toolName}" blocked. You must complete initial document reading first.
        
Required steps:
1. read(".opencode/agents/<YourAgent>.md")
2. read required skills (see project.config.json → required_skills)
3. read required rules (see project.config.json → required_rules)
4. Call config_read_attest(task_id)
5. Call skill_read_attest(task_id, key_phrase)
6. Call rule_read_attest(task_id, key_phrase)

After completing these steps, retry the tool.`,
      };
    }
  }
  
  // 其他 phases 使用正常 passthrough 列表
  if (getPassthroughTools().has(toolName)) return { blocked: false };
  
  // ...
}
```

#### 2.2.3 read_audit 表扩展

```sql
-- 新增字段
ALTER TABLE read_audit ADD COLUMN content_length INTEGER DEFAULT 0;
ALTER TABLE read_audit ADD COLUMN file_hash TEXT DEFAULT '';
ALTER TABLE read_audit ADD COLUMN file_size INTEGER DEFAULT 0;
```

#### 2.2.4 read-track-after hook 增强

```typescript
// .opencode/plugin-handlers/after/read-track.ts

import * as fs from "node:fs";
import * as crypto from "node:crypto";

export async function handle(input: any, output: any): Promise<void> {
  const tool = input?.tool || "";
  if (tool !== "read" && tool !== "Read") return;
  
  const filePath = input?.args?.filePath || input?.args?.file_path || "";
  if (!filePath) return;

  // 计算文件 hash 和大小
  let fileHash = "";
  let fileSize = 0;
  try {
    const absolutePath = path.resolve(process.env.OPENCODE_ROOT || ".", filePath);
    const content = fs.readFileSync(absolutePath, "utf8");
    fileHash = crypto.createHash("sha256").update(content).digest("hex");
    fileSize = content.length;
  } catch {}

  // 获取输出内容长度
  const contentLength = output?.output?.length || 0;

  trackReadEvent({
    sessionID: input?.sessionID || "",
    callID: input?.callID || "",
    filePath,
    contentLength,
    fileHash,
    fileSize,
  });
}
```

#### 2.2.5 verifyRead() 增强

```typescript
// .opencode/service/file-guard/read-audit-verify.ts

export interface ReadVerifyResult {
  verified: boolean;
  reason: string;
  matchedEntry?: ReadAuditEntry;
  readRatio?: number;  // 新增：读取比例
  hashMatch?: boolean; // 新增：hash 是否匹配
}

export function verifyRead(agent: string, filePath: string, sessionId?: string): ReadVerifyResult {
  // ... 现有逻辑 ...
  
  if (row) {
    const matchedEntry = dbEntryToReadAuditEntry(row);
    
    // 新增检查 1：全量读取验证
    const readRatio = row.content_length / row.file_size;
    const requiredRatio = getRequiredReadRatio(); // 从配置读取，默认 0.8
    if (readRatio < requiredRatio) {
      return {
        verified: false,
        reason: `Only read ${Math.round(readRatio * 100)}% of file (required: ${Math.round(requiredRatio * 100)}%). Please read the complete file.`,
        readRatio,
        hashMatch: false,
      };
    }
    
    // 新增检查 2：文件变更验证
    let hashMatch = true;
    try {
      const absolutePath = path.resolve(process.env.OPENCODE_ROOT || ".", filePath);
      const currentContent = fs.readFileSync(absolutePath, "utf8");
      const currentHash = crypto.createHash("sha256").update(currentContent).digest("hex");
      hashMatch = (row.file_hash === currentHash);
      if (!hashMatch) {
        return {
          verified: false,
          reason: "File has been modified since you read it. Please re-read the file.",
          readRatio,
          hashMatch,
        };
      }
    } catch {}
    
    return {
      verified: true,
      reason: `Agent "${matchedEntry.agent}" read "${matchedEntry.filePath}" at ${matchedEntry.timestamp}`,
      matchedEntry,
      readRatio,
      hashMatch,
    };
  }
  
  // ...
}
```

#### 2.2.6 新增 skill_read_attest 工具

```typescript
// .opencode/tools/skill_read_attest.ts

import { tool } from "@opencode-ai/plugin";
import * as fs from "node:fs";
import * as path from "node:path";
import { verifyRead } from "../service/file-guard/read-audit-verify";
import { checklistWirePassed } from "../service/gate/checklist-hooks";

export default tool({
  description:
    "Verify that the agent has read all required skill files. " +
    "Checks: (1) read_audit records exist, (2) full read (content_length/file_size >= 0.8), " +
    "(3) file hash matches (file not modified), (4) key_phrase exists in file. " +
    "Called by agents during Phase 0 (initial_read).",
  args: {
    task_id: tool.schema.string().describe("DAG task ID for session tracking"),
    key_phrase: tool.schema.string().describe(
      "Quote a specific phrase from one of the skill files to prove you read it. " +
      "This phrase must be at least 20 characters long and must exist in the file."
    ),
  },
  async execute(args: { task_id: string; key_phrase: string }, context: any) {
    const agent = context.agent || process.env.FRAMEWORK_AGENT || "";
    const sessionID = context.sessionID;
    const worktree = context.worktree || process.cwd();

    // 加载必需 skills 列表
    const configPath = path.join(worktree, ".opencode/project.config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const requiredSkills: string[] = config?.template_resolution?.required_skills || [];

    if (requiredSkills.length === 0) {
      return JSON.stringify({ verified: true, reason: "No required skills configured" });
    }

    // 验证所有 skills 已读取
    const unreadFiles: string[] = [];
    const readVerifications: Array<{ file: string; timestamp: string; readRatio: number }> = [];

    for (const skillPath of requiredSkills) {
      const result = verifyRead(agent, skillPath, sessionID);
      if (result.verified && result.matchedEntry) {
        readVerifications.push({
          file: skillPath,
          timestamp: result.matchedEntry.timestamp,
          readRatio: result.readRatio || 0,
        });
      } else {
        unreadFiles.push(skillPath);
      }
    }

    // 验证 key_phrase 存在于某个 skill 文件中
    let keyPhraseFound = false;
    if (args.key_phrase && args.key_phrase.length >= 20) {
      for (const skillPath of requiredSkills) {
        try {
          const absolutePath = path.resolve(worktree, skillPath);
          const content = fs.readFileSync(absolutePath, "utf8");
          if (content.includes(args.key_phrase)) {
            keyPhraseFound = true;
            break;
          }
        } catch {}
      }
    }

    const allRead = unreadFiles.length === 0;

    if (allRead && keyPhraseFound) {
      // 标记 checklist item 为 passed
      checklistWirePassed(
        sessionID,
        agent,
        args.task_id,
        "skills_read_attested",
        JSON.stringify(readVerifications),
      );

      return JSON.stringify({
        verified: true,
        session_id: sessionID,
        files_verified: readVerifications.length,
        key_phrase_verified: true,
      });
    }

    // 返回错误
    const errors: string[] = [];
    if (!allRead) {
      errors.push(`Missing read audit records for ${unreadFiles.length} skill file(s): ${unreadFiles.join(", ")}`);
    }
    if (!keyPhraseFound) {
      errors.push("Key phrase not found in any skill file. Please quote a phrase (>= 20 chars) from one of the skill files.");
    }

    return JSON.stringify({
      verified: false,
      error: errors.join("; "),
      hint: "Read all required skill files using the read tool, then re-run skill_read_attest with a key phrase from the file.",
      required_skills: requiredSkills,
    });
  },
});
```

#### 2.2.7 config_read_attest 优化

```typescript
// .opencode/service/session/config-attest.ts

// 从 3 个文件减少到 1 个
const MANDATORY_CONFIG_FILES: string[] = [];  // 清空

function resolveConfigPaths(agent: string, worktree: string): string[] {
  return [
    resolveAgentConfigPath(agent, worktree),  // 只保留 Agent .md
  ];
}
```

**上下文窗口节省**：
- `opencode.json`: ~80KB → 移除
- `project.config.json`: ~20KB → 移除
- **总计节省**: ~100KB

#### 2.2.8 配置文件

```json
// .opencode/project.config.json
{
  "template_resolution": {
    "required_skills": [
      ".opencode/skills/execution-preflight-check/FULL.md",
      ".opencode/skills/codegraph-first/FULL.md"
    ],
    "required_rules": [
      ".opencode/rules/common-project.md",
      ".opencode/rules/rule_detail/skill-invocation-standard.md"
    ],
    "required_read_ratio": 0.8
  }
}
```

---

## 三、实施清单

### 3.1 文件变更列表

| 序号 | 文件 | 变更类型 | 说明 |
|------|------|---------|------|
| 1 | `.opencode/state/framework-state.db` | Schema | read_audit 表新增 content_length, file_hash, file_size |
| 2 | `.opencode/plugin-handlers/after/read-track.ts` | 修改 | 记录 content_length, file_hash, file_size |
| 3 | `.opencode/service/file-guard/read-audit-write.ts` | 修改 | ReadAuditEntry 接口新增字段，recordRead() 写入新字段 |
| 4 | `.opencode/service/file-guard/read-audit-verify.ts` | 修改 | verifyRead() 增加全量读取和 hash 验证 |
| 5 | `.opencode/tools/skill_read_attest.ts` | 新建 | skill 读取验证工具 |
| 6 | `.opencode/tools/rule_read_attest.ts` | 新建 | rule 读取验证工具 |
| 7 | `.opencode/service/session/config-attest.ts` | 修改 | 从 3 文件减少到 1 文件 |
| 8 | `.opencode/service/gate/checklist-phase.ts` | 修改 | 新增 initial_read phase |
| 9 | `.opencode/service/gate/checklist-validate.ts` | 修改 | Phase 0 passthrough 限制 |
| 10 | `.opencode/project.config.json` | 修改 | 新增 required_skills, required_rules, required_read_ratio |

### 3.2 实施步骤

**Phase 1: 基础设施（1-2天）**
1. DB schema 变更（read_audit 表新增字段）
2. read-track-after hook 增强（记录 hash/length）
3. read-audit-write.ts 增强（写入新字段）
4. read-audit-verify.ts 增强（全量读取 + hash 验证）

**Phase 2: Attest 工具（1-2天）**
5. 新建 skill_read_attest.ts
6. 新建 rule_read_attest.ts
7. 修改 config-attest.ts（从 3 文件减少到 1 文件）

**Phase 3: Checklist 集成（1天）**
8. checklist-phase.ts 新增 initial_read phase
9. checklist-validate.ts Phase 0 passthrough 限制

**Phase 4: 配置与测试（1天）**
10. project.config.json 配置必需读取列表
11. 端到端测试验证

---

## 四、验证计划

### 4.1 单元测试

- [ ] verifyRead() 全量读取验证
- [ ] verifyRead() hash 比对验证
- [ ] skill_read_attest key_phrase 验证
- [ ] config_read_attest 单文件验证

### 4.2 集成测试

- [ ] Phase 0 阻断非 read 工具
- [ ] Phase 0 完成后 auto-advance
- [ ] 文件变更后 read 失效
- [ ] 部分读取被拒绝

### 4.3 端到端测试

- [ ] serve session 完整流程
- [ ] web UI session 完整流程
- [ ] Agent 遵循正确工作流
- [ ] 上下文窗口使用量减少

---

## 五、风险与缓解

### 5.1 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Agent .md 不包含所有必要信息 | Agent 可能错过某些配置 | 确保 Agent .md 是自包含的 |
| Phase 0 增加启动延迟 | 任务开始变慢 | 可接受，确保正确性优先 |
| Hash 计算性能开销 | 每次 read 都计算 hash | 只对小文件计算，大文件用 mtime |

### 5.2 回滚方案

如果方案出现问题，可以：
1. 禁用 Phase 0（从 PHASE_ORDER 中移除）
2. 恢复 config_read_attest 为 3 文件
3. 禁用 hash 验证（保留 content_length 验证）

---

## 六、成功标准

- [ ] Agent 100% 读取必需 skills/rules
- [ ] 无 agent 因跳过文档读取而被阻断
- [ ] 上下文窗口使用量减少 100KB+
- [ ] 文件变更后 agent 被提示重新读取
- [ ] 部分读取被拒绝（< 80%）

---

## 七、附录

### 7.1 相关文件

- `.opencode/service/file-guard/read-audit-write.ts`
- `.opencode/service/file-guard/read-audit-verify.ts`
- `.opencode/service/session/config-attest.ts`
- `.opencode/service/gate/checklist-phase.ts`
- `.opencode/service/gate/checklist-validate.ts`
- `.opencode/plugin-handlers/after/read-track.ts`

### 7.2 参考资料

- [Serve Session Enforcement Investigation](../memory/2026-07-01.md)
- [config_read_attest 实现](../.opencode/service/session/config-attest.ts)
- [read_audit 表结构](../.opencode/state/framework-state.db)
