/**
 * Ban the accounts that hide a phone number in their name fields, and rewrite
 * the name to "<given name> le Tricheur".
 *
 * Context: these users put their own phone number in their display name so
 * other players could contact them without Gold. The number is always their
 * own (verified against phone_number), so this is contact-gate evasion, not
 * spam or recruiting. Decided 2026-09-23.
 *
 * What this does per user:
 *   1. Snapshots every original name field into `moderation_name_backup` so an
 *      appeal can be reversed exactly.
 *   2. Strips the number and writes "<given name> le Tricheur" to display_name,
 *      first_name, last_name and nickname. first_name/last_name are DERIVED from
 *      display_name by splitting on the first space (first_name_finder.dart), so
 *      they are written to match rather than left to drift.
 *   3. Sets banned: true, with banned_by / ban_reason so the `bans` record the
 *      updateUserBannedStatus trigger writes is attributable.
 *
 * What this deliberately does NOT do:
 *   - Touch games directly. The updateUserBannedStatus trigger (index.js ~4104)
 *     removes the user from games where `date >= now` only. Past games are left
 *     intact by design; doing it here as well would race that trigger.
 *
 * Usage: node ban_spelled_number_names_2026-09-23.js [--apply]
 */
const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');
const MARK = 'le Tricheur';
const REASON = 'phone number hidden in name to bypass the Gold contact gate';

// The 25 live hard-signal accounts from scan_spelled_numbers_wide.js.
// The 3 already-banned accounts in that scan are excluded: they were banned
// earlier for unrelated reasons and must not be re-stamped.
const UIDS = [
  'HpinoeZ2g7dSEhejLQ5aHsB02Ef1','IlJpGRzkK7Zcf6ZaJS6s5i9DAjr1','jQH7GNNj2OWXNcYzoBtSBMwtKcA2',
  'zNFTnukULcPHZkqZVcVy7DcmtUp1','XIFhmVZiexagxoT8YfPTLk6SjIP2','ewYAyF2kLHOpiY9X1wjFnqIG4lo1',
  'gMugRaZmIxafK5n3O0319bhJ8qb2','M3mHsw9sziPeLsgwlU1nnzQZoTg1','fYIquu7yO7g7C1MHRdAAkiGkMTl2',
  '5s70nzeTzoOkDAWARdtLJRWCSfF3','9PehwKH8ruf4iqjh2WuIdl1suIy2','Yti9bTsPkkM9CoGSXvMBv4pY4pS2',
  'x4rw3YtGuxXftlz0cwpcmXNPXSc2','a9LgFUf7vpNZ0Ss2EX4ZZ1x1XFx1','WGYUpdZTgtO0g6wMom6Zc7m3oN93',
  '3ahELjMEbRcYSuSuvLOvjgPoaM02','LEcWTmBYrsd0C8Q6gdVFoVQIQs83','QrHNkslZPyVt6T9vNAvwUrACK5H2',
  'UpqvMWpUOlf0jQNVRsLOLD5i9ke2','ew3GACDRP8UnjNCcNvvniBkgvOP2','i67BP9POMobGwyJjhi8cgsqIi3E2',
  'iq3nCWP7hFT0UPw1AgGF2tX3Sa72','xf2eegavZDM0MvOUSLxI3MEQnp93','zEbiCnhQKigYP75pheHERSERu3F3',
  'zU00ntt46dWAyRqqeQ2BQ1lkLIv2',
];

const NUM_WORDS = ['quatrevingtdix','quatrevingt','soixantedix','zero','zéro','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','onze','douze','treize','quatorze','quinze','seize','vingt','trente','quarante','cinquante','soixante','cent','un','une'];
const deaccent = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Recover the human name from a field that also carries a phone number.
 * Returns '' when nothing human is left (the field was only a number).
 */
