# OpenCode Worktree 活用机制官方全解析
## 核心结论
**OpenCode 官方原生没有内置专属的 worktree 管理工具，但与 Git Worktree 天然深度兼容**。原生设计以「当前工作目录（CWD）」为会话边界，运行在 worktree 目录中时会自动识别仓库状态，实现文件系统级的会话隔离；更自动化的 worktree 创建、销毁、生命周期管理能力，由社区插件基于 Plugin Hook 体系扩展实现，完美契合你提出的「原生 Agent + Skill + Hook」架构范式。

Worktree 是 OpenCode 实现多 Agent 并行开发、多分支隔离、环境互不干扰的核心底层手段，配合 Skill 定义流程、Hook 做生命周期管控，可完整覆盖复杂项目的多任务并行研发全流程。

---

## 一、原生底层机制：天然兼容 Git Worktree
### 1.1 原生兼容原理
OpenCode 是终端原生的 AI 编码工具，**以当前启动目录作为唯一工作区边界**，本身不感知也不绑定具体分支，只读取当前目录下的文件与 Git 状态。Git Worktree 本质是同一仓库的多个独立工作目录，因此天然适配：
- 在任意 worktree 目录中启动 `opencode`，Agent 只会操作该 worktree 内的文件，对应绑定的分支完全独立
- 不同 worktree 中的 OpenCode 会话上下文、已加载 Skill、文件修改完全隔离，互不污染
- 所有 worktree 共享同一份 Git 对象库，分支提交、合并等操作与原生 Git 完全一致

原生启动方式极为简单：
```bash
# 1. 创建 worktree
git worktree add ../project-feat-auth -b feat/auth main

# 2. 进入 worktree 启动 OpenCode
cd ../project-feat-auth
opencode
```
> 该模式下，每个 worktree 对应一个独立的 OpenCode 终端会话，Agent 行为与主仓库完全一致，无需任何额外配置。

### 1.2 源码层面的原生适配
OpenCode 源码中已内置对 Git Worktree 的边界识别能力，核心体现在目录遍历逻辑中：
- Skill 发现、文件扫描等向上遍历操作，会以 **Git Worktree 根目录** 为停止边界（`Instance.worktree`）
- 不会跨 worktree 扫描文件、加载 Skill，保证每个 worktree 的配置与能力集独立
- 主仓库与子 worktree 可拥有各自的 `.opencode/` 配置、Skill 集、插件，互不影响

这也是为什么 OpenCode 不需要专门做 worktree 适配——它的目录设计从一开始就遵循 Git 的工作区边界规则。

---

## 二、插件增强：自动化 Worktree 全生命周期管理
原生模式需要手动执行 Git 命令、手动启动会话，社区主流的 `opencode-worktree` 插件基于 Plugin Hook 体系，将 worktree 操作封装为 Agent 可直接调用的工具，实现全流程自动化。这也是官方推荐的扩展方式，无需修改内核。

### 2.1 核心工具能力
插件向 Agent 注入两个原生工具，可被主 Agent / 子 Agent 直接调用：

| 工具 | 作用 | 核心参数 |
|---|---|---|
| `worktree_create` | 创建新的 worktree 并自动启动 OpenCode 会话 | `branch` 分支名、`baseBranch` 基准分支（默认 HEAD） |
| `worktree_delete` | 清理 worktree，自动提交快照、释放分支 | `reason` 删除原因 |

#### 创建流程（调用 `worktree_create` 后自动执行）
1. 在统一目录（默认 `~/.local/share/opencode/worktree/<项目ID>/<分支名>`）创建 Git worktree
2. 按配置同步项目级配置文件（`.opencode/`、环境变量等）
3. 执行后置钩子（如自动安装依赖 `pnpm install`、启动开发服务）
4. 自动检测终端，弹出新终端窗口并在该 worktree 中启动 OpenCode

