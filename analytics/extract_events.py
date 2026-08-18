#!/usr/bin/env python3
"""Extract the Amplitude event taxonomy from trackAmplitude() call sites."""
import re, os, json, collections

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ROOTS = {
    'poteau-app': os.path.join(REPO, 'poteau-app', 'lib'),
    'poteau-max': os.path.join(REPO, 'poteau-max', 'lib'),
}
SKIP = ('track_amplitude.dart', 'actions/index.dart')

CALL = re.compile(r'trackAmplitude\s*\(', re.S)

def split_args(s, start):
    """From the char after '(', return (args_list, end_idx) respecting nesting/strings."""
    depth, i, cur, args = 1, start, [], []
    quote = None
    while i < len(s):
        c = s[i]
        if quote:
            if c == '\\':
                cur.append(s[i:i+2]); i += 2; continue
            if c == quote:
                quote = None
            cur.append(c)
        else:
            if c in "'\"":
                quote = c; cur.append(c)
            elif c in '([{':
                depth += 1; cur.append(c)
            elif c in ')]}':
                depth -= 1
                if depth == 0:
                    args.append(''.join(cur))
                    return args, i
                cur.append(c)
            elif c == ',' and depth == 1:
                args.append(''.join(cur)); cur = []
            else:
                cur.append(c)
        i += 1
    return args, i

def event_name(arg):
    """Extract literal event name(s); ternaries yield multiple."""
    lits = re.findall(r"'((?:[^'\\]|\\.)*)'", arg)
    lits = [l for l in lits if l and not l.startswith('$')]
    if not lits:
        return ['<DYNAMIC>'], arg.strip()[:90]
    if len(lits) > 1 and '?' in arg:
        return lits, None
    return [lits[0]], None

def props_from(arg):
    """Pull property keys out of an amplitudeProperties('a:${x},b:${y}') payload."""
    if 'amplitudeProperties' not in arg:
        return (None if arg.strip() in ('null', '') else ['<RAW>'])
    body = ''.join(re.findall(r"'((?:[^'\\]|\\.)*)'", arg))
    if not body:
        return ['<DYNAMIC>']
    keys, risky = [], []
    # keys look like  name:${...}  or  name:literal  at a comma boundary
    for m in re.finditer(r'(?:^|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:', body):
        keys.append(m.group(1))
    # flag interpolations known to embed ',' or ':' -> corrupts the naive parser
    for m in re.finditer(r'([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*\$\{([^}]*)\}', body):
        k, expr = m.group(1), m.group(2)
        if re.search(r'(Location|latLng|LatLng|dateToIso|toIso8601|\.date|Date\b|time_?zone|address|Address|displayName|\.name\b)', expr):
            risky.append(k)
    return keys, risky

rows = []
for app, root in ROOTS.items():
    for dirpath, _, files in os.walk(root):
        for fn in files:
            if not fn.endswith('.dart'):
                continue
            path = os.path.join(dirpath, fn)
            if any(sk in path for sk in SKIP):
                continue
            src = open(path, encoding='utf-8', errors='replace').read()
            if 'trackAmplitude' not in src:
                continue
            for m in CALL.finditer(src):
                args, _ = split_args(src, m.end())
                if len(args) < 2:
                    continue
                names, dyn = event_name(args[1])
                pr = props_from(args[2]) if len(args) > 2 else None
                keys, risky = (pr if isinstance(pr, tuple) else (pr, []))
                line = src[:m.start()].count('\n') + 1
                rel = os.path.relpath(path, REPO)
                has_user_props = len(args) > 3 and args[3].strip() not in ('null', '')
                for nm in names:
                    rows.append(dict(app=app, event=nm, file=rel, line=line,
                                     props=keys or [], risky=risky or [],
                                     dynamic=dyn, user_props=has_user_props))

print(f"call sites parsed: {len(rows)}")
by_event = collections.defaultdict(list)
for r in rows:
    by_event[(r['app'], r['event'])].append(r)
print(f"distinct (app, event): {len(by_event)}")
print(f"dynamic-name sites: {sum(1 for r in rows if r['event']=='<DYNAMIC>')}")
risky_events = {k for k, v in by_event.items() if any(x['risky'] for x in v)}
print(f"events with delimiter-unsafe props: {len(risky_events)}")
json.dump(rows, open(os.path.join(os.path.dirname(__file__),'events.json'),'w'), indent=1)
print("\n--- top 30 events by call-site count ---")
for (app, ev), v in sorted(by_event.items(), key=lambda kv: -len(kv[1]))[:30]:
    print(f"{len(v):3}  {app:11} {ev}")
