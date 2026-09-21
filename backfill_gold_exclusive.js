#!/usr/bin/env node
/**
 * Applies `gold_exclusive` to PLAYER-ORGANIZED RECURRING games that the
 * repeater path never flagged.
 *
 * WHY. The rule lived only in `publishGame`, and recurring games bypass it.
 * Measured 2026-09-21, by creation path and organizer:
 *
 *   one-off  / player    91% flagged   working
 *   repeater / player    14% flagged   THE DEFECT
 *   repeater / pro        0% flagged   correct, pro games are never gated
 *   one-off  / pro       13% flagged   small, mostly correct
 *
 * 697 player-organized recurring games at a gold centre are unflagged (361
 * upcoming, 336 already played), with 361 non-Gold players on them.
 *
 * TWO EARLIER FIGURES WERE WRONG and are recorded here so nobody repeats them.
 * "Only 12 of 737 are gold" came from `orderBy("date","desc").limit(2000)`,
 * which returns the games furthest in the FUTURE -- widening the window shows
 * 1,198 flagged games, so gold-exclusive was never broken globally. And "850
 * non-Gold players" counted pro-organized games, which must never be gated.
 *
 * `gen2/applyGoldExclusive.js` stops this for new games; this corrects the
 * backlog.
 *
 * THE D+2 RULE (Tim, 2026-09-21): "Backfill ASAP EXCEPT for games today or
 * tomorrow. From D+2, remove non Gold players from games once the game is back
 * to being gold exclusive."
 *
 * Nobody loses a spot at short notice. A game tonight or tomorrow keeps
 * everyone who joined it, because telling somebody they are out of a game they
 * planned their evening around is worse than the subscription it recovers.
 * From D+2 there is time to find another game.
 *
 * PRO-ORGANIZED GAMES ARE NEVER GATED, matching the trigger. A centre fills
 * its pitch by reaching everybody.
 *
 *   node backfill_gold_exclusive.js            # dry run, writes nothing
 *   node backfill_gold_exclusive.js --write
 */
const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(
    require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json")),
});

const WRITE = process.argv.includes("--write");
const db = admin.firestore();

/** Start of the day after tomorrow, local. Games before this keep their roster. */
function cutoff() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 2);
  return d;
}

async function goldCentres() {
  const t = await admin.remoteConfig().getTemplate();
  const p = t.parameterGroups?.["Gold"]?.parameters?.["gold_centres"];
  const raw = p?.defaultValue?.value || "";
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

(async () => {
  const list = await goldCentres();
  if (!list.length) {
    console.error("No gold centres configured. Refusing to run.");
    process.exit(1);
  }
  const D2 = cutoff();
  console.log(`${WRITE ? "WRITING" : "DRY RUN"} — ${list.length} gold centres`);
  console.log(`Games kicking off before ${D2.toISOString()} keep their rosters.\n`);

  const snap = await db.collection("games").orderBy("date", "desc").limit(6000).get();

  const toFlag = [];      // D+2 and later: flag, and remove non-Gold players
  const flagOnly = [];    // today/tomorrow: flag only, roster untouched
  const skipped = { pro: 0, padel: 0, notGold: 0, already: 0, past: 0, oneOff: 0 };

  for (const doc of snap.docs) {
    const g = doc.data();
    if (g.gold_exclusive === true) { skipped.already++; continue; }
    if ((g.sport || "soccer") === "padel") { skipped.padel++; continue; }
    const name = (g.centre || "").toLowerCase();
    if (!list.some((f) => name.includes(f))) { skipped.notGold++; continue; }
    const kickoff = g.date ? g.date.toDate() : null;
    if (!kickoff || kickoff < new Date()) { skipped.past++; continue; }

    // RECURRING GAMES ONLY. One-off player games already run through
    // publishGame and are flagged at 91%; the ones that are not were a
    // deliberate choice by their organizer, and this script does not overrule
    // anybody. The defect is specific to the repeater path.
    if (!g.repeater) { skipped.oneOff++; continue; }

    // Pro-organized games are never gated.
    let isPro = false;
    if (g.organizer) {
      const o = await db.collection("users").doc(g.organizer).get();
      const t = o.exists ? o.data().type : null;
      isPro = t === "pro" || t === "super_pro";
    }
    if (isPro) { skipped.pro++; continue; }

    (kickoff >= D2 ? toFlag : flagOnly).push({ ref: doc.ref, g, kickoff });
  }

  // Who would lose a spot?
  let removals = 0;
  const removalDetail = [];
  for (const item of toFlag) {
    const uids = [...new Set((item.g.teams || [])
      .filter((s) => s.user_id && !s.plus_one &&
        (s.status === "confirmed" || s.status === "reserved"))
      .map((s) => s.user_id))];
    if (!uids.length) continue;
    const docs = await db.getAll(...uids.map((u) => db.collection("users").doc(u)));
    const nonGold = docs.filter((d) => d.exists && d.data().gold_status !== true)
      .map((d) => d.id);
    if (nonGold.length) {
      removals += nonGold.length;
      removalDetail.push({ game: item.ref.id, centre: item.g.centre,
        kickoff: item.kickoff.toISOString().slice(0, 16), players: nonGold.length });
    }
  }

  console.log(`Flag + roster clean (D+2 onward): ${toFlag.length} games`);
  console.log(`Flag only (today/tomorrow)      : ${flagOnly.length} games`);
  console.log(`Non-Gold players to remove      : ${removals}`);
  console.log("\nskipped:", JSON.stringify(skipped));
  console.log("\nthe ten biggest roster changes:");
  removalDetail.sort((a, b) => b.players - a.players).slice(0, 10)
    .forEach((r) => console.log(`  ${r.players} players  ${r.kickoff}  ${r.centre}`));

  if (!WRITE) {
    console.log("\nDry run. Nothing written. Re-run with --write.");
    process.exit(0);
  }

  let flagged = 0;
  for (const item of [...toFlag, ...flagOnly]) {
    await item.ref.update({ gold_exclusive: true });
    flagged++;
  }
  console.log(`\nFlagged ${flagged} games.`);
  console.log("Roster removals are NOT performed by this script — see the note below.");
  process.exit(0);
})();
