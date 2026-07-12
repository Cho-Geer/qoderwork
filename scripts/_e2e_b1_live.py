#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
E2E B1 live driver: drives 12 intents x (CN+EN) = 24 real Orchestrator
sessions through the live serve (127.0.0.1:4096), then parses the real
skill-summary runtime log for the actual injected keyword skills.

This upgrades B1 evidence from runtime-smoke (in-process _b1_live.ts) to
live LLM E2E (real sessions, real LLM, real agent resolution).
"""
import json
import time
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:4096"
WORK_ONE = "/home/zhaoge/workspace/opencode/work-one"
LOG = f"{WORK_ONE}/.task_temp/_logs/2026-07-11/plugin-plugin-skill-summary-runtime.log"

# (tag, prompt) -- 24 entries
PROMPTS = [
    ("1-CN", "需求不清，先帮我澄清到底要做什么"),
    ("1-EN", "The requirements are unclear — help me clarify what we actually need to build"),
    ("2-CN", "修改 `.opencode/tools/safe_edit.ts` 的实现逻辑"),
    ("2-EN", "Modify the implementation logic in `.opencode/tools/safe_edit.ts`"),
    ("3-CN", "修改 OpenCode 框架的 before hook 做路径校验"),
    ("3-EN", "Edit the OpenCode framework's before hook to add path validation"),
    ("4-CN", "把一个子任务 dispatch 给 build agent 去执行"),
    ("4-EN", "Dispatch a subtask to the build agent for execution"),
    ("5-CN", "交付前帮我做验收，确认产出达标"),
    ("5-EN", "Before delivery, help me do acceptance and confirm the output meets the bar"),
    ("6-CN", "给项目加一条 CI 流水线，跑 lint 和测试"),
    ("6-EN", "Add a CI pipeline to the project that runs lint and tests"),
    ("7-CN", "数据库迁移：把用户表拆成两张并迁移数据"),
    ("7-EN", "Database migration: split the user table into two and migrate the data"),
    ("8-CN", "查一下当前 axios 最新版本和 breaking change"),
    ("8-EN", "Check the latest axios version and its breaking changes"),
    ("9-CN", "这个偶发崩溃根因一直查不清，帮我系统调查"),
    ("9-EN", "This intermittent crash's root cause is hard to pin down — help me investigate systematically"),
    ("10-CN", "多份文档对同一个 API 行为说法冲突，帮我定论"),
    ("10-EN", "Multiple docs conflict on the same API's behavior — help me settle it"),
    ("11-CN", "修改框架源码：在 `before/codegraph.ts` 加一行日志"),
    ("11-EN", "Edit framework source: add a log line in `before/codegraph.ts`"),
    ("12-CN", "一句话问答：Git 怎么看当前分支"),
    ("12-EN", "Quick question: how do I see the current Git branch?"),
]


def create_session():
    body = json.dumps({"agent": "Orchestrator"}).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}/session", data=body,
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)["id"]


def post_message(sid, text):
    """POST a user message. We abort at 10s: skill-summary fires on the
    first system.transform (well within 10s); the LLM's later behavior is
    irrelevant to the injection test and aborting minimizes side effects."""
    body = json.dumps({"parts": [{"type": "text", "text": text}]}).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}/session/{sid}/message", data=body,
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return f"HTTP {e.code}"
    except Exception as e:
        return f"ABORT/ERR: {type(e).__name__}"


def parse_log_for(sid):
    """Return (keywordGroups, keywordSkills) for the first SKILL-SUMMARY-INJECTED
    line of this SID that has non-empty keywordSkills (fallback: last line)."""
    try:
        with open(LOG, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except FileNotFoundError:
        return ("NO_LOG", "NO_LOG")
    cand = None
    last = None
    for ln in lines:
        if sid not in ln:
            continue
        if "SKILL-SUMMARY-INJECTED" not in ln:
            continue
        last = ln
        try:
            payload = ln.split("|", 7)[7]
            obj = json.loads(payload)
            groups = obj.get("keywordGroups", "")
            skills = obj.get("keywordSkills", "")
            if skills and skills != "none":
                cand = (groups, skills)
        except Exception:
            pass
    return cand or (last_extract(last) if last else ("NONE", "NONE"))


def last_extract(ln):
    try:
        payload = ln.split("|", 7)[7]
        obj = json.loads(payload)
        return (obj.get("keywordGroups", ""), obj.get("keywordSkills", ""))
    except Exception:
        return ("PARSE_ERR", "PARSE_ERR")


def main():
    results = []  # (tag, sid, status)
    for tag, text in PROMPTS:
        try:
            sid = create_session()
        except Exception as e:
            print(f"[SKIP] {tag}: create_session failed: {e}", flush=True)
            results.append((tag, "NO_SID", "CREATE_FAIL"))
            continue
        st = post_message(sid, text)
        time.sleep(6)  # allow 5s flush timer
        results.append((tag, sid, str(st)))
        print(f"[OK] {tag} sid={sid} post={st}", flush=True)

    # final settle
    time.sleep(8)

    print("\n=== LIVE E2E RESULTS (skill-summary injection) ===")
    table = []
    for tag, sid, st in results:
        groups, skills = parse_log_for(sid)
        table.append((tag, sid, groups, skills))
        print(f"{tag}\t{groups}\t{skills}", flush=True)

    # persist for doc update
    with open("/home/zhaoge/workspace/qoderwork/scripts/_e2e_b1_results.tsv", "w", encoding="utf-8") as f:
        for tag, sid, groups, skills in table:
            f.write(f"{tag}\t{sid}\t{groups}\t{skills}\n")

    # safety: check for unintended work-one changes
    import subprocess
    try:
        out = subprocess.run(
            ["git", "-C", WORK_ONE, "status", "--short"],
            capture_output=True, text=True, timeout=20)
        changes = out.stdout.strip()
        print("\n=== git status --short (work-one) ===")
        print(changes if changes else "[clean] no unintended changes")
    except Exception as e:
        print(f"git status check skipped: {e}")


if __name__ == "__main__":
    main()
