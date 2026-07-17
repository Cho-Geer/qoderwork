# PT-WM-00R Reviewer Live E2E 验收

**为什么**: 作为 Reviewer 执行 live LLM E2E 测试，收集运行态证据以解除 BLOCK-PT-02。

**改了什么**: 无代码修改。纯验证执行。

**验证结果**:
- T-PT-001 (skill discovery): PASS — `opencode debug skill` 发现两个测试 Skill
- T-PT-004 (写阻断 4 件套): PASS — verified:false + rule 拒绝 + executor entry=0 + target unchanged
- T-PT-046 (runtime smoke): PASS — attest→false, read/question allow, dispatch 阻断, file NOT created
- T-PT-047 (live rework): PARTIAL — 负向阻断 PASS；正向认证通过但 dispatch 仍被 identity mismatch 阻断

**决策**:
1. BLOCK-PT-02 **可以解除**：T-PT-004 的 4 件套证据全部通过 live runtime 验证
2. 发现 BLOCK-PT-03（新）：`attestSkillRead()` 和 `validateSkillAttestation()` 使用不同的 identity resolution 路径，导致认证通过后 handler 校验仍失败。这是一个新阻塞项，需在 PT-WM-01 前修复
3. 所有证据保存于 `e2e-evidence/L3/permission-template-enforcement/rework-pt-wm-00r/`

**下一步**: 修复 identity resolution 不一致（BLOCK-PT-03），然后继续 PT-WM-01~03 的 permission template 核心迁移验收。
