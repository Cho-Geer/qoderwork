# bootstrap child/grant 实施状态复审

**为什么**: 根据当前 `scripts/test-serve` 源码、组件测试和 runtime smoke 式样书，重新裁决实施方案各节状态，避免将组件 PASS 扩大为 runtime 完成。

**改了什么**:
- `plans/隔离 serve 测试基建待办/01-bootstrap-child-grant-fail-closed实施步骤.md` — 所有 section title 增加状态；更新 checklist、当前测试数量和 fixture 替代实现。
- 同一文档 §9 — 标记 cleanup 契约仍为 PARTIAL，并修正会误报测试 teardown 的 run-root 扫描范围。

**决策**: TSI-04 主体维持组件完成（37/37 PASS）；cleanup evidence 显式契约、确定性集成与 runtime smoke 保持开放，runtime 不得执行或标记 PASS。
