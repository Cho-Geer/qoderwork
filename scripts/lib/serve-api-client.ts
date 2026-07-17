/**
 * serve-api-client.ts — 通用 serve API 客户端 (serve-api skill §1.1/§4 全条款)
 *
 * 创建于 2026-07-14：审计发现之前 live E2E 脚本只用了 §1.1 核心操作 1-4 (session/message/SSE)，
 * 漏掉 5-10 (question/identity/turn/verify)。本 lib 把"必须遵循的硬要求"封装为函数，
 * 任何 `_b_*.ts` 脚本应 import 此 lib 而非自己手写。
 *
 * 封装能力 (对应 serve-api skill 章节):
 *   - httpJson()                   : §1.1 通用 HTTP helper
 *   - getSessionAgent(sid, url)    : §4.6 先查再发 (identity-preserve pattern)
 *   - promptAsync(sid, text, url)  : §4.4 身份保留指导 (prompt_async 必传 agent)
 *   - pollAndReplyQuestions(...)   : §1.1 核心操作#5 主动轮询 + #6 自动 reply
 *   - waitForIdle(sid, ms, ...)    : §4.5 Turn 模型 (按 session.idle/error 判定)
 *
 * 证据纪律 (每次调用必须输出 Verified-by):
 *   - 函数内部 console.log "Verified-by: <端点> → <关键返回>"
 *   - 调用方无需重复输出
 *
 * 升级约定 (后续维护):
 *   - 加新能力时必须先读 serve-api skill § 章节再加函数
 *   - 改函数签名时同步更新所有 import 方
 */

import { SSEWatcher } from "./sse-watcher";
import { ServeClientContext } from "./types";

// ── Default question reply labels ──
// 来自历史 PT-WM-00R2 + L3-012 场景的 6 个标准 label
// 调用方可用 ...QUESTION_REPLY_DEFAULTS 扩展
export const QUESTION_REPLY_DEFAULTS: Record<string, string> = {
  "报告失败，等待修复": "报告失败，等待修复",
  "接受测试结果报告": "接受测试结果报告",
  "是的，这是测试预期": "是的，这是测试预期",
  "报告阻塞到此为止": "报告阻塞到此为止",
  "Check system logs": "Check system logs",
  "使用其他工具": "使用其他工具",
};

// ── HTTP helper (serve-api skill §1.1 模式 D: 脚本化执行) ──
export interface HttpResponse {
  status: number;
  data: any;
  raw: string;
}

export async function httpJson(
  method: string,
  path: string,
  serveUrl: string,
  body?: any,
): Promise<HttpResponse> {
  const url = new URL(path, serveUrl);
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = text;
  try { data = text ? JSON.parse(text) : null; } catch { /* keep raw */ }
  return { status: res.status, data, raw: text };
}

// ── §4.6 先查再发 (identity-preserve pattern) ──
// 发消息前必须先 GET 该 SID 真实 agent，避免子 session 身份被覆盖为 Orchestrator
export async function getSessionAgent(
  sid: string,
  serveUrl: string,
): Promise<string> {
  const r = await httpJson("GET", `/session/${sid}`, serveUrl, undefined);
  if (r.status !== 200) {
    throw new Error(`getSessionAgent failed: GET /session/${sid} → ${r.status}`);
  }
  const agent = r.data?.agent || "unknown";
  console.log(`  Verified-by: GET /session/${sid.slice(0, 20)}... → agent=${agent}`);
  return agent;
}

// ── §4.4 身份保留指导: prompt_async 必须传 agent 字段 ──
export async function promptAsync(
  sid: string,
  text: string,
  serveUrl: string,
): Promise<void> {
  const agent = await getSessionAgent(sid, serveUrl);  // §4.6 先查再发
  const r = await httpJson(
    "POST",
    `/session/${sid}/prompt_async`,
    serveUrl,
    {
      parts: [{ type: "text", text }],
      agent,                                            // §4.4 必须传
    },
  );
  if (r.status >= 400) {
    throw new Error(
      `promptAsync failed: POST /session/${sid}/prompt_async → ${r.status} ${r.raw.slice(0, 200)}`,
    );
  }
  console.log(`  Verified-by: POST /session/${sid.slice(0, 20)}/prompt_async → ${r.status} (agent=${agent})`);
}

// ── §1.1 核心操作#5 主动 GET /question 轮询 + #6 自动 reply ──
export type QuestionReplier = (serveUrl: string) => Promise<number>;

