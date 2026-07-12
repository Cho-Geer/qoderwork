# 清理 qoderwork 本地 `.task_temp` 并盘点脚本引用

**为什么**: qoderwork 根目录下的 `.task_temp` 只是本地残留，不是 watcher 与主联调链路的核心运行目录；需要删除残留并把 repo 内脚本对 `.task_temp` 的依赖边界整理清楚。

**改了什么**:
- `.task_temp/` — 删除本地残留目录（历史 `_logs/` + `test-write.txt`）。
- `temporary-audits/task-temp-script-inventory.md` — 新增脚本清单，区分相对 ROOT 的 `.task_temp` 与明确读取 `work-one/.task_temp` 的脚本。

**决策**: 不改脚本行为，只做残留清理和引用盘点；主 watcher / E2E 链路继续以 `work-one/.task_temp` 为权威运行态目录。
