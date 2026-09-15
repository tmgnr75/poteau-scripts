/**
 * Signup health after the disposable-domain block (deployed 2026-09-15 07:32Z).
 *
 * THE FAILURE THIS EXISTS TO CATCH
 *
 * handleNewUser now withholds the verification code from throwaway domains.
 * It sits on the signup path for every new account in both apps, so the
 * dangerous outcome is not "it blocked someone" -- it is "it blocked
 * EVERYONE", or threw before scheduling the activation tasks. Both look like
 * silence from the user's side: no code arrives, and there is no resend path.
 *
 * So this reports the rate, not the count, and compares against the measured
 * baseline of ~65 signups/day (~9/day on the email OTC path).
 *
 * Posts to #health-reports via ~/.poteau/slack_webhook.env, matching
 * daily_health_report.js. Use --dry to print without posting.
 *
 * Read-only against Firestore.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const admin = require("firebase-admin");
const serviceAccount = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: "krank-club" });
const db = admin.firestore();

const DEPLOYED_AT = new Date("2026-09-15T07:32:41Z");
const DRY = process.argv.includes("--dry");

// Measured on 2026-09-15 immediately before deploy.
const BASELINE_PER_DAY = 65;
const BASELINE_EMAIL_PER_DAY = 9;

const WEBHOOK_ENV = path.join(os.homedir(), ".poteau", "slack_webhook.env");

function webhookUrl() {
    const fromEnv = process.env.SLACK_WEBHOOK_URL;
    if (fromEnv) return fromEnv;
    const file = fs.readFileSync(WEBHOOK_ENV, "utf8");
    const m = file.match(/^\s*(?:export\s+)?SLACK_WEBHOOK_URL\s*=\s*["']?([^"'\r\n]+)/m);
    if (!m) throw new Error(`SLACK_WEBHOOK_URL not found in ${WEBHOOK_ENV}`);
    return m[1];
}

async function countSince(since) {
    const s = await db.collection("users")
        .where("created_time", ">=", admin.firestore.Timestamp.fromDate(since))
        .select("connector", "email", "signup_blocked_reason")
        .get();
    let email = 0, blocked = 0;
    const blockedEmails = [];
    s.forEach((d) => {
        const x = d.data();
        if (x.connector === "email") email++;
        if (x.signup_blocked_reason) {
            blocked++;
            blockedEmails.push({ uid: d.id, email: x.email });
        }
    });
    return { total: s.size, email, blocked, blockedEmails };
}

async function main() {
    const now = Date.now();
    const sinceDeploy = await countSince(DEPLOYED_AT);
    const last24 = await countSince(new Date(now - 24 * 3600 * 1000));

    const hoursLive = Math.max(0.1, (now - DEPLOYED_AT.getTime()) / 3600000);
    const ratePerDay = (sinceDeploy.total / hoursLive) * 24;
    const emailRatePerDay = (sinceDeploy.email / hoursLive) * 24;

    // Grade by RATE against the baseline, never by a bare count -- a low count
    // a few hours after deploy is normal, a collapsed rate is not.
    let severity = "green", note;
    if (hoursLive < 3) {
        severity = "grey";
        note = `Only ${hoursLive.toFixed(1)}h since deploy — too early to judge the rate.`;
    } else if (sinceDeploy.total === 0) {
        severity = "red";
        note = "NO signups at all since deploy. Check handleNewUser for a throw before task scheduling.";
    } else if (emailRatePerDay < BASELINE_EMAIL_PER_DAY * 0.3 && sinceDeploy.email === 0) {
        severity = "orange";
        note = `No email signups in ${hoursLive.toFixed(1)}h (baseline ~${BASELINE_EMAIL_PER_DAY}/day). Watch — the OTC path is the one that changed.`;
    } else if (ratePerDay < BASELINE_PER_DAY * 0.5) {
        severity = "orange";
        note = `Signup rate ~${Math.round(ratePerDay)}/day vs baseline ~${BASELINE_PER_DAY}/day.`;
    } else {
        note = `Signup rate ~${Math.round(ratePerDay)}/day vs baseline ~${BASELINE_PER_DAY}/day — normal.`;
    }

    const icon = { green: "✅", orange: "🟠", red: "🚨", grey: "⏳" }[severity];

    const lines = [
        `${icon} *Signup health — disposable-domain block*`,
        "",
        `Deployed ${DEPLOYED_AT.toISOString().slice(0, 16).replace("T", " ")}Z, live ${hoursLive.toFixed(1)}h.`,
        `Since deploy: *${sinceDeploy.total}* signups (${sinceDeploy.email} via email/OTC).`,
        `Last 24h: ${last24.total} signups (${last24.email} via email).`,
        note,
    ];

    if (sinceDeploy.blocked > 0) {
        lines.push("", `*${sinceDeploy.blocked} signup(s) blocked* on a throwaway domain:`);
        sinceDeploy.blockedEmails.forEach((b) => lines.push(`• \`${b.email}\` (${b.uid})`));
        lines.push("_If any of those look like a real player, the list is too broad — they cannot tell us, there is no resend path._");
    } else {
        lines.push("", "No signups blocked yet.");
    }

    const text = lines.join("\n");
    console.log(text.replace(/\*/g, ""));

    if (DRY) { console.log("\n(--dry, not posted)"); process.exit(0); }

    const res = await fetch(webhookUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
    });
    console.log(`\nPosted to #health-reports: ${res.status} ${await res.text()}`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
