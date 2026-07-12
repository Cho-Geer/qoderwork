# hook-commit-msg.ts 漏 import isInfrastructureFile 修复

**为什么**: IDE 对 `.opencode/hooks/lib/hook-commit-msg.ts` 和 `hook-layers.ts` 报红。用临时 tsconfig（bundler + strict:false，与项目一致）跑 tsc 定位到两处真实错误：line 288 / 306 调用了 `isInfrastructureFile()` 但从未 import。`hook-layers.ts` 本身 0 错误。进一步发现：该 hook 文件根本不在 `tsconfig.json` 的 `include` 里，所以项目级 `bun tsc --noEmit` 从来没检查过它们，错误一直潜伏。

**改了什么**:
- `.opencode/hooks/lib/hook-commit-msg.ts` — 顶部 `./hook-critical-files` import 增加 3 个 symbol（`isInfrastructureFile` 修 bug；`getStagedChangedFiles` / `hasMixedBusinessAndInfra` 提前到顶部，消除原本"先用后 import"的别扭写法）；删除 line 202–205 的中间重复 import 块
- `tsconfig.json` — `include` 增加 `.opencode/hooks/**/*.ts`，让项目级 tsc 覆盖 hook 脚本，避免同类错误再次潜伏

**决策**: 仅做最小修复（补 import + 合并 import 块 + 扩展 tsconfig），不动业务逻辑。被否决的方案：把 `isInfrastructureFile` 改成 `isInfraFile` 之类的别名——收益不大且会破坏 `hook-critical-files.ts` 的 re-export 契约，故不做。
