# AI 测试式样书与执行 Skills

**为什么**: 将“不要过度 mock、用独立 oracle、覆盖负向/故障/并发/安全路径”的讨论固化为两个可复用 workflow，避免 AI 只靠单元测试绿灯宣称正确。

**改了什么**:
- `.agents/skills/requirements-to-test-specification/` — 从需求生成可追溯测试式样书，强制原子需求、独立 oracle、风险矩阵、对抗性 charter 与覆盖 gate。
- `.agents/skills/test-specification-execution/` — 按式样书执行分层与对抗性验证，强制真实证据、状态语义、故障/变异/性质测试和 E2E 边界。

**决策**: 将测试设计和执行拆成两个 Skill；前者不能产出 PASS，后者不能把 unit/component 证据提升为 E2E。Mock 只允许放在不可控系统边界，内部业务协作优先真实实现或 contract-tested fake。
