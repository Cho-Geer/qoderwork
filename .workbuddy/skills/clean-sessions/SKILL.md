---
name: clean-sessions
description: "清理 opencode serve 的残留 session（原生持久化 store + framework-state.db 的 session_map），避免污染后续测试 run。重点处理 session 持久化带来的清理陷阱：DELETE 异步生效(~3s)、serve 重启不清 session、abort 只改 status 不移除、两层模型(原生 store + session_map)。Trigger: clean sessions, 清理 session, 清理残留, delete session, purge sessions, session 清理, 残留 session, ses_* 清理, 清空 session. Not for: session 创建/监控/干预(用 serve-api)、框架运行时 .ts 修改."
---

# clean-sessions

## Language / 语言

Follow the user's language: reply in Chinese for Chinese requests and English for English requests. Provide both only when requested; preserve code, commands, paths, API names, identifiers, and quoted source text exactly.

清理 opencode serve 的残留 session，保证下次测试 run 从干净基线开始。

> **本技能与 `serve-api` 的关系**：`serve-api` 负责 session 创建 / 监控 / `abort` / 干预，但**从未记载 `DELETE /session/{sid}` 端点，也没有批量清理流程**。本技能是 serve-api 的「清理补丁」——在 run 之间把残留 session 清空。两者都不修改框架代码。
>
> **步骤类型区分**：Pre-flight 和定位 DB 路径是 `[ANALYSIS]`；`DELETE /session`、SQLite 删除、等待异步生效、复测计数归零是 `[VERIFICATION]`。
> **Verified-by 要求**：每次 `[VERIFICATION]` 后都要记录 `Verified-by: <命令> -> <HTTP code / 剩余计数 / SQLite count / 备份路径>`。
> **合理化检测**：如果你发现自己在想「DELETE 返回 200 了，所以肯定已经清干净」--停下来，这是跳步信号。必须等待并复测剩余计数。
> **认知说明**：源码分析和路径定位只能回答“要删哪里”；运行态验证才能回答“是否真的删干净了”。两者不能互相替代。

## 0. 何时使用
- 测试 run 后残留大量 `ses_*` session 污染下次 run
- 需批量删除特定前缀/模式的 session（如 `ses_0abd9*`）
- 框架层 `framework-state.db` 的 `session_map` 表有孤儿记录需同步清理

## 1. 关键事实：session 持久化如何影响清理（必读）
> serve-api 只讲生命周期创建/abort，完全没提 DELETE。下面 5 条是清理时最容易踩的坑，全部来自本会话实测。

1. **原生 session 存于持久化 store，非纯内存**：serve 重启**不会**清除 session。实测 48 个 stale session 跨多次 serve 重启仍在。→ 清理只能靠 `DELETE`，**不能靠重启**。
2. **`DELETE /session/{sid}` 是异步的**：单次删除返回 `200`，但 `GET /session` 列表约 **3 秒后**才反映移除。早前曾误判「DELETE 无效」正是因此。→ 必须**循环删除全部 + 等待 + 复测计数归零**，不能删一个立刻断言消失。
3. **`abort` ≠ 清理**：`POST /session/{SID}/abort` 只改 `status`（working→idle/error），**不**从 `GET /session` 列表移除。abort 是止损，不是清理。
4. **两层模型**（清理通常两层都要做，否则 `session_map` 孤儿行会误导 guidance/enforcement）：
   - **层 A**：opencode 原生 session（持久化 store）→ 用 `DELETE /session/{sid}` 移除。
   - **层 B**：框架层 `framework-state.db` 的 `session_map` 表（orphan 行）→ 用 SQLite `DELETE` 移除（**删前必须备份 DB**）。
   - 两者独立；层 A 删除后层 B 不一定自动清空。
5. **serve-api 未记载 DELETE**：serve-api 的清理节（reference.md A.0/A.14/B.7）只写「清理旧进程和临时文件」+ `abort` + generic `echo Cleanup complete`，**无 `DELETE /session`、无批量清理流程**。本技能补上。

## 2. Pre-flight（每次清理前必做） `[ANALYSIS]`
- [ ] serve 可达：`curl -s http://localhost:4096/session/status` 返回就绪。
- [ ] 明确**删除过滤器**：只删匹配显式前缀/模式的 session（如 `ses_0abd9*`）。**绝不**无过滤全删。
- [ ] 列出待删 session 并计数：`GET /session` 拿到完整列表，本地按前缀过滤。
- [ ] 若涉及层 B：先 `cp framework-state.db framework-state.db.bak-<ts>` 备份。
- [ ] 推荐先 `--dry-run` 打印将删项，确认无误再执行。

