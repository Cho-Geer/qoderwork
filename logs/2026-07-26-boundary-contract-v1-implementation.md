# boundary-contract/v1 实施

- 新增 requirements contract 的路径/哈希 Plan 入口校验，以及历史入口的固定 SHA-256 豁免注册表。
- 新增边界预检矩阵：验证 `R-*` / `DC-*`、fixture、oracle、观察结果、禁止副作用和 case 唯一证据绑定；仅输出 `READY_FOR_LLM_REVIEW` 或 `BLOCKED`。
- 审计合同可绑定矩阵哈希；v1 要求完整矩阵、逐 case evidence binding 和 `MODEL_REVIEW`，机械失败不可由模型豁免。
- `finalize-audit.ts` 在原子写入 hash-bound `LATEST.md` 前强制重跑 `validate-audit.ts`；验证失败或已有指针均拒绝签署。
- 清除预检脚本的旧不可达分支；矩阵改为记录实际证据哈希，并阻断 case 越界、观察值/fixture/oracle/禁止副作用不匹配。
- 更新 AGENTS 与两个相关 skill 的职责边界和 PLAN_SET 模板字段。
- 已验证相关 Plan/audit 组件测试；全量 typecheck 仍保留既有 `_b1_live.ts` TS2307 基线，未宣称全绿。
