#!/bin/bash
#
# STORE SCREENSHOT CAPTURE — ONE COMMAND, START TO FINISH (5.2.0).
#
# Seeds the fixtures, drives the app with idb, captures every screen in every
# language on one device, and leaves the data seeded for the next device.
#
# Usage:
#   ./run_store_capture.sh iphone          # capture the iPhone set
#   ./run_store_capture.sh ipad            # capture the iPad set
#   ./run_store_capture.sh iphone --keep   # skip the reseed, use what is there
#
# Run the cleanup yourself when BOTH devices are done:
#   node seed_store_screenshots.js --purge
#   node seed_store_screenshots.js --restore
#
# ============================================================================
# WHY THIS EXISTS RATHER THAN A LIST OF STEPS IN A DOC
# ============================================================================
#
# The capture is 5 screens x 4 languages x 2 devices = 40 files, and every one
# of them depends on state that is easy to get subtly wrong: the app's language
# (set in-app, NOT by launch arguments -- see below), the status bar override,
# a changelog banner that appears once and covers the top half of Home, a
# rating prompt that appears on Home and belongs in no screenshot, and Live
# fixtures whose kickoff times are relative to now and go stale within hours.
#
# Doing that by hand across two devices reliably is not realistic. Doing it
# twice, consistently, is less so.
#
# ============================================================================
# FOUR THINGS LEARNED THE HARD WAY (2026-09-23). DO NOT "SIMPLIFY" THESE.
# ============================================================================
#
# 1. LANGUAGE IS SET IN-APP, NOT BY LAUNCH ARGUMENTS.
#    `simctl launch -AppleLanguages "(fr)"` does switch the UI strings, but it
#    does NOT switch the app's own locale state, so times still render through
#    the English branch of getFormattedTime() -- a French screenshot showing
#    "8pm" instead of "20:00". The app stores its language under
#    FFLocalizations and only the in-app picker writes it. So this script taps
#    Profile -> settings -> the flag, every time.
#
# 2. IDB TAPS ARE IN POINTS, NOT PIXELS.
#    A screenshot is 1320x2868 but the device is 440x956 points. Tapping with
#    pixel coordinates silently misses (it lands off-screen or on the wrong
#    control and nothing appears to happen). Every coordinate below is points,
#    read from `idb ui describe-all`.
#
# 3. THE VIEWER MUST NOT BE ON ANOTHER SEEDER'S FIXTURES.
#    seed_test_matrix puts the whole test pool -- including our viewer -- on
#    its own 28 games at VSD39 Dole. Those then fill "Tes matchs" and push our
#    invitations off screen. This script detaches the viewer from every test
#    game that is not ours, every run, because a reseed re-attaches her.
#
# 4. A BROAD PURGE WILL DELETE THIS SET MID-SESSION.
#    `seed_test_matrix.js --purge` selects on `is_test_game` alone, so it
#    removes our fixtures too. That happened during the first attempt and cost
#    the whole seeded set. If a capture run finds no fixtures, that is why --
#    this script reseeds at the start so it is self-healing.

set -uo pipefail

DEVICE="${1:?usage: run_store_capture.sh <iphone|ipad> [--keep]}"
KEEP="${2:-}"

HERE="$(cd "$(dirname "$0")" && pwd)"
IDB="$HOME/.poteau/idb-venv/bin/idb"
BUNDLE="com.krank.club"
VIEWER="Y3V5WDgZGTWsQ3vSZDvNlu0Uo1D2"

case "$DEVICE" in
    iphone) UDID="7506B541-2FE3-4BDC-A2FD-265C61D71F07" ;;
    ipad)   UDID="$(xcrun simctl list devices available 2>/dev/null \
                | grep 'iPad Pro 13-inch (M4)' | head -1 \
                | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')" ;;
    *) echo "unknown device '$DEVICE' (expected iphone|ipad)" >&2; exit 1 ;;
esac
[ -n "$UDID" ] || { echo "no $DEVICE simulator found" >&2; exit 1; }

