# P0-2 Plan Set 再审计

- 按最新版 deterministic plan skill 将 6 张历史卡迁移为 `PLAN_SET`：index、8 个单结果 Phase 和 final verification。
- 当前实测：`oracle + verify-p01b + verify-p02` 为 44/0/83；P0-2 coordinator、CLI、runtime test 均不存在。
- 当前 `verifyP02` 仍为布尔 oracle 路径；Phase 01–02 固定改为三态与当前生命周期证据。
- P0-2 runtime 维持 `NOT-RUN`；reviewer ports 只阻断 runtime Phase。
- 根 typecheck 当前 exit 1；只阻断 regression closure，不将范围外债务写成 PASS。
- 更新文档：P0-2 原 6 卡被 8 个 `NN-phase-*` 文件替代，新增 `00-plan-index.md` 与 `99-final-verification.md`。
