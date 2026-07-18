# 根目录 Bun / TypeScript 工具链
**ID**: ROOT-TOOLCHAIN-20260718
**原因**: `.agents` Skill 脚本不属于 `scripts/tsconfig.json`，编辑器无法共享 `bun-types` 配置。
**变更**: 根目录新增 `package.json`、`tsconfig.json`、`bun.lock`；依赖统一为 `bun-types` 与 `typescript`。
**范围**: tsconfig 仅包含 `scripts/**/*.ts` 与 `.agents/skills/*/scripts/**/*.ts`；排除 `.opencode` 与三份客户端镜像。
**清理**: 移除 `scripts/package.json`、`scripts/tsconfig.json`、`scripts/bun.lock`；旧 `scripts/node_modules` 已移入系统回收站，可恢复。
**指引**: `AGENTS.md` 已改为根目录 `bun run typecheck`；根 `node_modules/` 已加入 ignore。
**Verified-by**: 根依赖安装后，test-serve 三文件回归 44 pass / 0 fail / 83 expect()。
**Verified-by**: Skill validator 3 pass / 0 fail / 8 expect()；Skill 脚本显式 typecheck PASS。
**已知债务**: 全量 typecheck 仍只命中既有 work-one `.opencode/service/**` 与 `scripts/_b_l3_012_repo_op_deny.ts`。
**未更新**: `documents/INDEX.md`；本次未修改 `documents/` 条目。
