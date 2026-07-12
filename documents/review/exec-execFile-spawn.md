# exec/ execFile/ spawn对比表
这是一张从原理到实战的 exec/ execFile/ spawn对比表，也是 Node.js 子进程模块的核心知识。
---
## 🆚 exec / execFile / spawn 核心对比表
|维度|exec​|execFile​|spawn​|
|-|-|-|-|
|所属模块​|child_process|child_process|child_process|
|是否启动 shell​|✅ 是​ (/bin/sh)|❌ 否​|❌ 否​|
|安全风险​|⚠️ 高（极易注入）|✅ 低​|✅ 低​|
|命令传参方式​|字符串（拼接）|数组​|数组​|
|输出处理方式​|一次性缓存​|一次性缓存​|流式（Stream）​|
|适合输出大小​|❌ 小输出（< 1MB）|❌ 小输出（< 1MB）|✅ 大输出 / 持续输出​|
|实时输出​|❌ 不支持|❌ 不支持|✅ 支持​|
|内存占用​|较高（缓存全部输出）|较高|低（边读边处理）|
|API 风格​|回调|回调|事件 / Stream|
|Promise 支持​|✅ promisify|✅ promisify|✅ spawn + async iterator|
|默认返回​|stdout, stderr|stdout, stderr|stdout, stderr流|
|复杂度​|⭐ 简单|⭐⭐ 简单|⭐⭐⭐ 稍复杂|

            维度
            exec​
            execFile​
            spawn​
            所属模块​
            child_process
            child_process
            child_process
            是否启动 shell​
            ✅ 是​ (/bin/sh)
            ❌ 否​
            ❌ 否​
            安全风险​
            ⚠️ 高（极易注入）
            ✅ 低​
            ✅ 低​
            命令传参方式​
            字符串（拼接）
            数组​
            数组​
            输出处理方式​
            一次性缓存​
            一次性缓存​
            流式（Stream）​
            适合输出大小​
            ❌ 小输出（< 1MB）
            ❌ 小输出（< 1MB）
            ✅ 大输出 / 持续输出​
            实时输出​
            ❌ 不支持
            ❌ 不支持
            ✅ 支持​
            内存占用​
            较高（缓存全部输出）
            较高
            低（边读边处理）
            API 风格​
            回调
            回调
            事件 / Stream
            Promise 支持​
            ✅ promisify
            ✅ promisify
            ✅ spawn + async iterator
            默认返回​
            stdout, stderr
            stdout, stderr
            stdout, stderr流
            复杂度​
            ⭐ 简单
            ⭐⭐ 简单
            ⭐⭐⭐ 稍复杂
---
## 📌 代码示例对比
### 1️⃣ exec（不推荐，除非必须）
```plaintext
import { exec } from "child_process";

exec("ls -l /tmp", (err, stdout, stderr) => {
  console.log(stdout);
});
```
🚨 危险点：
```plaintext
exec(`ls ${userInput}`); // 用户可注入 ; rm -rf /
```
---
### 2️⃣ execFile（✅ 推荐用于短命令）
```plaintext
import { execFile } from "child_process";

execFile("ls", ["-l", "/tmp"], (err, stdout, stderr) => {
  console.log(stdout);
});
```
✅ 安全原因：
- 不启动 shell
- 参数不会被解析为命令
---
### 3️⃣ spawn（✅ 推荐用于长任务 / 大数据）
```plaintext
import { spawn } from "child_process";

const ls = spawn("ls", ["-l", "/tmp"]);

ls.stdout.on("data", (chunk) => {
  process.stdout.write(chunk); // 实时输出
});

ls.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
});

ls.on("close", (code) => {
  console.log(`exit code: ${code}`);
});
```
✅ 优势：
- 不会卡死大输出
- 适合日志、视频处理、构建工具
---
## 🎯 使用场景速查表
|场景|推荐|
|-|-|
|执行简单系统命令|✅ execFile|
|用户输入参与命令|✅ 必须用 execFile / spawn​|
|需要 shell 特性（&&, >）|⚠️ exec（慎用）|
|实时日志 / 长时间运行|✅ spawn|
|大文件 / 大量输出|✅ spawn|
|CLI 工具开发|✅ spawn|
|快速脚本 / 原型|execFile|
|安全敏感环境|❌ 禁止 exec|

            场景
            推荐
            执行简单系统命令
            ✅ execFile
            用户输入参与命令
            ✅ 必须用 execFile / spawn​
            需要 shell 特性（&&, >）
            ⚠️ exec（慎用）
            实时日志 / 长时间运行
            ✅ spawn
            大文件 / 大量输出
            ✅ spawn
            CLI 工具开发
            ✅ spawn
            快速脚本 / 原型
            execFile
            安全敏感环境
            ❌ 禁止 exec
---
## ⚠️ 常见误区
### ❌ “execFile 一定比 spawn 简单”
→ 对，但 不适合长任务
### ❌ “spawn 太复杂，我用 exec 就行”
→ 一旦输出超过 ~1MB，exec 会直接失败
### ❌ “用了 execFile 就不需要校验参数”
→ 错，路径穿越、逻辑漏洞仍然存在
---
## ✅ 一句话选择指南
> **能用 execFile就用 execFile，要实时输出或大流量用 spawn，除非你明确需要 shell，否则永远不要用 exec。**
---
## 🧠 进阶提示（很重要）
### Promise 写法（现代 Node.js）
```plaintext
import { promisify } from "util";
import { execFile } from "child_process";

const run = promisify(execFile);
await run("ls", ["-l"]);
```
### spawn + async/await（Node 18+）
```plaintext
for await (const chunk of spawn("ls", ["-l"]).stdout) {
  process.stdout.write(chunk);
}
```
---