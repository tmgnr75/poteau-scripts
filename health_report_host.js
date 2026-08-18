/**
 * Host adapter for the daily health report.
 *
 * WHY THIS FILE EXISTS. The report runs in two places now:
 *
 *   the Mac      launchd at 08:30, `node daily_health_report.js`
 *   the cloud    a scheduled Cloud Function, immune to the Mac being asleep
 *
 * Everything the report actually DOES — the Firestore counts, the error
 * triage, the cron staleness rules, the Slack blocks — is identical in both.
 * Only three things differ, and they are exactly the three things a Cloud
 * Function cannot do:
 *
 *   readLogs      the Mac shells out to `gcloud logging read`; the cloud has
 *                 no gcloud binary and uses @google-cloud/logging
 *   listCronJobs  same story, `gcloud scheduler jobs list` vs the REST API
 *   postSlack     the Mac reads ~/.poteau/slack_webhook.env; the cloud reads
 *                 process.env.SLACK_WEBHOOK_URL
 *   recentDeploys the Mac reads local git; the cloud has no checkout, so it
 *                 reports nothing rather than lying
 *
 * THE POINT IS THAT THERE IS ONE REPORT, NOT TWO. A forked copy would drift:
 * a threshold tuned on the Mac would silently not apply in the cloud, and the
 * two would start disagreeing about whether production is healthy. So the
 * report logic lives in daily_health_report.js and takes a host; this file is
 * the Mac host, and the Cloud Function supplies its own.
 *
 * Not used directly — daily_health_report.js requires it when run on the Mac.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');

const PROJECT = 'krank-club';

// The admin SA, never a user account. User OAuth tokens expire and cannot be
// refreshed from launchd — there is no browser to prompt — which is what
// killed the 08:30 run before 2026-08-04. Service-account keys do not expire.
const ACCOUNT = 'firebase-adminsdk-bl4zy@krank-club.iam.gserviceaccount.com';

function gcloud(args, account) {
  if (account) {
    execFileSync('gcloud', ['config', 'set', 'core/account', account], { stdio: 'pipe' });
  }
  return execFileSync('gcloud', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * Read log entries matching a filter.
 *
 * Returns a normalised shape so the report never touches a gcloud-specific or
 * library-specific field: { service, textPayload, status, latency, userAgent }.
 * The cloud host returns the same shape from a completely different API.
 */
