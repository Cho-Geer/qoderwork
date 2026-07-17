# PT-WM-00R2 G1 失败后的文档复核

**为什么**: G1 live 证据显示未认证 dispatch 被硬门拒绝且目标不变，但 LLM 未调用 `skill_read_attest`；同时 L3-012 rerun 仅命中前置 attestation 门，不能证明 repo grant。

**改了什么**:
- `blueprints/blueprint-permission-template-driven-enforcement.md` — 更新为 v1.5.0；记录 G1 子断言、拆分 T-PT-004 的确定性与 live 观察，并分列 L3-012 core/rerun 证据。
- `e2e/permission-template-enforcement-test-spec.md` — 更新执行账本和 T-PT-004/T-PT-047 oracle，保留 first failure 与 BLOCK-PT-02/03。

**决策**: 不把“未调用 attest”写成产品失败或 PASS；确定性 `attest:false` 由 reviewer 直接执行，live 仅断言真实发生的拒绝和零副作用。L3-012 historical repo-policy PASS 与本轮 attestation rerun 不互相替代。
