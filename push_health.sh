#!/bin/bash
# Push pipeline health, from Cloud Monitoring metrics rather than log queries.
#
# WHY NOT LOGS. Every log-based detector built on 2026-08-26 produced false
# alarms at production volume: "109 never sent" (all three checked were
# published), "FCM=0, consumer dead" (2,000 invocations were running), "654
# never sent" at one window and 0 at another on the same healthy system. Root
# cause was always the same -- gcloud logging read truncates, caps, and fails
# transiently at ~600k documents a day, and an incomplete answer is
# indistinguishable from a complete one.
#
# Cloud Monitoring aggregates server-side. No row caps, no truncation, and a
# failed call is an HTTP error rather than a plausible-looking zero.
#
# Usage: push_health.sh [minutes]   default 10
set -uo pipefail
M="${1:-10}"
TOKEN=$(gcloud auth print-access-token 2>/dev/null) || { echo "AUTH FAILED"; exit 1; }
END=$(date -u +%Y-%m-%dT%H:%M:%SZ)
START=$(date -u -v-${M}M +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "-${M} minutes" +%Y-%m-%dT%H:%M:%SZ)

series() { # $1 = metric filter
  curl -s --max-time 60 -H "Authorization: Bearer $TOKEN" \
    "https://monitoring.googleapis.com/v3/projects/krank-club/timeSeries?filter=$1&interval.startTime=$START&interval.endTime=$END&aggregation.alignmentPeriod=$((M*60))s&aggregation.perSeriesAligner=ALIGN_SUM"
}

G2=$(series "metric.type%3D%22run.googleapis.com%2Frequest_count%22%20AND%20resource.labels.service_name%3D%22translatepluspush%22")
CONS=$(series "metric.type%3D%22cloudfunctions.googleapis.com%2Ffunction%2Fexecution_count%22%20AND%20resource.labels.function_name%3D%22sendPushNotification%22")
GEN1=$(series "metric.type%3D%22cloudfunctions.googleapis.com%2Ffunction%2Fexecution_count%22%20AND%20resource.labels.function_name%3D%22translateAndSendPush%22")

printf '%s' "$G2"   > /tmp/ph_g2.json
printf '%s' "$CONS" > /tmp/ph_cons.json
printf '%s' "$GEN1" > /tmp/ph_gen1.json

python3 - "$M" <<'PY'
import json,sys
m=sys.argv[1]
def tally(path,key):
    try:
        d=json.load(open(path))
    except Exception:
        return None
    if 'error' in d: return None
    out={}
    for s in d.get('timeSeries',[]):
        k=s['metric']['labels'].get(key,'?')
        for pt in s.get('points',[]):
            out[k]=out.get(k,0)+int(pt['value']['int64Value'])
    return out
g2=tally('/tmp/ph_g2.json','response_code_class')
cons=tally('/tmp/ph_cons.json','status')
gen1=tally('/tmp/ph_gen1.json','status')

print(f"=== push health, last {m}m (Cloud Monitoring) ===")
if g2 is None: print("  producer   : UNKNOWN - metrics call failed")
else:
    ok=g2.get('2xx',0); bad=sum(v for k,v in g2.items() if k!='2xx')
    print(f"  producer   : {ok:,} ok, {bad} error(s)")
if cons is None: print("  consumer   : UNKNOWN - metrics call failed")
else:
    ok=cons.get('ok',0); bad=sum(v for k,v in cons.items() if k!='ok')
    print(f"  consumer   : {ok:,} ok, {bad} error(s)")
if gen1 is None: print("  gen1       : UNKNOWN")
else: print(f"  gen1       : {sum(gen1.values()):,} executions (should be inert)")

verdict="HEALTHY"; notes=[]
if g2 is None or cons is None:
    verdict="UNKNOWN"; notes.append("a metrics call failed; state not proven")
else:
    if sum(v for k,v in g2.items() if k!='2xx')>0: verdict="ACT NOW"; notes.append("producer returning errors")
    if sum(v for k,v in cons.items() if k!='ok')>0: verdict="ACT NOW"; notes.append("consumer returning errors")
    if g2.get('2xx',0)>0 and cons.get('ok',0)==0: verdict="ACT NOW"; notes.append("producer publishing but consumer never ran")
print(f"  VERDICT    : {verdict}")
for n in notes: print(f"    - {n}")
PY
