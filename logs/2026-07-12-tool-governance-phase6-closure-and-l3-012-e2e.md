# tool-governance Phase 6 收口与 L3-012 E2E 文档

**为什么**: 用户要求确认 `safe_shell` 卡在错误阻断层是否与治理蓝图相关，并把未实装部分改成弱模型也能安全执行的固定步骤，同时补一份完整单 case 端到端测试文档。

**改了什么**:
- `blueprints/blueprint-tool-governance-mvc-refactor.md` — 升级到 v2.5.0，明确“蓝图未闭环完成”，新增 Phase 6 强制实施顺序：共享 `safe_shell` 解析模块、`codegraph` defer repo/gh、before 顺序重排、统一测试闭环。
- `e2e/L3-012-safe-shell-gh-remote-write-e2e.md` — 新建单 case live E2E 文档，固定 `Orchestrator`、固定 `gh issue create --repo ...` 输入、固定 question reply、固定证据目录、固定 PASS/FAIL 分类。

**决策**: 不再把缺口描述成“只差 live E2E”，而是显式定义为运行态治理收口未完成；验收主 case 固定为 `L3-012`，直接验证 `safe_shell gh` 远程写是否由 `repo-policy` 首裁决。
