/**
 * Incremental operator check: everything since the LAST run, not a fixed window.
 *
 * Keeps a watermark in .signup_check_state.json so repeated checks during an
 * attack never re-report the same accounts and never leave a gap between them.
 * First run falls back to 2 hours.
 *
 * Reports two tiers, because conflating them is how a real player gets banned:
 *
 *   HARD  - a signal only the operator produces: a known burner number, a
 *           throwaway domain, an OPERATOR_SCRIPT phrase, a blocked signup.
 *           Act on these.
 *   soft  - fast signup, flagged venue, harvest phrasing, no photo. Ordinary
 *           for a real new organiser. Context only, never a reason on its own.
 *
 * Read-only. --reset to clear the watermark, --since=30m to override.
 */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const serviceAccount = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: "krank-club" });
const db = admin.firestore();

const S = require(path.join(__dirname, "../cloud-functions/functions/shared/spamSignature.js"));

const STATE = path.join(__dirname, ".signup_check_state.json");
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1];

function watermark() {
    if (process.argv.includes("--reset")) return null;
    const since = arg("since");
    if (since) {
        const m = since.match(/^(\d+)([mh])$/);
        if (m) return new Date(Date.now() - Number(m[1]) * (m[2] === "h" ? 3600 : 60) * 1000);
    }
    try {
        return new Date(JSON.parse(fs.readFileSync(STATE, "utf8")).last);
    } catch { return null; }
}

async function main() {
    const last = watermark();
    const since = last || new Date(Date.now() - 2 * 3600 * 1000);
    const now = new Date();

    // Paris, not UTC. Tim reads these next to his own clock, and a UTC time
    // two hours behind reads as a stale or broken watermark.
    const paris = (d) => d.toLocaleString("fr-FR", {
        timeZone: "Europe/Paris", day: "2-digit", month: "2-digit",
        hour: "2-digit", minute: "2-digit",
    });
    console.log(`since ${paris(since)} Paris → now ${paris(now)}${last ? "" : "  (first run, 2h fallback)"}`);

    const users = await db.collection("users")
        .where("created_time", ">=", admin.firestore.Timestamp.fromDate(since))
        .select("email", "display_name", "phone_number", "banned", "connector",
                "created_time", "signup_blocked_reason", "photo_url", "hash_pic")
        .get();

    // One games read, indexed by organizer, rather than a query per account.
    const games = await db.collection("games")
        .select("organizer", "centre", "created_on", "status", "attendees", "max_players")
        .get();
    const byOrg = new Map();
    games.forEach((d) => {
        const o = d.data().organizer;
        if (typeof o !== "string") return;
        if (!byOrg.has(o)) byOrg.set(o, []);
        byOrg.get(o).push(d.data());
    });

    const report = [];
    for (const doc of users.docs) {
        const x = doc.data();
        if (x.banned === true) continue;

        const hard = [], soft = [];
        if (x.signup_blocked_reason) hard.push(`BLOCKED:${x.signup_blocked_reason}`);
        if (S.isDisposableEmail(x.email)) hard.push("disposable domain");
        if (x.phone_number && S.hasKnownPhone(x.phone_number)) hard.push("KNOWN OPERATOR PHONE");

        const msgs = await db.collection("messages")
            .where("author_id", "==", db.collection("users").doc(doc.id))
            .select("text", "created")
            .get();
        const human = msgs.docs.map((m) => m.data())
            .filter((m) => { const t = m.text || ""; return t && !/^(a |⚠)/.test(t); });

        for (const m of human) {
            const t = m.text || "";
            if (S.matchesOperatorScript(t)) hard.push("OPERATOR SCRIPT");
            else if (S.hasKnownPhone(t)) hard.push("KNOWN PHONE IN MESSAGE");
            else if (S.looksLikeHarvest(t)) soft.push("harvest phrasing");
        }

        const created = x.created_time?.toDate?.();
        const gs = byOrg.get(doc.id) || [];
        for (const g of gs) {
            const gap = created && g.created_on
                ? Math.round((g.created_on.toDate() - created) / 60000) : null;
            if (gap !== null && gap <= 120) soft.push(`fast:${gap}min`);
            if (S.isFlaggedVenue(g.centre)) soft.push(`venue:${g.centre}`);
        }
        if (!x.display_name) soft.push("no name");
        if (!x.photo_url) soft.push("no photo");

        if (hard.length || soft.length >= 2) {
            report.push({ uid: doc.id, x, created, gs, human,
                          hard: [...new Set(hard)], soft: [...new Set(soft)] });
        }
    }

    console.log(`${users.size} signup(s), ${report.length} worth a look\n`);

    report.sort((a, b) => b.hard.length - a.hard.length || a.created - b.created);
    for (const r of report) {
        const tag = r.hard.length ? "ACT" : "   ";
        console.log(`${tag} ${r.uid} | ${r.x.display_name || "(no name)"} | ${r.x.email}`);
        console.log(`    ${paris(r.created)} ${r.x.connector || "?"} | ${r.x.phone_number || "no phone"} | ${r.gs.length} game(s) | ${r.human.length} msg(s)`);
        if (r.hard.length) console.log(`    HARD: ${r.hard.join(" · ")}`);
        if (r.soft.length) console.log(`    soft: ${r.soft.join(" · ")}`);
        r.gs.forEach((g) => console.log(`      ${g.centre} | ${g.status} | kickoff ${g.date?.toDate?.() ? paris(g.date.toDate()) : "?"}`));
        r.human.slice(0, 2).forEach((m) => console.log(`      "${(m.text || "").replace(/\n/g, " ").slice(0, 120)}"`));
        console.log("");
    }

    if (!report.length) console.log("nothing\n");
    const acting = report.filter((r) => r.hard.length).length;
    console.log(acting ? `${acting} with a HARD signal` : "no hard signals");

    fs.writeFileSync(STATE, JSON.stringify({ last: now.toISOString() }, null, 2));
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
