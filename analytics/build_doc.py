#!/usr/bin/env python3
"""Render AMPLITUDE_EVENTS.md from the parsed call-site data."""
import json, collections, re

import os
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
rows = json.load(open(os.path.join(HERE, 'events.json')))

# Group by app -> event
apps = collections.defaultdict(lambda: collections.defaultdict(list))
for r in rows:
    ev = r['event'].replace("\\'", "'")
    apps[r['app']][ev].append(r)

# Categorise by leading verb / domain so the doc is navigable
def bucket(ev):
    e = ev.lower()
    rules = [
        ('Onboarding & signup', r'onboard|signup|signin|continue with|otc|magic|phone|welcome|'
                                r'connect email|redirected|landing|first name|email verified|'
                                r'pick a sport|sports? selected|turn padel|recap|banned'),
        ('Level & quiz',        r'level|quiz|skill|\brole\b|score social'),
        ('Availabilities & alerts', r'availabilit|alert|slot|radius'),
        ('Location & permissions', r'location|city|geoloc|my location|select area|'
                                r'refused .*access|library access|expand location'),
        ('Games — discovery',   r'game list|open map|filter|search|centre|explore|selection|'
                                r'suggested games|display .*games|failure to display|skipped game|'
                                r'stop watching|watch'),
        ('Games — joining',     r'join|wants to play|spot|reserve|confirm|waiver|interested|'
                                r'needs to pay directly'),
        ('Games — organizing',  r'create|publish|repeater|weekly|field (not )?booked|draft|invite|team|'
                                r'chose (date|visibility)|select (date|type|location)|'
                                r'format selected|visibility selected|repeat selected|'
                                r'make game (private|public)|add first players|cancel|'
                                r'remove (me|player)|game left|game canceled|wants to (cancel|remove|leave)|'
                                r'suggested players|display players'),
        ('Games — in-game',     r'chat|message|reaction|emoji|itinerary|share game|roster|'
                                r'copy game link|call user|text user'),
        ('Post-game',           r'feedback|rate|vote|thumbs|report|no.?show|played|past games'),
        ('Payments & Gold',     r'gold|payment|paid|price|subscri|purchase|stripe'),
        ('Social & friends',    r'friend|profile|follow|block|connect|contact|share invitation'),
        ('Notifications',       r'notif|push|banner|remote'),
        ('App lifecycle',       r'update (poteau|forced|needed)|open in app|open the app|'
                                r'download the app|poteau website|\bhome\b'),
        ('Settings & account',  r'setting|account|delete|logout|language|skin|photo|edit'),
    ]
    for name, pat in rules:
        if re.search(pat, e):
            return name
    return 'Other'

def esc(s):
    return s.replace('|', '\\|')

out = []
W = out.append

W("# Poteau — Amplitude event taxonomy")
W("")
W("Generated from the codebase on **28 July 2026** by parsing every `trackAmplitude()` call")
W("site in `poteau-app` and `poteau-max` (V5).")
W("")
W("**What this is:** every event the apps *can* fire, with its properties and where it fires from.")
W("**What this is not:** proof any of them still arrive. A codebase event that Amplitude has")
W("not seen in 90 days is dead code; only Amplitude can tell you which. See *Reconciling with")
W("live data* at the bottom — that column is deliberately left blank until someone fills it")
W("from the Amplitude MCP.")
W("")

total_sites = len(rows)
total_events = sum(len(v) for v in apps.values())
risky_events = sorted({r['event'].replace("\\'","'") for r in rows if r['risky']})
W(f"| | |")
W(f"|---|---|")
W(f"| Call sites | {total_sites} |")
W(f"| Distinct events | {total_events} ({len(apps['poteau-app'])} app · {len(apps['poteau-max'])} max) |")
W(f"| Events with delimiter-unsafe properties | **{len(risky_events)}** |")
W("")
W("---")
W("")