## 3. 执行流程 `[VERIFICATION]`

### 层 A：原生 session（DELETE，异步生效）
```bash
PORT=4096
PREFIX="ses_0abd9"   # 删除过滤器（显式前缀）
# 1. 取全部 session，过滤目标
SID_LIST=$(curl -s "http://localhost:${PORT}/session" | python3 -c "import sys,json; print('\n'.join(s['id'] for s in json.load(sys.stdin) if s['id'].startswith('$PREFIX')))")
echo "待删: $(echo "$SID_LIST" | grep -c .) 个"
# 2. 循环 DELETE（每个返回 200 即已提交，但异步）
for SID in $SID_LIST; do
  curl -s -o /dev/null -w "%{http_code} $SID\n" -X DELETE "http://localhost:${PORT}/session/$SID"
done
# 3. 关键：等待异步生效（~3s），再复测
sleep 4
REMAIN=$(curl -s "http://localhost:${PORT}/session" | python3 -c "import sys,json; print(sum(1 for s in json.load(sys.stdin) if s['id'].startswith('$PREFIX')))")
echo "剩余: $REMAIN"
# 4. 若 REMAIN>0，再循环删一轮 + 等；通常 1~2 轮归零
```
**Pitfall**：删完立刻 `GET /session` 可能仍显示 → 误以为失败。等 3~4s 再查。

### 层 B：framework-state.db 的 session_map（SQLite，删前备份）
```bash
DB="<path-to-framework-state.db>"   # 定位见 §5
PREFIX="ses_0abd9"
TS=$(date -u +%Y-%m-%dT%H-%M-%S-%3NZ)
cp "$DB" "${DB}.bak-${PREFIX}-${TS}"
# 先查再删
sqlite3 "$DB" "SELECT count(*) FROM session_map WHERE session_id LIKE '${PREFIX}%';"
sqlite3 "$DB" "DELETE FROM session_map WHERE session_id LIKE '${PREFIX}%';"
sqlite3 "$DB" "SELECT count(*) FROM session_map WHERE session_id LIKE '${PREFIX}%';"  # 应 = 0
```
**Pitfall**：serve 活跃持库，SQLite 并发删除安全（已 COMMIT）；但务必先备份。其他表（session_registry / session_events）通常无该前缀孤儿，删前先 `SELECT` 确认。WSL 内用 `python3`/`sqlite3` 直连；Windows 侧直连 UNC 路径常失败，走 WSL。

## 4. 复测与收尾 `[VERIFICATION]`
- [ ] 层 A：`GET /session` 中目标前缀计数 = 0。
- [ ] 层 B：`session_map` 中目标前缀计数 = 0。
- [ ] 备份文件保留（如 `framework-state.db.bak-ses_0abd9-<ts>`），不立即删，供回滚。
- [ ] **不要修改任何框架运行时 `.ts` 代码**——本技能只做数据层清理。
- `Verified-by: curl GET /session -> 目标前缀剩余计数 0`
- `Verified-by: sqlite3 framework-state.db 'SELECT count(*) ...' -> 0`
- `Verified-by: 备份文件路径 framework-state.db.bak-<prefix>-<ts>`

## 5. framework-state.db 定位
- 框架状态库为 SQLite，文件名 `framework-state.db`。
- 定位：`find <workspace> -name 'framework-state.db' 2>/dev/null`（通常在 opencode / work-one 的 state 目录下）。
- 若在 WSL：用 `python3`（stdlib `sqlite3`）或 `sqlite3` 直连。

## 6. 参考脚本
完整可复用脚本见 [reference.md](./reference.md)（`clean-sessions.py`：支持 `--prefix/--db/--dry-run/--port/--wait`，自动备份 + 异步等待 + 复测 + 两层清理）。

## 7. 与 serve-api 的边界
| 能力 | serve-api | clean-sessions |
|------|-----------|----------------|
| 创建 session | ✅ `POST /session` | ❌ |
| 监控/轮询 | ✅ SSE + `GET /message` | ❌ |
| `abort` 止损 | ✅ `POST /abort` | ❌（只说明它≠清理） |
| `DELETE` 批量清理 | ❌ 未记载 | ✅ |
| `session_map` 孤儿清理 | ❌ | ✅（带备份） |
| 修改框架代码 | ❌ | ❌ |
