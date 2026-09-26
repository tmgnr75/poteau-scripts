# Store screenshots 5.2.0 — capture notes

Captured 2026-09-24 (evening) from build **5.2.0 (238)**, poteau-app develop,
on the iPhone 16 Pro Max simulator (1320x2868, the 6.9" native size).

## What is here

    iphone/{fr,en,es,it}/
      01_invites.png   Home
      02_games.png     Games list, soccer tab
      03_sheet.png     Game sheet, joinable, 9/10
      04_live.png      Home with the Live card mid-match

16 frames, all verified 1320x2868, native resolution, no cropping.

## The four personas

A language is a PERSON IN A CITY, not a translation. This was the defect that
made the first attempt unusable: every frame carried Paris venues, so a New
Yorker browsing the US App Store saw "LE FIVE Paris 17".

    fr  Maxime L.  Paris      EUR  24h     LE FIVE Paris 17, Casa Padel
    en  Tyler M.   New York   USD  AM/PM   Chelsea Piers, Padel Haus Williamsburg
    es  Diego R.   Miami      USD  AM/PM   Kendall Soccer Park, Ultra Padel
    it  Luca M.    Rome       EUR  24h     Tre Fontane, Padel Roma Nord

Player names follow the city too. Photos are the exception and are shared, as
the nine consented faces are the only ones cleared for commercial use.

Games are **5v5, ten players** -- the format Poteau is for. The first attempt
shipped six-player games because the shared account pool held nine people;
each persona now owns twelve accounts (create_store_personas.js).

## Known gaps

### 05_share NOT CAPTURED (all four languages)
The wrap-up share card is the last step of the four-step feedback flow. Its
buttons do not respond to a synthetic tap at their reported centre: the walk
stalls on step 2 (the score confirmation), whatever offset is used. Clearing
`pending_feedback` to reach the direct "see your card" entry instead removes
the wrap-up section from Home entirely.

Needs a manual walk, or a look at why those buttons ignore idb taps.

### iPad NOT CAPTURED
The app builds and runs, and the login works, but the iPad is 1032x1376
points against the iPhone's 440x956: every coordinate differs, and the tab bar
and settings gear are not where the resolved-geometry helpers expect. The
login script was made resolution-independent; the capture script was not.

### Android NOT CAPTURED
Android Studio is installed with two Pixel 3a AVDs (1080x2220, under the
1080x2400 the brief asks for). A cloned AVD at the right size would not boot,
and the stock AVD did not attach to adb within the session.

### 01_invites is dominated by the Live card
Home renders the Live and wrap-up cards ABOVE the invitations, so screen 1
shows a Live scoreboard rather than the pending invitations it is meant to
sell. The seeder can park the Live fixtures outside Home's 30-minute window
for screen 1 and bring them back for screen 4, which is what the French pass
did by accident; that sequencing is not yet in the capture script.

### "6:30p" truncates on the first card of the EN/ES games list
Only the first row, and only in 12-hour mode.

## App bugs found and fixed during this work

- **Double AM/PM.** `formatTimeOfDay` returns "11pm" in 12-hour mode -- the
  suffix is part of the string -- and the time column rendered a second label
  beneath it. Every English and Spanish card read "11pm" with "PM" under it.
  Fixed: poteau-app a2c74d5d.
- **Wrong heading over the follow button.** "Tu as envie de jouer ?" sat above
  a button reading "Suivre" and a count reading "2 personnes suivent ce
  match". Fixed to "Tu veux suivre ce match ?" in all four languages:
  poteau-app 5222a6a4.

## Three things the fixtures must respect

1. **Kickoffs are absolute evening slots** (18:30-21:00), moving to tomorrow
   if those have passed. Anchoring to "now + 75 minutes" produced a listing
   advertising a 2am five-a-side when the run reached English at 21:00.
2. **Home only lists games kicked off within the last 30 minutes**
   (nowMinus30Min). A Live fixture outside that window renders nothing, and so
   does a played game older than half an hour.
3. **Poteau Live needs `poteau_live: true`** on the game. It is an opt-in
   cohort flag defaulting to false, so a Live fixture without it shows no Live
   UI however correct the event log and confirmed teams are.

## Reproducing

    cd ~/poteau-workspace/scripts
    node switch_persona.js --lang en      # rename the signed-in account
    node seed_store_persona.js --lang en --write
    ./set_clock.sh en iphone              # reboots if the format changes
    ./capture_persona.sh en iphone

`switch_persona.js` renames ONE signed-in account rather than signing out and
in per persona (Tim's suggestion, and it removed a whole class of failure: a
tap landing on "Continue with Google", an email field swallowing the start of
the password, a signup form captured instead of a login form).

The app language is still set in-app with the flag picker, because that is the
only thing that moves FFLocalizations. Read the flag's frame and tap it in the
SAME breath -- the row shifts while the sheet settles, and a stale y taps
nothing.

## Cleanup

    node seed_store_persona.js --purge
    node create_store_personas.js --delete

## 2026-09-25 — three findings that cost the EN set several retakes

### 1. The two rendering surfaces disagree about TIMEZONE

The games list renders kickoffs against the SIMULATOR'S CLOCK, which stays on
the host's zone whatever `AppleTimeZone` says. The invitation cards honour the
game's own `time_zone` field. Building a New York slate in `America/New_York`
therefore produced a games list reading "12am" and "2am" while the invitation
cards read 7pm.

Both `eveningSlate()` and `inviteSlate()` now build in
`Intl.DateTimeFormat().resolvedOptions().timeZone` — the device's zone — and
the persona's zone is written onto the game for the surfaces that honour it.
Fixing only one of the two leaves the other wrong, which is what happened
first: `eveningSlate` was corrected and `inviteSlate` was not, so screen 1
showed 1am invitations.

### 2. The Home invitations section is NOT driven by `game_invitations`

It merges the invitation docs with every nearby JOINABLE game. Four invitation
docs produced six rows, and the same padel fixture rendered twice at two
different times. Two consequences:

  - The eight `list_*` fixtures seeded for screen 2 appear on screen 1 as
    well, so `park_for_invites.js` now shelves them a week out.
  - A fixture can still render twice. The mitigation is to give the four
    invitations FOUR DISTINCT VENUES, so a duplicated render can never repeat
    a venue name, which is the part a viewer reads as broken data.

### 3. Screen 2 needs a THIRD fixture state, not two

`--restore` puts the Live fixture back on the viewer, which heads the games
list with a black "Your game / FULL" card that eats the top third of the
frame. Screen 2 is selling the list, so it needs the viewer detached (as for
screen 1) but the `list_*` fixtures visible (unlike screen 1). That is
`park_for_invites.js --list`.

### Not defects, checked and dismissed

  - "Not free today" on the day-card header is a DISMISS BUTTON, not a status
    label. It reads as a statement in a still frame but is working as designed.
  - The Live card's "22:07" is a match clock in MM:SS (22 minutes played), not
    a wall clock. With kickoff at 3pm the status bar is set to 3:21 so the two
    agree.

## 2026-09-25, second pass — four findings

### 1. The status bar is chrome, so it gets ONE time

Screens 4 and 5 used to carry the Live fixture's real clock so the bar would
agree with the card's own "Today at 4pm". Across a five-frame set that read
9:41, 16:14, 16:51, 4:21 and 16:33. In a composed listing nobody reads the bar
against the card, but they do see the frames side by side, so it is pinned to
9:41 everywhere.

On Android the equivalent of `simctl status_bar override` is SYSUI DEMO MODE
(`am broadcast -a com.android.systemui.demo`). Pass `-e fully true` on the
network commands or the wifi glyph renders with the no-internet "!" badge.

### 2. The CLOCK FORMAT is a device setting, and must follow the market

`formatTimeOfDay` reads the device, not the app language, and that is correct:
a 12-hour clock is a device convention. But a French listing should still read
19:00, so the runner now sets the device from the persona -- FR and IT 24-hour,
EN and ES 12-hour. Setting it by hand is how an Italian Android set came back
reading "7 PM" beside an Italian iPhone set reading "19:00".

### 3. The evening slate ROLLS TO TOMORROW after about 17:15

`eveningSlate()` moves the whole evening forward rather than pushing kickoffs
into the small hours, so the games list opens on an empty Today. Both runners
detect this and move to the next day tab.

On iOS the tab is found BY ITS WORD. Picking "the second labelled control near
the top" opened the location and radius sheet instead, because the screen title
is itself such a control. On Android there is no tree to read, so the question
is asked of FIRESTORE -- a pixel test for "the list looks empty" fails, because
the empty state carries two paragraphs of copy rather than being a flat colour.

### 4. A FRESH INSTALL has no location, and the list searches by radius

Right after the simulator rebuild, screen 2 came back as "non ci sono partite
organizzate vicino a casa tua". `simctl location set` (and `adb emu geo fix`)
now runs on every capture.

### Android needs 4 GB, not the AVD default

The `Poteau_Store` AVD shipped with `hw.ramSize = 1536` for a 130 MB release
build, and threw "Process system isn't responding" mid-run. It is now 4096 with
`vm.heapSize = 576`. Launch also waits 40 seconds rather than 22: the release
build starts slower than the debug build did, and 22 captured a half-painted
Home.

### THE PERSONAS ARE SHARED STATE. Never capture two at once.

The fixtures live in one Firestore project, so seeding a second persona
rewrites the games the first is still photographing. An Android run
backgrounded while French was re-seeded came back showing LE FIVE Paris 17
under an English UI. Every run must be serial.

## Teardown, 2026-09-26 — what the purge did not cover

The fixtures live in the REAL Firestore project, so teardown is part of the
job, not an afterthought. Three things were left behind by the scripts as
written, and all three are now fixed.

### The old seeder's cast restyle needed --restore, not --purge

`seed_store_screenshots.js` (the first, replaced seeder) restyled ten existing
`is_test_account` accounts into persona names and repointed their photos, and
backed the originals up in a `store_shots_backup` field. `--purge` does not
touch that; `--restore` does. Running it returned Sophie Test, Gina Test, Marco
Test and seven others to their own names and cleared every backup field.

Those accounts are NOT deletable: they belong to the seed-matrix
(`test_*@poteau-test.internal`) and other work depends on them.

### The availabilities document was orphaned

Screen 1 needs the invitations toggle to read "On", which is driven by an
`availabilities` doc keyed on the viewer's uid. `--purge` never removed it, and
deleting the persona accounts afterwards left it in a production collection
with 35 slots and no owner. `seed_store_persona.js --purge` now deletes it, and
the header records that **purge must run BEFORE
`create_store_personas.js --delete`** — purge finds those documents by walking
the persona accounts, so deleting the accounts first makes them unfindable.

### The consented photos were copies, and they are gone

The 42 players' faces were cropped into `store_shots_520/persona/` in Cloud
Storage, and the ten restyled test accounts' own photos into
`store_shots_520/cast/`. Nothing references either prefix once the fixtures and
personas are gone, so all 54 objects were deleted. The photos should not
outlive the fixtures they were consented for.

### Verify all six, not just the games

    games with seed_tag          0
    game_invitations             0
    users with store_persona     0
    users with store_anchor      0
    store_shots_backup fields    0
    users on a cast photo        0

The last two need a full user-collection scan (107,427 documents), not a
`where` query -- the restyled accounts carry no persona tag, which is exactly
why they were missed the first time.
