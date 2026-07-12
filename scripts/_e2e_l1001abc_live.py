#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
E2E L1-001A/B/C live driver (2026-07-12).

Drives targeted real Orchestrator sessions through serve (127.0.0.1:4096) and
captures the framework's SKILL-SUMMARY-INJECTED directive + policy decisions
from the CURRENT dated runtime log.

  L1-001A (F1, bilingual alignment): same intent in CN + EN -> consistent boost
  L1-001B (F2, substring false-hit): "API" -> context7-first ; "base" -> database
  L1-001C (F4, library/context7):    bare "库"/dependency -> dependency-library + context7-first

Reuses the _e2e_b1_live.py methodology (POST /session + /message, abort at 10s
because skill-summary fires on the first system.transform; LLM later behavior
is irrelevant to the injection test). Log path is located dynamically (dated
dir), unlike the hardcoded 2026-07-11 path in the original driver.
"""
import json
import time
import urllib.request
import urllib.error
import glob
import os

BASE = "http://127.0.0.1:4096"
WORK_ONE = "/home/zhaoge/workspace/opencode/work-one"

# Locate the CURRENT plugin-plugin-skill-summary runtime log (dated dir)
LOGS = sorted(glob.glob(f"{WORK_ONE}/.task_temp/_logs/*/plugin-plugin-skill-summary-runtime.log"),
              key=os.path.getmtime, reverse=True)
LOG = LOGS[0] if LOGS else None

# (group, tag, prompt)
PROMPTS = [
    # ---- L1-001A: bilingual alignment (CN + EN of the SAME intent) ----
    ("A", "A1-CN", "修改框架源码：在 before/codegraph.ts 加一行日志"),
    ("A", "A1-EN", "Edit framework source: add a log line in before/codegraph.ts"),
    ("A", "A2-CN", "给项目加一条 CI 流水线，跑 lint 和测试"),
    ("A", "A2-EN", "Add a CI pipeline to the project that runs lint and tests"),
    ("A", "A3-CN", "一句话问答：Git 怎么看当前分支"),
    ("A", "A3-EN", "Quick question: how do I see the current Git branch?"),
    ("A", "A4-CN", "需求不清，先帮我澄清到底要做什么"),
    ("A", "A4-EN", "The requirements are unclear - help me clarify what we actually need to build"),
    ("A", "A5-CN", "把一个子任务 dispatch 给 build agent 去执行"),
    ("A", "A5-EN", "Dispatch a subtask to the build agent for execution"),
    ("A", "A6-CN", "这个偶发崩溃根因一直查不清，帮我系统调查"),
    ("A", "A6-EN", "This intermittent crash's root cause is hard to pin down - help me investigate systematically"),
    # ---- L1-001B: English substring false-hit (API / base) ----
    ("B", "B1-API-EN", "How do I use the GitHub API to list my repositories?"),
    ("B", "B2-API-CN", "怎么用 GitHub API 列出我的仓库"),
    ("B", "B3-base-EN", "How do I design the base schema for the database?"),
    ("B", "B4-base-CN", "怎么给数据库设计 base 表结构"),
    # ---- L1-001C: library / context7 coverage ----
    ("C", "C1-lib-CN", "给项目加一个第三方库做日期格式化"),
    ("C", "C2-dep-EN", "Add a dependency library for date formatting to the project"),
    ("C", "C3-ctx7-CN", "查一下这个库的 context7 文档"),
    ("C", "C4-lib-EN", "How do I add a new library to the project?"),
]


def create_session():
    body = json.dumps({"agent": "Orchestrator"}).encode("utf-8")
    req = urllib.request.Request(f"{BASE}/session", data=body,
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)["id"]


def post_message(sid, text):
    body = json.dumps({"parts": [{"type": "text", "text": text}]}).encode("utf-8")
    req = urllib.request.Request(f"{BASE}/session/{sid}/message", data=body,
                                 headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return f"HTTP {e.code}"
    except Exception as e:
        return f"ABORT/ERR: {type(e).__name__}"


def _payload(ln):
    try:
        return json.loads(ln.split("|", 7)[7])
    except Exception:
        return None


def parse_log_for(sid):
    """Return dict with keywordGroups, keywordSkills, risk (from policy events)."""
    if not LOG:
        return {"keywordGroups": "NO_LOG", "keywordSkills": "NO_LOG", "risk": "NO_LOG"}
    groups = skills = None
    risk = None
    try:
        with open(LOG, "r", encoding="utf-8") as f:
            for ln in f:
                if sid not in ln:
                    continue
                if "SKILL-SUMMARY-INJECTED" in ln:
                    o = _payload(ln)
                    if o:
                        g = o.get("keywordGroups", "")
                        s = o.get("keywordSkills", "")
                        if s and s != "none":
                            groups, skills = g, s
                elif "preflight_policy_decision" in ln or "todo_policy_decision" in ln:
                    o = _payload(ln)
                    if o and o.get("risk"):
                        risk = o.get("risk")
    except FileNotFoundError:
        return {"keywordGroups": "NO_LOG", "keywordSkills": "NO_LOG", "risk": "NO_LOG"}
    return {
        "keywordGroups": groups or "none",
        "keywordSkills": skills or "none",
        "risk": risk or "n/a",
    }


def main():
    print(f"[INFO] runtime log = {LOG}", flush=True)
    results = []
    for grp, tag, text in PROMPTS:
        try:
            sid = create_session()
        except Exception as e:
            print(f"[SKIP] {tag}: create_session failed: {e}", flush=True)
            results.append((grp, tag, text, "NO_SID", "NO_LOG", "NO_LOG", "NO_LOG"))
            continue
        st = post_message(sid, text)
        time.sleep(6)  # allow 5s flush timer
        results.append((grp, tag, text, sid, str(st), None, None))
        print(f"[OK] {tag} sid={sid} post={st}", flush=True)

    time.sleep(8)  # final settle

    table = []
    print("\n=== L1-001A/B/C LIVE RESULTS (skill-summary injection) ===")
    print(f"{'tag':<12}{'groups':<40}{'skills':<45}{'risk'}")
    for grp, tag, text, sid, st, _, _ in results:
        if sid in ("NO_SID",):
            print(f"{tag:<12}{'CREATE_FAIL':<40}{'CREATE_FAIL':<45}{'-'}")
            table.append((grp, tag, text, sid, "CREATE_FAIL", "CREATE_FAIL", "CREATE_FAIL"))
            continue
        info = parse_log_for(sid)
        groups, skills, risk = info["keywordGroups"], info["keywordSkills"], info["risk"]
        table.append((grp, tag, text, sid, groups, skills, risk))
        print(f"{tag:<12}{groups:<40}{skills:<45}{risk}")

    # persist
    out = "/home/zhaoge/workspace/qoderwork/scripts/_e2e_l1001abc_results.tsv"
    with open(out, "w", encoding="utf-8") as f:
        f.write("group\ttag\tprompt\tsid\tgroups\tskills\trisk\n")
        for grp, tag, text, sid, groups, skills, risk in table:
            f.write(f"{grp}\t{tag}\t{text}\t{sid}\t{groups}\t{skills}\t{risk}\n")
    print(f"\n[INFO] wrote {out}", flush=True)


if __name__ == "__main__":
    main()
