# Node.js `exec` / `execFile` / `spawn` 安全对照

本文是 work-one 子进程执行层的强制选型规则。安全结论只在 `shell: false`、可执行文件固定或受白名单约束、参数逐项校验、工作目录受控、环境变量最小化时成立。

## 固定结论

| API | 是否启动 shell | 参数形式 | 输出模型 | work-one 规则 |
|---|---|---|---|---|
| `exec` / `execSync` | 是 | 单个命令字符串 | 全量缓冲 | 禁止用于 `safe_shell` 和任何含外部输入的路径 |
| `execFile` | 默认否 | `file` + `args[]` | 全量缓冲 | 仅用于有界短输出命令 |
| `spawn` | 默认否 | `file` + `args[]` | 流式 | 用于长任务、大输出或需要实时消费输出的命令 |

不得设置 `shell: true`。一旦启用 shell，`execFile` 和 `spawn` 会重新暴露 shell 注入面。

## 固定路由规则

1. 将请求解析为单个可执行文件和参数数组。
2. 校验可执行文件白名单、每个参数、`cwd`、目标路径和环境变量。
3. 出现 `;`、`&&`、`||`、管道、重定向、命令替换、后台执行、通配符展开或环境变量展开需求时，拒绝请求；改用一等工具或仓库内已审核脚本。
4. 输出上限明确且结果较小时使用异步 `execFile`。
5. 输出可能较大、持续运行或需要实时消费时使用 `spawn`，并逐块计数，超过上限立即终止子进程。

## 共同安全约束

- 禁止把用户或模型输入拼接进命令字符串。
- 禁止依赖 `PATH` 解析不受控程序；生产路径使用固定绝对路径或经过校验的可执行文件映射。
- 固定 `cwd`，并在执行前对路径做规范化、边界检查和符号链接检查。
- 使用最小环境变量集合，删除可改变加载行为的变量，例如 `NODE_OPTIONS`、`BASH_ENV`、`LD_PRELOAD`。
- 必须设置超时、输出字节上限和 `AbortSignal`；超限、超时或取消后终止整个子进程树。
- stderr 不等于失败；以退出码、信号和调用契约共同判断结果。
- 日志记录规则 ID、可执行文件、脱敏参数、退出码、信号、耗时和截断状态；不得记录密钥和完整敏感参数。
- `execFile`/`spawn` 只能消除 shell 解析，不会消除参数注入、选项注入、路径穿越、恶意配置或被执行程序自身的漏洞。

## 安全示例

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const runFile = promisify(execFile);
const result = await runFile("/usr/bin/git", ["status", "--short"], {
  cwd: verifiedRepoRoot,
  env: minimalEnv,
  encoding: "utf8",
  timeout: 30_000,
  maxBuffer: 1 * 1024 * 1024,
  signal,
  shell: false,
});
```

参数若可能以 `-` 开头，必须按目标程序语义使用 `--` 终止选项，或拒绝该参数；不能假设参数数组会自动阻止选项注入。
