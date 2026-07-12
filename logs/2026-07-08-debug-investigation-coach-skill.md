# Debug Investigation Coach Skill

**为什么**: 用户希望创建一个面向小白的调查教练 skill，不要求用户预先判断问题类别，能自动带用户通过分诊、日志、断点、根因收敛、修复验证，并在最后生成可复习的诊断文档。

**改了什么**:
- `.qoder/skills/debug-investigation-coach/SKILL.md` — 新增六阶段调查流程、自动阶段选择规则、日志/断点观察规则、框架问题分层排查规则。
- `.qoder/skills/debug-investigation-coach/references/*.md` — 新增新手分诊、观察手册、诊断总结模板。
- `.qoder/skills/debug-investigation-coach/.skill-metadata.yaml` — 新增中英文示例 prompt，便于 QoderWork 技能展示和调用。

**决策**: `.agents/skills` 在当前沙箱内只读，无法直接写入；先将完整技能源文件放入可写的 `.qoder/skills`，保留与现有 QoderWork skill 源目录一致的结构。