#### 删除流程（调用 `worktree_delete` 后自动执行）
1. 执行前置钩子（如停止 Docker 服务、清理临时文件）
2. 自动提交所有未提交变更为快照提交，防止代码丢失
3. 强制移除 worktree 目录，清理 Git 引用
4. 同步清理对应会话的状态缓存

### 2.2 支持的终端与平台
插件自动适配主流终端，新会话自动弹出：
- macOS：Ghostty、iTerm、Terminal.app、WezTerm、Kitty、Alacritty
- Linux：tmux、WezTerm、Kitty、Alacritty
- 支持自定义启动命令，可替换为 `code`、`cursor` 等其他工具

### 2.3 命令行快捷指令（`owt`）
插件同时提供 CLI 快捷命令，方便用户手动操作：
```bash
owt                  # 列出所有 worktree 及状态
owt status           # 查看所有 worktree 的 Git 状态
owt diff <分支名>    # 查看指定 worktree 与基准分支的差异
owt merge <分支名>   # 将指定 worktree 分支合并回当前分支
owt commit <分支名> -m "msg"  # 不切换目录，直接提交对应 worktree 的变更
```
所有操作都内置脏状态防护，防止未提交变更导致的冲突与丢失。

---

## 三、结合 Skill + Hook + 原生 Agent 的活用方案
Worktree 的真正价值，是与你提出的「原生 Agent + Skill + Hook」架构结合，构建出**物理隔离 + 能力管控 + 流程标准化**的多任务并行研发体系。

### 3.1 典型架构分层
| 层级 | 角色 | 与 Worktree 的配合 |
|---|---|---|
| 执行层 | 原生 Agent（Plan/Build/General/Explore） | 每个 worktree 中运行独立 Agent 会话，上下文完全隔离（注：`Scout` 在 OpenCode v2 已废弃，外部调研改用 `explore`） |
| 能力层 | Skill | 每个 worktree 可加载对应任务的专属 Skill 集，如功能开发 Skill、Hotfix 修复 Skill |
| 管控层 | Plugin Hook | 管控 worktree 生命周期，统一注入配置、规范、审计逻辑 |

### 3.2 四大核心落地场景
#### 场景一：多任务并行开发，互不阻塞
**痛点**：主分支正在开发大版本，中途需要紧急修复线上 Bug，反复 stash/切换分支打断思路。
**方案**：
1. 主 worktree 运行 Build Agent，负责主版本迭代，加载全量开发 Skill
2. 通过 `worktree_create` 快速创建 hotfix 分支 worktree，自动启动独立 OpenCode 会话
3. Hotfix worktree 只加载故障排查、紧急修复相关 Skill，权限收紧，最小可用原则
4. 修复完成后通过 Hook 自动校验、合并回主分支，清理 worktree

全程主 worktree 的开发状态、上下文、运行中的服务完全不受影响。

#### 场景二：多 Agent 并行协作，物理隔离防冲突
**痛点**：多个子 Agent 同时修改代码容易出现文件覆盖、依赖冲突，上下文互相干扰。
**方案**：
1. 主 Agent 拆解任务后，通过 Hook 封装 `worktree_create`，为每个子任务创建独立 worktree
2. 每个 worktree 中启动 General 子 Agent，加载对应模块的开发 Skill，并行推进
3. 所有子任务完成后，主 Agent 在主 worktree 中统一执行合并、冲突解决、集成测试
4. 通过 `session.deleted` Hook 自动清理用完的 worktree，避免资源残留

相比原生子 Agent 共享同一工作目录，worktree 方案从文件系统层面杜绝了并行修改的冲突风险。

#### 场景三：代码评审与验证，环境独立
**痛点**：评审同事的 PR 时，切换分支会破坏本地开发环境，依赖重装、服务重启成本高。
**方案**：
1. Explore Agent 调用 `worktree_create`，基于远程 PR 分支创建临时 worktree
2. 自动执行依赖安装、服务启动、测试运行，全程不影响主工作区
3. 加载代码评审 Skill，按规范完成审查、输出评审报告
4. 评审结束后一键删除 worktree，环境零残留