# The flag buttons in the in-app language picker, by x coordinate (points).
# All four sit on one row; the row's y is found at run time because it moves
# with the scroll position.
flag_x() {
    case "$1" in
        fr) echo 107 ;;
        en) echo 182 ;;
        es) echo 257 ;;
        it) echo 332 ;;
    esac
}

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }

ui()  { "$IDB" ui "$@" --udid "$UDID" 2>/dev/null; }
tree() { "$IDB" ui describe-all --udid "$UDID" 2>/dev/null; }

# Find an element by label substring; echoes "x y" (centre, in points) or
# nothing. Elements with a zero frame are off-screen and deliberately skipped:
# tapping their reported (0,0) would hit the top-left corner.
find_el() {
    tree | python3 -c "
import json,sys
needle = sys.argv[1].lower()
try: d = json.load(sys.stdin)
except Exception: sys.exit(0)
for e in d:
    lbl = (e.get('AXLabel') or '')
    f = e.get('frame') or {}
    if needle in lbl.lower() and f.get('width', 0) > 0:
        print(int(f['x'] + f['width'] / 2), int(f['y'] + f['height'] / 2))
        break
" "$1"
}

tap_label() {
    local coords; coords=$(find_el "$1")
    [ -n "$coords" ] || return 1
    ui tap $coords
    sleep "${2:-2}"
}

# THE CLOCK FORMAT IS A DEVICE SETTING, AND IT FOLLOWS THE MARKET.
#
# format_date.dart is explicit about this: "Driven by the DEVICE clock setting,
# never by the language." It reads FFAppState().show24h, which device24hFormat
# fills from the simulator's own 24-hour preference. So the app language does
# NOT decide whether a time renders "20:00" or "8pm" -- the device does.
#
# Which means the split is by MARKET, not by language (Tim, 2026-09-24):
#
#   fr, it  -> 24h   European markets
#   en, es  -> AM/PM US and Latin American markets
#
# It is a preferences write plus a reboot, so it is done once per clock format
# rather than once per language: fr and it share a 24-hour boot, en and es
# share a 12-hour one.
set_clock() {
    local want24="$1"   # "true" or "false"
    local current
    current=$(xcrun simctl spawn "$UDID" defaults read "Apple Global Domain" \
        AppleICUForce24HourTime 2>/dev/null | tr -d '[:space:]')
    [ "$current" = "1" ] && current="true" || current="false"
    [ "$current" = "$want24" ] && return 0

    log "  clock -> $([ "$want24" = true ] && echo 24h || echo AM/PM) (reboot)"
    xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1
    if [ "$want24" = "true" ]; then
        xcrun simctl spawn "$UDID" defaults write "Apple Global Domain" \
            AppleICUForce24HourTime -bool true >/dev/null 2>&1
    else
        xcrun simctl spawn "$UDID" defaults delete "Apple Global Domain" \
            AppleICUForce24HourTime >/dev/null 2>&1
    fi
    xcrun simctl shutdown "$UDID" >/dev/null 2>&1
    sleep 3
    xcrun simctl boot "$UDID" >/dev/null 2>&1
    until xcrun simctl list devices booted 2>/dev/null | grep -q "$UDID"; do sleep 3; done
    xcrun simctl location "$UDID" set 48.8566,2.3522 >/dev/null 2>&1
    sleep 4
}

relaunch() {
    xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1
    sleep 1
    xcrun simctl launch "$UDID" "$BUNDLE" >/dev/null 2>&1
    sleep 14
}

