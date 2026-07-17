# 权限模板 Skill 读取硬门返工契约

**为什么**: T-PT-003 已证明读取认证返回值，但 T-PT-004 发现 active runtime 只 WARN/audit-only，无法保证 `verified:false` 后写工具零执行；弱模型安全交付声明不能关闭。

**改了什么**:
- `blueprints/blueprint-permission-template-driven-enforcement.md` — 升级 v1.2.0，新增 DB-canonical hard gate、reviewer 控制启动环境、bootstrap 例外与固定 `PT-WM-00R` Task Contract。
- `e2e/permission-template-enforcement-test-spec.md` — 升级 v1.1.0，新增 REQ-PT-015/016、ORA-PT-11/12、T-PT-039–047、ADV-PT-008/009 和 BLOCK-PT-02。

**决策**: 保留 T-PT-004 的零执行 oracle；否决降低式样书和全局 hard-block checklist。唯一返工路径是 active `skill-policy` 读取 SQLite 认证状态并以专用 rule fail-closed；旧失败证据只读保留。
