import json, urllib.request

BASE = "http://127.0.0.1:4096"

def get(path):
    return urllib.request.urlopen(BASE + path, timeout=10).read().decode()

sessions = json.loads(get("/session"))
print("Found %d sessions:" % len(sessions))
for s in sessions:
    sid = s["id"]
    print("  %s  title=%s agent=%s" % (sid, s.get("title"), s.get("agent")))
    # abort each (idle abort is a no-op; working abort frees resources)
    req = urllib.request.Request(BASE + "/session/" + sid + "/abort", method="POST")
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        print("    abort -> HTTP %d" % resp.status)
    except Exception as e:
        print("    abort -> ERR %s" % e)
print("DONE")