# The changelog banner and the rating prompt both appear on Home and both
# ruin a screenshot. Dismiss whatever is present; absent is fine.
dismiss_overlays() {
    # Changelog card: an X in its top-right corner.
    local c; c=$(tree | python3 -c "
import json,sys
try: d=json.load(sys.stdin)
except Exception: sys.exit(0)
for e in d:
    f=e.get('frame') or {}
    if 0 < f.get('width',0) < 50 and 130 < f.get('y',0) < 200 and f.get('x',0) > 350:
        print(int(f['x']+f['width']/2), int(f['y']+f['height']/2)); break
")
    [ -n "$c" ] && { ui tap $c; sleep 2; }
    return 0
}

set_language() {
    local lang="$1"
    log "  switching app language to $lang"

    # Profile is the 4th tab. The tab bar is an overlay near the bottom.
    ui tap 350 858; sleep 3
    # Settings gear, top right of the profile.
    ui tap 408 85; sleep 3

    # The flag row is below the fold; scroll until it is on screen.
    local row=""
    for _ in 1 2 3 4 5; do
        row=$(tree | python3 -c "
import json,sys
try: d=json.load(sys.stdin)
except Exception: sys.exit(0)
for e in d:
    if (e.get('AXLabel') or '') == '🇫🇷':
        f=e.get('frame') or {}
        if f.get('width',0) > 0:
            print(int(f['y'] + f['height']/2)); break
")
        [ -n "$row" ] && break
        ui swipe 220 800 220 400 --duration 0.4; sleep 2
    done

    if [ -z "$row" ]; then
        log "  WARNING: language picker not found, leaving language unchanged"
        relaunch
        return 1
    fi

    ui tap "$(flag_x "$lang")" "$row"
    sleep 6
    relaunch
}

capture() { "$HERE/capture_store_screenshots.sh" "$UDID" "$DEVICE" "$1" "$2" "${3:-2}"; }

# ---------------------------------------------------------------------------
# 1. Data
# ---------------------------------------------------------------------------
if [ "$KEEP" != "--keep" ]; then
    log "seeding fixtures (fr cast)"
    node "$HERE/seed_store_screenshots.js" --cast fr --write >/dev/null 2>&1 \
        || { echo "seeding FAILED" >&2; exit 1; }
fi

log "detaching the viewer from other seeders' fixtures"
node -e "
const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(require('$HERE/krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')),
  projectId: 'krank-club',
});
const db = admin.firestore();
const V = '$VIEWER';
(async () => {
  const snap = await db.collection('games').where('is_test_game','==',true).get();
  let n = 0;
  for (const d of snap.docs) {
    const g = d.data();
    if (g.seed_tag === 'store_shots_520') continue;
    const teams = g.teams || [];
    if (!teams.some(t => t.user_id === V)) continue;
    await d.ref.update({
      teams: teams.map(t => t.user_id === V ? { ...t, user_id: '', status: 'open' } : t),
      attendees: (g.attendees || []).filter(r => r.id !== V),
    });
    n++;
  }
  console.log('  detached from ' + n + ' game(s)');
  process.exit(0);
})();
" 2>/dev/null

# users.stats has to be written directly: recomputeUserStats excludes test
# games, and the seeder's own write of this map has proved unreliable.
log "writing viewer stats"
node -e "
const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(require('$HERE/krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')),
  projectId: 'krank-club',
});
const db = admin.firestore();
const at = (h,m,d=0) => { const x = new Date(); x.setDate(x.getDate()+d); x.setHours(h,m,0,0); return x; };
const B = (o={}) => ({
  games_played:0, games_with_result:0, wins:0, draws:0, losses:0,
  games_with_score:0, goals:0, assists:0, goals_conceded:0, games_as_goalkeeper:0,
  matches_with_result:0, matches_won:0, sets_played:0, sets_won:0,
  padel_games_played:0, padel_games_won:0,
  first_result_game_date:null, last_played_date:null,
  ...o, computed_at:new Date(), source_version:1,
});
db.collection('users').doc('$VIEWER').update({
  last_address: 'Paris',
  last_label: 'home',
  stats: {
    soccer: B({ games_played:34, games_with_result:28, wins:16, draws:5, losses:7,
                games_with_score:24, goals:21, assists:13,
                last_played_date:at(19,0,-2), first_result_game_date:at(20,0,-240) }),
    padel:  B({ games_played:12, matches_with_result:10, matches_won:6,
                sets_played:23, sets_won:13, padel_games_played:178, padel_games_won:94,
                last_played_date:at(18,30,-5), first_result_game_date:at(19,0,-160) }),
  },
}).then(() => { console.log('  stats written'); process.exit(0); });
" 2>/dev/null