function readLogs(filter, { limit = 1000, withDetail = false } = {}) {
  // JSON, not `--format=value(...)`.
  //
  // The tab-separated format cannot represent a textPayload containing
  // newlines, and most real errors here ARE stack traces. Splitting that output
  // on "\n" turned every continuation line into a separate entry whose service
  // name was a stack frame ("at ProxyTracer.startActiveSpan"), inflating a
  // 7-error day into dozens. Heuristics to rejoin the lines get most of it back
  // but not all — "Connection failed with status DEADLINE_EXCEEDED." is
  // unindented and indistinguishable from a fresh row.
  //
  // JSON has no such ambiguity, and it makes this host parse the same SHAPE the
  // cloud host already parses, so the two cannot disagree about what an entry is.
  const raw = gcloud(
    ["logging", "read", filter, `--project=${PROJECT}`, `--limit=${limit}`, "--format=json"],
    ACCOUNT
  );
  let entries;
  try {
    entries = JSON.parse(raw || "[]");
  } catch (e) {
    console.error(`[healthReport] could not parse gcloud JSON: ${e.message}`);
    return [];
  }

  // Pull a human-readable line out of either payload shape.
  //
  // `error` BEFORE `message`. With firebase-functions' logger,
  // `logger.error("letsPay error", { error: err.message })` puts the CAUSE in
  // `error` and its own generic label in `message` -- so preferring `message`
  // yields "Error: letsPay error", which names the function we already knew was
  // failing and hides "You did not provide an API key", which is the finding.
  const extractText = (entry) => {
    if (typeof entry.textPayload === "string") return entry.textPayload;
    const j = entry.jsonPayload;
    if (!j || typeof j !== "object") return "";
    for (const k of ["error", "message", "stack"]) {
      const v = j[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    return "";
  };

  return entries
    .filter((e) => {
      // Same rule as the cloud host: an entry with neither label is not Cloud
      // Function output (scheduler bookkeeping, audit-log protos) and must not
      // be counted as a production error.
      const l = (e.resource && e.resource.labels) || {};
      return Boolean(l.service_name || l.function_name);
    })
    .map((e) => {
      const l = (e.resource && e.resource.labels) || {};
      const http = e.httpRequest || {};
      return {
        service: l.service_name || l.function_name || "unknown",
        // textPayload OR jsonPayload, matching the cloud host.
        //
        // gen2 logs structurally (`logger.error("msg", {...})`), which lands in
        // jsonPayload and leaves textPayload null. Reading only textPayload is
        // why the 2026-08-17 letsPay report could name the failing service but
        // not the Stripe "no API key" cause sitting in jsonPayload.message.
        // Scheduler/audit records carry none of these keys and still yield "".
        textPayload: extractText(e),
        status: http.status != null ? String(http.status) : "",
        latency: http.latency != null ? String(http.latency) : "",
        userAgent: http.userAgent || "",
        // Which container served it — lets the report tell a poisoned instance
        // apart from a genuinely broken dependency.
        instanceId: (e.labels && e.labels.instanceId) || "",
      };
    });
}

/** Scheduler jobs as { name, schedule, lastAttempt }. */
function listCronJobs() {
  const raw = gcloud(
    ["scheduler", "jobs", "list", `--project=${PROJECT}`, "--location=europe-west1",
      "--format=value(name.basename(),schedule,lastAttemptTime)"],
    ACCOUNT
  );
  return raw
    .split("\n")
    .map((l) => l.split("\t"))
    .filter((p) => p.length >= 3 && p[2])
    .map(([name, schedule, lastAttempt]) => ({ name, schedule, lastAttempt }));
}

/**
 * Commits across the four repos in the window.
 *
 * Mac-only by nature: the cloud has no checkout. The cloud host returns [] and
 * the report simply omits the section rather than claiming "no deploys", which
 * would be a false statement rather than a missing one.
 */
function recentDeploys(sinceISO, untilISO) {
  const repos = ["cloud-functions", "scripts", "poteau-app", "poteau-max"];
  const out = [];
  for (const r of repos) {
    try {
      const log = execFileSync(
        "git",
        ["-C", `/Users/tmgnr/poteau-workspace/${r}`, "log", `--since=${sinceISO}`, `--until=${untilISO}`, "--oneline"],
        { encoding: "utf8" }
      );
      log.split("\n").filter(Boolean).forEach((line) => out.push(`${r}: ${line}`));
    } catch (e) {
      /* not a git repo, or no commits in the window */
    }
  }
  return out;
}

function slackWebhookUrl() {
  const path = `${process.env.HOME}/.poteau/slack_webhook.env`;
  const env = fs.readFileSync(path, "utf8");
  const url = (env.match(/SLACK_WEBHOOK_URL=["']?([^"'\n]+)/) || [])[1];
  if (!url) throw new Error("SLACK_WEBHOOK_URL not found in " + path);
  return url;
}

async function postSlack(payload) {
  // curl rather than fetch: this path has worked unattended from launchd since
  // 2026-08-03 and there is no reason to re-prove a new one on the Mac.
  execFileSync("curl", ["-s", "-X", "POST", "-H", "Content-type: application/json",
    "--data", JSON.stringify(payload), slackWebhookUrl()], { encoding: "utf8" });
  return true;
}

module.exports = {
  name: "mac",
  readLogs,
  listCronJobs,
  recentDeploys,
  postSlack,
};
