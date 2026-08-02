### Dispatch Assessment

第 3 轮复审：复审对象 = 修订后的 19 项清单（原 15 + 新增 4）。复审 agent 需独立验证：①19 项行号/分类准确性；②主会话对第 2 轮意见的采纳是否全部正确（含误采纳/漏采纳）；③是否还有更深层遗漏（如 deliver-guidance.ts 同模式、start-serve.ts:101 guard 安全性）。

**MODE：SUBAGENT（复审）**，路由 §3.7 判断 2 命中 → high-precision（model opus）。

复审 agent 结论：**需再修订（2 漏项 + 1 描述补强）**。主会话对关键新发现做最便宜独立抽查（hook 强制）：

6 项抽查全部与复审一致（M1/M2 漏项属实、M3 DB_PATH 漏项属实、M4 fail-open 逻辑成立、M5 bash 调用唯一、M6 guard 先于 /proc/version 安全）。

### Final Gate（主会话采纳第 3 轮复审）

**裁决：采纳全部修订，清单定稿为 21 项（19 + 2 漏项）**

| 复审意见 | 类型 | 主会话裁决 |
|---|---|---|
| 漏项 1：NEW-3 补 `live-question-recovery-e2e.ts:29` + `_b_l3_012_repo_op_deny.ts:35` | 采纳缺陷修复 | ✅ 采纳（M1/M2 独立确认属实） |
| 漏项 2：`deliver-guidance.ts:12` + `e2e-deliver-guidance.ts:11` 硬编码 DB_PATH（并入 #10 族） | 独立遗漏 | ✅ 采纳（M3 确认） |
| 描述补强：#2 补 "win32 ino 恒 0 → fail-open，rotation 后静默漏事件" | 非阻断 | ✅ 采纳（M4 确认：sse-watcher.ts:39 `st.ino !== this.ino` 恒 false + sse-daemon 用 renameSync rotation） |
| 其余 17 项引用 + 5 项采纳正确性 + C 组 4 项安全判定 | 核实无误 | ✅ 采纳 |

---

## 定稿清单（21 项 = 原 15 + NEW-1..4 + 第 3 轮 2 漏项）

### 第 1 类：必须 native Windows 实测
| # | 待实测 | 文件:行号 |
|---|---|---|
| 1 | URL pathname `/C:/` 前导斜杠 → root 推导错误 | `workspace-paths.ts:280`；`process.ts:18` |
| 2 | SSEWatcherFd `st.ino` NTFS（**补强：ino 恒 0 → fail-open，rotation 后静默漏事件**） | `lib/sse-watcher.ts:39,67` |
| 3 | **【最高风险】** SIGTERM/SIGKILL 全链路 | `process.ts:190,195`；`run-context.ts:403,523,526`；`port-reserver.ts:48` |
| NEW-2 | `/proc/` 多文件依赖 | `process.ts:232,233`；`verify-p02.ts:14,250,261`；`p02-sentinel.ts:141` |
| #11 | 【升类】XDG fallback `~/.local/state` 运行时写入错误 | `run-context.ts:53-55` |

### 第 2 类：静态 BLOCKING，需实测失败形态
| # | 待实测 | 文件:行号 |
|---|---|---|
| 4 | `spawn("tail")` | `sse-watcher.ts:95` |
| 6 | ss/lsof/pgrep bestEffort 吞错 | `start-serve.ts:266,271,283` |
| 7 | bash deliver-guidance.sh（唯一调用点） | `test-integration.ts:169` |
| 8 | curl 行为差异（含补点） | `process.ts:251,267`；`p02-orchestrator.ts:468` |
| NEW-1 | tar 命令依赖（4 处） | `run-context.ts:266,352,597,605` |
| NEW-3 | `/tmp/` 硬编码（8 处，含生产 daemon） | `sse-daemon.ts:13,14`；`tree-watcher.ts:66`；`test-integration.ts:14`；`test-hybrid-enforcement.ts:13`；`live-llm-privilege-e2e.ts:30`；`live-llm-dispatch-e2e.ts:32`；**`live-question-recovery-e2e.ts:29`**；**`_b_l3_012_repo_op_deny.ts:35`** |

### 第 3 类：环境/配置类
| # | 待实测 | 文件:行号 |
|---|---|---|
| 9 | work-one clone + win32 key 全链路 | `local-paths.example.json:7-9`；`workspace-paths.ts:96-132,288-362` |
| 10 | 4 IDE 配置 MCP 启动 | `.kimi-code/mcp.json`；`.codebuddy/settings.local.json`；`.qoder/settings.local.json` |
| **+2 漏项** | **DB_PATH 硬编码族（并入 #10）** | **`deliver-guidance.ts:12`；`e2e-deliver-guidance.ts:11`** |
| 13 | git-for-Windows worktree remove | `cleanup.ts:49` |
| NEW-4 | realpathSync.native() | `bootstrap.ts:315,317` |

### 第 4 类：测试类
| # | 待实测 | 文件:行号 |
|---|---|---|
| 14 | workspace-paths.test.ts 注入 win32（0 覆盖） | `workspace-paths.ts:72-77,161-163`；`__tests__/workspace-paths.test.ts` |
| 15 | bun.lock win32 optionalDependencies 安装 | `bun.lock:52,54,58`（覆盖完整，实测安装） |

---

### 三轮迭代轨迹
1. **第 1 轮**（GLM-5.2）：15 项基线，Top1 = #1 URL pathname
2. **第 2 轮**：+4 项遗漏（tar//proc//tmp 扩展/realpathSync.native）+ 4 修订；Top1 重排 = #3 SIGTERM
3. **第 3 轮**：+2 漏项（/tmp 2 处 + DB_PATH 2 处）+ #2 描述补强（fail-open）；其余 17 项引用 + 5 项采纳 + 4 项安全判定全部核实无误

### CHECK
- [TEST] PASS — 复审 40+ 命令独立验证 + 主会话 6 项抽查全一致
- [DOC] NOT-NEEDED — 只读审核
- [RISK] OPEN — 21 项待实测；Native Windows 仍 6/7 维度 BLOCKING

### FINAL
**清单定稿 21 项**，三轮 high-precision 复审迭代收敛（每轮均有实质发现，第 3 轮收敛至 2 漏项 + 1 描述补强，无结构性异议）。Native Windows 结论不变：无法直接运行；WSL 全 OK。本次仅审核，未改动任何文件。