# ---------------------------------------------------------------------------
# 2. Device
# ---------------------------------------------------------------------------
xcrun simctl list devices booted 2>/dev/null | grep -q "$UDID" || {
    log "booting $DEVICE"
    xcrun simctl boot "$UDID" >/dev/null 2>&1
    until xcrun simctl list devices booted 2>/dev/null | grep -q "$UDID"; do sleep 3; done
}

# Record which build these frames came from. A store screenshot that cannot
# be traced to a build is a screenshot nobody can re-shoot identically, and
# 5.2.0 moved 236 -> 238 mid-session over defects that change what renders.
BUILD="$(grep -m1 '^version:' "$HERE/../poteau-app/pubspec.yaml" | awk '{print $2}')"
COMMIT="$(git -C "$HERE/../poteau-app" rev-parse --short HEAD 2>/dev/null)"
log "app build: $BUILD ($COMMIT)"
printf '%s\nbuild: %s\ncommit: %s\ndevice: %s\n\n' \
    "$(date '+%Y-%m-%d %H:%M')" "$BUILD" "$COMMIT" "$DEVICE" \
    >> "$HOME/poteau-store-screenshots/raw-520/CAPTURE_NOTES.md"

log "launching the app"
relaunch

# ---------------------------------------------------------------------------
# 3. Capture, language by language
# ---------------------------------------------------------------------------
# Ordered so the two 24-hour languages run together and the two AM/PM ones do
# too: the clock change costs a reboot, so this pays it twice rather than four
# times.
for LANG_CODE in fr it en es; do
    log "=== $LANG_CODE ==="
    case "$LANG_CODE" in
        fr|it) set_clock true  ;;   # European markets
        en|es) set_clock false ;;   # US / Latin American markets
    esac
    set_language "$LANG_CODE"
    dismiss_overlays

    # Screen 1 — Home with pending invitations.
    capture "$LANG_CODE" 01_invites 2

    # Screen 2 — the games list (soccer tab).
    ui tap 155 858; sleep 4
    dismiss_overlays
    capture "$LANG_CODE" 02_games 2

    # Screen 3 — a game sheet the viewer has not joined.
    if tap_label "LE FIVE Paris 17" 4 || tap_label "Riverside Five" 4; then
        capture "$LANG_CODE" 03_sheet 2
        relaunch
    else
        log "  WARNING: could not open a game sheet for 03_sheet"
        relaunch
    fi

    # Screen 4 — the Live board, mid-match.
    dismiss_overlays
    if tap_label "LIVE" 4; then
        capture "$LANG_CODE" 04_live 2
        relaunch
    else
        log "  WARNING: no Live card on Home for 04_live"
        relaunch
    fi

    # Screen 5 — the wrap-up share card, and the profile.
    dismiss_overlays
    if tap_label "SIFFLET" 4 || tap_label "WHISTLE" 4 || tap_label "SILBATO" 4 || tap_label "FISCHIO" 4; then
        capture "$LANG_CODE" 05_share 2
        relaunch
    else
        log "  WARNING: no wrap-up card for 05_share"
        relaunch
    fi

    ui tap 350 858; sleep 4
    capture "$LANG_CODE" 05b_profile 2
    relaunch
done

log "done. files:"
find "$HOME/poteau-store-screenshots/raw-520/ios-$DEVICE" -name '*.png' | sort | while read -r f; do
    printf '  %s  %s\n' \
        "$(sips -g pixelWidth -g pixelHeight "$f" 2>/dev/null | tail -2 | awk '{print $2}' | paste -sd'x' -)" \
        "${f#$HOME/poteau-store-screenshots/raw-520/}"
done
