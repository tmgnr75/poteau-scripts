/**
 * Remove "ghost" attendees from FUTURE repeater-generated games.
 *
 * The bug: both repeater game-creation paths in cloud-functions/functions/index.js
 * (`createGamesFromRepeater` onCreate, and the `scheduleGames` cron) copy
 * `attendees` + `teams` verbatim from the repeater's earliest game onto every
 * future occurrence. A player who joined ONE week therefore appears as already
 * registered on every future week they never joined.
 *
 * A ghost is defined conservatively; a user is only removed when ALL hold:
 *   1. They are a non-organizer attendee of a FUTURE repeater-linked game.
 *   2. They have NO addPlayer/addAttendee join log for that specific game.
 *   3. They ARE an attendee of the repeater's earliest game (the copy source),
 *      which is what makes the roster-copy the explanation.
 *
 * Both `attendees` and `teams` are repaired together: the ghost's entries are
 * dropped from `attendees` and their spots reset to `status: 'open'`, so the
 * two views of the roster stay consistent (initGameTeams compares them).
 *
 * Usage:
 *   node fix_repeater_ghost_attendees.js --dry     # preview, writes nothing
 *   node fix_repeater_ghost_attendees.js --apply   # perform the repair
 */
const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');
const CROSSREF = process.env.CROSSREF_PATH ||
  '/private/tmp/claude-501/-Users-tmgnr-poteau-workspace/d5b69e4d-b0f4-4599-9d6e-c0d06e39b945/scratchpad/crossref.json';

(async () => {
  const rows = JSON.parse(fs.readFileSync(CROSSREF, 'utf8')).filter(r => r.ghosts.length > 0);
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} - candidate games: ${rows.length}\n`);

  // Build the copy-source roster per repeater, to re-verify condition 3 at write time.
  const srcAttendees = new Map();
  for (const repId of [...new Set(rows.map(r => r.repeaterId))]) {
    const snap = await db.collection('games')
      .where('repeater', '==', db.collection('repeaters').doc(repId))
      .orderBy('date', 'asc').limit(1).get();
    if (!snap.empty) {
      srcAttendees.set(repId, {
        gameId: snap.docs[0].id,
        ids: new Set((snap.docs[0].get('attendees') || []).map(r => r.id)),
      });
    }
  }

  let repaired = 0, skipped = 0, spotsFreed = 0, entriesRemoved = 0;
  const report = [];

  for (const row of rows) {
    const ref = db.collection('games').doc(row.gameId);
    const doc = await ref.get();
    if (!doc.exists) { skipped++; continue; }
    const g = doc.data();

    // Re-verify the game is still in the future and still repeater-linked.
    const date = g.date && g.date.toDate ? g.date.toDate() : null;
    if (!date || date <= new Date()) { skipped++; continue; }
    if (!g.repeater) { skipped++; continue; }

    const src = srcAttendees.get(row.repeater_id || row.repeaterId);
    // Never touch the copy-source game itself.
    if (src && src.gameId === row.gameId) { skipped++; continue; }

    // Final ghost set: unlogged AND present on the copy source.
    const ghosts = row.ghosts.filter(u => src && src.ids.has(u));
    if (ghosts.length === 0) { skipped++; continue; }
    const ghostSet = new Set(ghosts);

    const attendees = Array.isArray(g.attendees) ? g.attendees : [];
    const newAttendees = attendees.filter(r => !(r && r.id && ghostSet.has(r.id)));

    const teams = Array.isArray(g.teams) ? g.teams : [];
    const newTeams = teams.map(spot => {
      if (spot && spot.user_id && ghostSet.has(spot.user_id)) {
        spotsFreed++;
        const cleared = { ...spot, user_id: '', status: 'open' };
        // Drop any per-spot denormalised identity so no ghost name lingers.
        for (const k of ['display_name', 'photo_url', 'hash_pic', 'plus_one', 'position']) {
          if (k in cleared) delete cleared[k];
        }
        return cleared;
      }
      return spot;
    });

    entriesRemoved += attendees.length - newAttendees.length;
    report.push({
      gameId: row.gameId, date: date.toISOString(), centre: g.centre,
      orgType: row.orgType, ghosts, keptRealJoiners: row.real,
      attendeesBefore: attendees.length, attendeesAfter: newAttendees.length,
    });

    if (APPLY) {
      await ref.update({ attendees: newAttendees, teams: newTeams });
    }
    repaired++;
  }

  console.log(`Games repaired : ${repaired}`);
  console.log(`Games skipped  : ${skipped}`);
  console.log(`Attendee entries removed: ${entriesRemoved}`);
  console.log(`Team spots freed to open: ${spotsFreed}`);
  if (!APPLY) console.log('\nNo writes performed. Re-run with --apply to repair.');

  fs.writeFileSync(
    CROSSREF.replace('crossref.json', APPLY ? 'repair_applied.json' : 'repair_preview.json'),
    JSON.stringify(report, null, 2)
  );
  process.exit(0);
})();