export const defaultReplier: QuestionReplier = async (serveUrl) => {
  return pollAndReplyQuestionsWithMap(
    serveUrl,
    new Set(),  // 不限 session（与原 v2 行为一致）
    QUESTION_REPLY_DEFAULTS,
  );
};

export async function pollAndReplyQuestionsWithMap(
  serveUrl: string,
  knownSids: Set<string>,
  replyMap: Record<string, string>,
): Promise<number> {
  const r = await httpJson("GET", "/question", serveUrl, undefined);
  if (r.status !== 200) return 0;
  const questions = Array.isArray(r.data) ? r.data : [];
  let replied = 0;
  for (const q of questions) {
    if (knownSids.size > 0 && !knownSids.has(q.sessionID)) continue;
    const opts = q.questions?.[0]?.options || [];
    const header = q.questions?.[0]?.header || "";
    let chosen: string | null = null;
    for (const [kw, label] of Object.entries(replyMap)) {
      if (header.includes(kw) || opts.some((o: any) => o.label === label)) {
        chosen = label; break;
      }
    }
    if (!chosen && opts.length > 0) chosen = opts[0].label;
    if (!chosen) continue;

    const reply = await httpJson(
      "POST",
      `/question/${q.id}/reply`,
      serveUrl,
      { answers: [[chosen]] },  // §1.1 #6 双层数组格式
    );
    if (reply.status === 200 && reply.data === true) {
      console.log(`  Verified-by: POST /question/${q.id.slice(0, 25)}/reply → true (label="${chosen}")`);
      replied++;
    } else {
      console.log(`  ✗ reply failed: status=${reply.status} data=${JSON.stringify(reply.data)}`);
    }
  }
  return replied;
}

// ── §4.5 Turn 模型: 基于 SSE session.idle/session.error 判定 agent 完成 ──
export interface WaitResult {
  reason: "session.idle" | "session.error" | "timeout" | "question-pending-then-idle";
  totalMs: number;
  questionReplies: number;
}

export async function waitForIdle(
  sid: string,
  timeoutMs: number,
  sseFile: string,
  serveUrl: string,
  customReplier?: QuestionReplier,
  pollIntervalMs: number = 2_000,
): Promise<WaitResult> {
  const start = Date.now();
  const watcher = new SSEWatcher(sseFile);
  const replier = customReplier || defaultReplier;
  let totalReplies = 0;
  let lastIdleResult: "session.idle" | "timeout" | "question-pending-then-idle" = "timeout";

  try {
    while (Date.now() - start < timeoutMs) {
      // 主动轮询 question (lib 默认 replier 用 serveUrl)
      // 若是 customReplier，由调用方传 (sid) → 但为了一致性，replier 收 (serveUrl)
      const replied = await replier(serveUrl);
      totalReplies += replied;

      // 查 SSE 增量
      const events = await watcher.poll(pollIntervalMs);
      let sawIdle = false, sawError = false, sawQuestion = false;
      for (const ev of events) {
        const evSid = ev.sessionID || ev.data?.sessionID || "";
        if (!evSid.includes(sid)) continue;
        if (ev.type === "session.idle") sawIdle = true;
        if (ev.type === "session.error") sawError = true;
        if (ev.type === "question.asked") sawQuestion = true;
      }

      if (sawError) {
        return { reason: "session.error", totalMs: Date.now() - start, questionReplies: totalReplies };
      }
      if (sawQuestion) {
        // 继续等 idle（question 已经在 replier 里处理）
        continue;
      }
      if (sawIdle) {
        lastIdleResult = "session.idle";
        break;
      }
    }
  } finally {
    try { watcher.close(); } catch {}
  }

  return {
    reason: lastIdleResult,
    totalMs: Date.now() - start,
    questionReplies: totalReplies,
  };
}

export function clientContextFromManifest(manifest: { port: number; paths: { eventFilePath: string; worktreeDir: string; artifactsDir: string; frameworkDbPath: string } }): ServeClientContext {
  return {
    serveUrl: `http://localhost:${manifest.port}`,
    sseFile: manifest.paths.eventFilePath,
    worktreeDir: manifest.paths.worktreeDir,
    artifactsDir: manifest.paths.artifactsDir,
    frameworkDbPath: manifest.paths.frameworkDbPath,
  };
}