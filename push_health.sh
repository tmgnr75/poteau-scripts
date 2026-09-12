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
else:
    # A NON-ZERO COUNT HERE IS NORMAL AND IS NOT A REGRESSION.
    #
    # Gen1 is deployed-but-inert: its Firestore trigger still fires on every
    # connect doc and returns null immediately (index.js, "DEACTIVATED
    # 2026-08-26"). A Gen1 trigger cannot be paused, only deleted, and deleting
    # it reopens the window where nothing is attached -- so it stays. It
    # therefore records a full execution count while sending nothing.
    #
    # The label used to read "should be inert", which invites the reader to
    # treat ~15k executions as an incident. What proves inertness is the
    # ABSENCE of "Message published successfully" from this function; verified
    # again 2026-09-12 (zero publish lines, zero log output). Check that, never
    # the execution count.
    print(f"  gen1       : {sum(gen1.values()):,} trigger fires (inert: returns null, publishes nothing)")

verdict="HEALTHY"; notes=[]
# PAGE ON A RATE, NEVER ON A COUNT (2026-09-12).
#
# This used to be `if errors > 0`. At ~45,000 requests an hour that fires on a
# single blip, so it paged twice overnight on 11-12 Sep for a system that was
# provably healthy: 0 pushes lost, consumer 100% ok. Two separate mistakes:
#
#   1. A COUNT, not a rate. 735 errors sounds enormous and is 1.61% -- all of it
#      Cloud Run capacity throttling, which Pub/Sub retries. The proof it works
#      is that the consumer ran MORE times (46,493) than the producer reported
#      successes (44,856). Retries recovering is the system behaving correctly.
#   2. Errors and successes came from DIFFERENT windows, so the printed rate
#      read 15.9% against a true 1.61%. Both numbers must come from the same
#      aggregation, which they now do -- `tot` below is the denominator.
#
# `no available instance` is the known-benign class the daily health brief says
# to filter out. It is capacity, not a fault, and it is retried. A real
# regression shows up as a sustained rate, so that is what is measured here.
# Thresholds are deliberately generous: a quiet channel is the point, because a
# monitor Tim has learned to distrust is worse than no monitor at all.
PROD_PCT = 8.0   # producer 5xx share; throttling alone has never approached this
CONS_PCT = 2.0   # the consumer is not capacity-bound, so it should be near zero
# Defined up front: the cost guard below reads gpct, and on an UNKNOWN run the
# branch that computes it never executes. An unguarded NameError there would be
# swallowed by that block's bare `except`, silently dropping the check.
gpct = 0.0; cpct = 0.0
if g2 is None or cons is None:
    verdict="UNKNOWN"; notes.append("a metrics call failed; state not proven")
else:
    gtot=sum(g2.values()); ctot=sum(cons.values())
    gbad=sum(v for k,v in g2.items() if k!='2xx')
    cbad=sum(v for k,v in cons.items() if k!='ok')
    gpct=(100.0*gbad/gtot) if gtot else 0.0
    cpct=(100.0*cbad/ctot) if ctot else 0.0
    if gtot: print(f"  producer err: {gpct:.2f}%  (pages above {PROD_PCT:.0f}%)")
    if ctot: print(f"  consumer err: {cpct:.2f}%  (pages above {CONS_PCT:.0f}%)")
    if gpct>PROD_PCT:
        verdict="ACT NOW"; notes.append(f"producer error rate {gpct:.1f}% ({gbad} of {gtot})")
    if cpct>CONS_PCT:
        verdict="ACT NOW"; notes.append(f"consumer error rate {cpct:.1f}% ({cbad} of {ctot})")
    # The real outage shape: work going in and nothing coming out. This stays a
    # hard zero-check because it cannot be explained by throttling.
    if g2.get('2xx',0)>0 and cons.get('ok',0)==0: verdict="ACT NOW"; notes.append("producer publishing but consumer never ran")
# Cost guard. The one way this architecture can inflate a bill is retry
# looping: every redelivery is a billed invocation, so a persistent failure
# could multiply invocations without matching user traffic. Requests per
# document is the tell -- around 1.0 is healthy, sustained >1.3 means retries
# are amplifying rather than recovering.
try:
    import subprocess
    out=subprocess.run(['node','/Users/tmgnr/poteau-workspace/scripts/count_docs.js',str(m)],
                       capture_output=True,text=True,timeout=90).stdout.strip()
    docs=int(out) if out.isdigit() else 0
    req=sum(g2.values()) if g2 else 0
    if docs>50 and req:
        ratio=req/docs
        print(f"  req/doc    : {ratio:.2f}   (retry-amplification tell; ~1.0 healthy)")
        # RATIO ALONE MUST NOT PAGE (2026-09-12).
        #
        # Requests and documents are counted over slightly different boundaries,
        # so a burst straddling the window edge skews this on a healthy system.
        # Measured back-to-back on 2026-09-12 with ZERO errors throughout, the
        # same pipeline read 1.31, then 0.90 / 0.99 / 0.97 / 0.97 / 1.00 across
        # 10/15/20/30/60m windows. Paging on the 1.31 would have been a third
        # false alarm in one night.
        #
        # Real amplification means redelivery, and redelivery means the producer
        # is FAILING. So the ratio is only believed when errors corroborate it;
        # on its own it is printed as context and nothing more. Raised to 1.5
        # because everything at or below ~1.3 has been boundary noise.
        if ratio>1.5 and gpct>1.0:
            verdict="ACT NOW"
            notes.append(f"retry amplification {ratio:.2f}x with {gpct:.1f}% producer errors")
        elif ratio>1.5:
            notes.append(f"req/doc {ratio:.2f} but no producer errors - likely a window-edge artifact, not retries")
except Exception:
    pass

print(f"  VERDICT    : {verdict}")
for n in notes: print(f"    - {n}")
PY
