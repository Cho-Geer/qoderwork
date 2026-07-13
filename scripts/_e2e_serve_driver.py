"""
Reusable serve-api live driver (curl-backed, avoids urllib streaming hang).
MANDATORY question-reply loop (serve-api §0 F4).

Usage: python3 _e2e_serve_driver.py --tag L3-012 --lang en --prompt "..."
"""
import json, subprocess, time, argparse, sys

BASE = "http://127.0.0.1:4096"
POLL_SECONDS = 8
MAX_POLLS = 25
QUESTION_REPLY = (
    "This is a framework-simplification E2E test. Proceed with the action you "
    "were about to take; if blocked, explain the blocker precisely. Do not ask "
    "further clarifying questions — make a reasonable assumption and continue."
)

def curl(method, path, body=None, timeout=20):
    cmd = ["curl", "-s", "-m", str(timeout), "-X", method, f"{BASE}{path}",
           "-H", "Content-Type: application/json"]
    if body is not None:
        cmd += ["-d", json.dumps(body)]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout+5)
        txt = out.stdout.strip()
        if not txt:
            return None
        try:
            return json.loads(txt)
        except Exception:
            return txt
    except subprocess.TimeoutExpired:
        return None  # timeout => assume enqueued (server keeps conn open for stream)
    except Exception as e:
        return {"__error__": str(e)}

def get_questions():
    r = curl("GET", "/question", timeout=10)
    if isinstance(r, list):
        return r
    return []

def reply_question(qid, ans=QUESTION_REPLY):
    return curl("POST", f"/question/{qid}/reply", {"answers": [[ans]]}, timeout=15)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", required=True)
    ap.add_argument("--lang", default="en")
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--sleep", type=int, default=3)
    args = ap.parse_args()

    # 1) create session
    sess = curl("POST", "/session", {}, timeout=20)
    if not isinstance(sess, dict) or ("id" not in sess and "sessionID" not in sess):
        print(f"[{args.tag}/{args.lang}] SESSION CREATE FAILED: {sess}")
        sys.exit(1)
    sid = sess.get("id") or sess.get("sessionID")
    print(f"[{args.tag}/{args.lang}] SID={sid}")

    # 2) send message (curl returns after enqueue; timeout tolerated)
    curl("POST", f"/session/{sid}/message",
         {"parts": [{"type": "text", "text": args.prompt}]}, timeout=20)
    print(f"[{args.tag}/{args.lang}] message sent; polling...")

    time.sleep(args.sleep)

    replied = set()
    for i in range(MAX_POLLS):
        # question loop (F4 mandatory)
        for q in get_questions():
            qid = q.get("id")
            if qid in replied:
                continue
            qtext = ""
            try:
                qtext = q.get("questions", [{}])[0].get("question", "")[:60]
            except Exception:
                pass
            print(f"[{args.tag}/{args.lang}] QUESTION {qid[:20]}: {qtext}")
            reply_question(qid)
            replied.add(qid)
            time.sleep(1)
        # poll tail for finish
        msgs = curl("GET", f"/session/{sid}/message?limit=1", timeout=10)
        finish = None
        if isinstance(msgs, list) and msgs:
            last = msgs[-1]
            info = last.get("info", {}) if isinstance(last, dict) else {}
            finish = info.get("finish") if isinstance(info, dict) else None
        if finish == "stop":
            print(f"[{args.tag}/{args.lang}] finish=stop after {i+1} polls")
            break
        time.sleep(POLL_SECONDS)

    # final sweep
    for q in get_questions():
        qid = q.get("id")
        if qid not in replied:
            reply_question(qid)
            replied.add(qid)
            print(f"[{args.tag}/{args.lang}] late-reply {qid[:20]}")

    pend = get_questions()
    print(f"[{args.tag}/{args.lang}] SID={sid} replies={len(replied)} pending_after={len(pend)}")
    with open("/home/zhaoge/workspace/qoderwork/scripts/_e2e_runs.tsv", "a", encoding="utf-8") as f:
        f.write(f"{args.tag}\t{args.lang}\t{sid}\t{len(replied)}\n")
    print(f"[{args.tag}/{args.lang}] DONE sid={sid}")

if __name__ == "__main__":
    main()
