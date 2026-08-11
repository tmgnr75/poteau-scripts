// Health check for the roster-placement change (addPlayer.js, deployed
// 2026-08-11). Read-only: reads Firestore and Cloud Function logs, writes
// nothing except a Slack message.
//
// What it is actually watching for, in order of seriousness:
//   1. addPlayer ERRORS -- the change touches the join path, so a spike means
//      roll back rather than investigate slowly.
//   2. SPLIT HOSTS created since the deploy -- the bug this was meant to kill.
//      A host with a `+1` on the side they do not play is a regression now.
//   3. Sides going lopsided -- placement balances when a joiner has nobody to
//      join, so a drift here means the balancing arm is wrong.
//   4. Overfilled sides -- more spots occupied on one side than the roster
//      allows would mean placement wrote somewhere it should not have.
//
//   node monitor_placement.js            # print a report
//   node monitor_placement.js --slack    # also post it to #health-reports
const { execSync } = require("child_process");
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(
    require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json")
  ),
  projectId: "krank-club",
});
const db = admin.firestore();

const POST_TO_SLACK = process.argv.includes("--slack");
// Deploy time. Anything created after this is the new code's work.
const DEPLOY_AT = new Date(process.env.DEPLOY_AT || "2026-08-11T14:20:00Z");
const WINDOW_MIN = Number(process.env.WINDOW_MIN || 10);

function cfErrors(minutes) {
  // The admin SA is the only account that can read logs -- see the memory note
  // about gcloud auth drifting back to tim@poteau.team.
  try {
    const freshness = `${minutes}m`;
    const out = execSync(
      `gcloud logging read ` +
        `'resource.type="cloud_run_revision" AND resource.labels.service_name="addplayer" AND severity>=ERROR' ` +
        `--project=krank-club --freshness=${freshness} --limit=50 --format='value(textPayload)' 2>/dev/null`,
      { encoding: "utf8", timeout: 60000 }
    ).trim();
    return out ? out.split("\n").filter(Boolean) : [];
  } catch (e) {
    return [`(could not read logs: ${String(e.message).slice(0, 80)})`];
  }
}

/**
 * Hosts whose group is split AND could have been kept together.
 *
 * A split is only a fault if the host's own side had room for the group. A
 * group larger than half the roster MUST overflow: one organiser registering
 * 9 people into a 10-spot game fills their side and the rest necessarily play
 * on the other. Counting those as failures makes the monitor cry wolf on the
 * most normal thing in the data (55.7% of occupied spots are +1s).
 */
function splitHosts(teams) {
  const out = [];
  const ids = [...new Set(teams.filter((s) => s && s.user_id).map((s) => s.user_id))];
  for (const id of ids) {
    const mine = teams.filter((s) => s && s.user_id === id);
    const playing = new Set(mine.filter((s) => !s.plus_one).map((s) => s.team_side));
    const guesting = new Set(mine.filter((s) => s.plus_one).map((s) => s.team_side));
    if (!playing.size) continue; // guests only: nothing to be split from
    const side = [...playing][0];
    const sideCapacity = teams.filter((s) => s && s.team_side === side).length;
    // Could the whole group have fitted on the host's side?
    if (mine.length > sideCapacity) continue; // physically impossible, not a fault
    for (const g of guesting) {
      if (!playing.has(g)) {
        out.push(id);
        break;
      }
    }
  }
  return [...new Set(out)];
}

(async () => {
  const since = new Date(Date.now() - 36 * 3600 * 1000);
  const snap = await db
    .collection("games")
    .where("date", ">=", since)
    .limit(600)
    .get();

  let games = 0;
  let joinsSinceDeploy = 0;
  const splitGames = [];
  const lopsided = [];
  const overfilled = [];

  for (const doc of snap.docs) {
    const teams = doc.get("teams");
    if (!Array.isArray(teams) || !teams.length) continue;
    games++;

    const a = teams.filter((s) => s && s.team_side === "team_a");
    const b = teams.filter((s) => s && s.team_side === "team_b");
    const aTaken = a.filter((s) => s.status !== "open").length;
    const bTaken = b.filter((s) => s.status !== "open").length;

    // Only games touched since the deploy are evidence about the new code.
    const touched = doc.get("created_on")?.toDate?.() >= DEPLOY_AT;
    if (touched) joinsSinceDeploy += aTaken + bTaken;

    const split = splitHosts(teams);
    if (split.length) {
      splitGames.push({ id: doc.id, n: split.length, touched });
    }
    if (Math.abs(aTaken - bTaken) > 1 && aTaken + bTaken >= 4) {
      lopsided.push({ id: doc.id, a: aTaken, b: bTaken, touched });
    }
    if (aTaken > a.length || bTaken > b.length) {
      overfilled.push({ id: doc.id, a: `${aTaken}/${a.length}`, b: `${bTaken}/${b.length}` });
    }
  }

  const errs = cfErrors(WINDOW_MIN);
  const newSplits = splitGames.filter((g) => g.touched);
  const ok = errs.length === 0 && newSplits.length === 0 && overfilled.length === 0;

  const lines = [];
  lines.push(`${ok ? "✅" : "🚨"} *Roster placement* — addPlayer, last ${WINDOW_MIN}min`);
  lines.push(`• addPlayer errors: *${errs.length}*`);
  lines.push(`• games inspected: ${games} (last 36h)`);
  lines.push(
    `• split hosts in games created since deploy: *${newSplits.length}*` +
      (newSplits.length ? ` ← REGRESSION` : "")
  );
  lines.push(`• split hosts in older games (pre-existing, expected): ${splitGames.length - newSplits.length}`);
  lines.push(`• lopsided sides (>1 apart): ${lopsided.length}`);
  lines.push(`• overfilled sides: *${overfilled.length}*`);
  if (errs.length) {
    lines.push("```" + errs.slice(0, 3).join("\n").slice(0, 600) + "```");
  }
  if (newSplits.length) {
    lines.push("new splits: " + newSplits.slice(0, 5).map((g) => g.id).join(", "));
  }
  if (overfilled.length) {
    lines.push("overfilled: " + overfilled.slice(0, 5).map((g) => `${g.id} a=${g.a} b=${g.b}`).join(", "));
  }

  const report = lines.join("\n");
  console.log(report);

  if (POST_TO_SLACK) {
    const url = process.env.SLACK_WEBHOOK_URL;
    if (!url) {
      console.error("SLACK_WEBHOOK_URL not set — source ~/.poteau/slack_webhook.env");
      process.exit(1);
    }
    const payload = JSON.stringify({ text: report });
    execSync(
      `curl -s -X POST -H 'Content-type: application/json' --data ${JSON.stringify(payload)} "${url}" >/dev/null`,
      { timeout: 30000 }
    );
    console.log("\n(posted to Slack)");
  }
  process.exit(0);
})().catch((e) => {
  console.error("monitor failed:", e.message);
  process.exit(1);
});
