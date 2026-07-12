[Bug] WSL 工作区项目级 .workbuddy/skills/ 未注册

复现：WSL 挂载工作区的 .workbuddy/skills/<name>/SKILL.md 已放置且合法；重启进程后调用 Skill skill=<name>。

预期：项目级技能应被注册，手动挂载应立即可用。

实际：Skill 报"Can not find skill"，重启无效。同技能放用户级 C:\Users\<user>\.workbuddy\skills\ 则可注册。手动挂载仅提示、不重扫，新建task无效。

建议：修复 WSL 项目级技能扫描；挂载时重扫或懒加载。

版本：设置→关于 填。
