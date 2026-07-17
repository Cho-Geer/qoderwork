# T-PT-051 checklist (DRY-RUN plan)

## Status
- T-PT-051: READY (not executed)
- DRY_RUN: true
- H2_AUTHORIZED: false
- FRAMEWORK_SKILL_READ_HARD_GATE: (not set)
- **MARK: LIVE — REQUIRES H2 USER AUTHORIZATION**

## Prerequisites
- T-PT-048
- T-PT-049
- T-PT-050

## Live steps (10)
- Step 01: POST /session 创建 root session (agent=build) → expected 201, agent=build
- Step 02: GET /session/{rootSid} 验证 agent=build (§4.6 先查再发) → expected 200, agent=build
- Step 03: POST /session/{rootSid}/prompt_async 调 attestSkillRead(root) → expected 200, verified=true
- Step 04: 等待 root session.idle (§4.5 Turn 模型) → expected 200, idle=true
- Step 05: POST /session/{rootSid}/prompt_async 调 safe_edit (应 allowed) → expected 200
- Step 06: 验证 executor entry=1 (从 dispatcher trace) → expected executor_entry_count=1
- Step 07: POST /session/{rootSid}/prompt_async 调 dispatch_subagent 创建 child → expected 200, childSessionID
- Step 08: POST /session/{childSid}/prompt_async 调 attestSkillRead(child) → expected 200, verified=true
- Step 09: POST /session/{childSid}/prompt_async 调 safe_edit (应 allowed) → expected 200
- Step 10: POST /session/{unauthSid}/prompt_async 调 safe_edit (应 rejected) → expected 403, ruleId='skill-read-attest-required'

## Oracles (4)
- oracle-1 [ORA-PT-09]: 真实调用 10 步无 mock — 每步都通过真实 serve API → expected 10/10 step success, no stubs
- oracle-2 [ORA-PT-11/12]: 步骤 1-6 root lifecycle 完整通过 (canonical identity + skill-policy + executor) → expected root verified:true + safe_edit executor=1
- oracle-3 [ORA-PT-11/13]: 步骤 7-9 child lifecycle 完整通过 (parent-child identity 继承) → expected child verified:true + safe_edit executor=1
- oracle-4 [ORA-PT-12/13]: 步骤 10 unauth 必拒 (ruleId='skill-read-attest-required') → expected rejected + ruleId='skill-read-attest-required' + executor=0

## Oracle coverage
- Step 01-02 (root session 创建 + 验证)  → oracle-1, oracle-2
- Step 03-06 (root attest + safe_edit + executor) → oracle-1, oracle-2
- Step 07-09 (child dispatch + attest + safe_edit) → oracle-1, oracle-3
- Step 10 (unauth deny) → oracle-1, oracle-4

## Required evidence (production run)
- 10 步各自 HTTP status + response payload
- root session agent=build 确认 (§4.6)
- root attestSkillRead verified:true 返回
- root safe_edit executor boundary counter=1
- child session 创建 + childSessionID
- child attestSkillRead verified:true 返回
- child safe_edit executor boundary counter=1
- unauth session safe_edit 403 + ruleId='skill-read-attest-required'
- SSE session.idle 事件 (step 04)
- question 轮询记录 (§1.1 #5)

## Important constraint
- **三重前置条件**: `DRY_RUN=false` + `H2_AUTHORIZED=true` + `FRAMEWORK_SKILL_READ_HARD_GATE=1`
- 未满足三重条件时脚本 `exit 0`，不执行任何 live 步骤
- 需 reviewer 启动隔离 serve，不修改 work-one 任何源码
- §4.4 prompt_async 必传 agent（身份保留）
- §1.1 #5 主动轮询 /question + #6 reply
