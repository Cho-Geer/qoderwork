# execFile
execFile是 Node.js 内置模块 child_process​ 中的一个函数。
---
## 📦 它来自哪里？
```plaintext
import { execFile } from "child_process";
// 或 CommonJS
const { execFile } = require("child_process");
```
📘 官方文档：
https://nodejs.org/api/child_process.html#child_processexecfilefile-args-options-callback
---
## 🧠 它是什么？
execFile用来 直接执行一个可执行文件（命令），而不会启动系统的 shell。
> ✅ 这是它和 exec最核心的区别。
---
## 🔑 主要作用
安全地执行外部命令 / 子进程
比如：
- 执行 ls
- 执行 git
- 执行你自己的脚本
- 执行系统工具（如 ffmpeg, python, docker）
---
## 🆚 exec vs execFile（重点）
|对比项|exec|execFile|
|-|-|-|
|是否启动 shell|✅ 是|❌ 否|
|是否解析 `;|&& >`|✅ 会|
|是否容易注入|❌ 非常容易|✅ 非常安全|
|参数传递方式|字符串拼接|参数数组|
|推荐程度|❌ 不推荐|✅ 强烈推荐|

            对比项
            exec
            execFile
            是否启动 shell
            ✅ 是
            ❌ 否
            是否解析 `;
            && >`
            ✅ 会
            是否容易注入
            ❌ 非常容易
            ✅ 非常安全
            参数传递方式
            字符串拼接
            参数数组
            推荐程度
            ❌ 不推荐
            ✅ 强烈推荐
---
## ✅ execFile 基本用法
```plaintext
import { execFile } from "child_process";

execFile("ls", ["-l", "/tmp"], (error, stdout, stderr) => {
  if (error) {
    console.error("执行失败:", error);
    return;
  }
  console.log(stdout);
});
```
### 参数说明
```plaintext
execFile(command, [args], options, callback)
```
|参数|说明|
|-|-|
|command|要执行的命令（必须是可执行文件路径或命令名）|
|args|参数数组（不会当成 shell 语法解析）|
|callback|执行完成后的回调|

            参数
            说明
            command
            要执行的命令（必须是可执行文件路径或命令名）
            args
            参数数组（不会当成 shell 语法解析）
            callback
            执行完成后的回调
---
## 🔐 为什么 execFile 更安全？
### ❌ 危险的 exec
```plaintext
exec(`ls ${userInput}`);
// userInput = ".; rm -rf /"
// shell 会执行两条命令！
```
### ✅ 安全的 execFile
```plaintext
execFile("ls", [userInput]);
// userInput = ".; rm -rf /"
// 只是一个普通参数，不会被 shell 解析
```
👉 shell 根本没启动，注入无从谈起
---
## ⚠️ 什么时候不能用 execFile？
|场景|原因|
|-|-|
|需要 shell 特性|如通配符 *.js、管道 `|
|需要环境变量展开|$PATH|
|需要链式命令|cmd1 && cmd2|

            场景
            原因
            需要 shell 特性
            如通配符 *.js、管道 `
            需要环境变量展开
            $PATH
            需要链式命令
            cmd1 && cmd2
👉 这类情况才考虑 exec，但一定要极度谨慎
---
## ✅ 实战推荐组合（最佳实践）
```plaintext
import { execFile } from "child_process";

const ALLOWED = ["ls", "pwd", "date"];

function safeRun(cmd: string, args: string[]) {
  if (!ALLOWED.includes(cmd)) {
    throw new Error("非法命令");
  }

  return execFile(cmd, args);
}
```
---
## 🧩 常见误区
❌ “我用 execFile 就不用校验参数了”​
→ 错！参数仍可能影响程序行为（路径穿越、逻辑漏洞）
✅ 正确姿势：
- 白名单命令
- 校验参数格式
- 最小权限运行 Node 进程
---
## ✅ 一句话总结
> execFile是 Node.js 中用于“不通过 shell、直接执行命令”的安全接口，是防止命令注入的首选方案。
---
如果你愿意，我可以再帮你：
- ✅ 写一个 exec / execFile / spawn 对比表
- ✅ 用 TypeScript 封装一个安全执行工具
- ✅ 讲清楚 spawn 和 execFile 的区别
你现在是在写 CLI 工具、后端服务，还是 Electron 应用？我可以按场景给你最合适的使用方案。