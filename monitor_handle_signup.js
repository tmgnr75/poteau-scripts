/**
 * Watch handleSignup after the gen2 cutover (2026-09-16 10:13Z).
 *
 * gen1 handleNewUser is DELETED. Nothing else sends the one-time code, so a
 * failure here means nobody can finish an email signup, silently, with no
 * resend path in the app. That is the only outcome this script exists to
 * catch, and it grades on RATE against the measured baseline, never on a bare
 * count: a quiet hour looks identical to a broken function if you count.
 *
 * Baseline measured 2026-09-15: ~65 signups/day, ~9/day on the email OTC path.
 *
 * Posts to Slack. Defaults to #health-reports; set MONITORING_WEBHOOK_ENV to a
 * #monitoring webhook file once one exists. Use --dry to print only.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const admin = require("firebase-admin");
const serviceAccount = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: "krank-club" });
const db = admin.firestore();

const CUTOVER = new Date("2026-09-16T10:13:00Z");
const DRY = process.argv.includes("--dry");

const BASELINE_PER_DAY = 65;
const BASELINE_EMAIL_PER_DAY = 9;

// A webhook is bound to one channel forever, so #monitoring needs its own file.
// Falls back to the health webhook rather than failing: a monitor that cannot
// post is worse than one posting to the wrong channel.
const WEBHOOK_ENV = process.env.MONITORING_WEBHOOK_ENV
    || path.join(os.homedir(), ".poteau", "monitoring_webhook.env");
const FALLBACK_ENV = path.join(os.homedir(), ".poteau", "slack_webhook.env");

function webhookUrl() {
    if (process.env.SLACK_WEBHOOK_URL) return { url: process.env.SLACK_WEBHOOK_URL, from: "env" };
    for (const [file, label] of [[WEBHOOK_ENV, "#monitoring"], [FALLBACK_ENV, "#health-reports"]]) {
        try {
            const m = fs.readFileSync(file, "utf8")
                .match(/^\s*(?:export\s+)?SLACK_WEBHOOK_URL\s*=\s*["']?([^"'\r\n]+)/m);
            if (m) return { url: m[1], from: label };
        } catch { /* try the next one */ }
    }
    throw new Error(`No webhook found. Create ${WEBHOOK_ENV} with SLACK_WEBHOOK_URL="https://hooks.slack.com/..."`);
}

async function main() {
    const now = Date.now();
    const hoursLive = Math.max(0.1, (now - CUTOVER.getTime()) / 3600000);

    const since = new Date(Math.max(CUTOVER.getTime(), now - 24 * 3600 * 1000));
    const snap = await db.collection("users")
        .where("created_time", ">=", admin.firestore.Timestamp.fromDate(since))
        .select("connector", "email", "email_code", "signup_handled_at",
                "signup_blocked_reason", "created_time")
        .get();

    let total = 0, email = 0, handled = 0, blocked = 0;
    const unhandled = [];
    snap.forEach((doc) => {
        const d = doc.data();
        if (!d.connector) return; // not an app signup
        total++;
        if (d.connector === "email") email++;
        if (d.signup_blocked_reason) { blocked++; return; }
        if (d.signup_handled_at) handled++;
        else unhandled.push({ uid: doc.id, email: d.email, connector: d.connector,
                              created: d.created_time?.toDate?.() });
    });

    const ratePerDay = (total / hoursLive) * 24;
    const emailRate = (email / hoursLive) * 24;

    let severity, note;
    if (hoursLive < 3) {
        severity = "grey";
        note = `Only ${hoursLive.toFixed(1)}h since cutover — too early to judge the rate.`;
    } else if (total === 0) {
        severity = "red";
        note = "NO signups reached handleSignup since cutover. gen1 is deleted: check the trigger is still attached.";
    } else if (unhandled.length > 0 && unhandled.length >= total * 0.2) {
        severity = "red";
        note = `${unhandled.length} of ${total} signups have no signup_handled_at — the function is not completing.`;
    } else if (emailRate < BASELINE_EMAIL_PER_DAY * 0.3 && email === 0) {
        severity = "orange";
        note = `No email signups in ${hoursLive.toFixed(1)}h (baseline ~${BASELINE_EMAIL_PER_DAY}/day). The OTC path is what changed.`;
    } else if (ratePerDay < BASELINE_PER_DAY * 0.5) {
        severity = "orange";
        note = `Signup rate ~${Math.round(ratePerDay)}/day vs baseline ~${BASELINE_PER_DAY}/day.`;
    } else {
        severity = "green";
        note = `Signup rate ~${Math.round(ratePerDay)}/day vs baseline ~${BASELINE_PER_DAY}/day — normal.`;
    }

    const icon = { green: "✅", orange: "🟠", red: "🚨", grey: "⏳" }[severity];
    const lines = [
        `${icon} *handleSignup — gen2 cutover watch*`,
        "",
        `Live ${hoursLive.toFixed(1)}h. *${total}* signups, ${email} via email, ${handled} handled, ${blocked} blocked.`,
        note,
    ];

    if (unhandled.length) {
        lines.push("", `*${unhandled.length} signup(s) with no signup_handled_at:*`);
        unhandled.slice(0, 10).forEach((u) =>
            lines.push(`• \`${u.email || u.uid}\` (${u.connector}) ${u.created?.toISOString().slice(11, 16) || ""}`));
        lines.push("_These users may have received no verification code. There is no resend path._");
    }

    if (blocked) {
        lines.push("", `${blocked} signup(s) blocked on a throwaway domain. If any looks like a real player, the list is too broad.`);
    }

    const text = lines.join("\n");
    console.log(text.replace(/\*/g, ""));
    if (DRY) { console.log("\n(--dry, not posted)"); process.exit(0); }

    const { url, from } = webhookUrl();
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
    });
    console.log(`\nPosted to ${from}: ${res.status} ${await res.text()}`);
    process.exit(severity === "red" ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