# ---- the bug section, first, because it invalidates data ----
W("## ⚠️ Read this before trusting any property value")
W("")
W("`amplitudeProperties()` (`poteau-app/lib/flutter_flow/custom_functions.dart`) builds the")
W("property map by splitting a flat string:")
W("")
W("```dart")
W("List<String> pairs = str.split(',');      // value containing ',' -> split in half")
W("List<String> keyValue = pair.split(':');  // value containing ':' -> truncated at kv[1]")
W("```")
W("")
W("So any value containing a comma or a colon is **silently corrupted**. Keys usually survive;")
W("values get truncated. Verified simulations of real payloads:")
W("")
W("| Passed in | Arrives in Amplitude |")
W("|---|---|")
W("| `game_date:2026-07-28T19:30:00.000` | `game_date = \"2026-07-28T19\"` — hour resolution, minutes gone |")
W("| `location:LatLng(48.8566, 2.3522)` | `location = \"LatLng(48.8566\"` — longitude gone |")
W("| `user_name:Dupont, Jean` | `user_name = \"Dupont\"` — everything after the comma gone |")
W("")
W("This is why the data *looks* fine in Amplitude — the properties are present and plausible,")
W("just wrong. **Never draw a conclusion from a timestamp, coordinate, address or display-name")
W("property without checking it against Firestore first.**")
W("")
W("A warning comment already exists at `poteau-app/lib/components/own_profile/played/played_widget.dart:99`,")
W("where someone hit this and worked around it by passing counts only.")
W("")
W("**Fix (not yet applied):** pass a JSON string and `jsonDecode` it, or use a delimiter pair that")
W("cannot occur in values. Any fix must keep the old parser working for events already in flight,")
W("or historical comparisons break.")
W("")
W(f"Affected events ({len(risky_events)}): see the ⚠️ marker in the tables below.")
W("")
W("---")
W("")

for app in ('poteau-app', 'poteau-max'):
    events = apps[app]
    if not events:
        continue
    W(f"## {app}")
    W("")
    W(f"{len(events)} distinct events across {sum(len(v) for v in events.values())} call sites.")
    W("")
    groups = collections.defaultdict(list)
    for ev, sites in events.items():
        groups[bucket(ev)].append((ev, sites))
    order = ['Onboarding & signup','Level & quiz','Location & permissions',
         'Availabilities & alerts','Games — discovery','Games — joining',
         'Games — organizing','Games — in-game','Post-game','Payments & Gold',
         'Social & friends','Notifications','App lifecycle','Settings & account','Other']
    for g in order:
        if g not in groups:
            continue
        W(f"### {g}")
        W("")
        W("| Event | Properties | Fires from | ⚠️ |")
        W("|---|---|---|---|")
        for ev, sites in sorted(groups[g]):
            props = []
            for s in sites:
                for p in s['props']:
                    if p not in props:
                        props.append(p)
            risky = sorted({p for s in sites for p in s['risky']})
            locs = sorted({s['file'].split('/lib/')[-1] for s in sites})
            loc = locs[0] if len(locs) == 1 else f"{locs[0]} +{len(locs)-1}"
            n = len(sites)
            loc = f"{loc}" + (f" ({n}×)" if n > 1 else "")
            pstr = ', '.join(f"`{p}`" for p in props) if props else '—'
            mark = '⚠️ ' + ', '.join(f"`{p}`" for p in risky) if risky else ''
            W(f"| **{esc(ev)}** | {esc(pstr)} | `{esc(loc)}` | {esc(mark)} |")
        W("")
    W("---")
    W("")

W("## Reconciling with live data")
W("")
W("This doc is the **fire-able** set. To find the **live** set, query Amplitude for events seen")
W("in the last 90 days and diff:")
W("")
W("- **In code, not in Amplitude** → dead path, feature removed, or the event never fires because")
W("  its UI is unreachable. Candidate for deletion.")
W("- **In Amplitude, not in code** → fired by an older app version still in the wild, or by")
W("  `poteau-max`/Cloud Functions. Do not delete server-side dashboards based on this doc alone.")
W("- **In both** → live. Trust the event name; distrust any property flagged ⚠️ above.")
W("")
W("Fill the result into a `Last seen` column here, and this becomes the single source of truth.")
W("")
W("### Regenerating")
W("")
W("```bash")
W("python3 scripts/analytics/extract_amplitude_events.py   # rewrites this file")
W("```")
W("")
W("Re-run after any FlutterFlow export, since exports add and remove call sites wholesale.")
W("")

open(os.path.join(REPO,'AMPLITUDE_EVENTS.md'),'w').write('\n'.join(out))
print("wrote AMPLITUDE_EVENTS.md")
print("lines:", len(out))
print("risky events:", len(risky_events))
