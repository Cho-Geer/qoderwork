# 路径动态化 M1 PLAN_SET

- 原因：将经审计的路径动态化蓝图收敛为弱模型可执行的受限首批计划。
- 变更：新增 `plans/path-dynamic-resolution-m1/`，覆盖冻结清单、解析器、test-serve 消费点和后续交接四个阶段。
- 决策：1,758 处扫描不授权批量替换；未列入 M1 的脚本与 IDE 配置必须经 successor PLAN_SET 和 human scope lock。
- 证据：PLAN_SET 验证器 exit 0；现有 bootstrap isolation 测试 2/2 PASS（component）。
- 文档：更新 `documents/INDEX.md`；待本文件完成后同步 `logs/INDEX.md`。
