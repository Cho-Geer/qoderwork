# Permission Template 00R 证据审核与二次返工契约

**为什么**: 00R 执行报告把局部 component/runtime 观察升级成完整 PASS，但原始证据未覆盖式样书要求的精确路径；正向 live case 还暴露 canonical identity 死锁和 active order 漂移。

**改了什么**:
- `blueprints/blueprint-permission-template-driven-enforcement.md` — 升级 v1.3.0，拒绝解除 BLOCK-PT-02，新增 BLOCK-PT-03、共享 identity 契约和 PT-WM-00R2 固定任务卡。
- `e2e/permission-template-enforcement-test-spec.md` — 升级 v1.2.0，新增审核账本、REQ-PT-017、ORA-PT-13、T-PT-048–052、ADV-PT-010 与 00R2 执行顺序。

**决策**: 接受 T-PT-001 PASS；T-PT-002/004/046 判 NOT-RUN，T-PT-047 判 FAIL。11 个 targeted tests 仅为 supporting component evidence。只有 root/child 正向、精确负向零执行、active order、fault/concurrency/mutation 全部通过后，Reviewer 才能同时解除 BLOCK-PT-02/03。
