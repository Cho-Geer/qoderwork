# 弱模型硬约束设计前提补充

**为什么**: 用户说明当前框架复杂度源于 DeepSeek v4 flash 等弱遵从模型在实际使用中不读 Skill、不按要求执行、写错文件和写错代码，需要避免重构误读为取消硬约束。

**改了什么**:
- `blueprints/blueprint-opencode-framework-simplification-roadmap.md` — 升级为 v1.1.1，新增弱模型不遵从的设计动因、非目标、风险对照表和约束保留红线

**决策**: 轻量化不是退回 prompt 自觉遵守，而是把硬约束收敛到机器可验证、高风险、不可逆的节点；流程建议可 advisory，安全边界和可验证事实不能 advisory。