function humanPart(raw) {
  if (!raw) return '';
  let s = String(raw);
  s = s.replace(/\+?\d[\d\s.\-_/]{6,}\d/g, ' ');          // raw phone runs
  s = s.replace(/\d+/g, ' ');                              // any stray digits
  // Drop number-words, longest first, on word-ish boundaries.
  for (const w of [...NUM_WORDS].sort((a, b) => b.length - a.length)) {
    s = s.replace(new RegExp(w, 'gi'), ' ');
    // The same word without accents (Zéro -> Zero) and glued inside a run.
    s = s.replace(new RegExp(deaccent(w), 'gi'), ' ');
  }
  // Solicitation phrasing that is not a name.
  s = s.replace(/pour jouer|msg|wh?at?ts?ap+|whatsapp|snap(chat)?|insta(gram)?|telegram|c.?est mon num|mon num(ero)?|appel(ez|le)?|n.?h.?sitez pas.*/gi, ' ');
  s = s.replace(/pas (la version|le compte) (gold|premium)|j.?ai pas.*/gi, ' ');
  s = s.replace(/[^\p{L}\s'’-]/gu, ' ');                   // punctuation left behind
  s = s.replace(/\s+/g, ' ').trim();
  // Drop 1-letter leftovers (the "O" of a leetspeak Osept, stray initials).
  s = s.split(' ').filter(t => t.replace(/[^\p{L}]/gu, '').length > 1).join(' ');
  return s.trim();
}

function titleCase(s) {
  return s.split(' ').filter(Boolean)
    .map(w => w.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('-'))
    .join(' ');
}

// A fragment is only usable as a name if stripping the number left real words
// behind. Reject leftovers of the number itself ("Trentre", "Quarte",
// "Soixanté") and solicitation prose ("Si Je Suis Le Match", "Sur Messenger").
const JUNK = /^(trentre|quarte|soixante?|zero|appel|les|sur|msg|so)$/i;
const PROSE = /\b(si je|le match|sur messenger|version|compte|message|rajouter|jouer)\b/i;

function usableName(s) {
  if (!s) return '';
  const words = s.split(' ').filter(Boolean);
  if (!words.length) return '';
  if (PROSE.test(s)) return '';
  const kept = words.filter(w => !JUNK.test(deaccent(w)));
  if (!kept.length) return '';
  // More than three words is prose, not a name.
  if (kept.length > 3) return '';
  return kept.join(' ');
}

// Last resort: the email local part often carries the real name
// (benjamin.ces@ -> Benjamin, sofiane.bacha77@ -> Sofiane Bacha).
// Apple private-relay addresses are random, so they are never usable.
function nameFromEmail(email) {
  if (!email || /privaterelay\.appleid\.com$/i.test(email)) return '';
  const local = email.split('@')[0].replace(/\d+/g, ' ').replace(/[._-]+/g, ' ').trim();
  const words = local.split(/\s+/).filter(w => w.length > 1);
  if (!words.length || words.length > 2) return '';
  return words.join(' ');
}


// Hand-resolved names, verified per account against the fields the number did
// not touch. Automatic stripping either produced prose fragments ("Et",
// "Quarte") or nothing at all for these, so they are pinned explicitly.
const OVERRIDES = {
  '5s70nzeTzoOkDAWARdtLJRWCSfF3': 'Sofiane Bacha',   // email sofiane.bacha77@
  'WGYUpdZTgtO0g6wMom6Zc7m3oN93': 'Vincent Batista', // clean display_name; only nickname carried the number
  '9PehwKH8ruf4iqjh2WuIdl1suIy2': '',                // no name anywhere, Apple relay email
  'x4rw3YtGuxXftlz0cwpcmXNPXSc2': '',                // no name anywhere, Apple relay email
  'zEbiCnhQKigYP75pheHERSERu3F3': 'Mehdi Les',       // "Les" is the stored last_name, not a stopword
  'UpqvMWpUOlf0jQNVRsLOLD5i9ke2': 'Sélim Bn',
  'LEcWTmBYrsd0C8Q6gdVFoVQIQs83': 'François Tsr',
  'IlJpGRzkK7Zcf6ZaJS6s5i9DAjr1': 'Romain Suzanne',  // "SUZANNE" trails the number in display_name
};

/**
 * Pick the human name. Order matters: a field that was never polluted beats
 * anything reconstructed by stripping a number out of one that was.
 */
function pickName(d) {
  const clean = v => {
    if (!v) return '';
    const stripped = humanPart(v);
    // Unchanged by stripping => the field held no number => trust it.
    return stripped && stripped.length === String(v).trim().length ? stripped : '';
  };
  // 1. first_name + last_name, when neither carried the number.
  const f = clean(d.first_name), l = clean(d.last_name);
  const fu = usableName(f), lu = usableName(l);
  if (fu && lu) return `${fu} ${lu}`;
  if (fu) return fu;
  // 2. an untouched display_name or nickname.
  for (const v of [d.display_name, d.nickname]) {
    const u = usableName(clean(v));
    if (u) return u;
  }
  // 3. whatever survives stripping a polluted field.
  for (const v of [d.first_name, d.display_name, d.last_name, d.nickname]) {
    const u = usableName(humanPart(v));
    if (u) return u;
  }
  // 4. the email.
  return nameFromEmail(d.email);
}

async function main() {
  console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — ${UIDS.length} accounts\n`);
  let done = 0, skipped = 0;

  for (const uid of UIDS) {
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) { console.log(`SKIP ${uid} — no such user`); skipped++; continue; }
    const d = snap.data();

    if (d.banned === true) { console.log(`SKIP ${uid} — already banned`); skipped++; continue; }
    if (d.moderation_name_backup) { console.log(`SKIP ${uid} — already processed`); skipped++; continue; }

    const backup = {
      display_name: d.display_name ?? null,
      first_name: d.first_name ?? null,
      last_name: d.last_name ?? null,
      nickname: d.nickname ?? null,
      taken_at: admin.firestore.Timestamp.now(),
      reason: REASON,
    };

    const given = titleCase(
      Object.prototype.hasOwnProperty.call(OVERRIDES, uid) ? OVERRIDES[uid] : pickName(d)
    );
    const newName = given ? `${given} ${MARK}` : MARK;

    console.log(`${uid}`);
    console.log(`   was: ${JSON.stringify(d.display_name || d.first_name || d.nickname || '')}`);
    console.log(`   now: ${JSON.stringify(newName)}`);

    if (APPLY) {
      const space = newName.indexOf(' ');
      await ref.update({
        display_name: newName,
        // Mirror the first-space split that first_name_finder/last_name_finder use.
        first_name: space === -1 ? newName : newName.slice(0, space),
        last_name: space === -1 ? '' : newName.slice(space + 1),
        nickname: newName,
        moderation_name_backup: backup,
        ban_reason: REASON,
        banned_by: 'moderation-script/ban_spelled_number_names_2026-09-23',
        // Written LAST in the same update: the onUpdate trigger fires once on
        // this write and reads the post-write document, so it sees the reason.
        banned: true,
      });
      done++;
    }
  }

  console.log(`\n${APPLY ? 'Banned + renamed' : 'Would process'}: ${APPLY ? done : UIDS.length - skipped}, skipped: ${skipped}`);
  if (!APPLY) console.log('Re-run with --apply to commit.');
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