#### 场景四：A/B 方案对比与回归
**痛点**：验证两个版本的性能、功能差异，反复切换分支效率极低。
**方案**：
1. 同时创建两个 worktree，分别对应 v1 和 v2 分支
2. 各自启动独立的 OpenCode 会话，加载测试与性能分析 Skill
3. 两个环境并行运行，可同时启动服务、执行压测，直接对比结果
4. 对比完成后可按需保留或清理

### 3.3 Hook 层的典型管控能力
通过 Plugin Hook 可以为所有 worktree 统一施加治理规则，无需每个 worktree 单独配置：
1. **`config` Hook**：创建 worktree 时自动注入团队统一的 `opencode.json`、Skill 集、权限规则，保证所有 worktree 的规范一致
2. **`tool.execute.before` Hook**：拦截 `worktree_create` 调用，强制校验分支命名规范、基准分支权限，防止随意创建
3. **`tool.execute.after` Hook**：worktree 创建后自动注入企业级 Skill、合规说明、内部工具配置
4. **`session.deleted` Hook**：会话销毁时自动检测并清理闲置 worktree，记录审计日志
5. **`permission.*` Hook**：不同类型的 worktree（开发/Hotfix/测试）动态授予不同的 Skill 与工具权限

---

## 四、原生边界与最佳实践
### 4.1 原生能力边界
- 官方内核**没有内置** `worktree` 相关的原生工具与命令，所有自动化管理均为插件扩展实现
- 不支持在单个 OpenCode 会话内直接操作其他 worktree 的文件，必须通过 Git 命令或插件工具
- 子 Agent 默认共享当前工作目录，不会自动创建 worktree 隔离，需要插件 + Skill 配合实现

### 4.2 落地最佳实践
1. **主 worktree 做基线，子 worktree 做任务**：主目录始终保持 main/develop 分支干净状态，所有功能开发、Bug 修复都在新建 worktree 中进行，完成即合并清理。
2. **Skill 按任务类型分配**：不同用途的 worktree 加载不同 Skill 集，避免无关能力占用上下文，同时遵循最小权限原则。
3. **Hook 统一治理**：所有规范、校验、审计逻辑放在全局 Hook 中，所有新建 worktree 自动生效，保证团队标准一致。
4. **用完即清理**：临时评审、测试类 worktree 用完立即删除，避免大量闲置 worktree 占用磁盘与管理成本。
5. **依赖共享优化**：对于 Node.js 等项目，可通过 pnpm 全局存储、软链接等方式优化多 worktree 的依赖安装，避免重复下载。

### 4.3 注意事项
- 同一分支不能同时在两个 worktree 中检出，创建时会自动报错拦截
- worktree 共享同一份 Git 对象库，提交操作会实时反映到整个仓库，删除 worktree 不会删除已提交的分支
- 大仓库建议将 worktree 放在同一块 SSD 上，避免 IO 性能瓶颈

---

## 五、与整体架构的呼应
回到你最核心的判断：**原生 Agent + Skill + Hook 完全足以支撑复杂项目全流程**，Worktree 正是这套架构在「物理隔离与并行化」层面的关键补充。
- 原生 Agent 提供标准化执行能力
- Skill 注入领域知识与流程规范
- Hook 做全局治理与横切扩展
- Worktree 提供文件系统级的隔离底座

四者正交组合，无需自定义 Agent，即可构建出多分支、多任务、多 Agent 并行的企业级研发工作流，这也是 OpenCode 插件化架构的设计精髓。

**官方与权威信息源**：
- 插件官方文档：https://open-code.ai/zh/docs/plugins
- Worktree 社区插件：https://www.npmjs.com/package/opencode-worktree-plugin
- Git Worktree 原生机制：https://git-scm.com/docs/git-worktree
- OpenCode 工作区机制参考：`packages/opencode/src/instance/state.ts`