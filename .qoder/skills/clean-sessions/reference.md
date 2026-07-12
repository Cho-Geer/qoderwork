# clean-sessions — 参考脚本

可直接运行的 `clean-sessions.py`（仅依赖 Python 标准库，无需 pip）。封装两层清理、异步等待、备份、dry-run。

> 经验：driver / 脚本必须**在 WSL 内运行**（`python3 script.py`），勿经 Windows Git-Bash 裸跑——否则文件系统上下文错配会静默失败（本会话 L1-001 早前踩过的坑）。

## 用法
```bash
# 只清层 A（原生 session）
python3 clean-sessions.py --prefix ses_0abd9

# 两层都清（层 B 需给 DB 路径）
python3 clean-sessions.py --prefix ses_0abd9 --db /path/to/framework-state.db

# 先演练，不真删
python3 clean-sessions.py --prefix ses_0abd9 --dry-run

# 自定义端口 / 等待时长
python3 clean-sessions.py --prefix ses_0abd9 --port 4096 --wait 4
```

## clean-sessions.py
```python
#!/usr/bin/env python3
"""
clean-sessions.py — 清理 opencode serve 残留 session（层A 原生 + 层B session_map）
用法:
  python3 clean-sessions.py --prefix ses_0abd9
  python3 clean-sessions.py --prefix ses_0abd9 --db /path/framework-state.db
  python3 clean-sessions.py --prefix ses_0abd9 --dry-run
依赖: 仅标准库 (urllib, sqlite3, argparse, shutil)
"""
import argparse, json, os, shutil, sqlite3, sys, time, urllib.request

PORT_DEFAULT = 4096
BASE = f"http://127.0.0.1:{PORT_DEFAULT}"


def api(method, path, timeout=30):
    req = urllib.request.Request(f"{BASE}{path}", method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read().decode("utf-8", "replace")
            return r.status, (body if body else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:  # 网络/连接错误
        return None, str(e)


def list_sessions():
    st, body = api("GET", "/session")
    if st != 200 or not body:
        raise RuntimeError(f"GET /session 失败: status={st} body={body}")
    return json.loads(body)


def delete_session(sid):
    st, _ = api("DELETE", f"/session/{sid}")
    return st  # 200 = 已提交（异步生效，列表约 3s 后反映）


def main():
    ap = argparse.ArgumentParser(description="清理 opencode serve 残留 session")
    ap.add_argument("--prefix", required=True, help="session id 前缀过滤器, e.g. ses_0abd9")
    ap.add_argument("--port", type=int, default=PORT_DEFAULT)
    ap.add_argument("--db", default=None, help="framework-state.db 路径(层B); 不传则只清层A")
    ap.add_argument("--dry-run", action="store_true", help="只打印将删项, 不执行")
    ap.add_argument("--wait", type=float, default=4.0, help="DELETE 后等待异步生效秒数")
    ap.add_argument("--max-rounds", type=int, default=3, help="层A 最多删除轮数")
    args = ap.parse_args()

    global BASE
    BASE = f"http://127.0.0.1:{args.port}"

    # 预检: serve 可达
    st, _ = api("GET", "/session/status")
    if st != 200:
        print(f"[PREFLIGHT] serve 不可达 (status={st}); 退出", file=sys.stderr)
        sys.exit(2)

    # ---- 层 A: 原生 session ----
    sessions = list_sessions()
    targets = [s["id"] for s in sessions if s["id"].startswith(args.prefix)]
    print(f"[A] 匹配 '{args.prefix}': {len(targets)} 个 (总 session {len(sessions)})")

    if not targets:
        print("[A] 无可删项")
    elif args.dry_run:
        print("[DRY-RUN] 将删除(层A):")
        for t in targets:
            print("  ", t)
    else:
        for rnd in range(1, args.max_rounds + 1):
            for sid in targets:
                code = delete_session(sid)
                print(f"  DELETE {sid} -> {code}")
            time.sleep(args.wait)  # 关键: 等异步生效
            remain = [s["id"] for s in list_sessions() if s["id"].startswith(args.prefix)]
            print(f"[A] round {rnd}: 剩余 {len(remain)}")
            targets = remain
            if not targets:
                break
        print(f"[A] 层A 完成: 剩余 {len(targets)}")

    # ---- 层 B: framework-state.db session_map ----
    if not args.db:
        print("[B] 未传 --db, 跳过层B")
    elif not os.path.exists(args.db):
        print(f"[B] DB 不存在: {args.db}", file=sys.stderr)
    elif args.dry_run:
        try:
            con = sqlite3.connect(args.db)
            n = con.execute(
                "SELECT count(*) FROM session_map WHERE session_id LIKE ?",
                (args.prefix + "%",),
            ).fetchone()[0]
            con.close()
            print(f"[DRY-RUN] 将删除(层B session_map): {n} 行 (前缀 {args.prefix}%)")
        except Exception as e:
            print(f"[B] 查询失败: {e}", file=sys.stderr)
    else:
        bak = f"{args.db}.bak-{args.prefix}-{time.strftime('%Y%m%dT%H%M%S')}"
        shutil.copy2(args.db, bak)
        print(f"[B] 备份 -> {bak}")
        con = sqlite3.connect(args.db)
        before = con.execute(
            "SELECT count(*) FROM session_map WHERE session_id LIKE ?",
            (args.prefix + "%",),
        ).fetchone()[0]
        con.execute(
            "DELETE FROM session_map WHERE session_id LIKE ?",
            (args.prefix + "%",),
        )
        con.commit()
        after = con.execute(
            "SELECT count(*) FROM session_map WHERE session_id LIKE ?",
            (args.prefix + "%",),
        ).fetchone()[0]
        con.close()
        print(f"[B] session_map: {before} -> {after} (已删 {before - after})")

    print("[DONE] 备份保留供回滚; 未修改任何框架代码。")


if __name__ == "__main__":
    main()
```

## 实测验证记录（本会话 2026-07-12）
- 清理 24 个 `ses_0abd9*`：层 A `DELETE` 24 个 → 等 3s 复测 `GET /session` 计数 **24→0**（总 94→63，连带清掉派生子 session）。
- 层 B：`session_map` 中 24 条 `ses_0abd9*` 孤儿行，`DELETE ... LIKE 'ses_0abd9%'` → **24→0**（删前备份 `framework-state.db.bak-abd9-<ts>`）。
- 关键确认：`DELETE` 异步、serve 重启不清 session、`abort` 不移除——均已闭环验证。
