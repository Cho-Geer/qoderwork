import json, os
files = [
    ('Explore',  'model-io-sess_subagent_agent_48b62015-93f6-4f6e-94d7-8aa39a3df032.jsonl'),
    ('general-purpose', 'model-io-sess_subagent_agent_7528539b-6310-4c21-b9a5-8cf4b18d1d57.jsonl'),
    ('high-precision', 'model-io-sess_subagent_agent_d5f00e23-1a48-4964-838e-c3ed27889220.jsonl'),
]
for label, fn in files:
    candidates = [
        fn,
        'C:/Users/USER/.zcode/cli/rollout/' + fn,
        os.path.expanduser('~/.zcode/cli/rollout/') + fn,
    ]
    fp = None
    for c in candidates:
        try:
            if c and os.path.isfile(c):
                fp = c; break
        except TypeError:
            continue
    print('===', label, '(' + fn + ')', '===')
    print('  picked path:', fp, '| exists:', os.path.isfile(fp) if fp else False)
    if not fp or not os.path.isfile(fp):
        print('  SKIP: no accessible path'); continue
    with open(fp, 'r', encoding='utf-8') as fh:
        lines = fh.readlines()
    print('  total lines:', len(lines))
    if not lines: continue
    first = json.loads(lines[0])
    print('  first line keys (top 30):', list(first.keys())[:30])
    # Print model/engine fields in first line
    for k, v in first.items():
        kl = k.lower()
        if any(t in kl for t in ('model','engine','provider','inference','sampler')):
            s = repr(v)
            if len(s) > 220: s = s[:220] + '...'
            print('    ' + k + ' = ' + s)
    # Scan ALL lines for model/engine/provider fields
    found = {}
    for ln in lines:
        try: d = json.loads(ln)
        except: continue
        for k, v in d.items():
            kl = k.lower()
            if any(t in kl for t in ('model','engine','provider','sampler')) and not isinstance(v,(list,dict,bool)):
                if k not in found:
                    found[k] = v
    print('  all-line model/engine/provider fields:', found)