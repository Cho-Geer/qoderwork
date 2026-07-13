# `execFile` 安全使用规范

`execFile(file, args, options, callback)` 默认直接启动可执行文件，不经过 shell。它是 work-one 有界短输出命令的执行接口，不是完整安全边界。

## 强制调用契约

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const { stdout, stderr } = await execFileAsync(verifiedExecutable, verifiedArgs, {
  cwd: verifiedCwd,
  env: minimalEnv,
  encoding: "utf8",
  timeout: 30_000,
  maxBuffer: 1 * 1024 * 1024,
  signal,
  shell: false,
  windowsHide: true,
});
```

调用前必须全部满足：

1. `verifiedExecutable` 来自固定映射或严格白名单，不直接接受任意路径或命令名。
2. `verifiedArgs` 由语义解析器生成，每一项按对应命令的参数 schema 校验，禁止字符串拼接。
3. `verifiedCwd` 已规范化并确认位于允许根目录内；涉及文件时完成符号链接边界检查。
4. `minimalEnv` 只包含执行所需变量，不继承可能改变解释器或模块加载行为的危险变量。
5. `timeout`、`maxBuffer`、`signal` 均已设置；调用方能区分超时、取消、信号退出、非零退出和输出超限。
6. `shell` 显式为 `false`，任何代码路径都不得覆盖为 `true`。

## 必须拒绝的输入

- 需要 `;`、`&&`、`||`、`|`、`>`、`<`、反引号、`$()`、后台执行或 shell 展开的请求。
- 未知可执行文件、未知子命令、未知选项或无法解析的复合命令。
- 可能把输入解释为选项但又无法安全使用 `--` 的参数。
- 超出允许工作目录的路径、未通过符号链接检查的路径、设备文件和特殊文件。
- 包含密钥但日志层无法可靠脱敏的参数。

复合工作流必须改用一等工具或仓库内已审核脚本。不得通过 `/bin/sh -c`、`bash -c` 或 `shell: true` 绕过限制。

## 错误与输出处理

- `execFile` 会缓冲 stdout/stderr；输出不可证明有界时改用 `spawn`。
- 非零退出时保留退出码、信号、已捕获 stdout/stderr 和截断标志，但对模型返回前必须脱敏。
- stderr 有内容不自动代表失败，退出码为零也不自动代表业务成功；调用方按命令契约判定。
- 超时、取消或输出超限必须终止子进程及其后代，不能只停止等待回调。

## 安全边界

参数数组避免了 shell 对元字符的二次解释，但被执行程序仍会解析参数。`--config`、`--output`、`-C`、响应文件、插件加载参数和以 `-` 开头的值都可能改变程序行为，必须逐命令建模和校验。
