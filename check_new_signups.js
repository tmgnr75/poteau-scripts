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

/**
 * Canonical inbox, so alias tricks collapse onto the address they actually
 * reach. Gmail ignores dots and everything after a +, and no provider
 * distinguishes case. A banned account plus a live sibling on the same inbox is
 * ban evasion, and the checker was blind to it until 2026-09-16: it reported
 * "no hard signals" on a window containing m2eux.laa@gmail.com, two minutes and
 * one dot away from a banned m2euxlaa@gmail.com.
 */
function canonicalInbox(email) {
    const e = String(email || "").toLowerCase().trim();
    const [local, domain] = e.split("@");
    if (!domain) return e;
    if (/^(gmail|googlemail)\.com$/.test(domain)) {
        return `${local.split("+")[0].replace(/\./g, "")}@gmail.com`;
    }
    // Plus-addressing is near-universal; dot-folding is not, so only gmail
    // gets the dots stripped.
    return `${local.split("+")[0]}@${domain}`;
}

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
        byOrg.get(o).push({ ...d.data(), id: d.id });
    });

    // Every banned inbox, ever, canonicalised. A fresh signup reaching the same
    // inbox as a banned account is evasion regardless of how it is spelled.
    const bannedInbox = new Map();
    const bannedPhone = new Map();
    const normPhone = (s) => String(s || "")
        .replace(/[\s.\-()]/g, "").replace(/\+33/g, "0").replace(/0033/g, "0");
    const allUsers = await db.collection("users")
        .select("email", "banned", "display_name", "phone_number").get();
    allUsers.forEach((d) => {
        const y = d.data();
        if (y.banned !== true) return;
        const c = canonicalInbox(y.email);
        if (c.includes("@")) bannedInbox.set(c, y.email);
        // EXACT number, not a 7-digit prefix block. Three of the live prefix
        // blocks already contain legitimate players, so prefix matching here
        // would flag real people; an exact repeat of a banned number does not.
        const p = normPhone(y.phone_number);
        if (p.length >= 9) bannedPhone.set(p, y.email);
    });

    const report = [];
    for (const doc of users.docs) {
        const x = doc.data();
        if (x.banned === true) continue;

        const hard = [], soft = [];

        const inbox = canonicalInbox(x.email);
        if (bannedInbox.has(inbox)) {
            hard.push(`SAME INBOX AS BANNED: ${bannedInbox.get(inbox)}`);
        }
        if (x.signup_blocked_reason) hard.push(`BLOCKED:${x.signup_blocked_reason}`);
        if (S.isDisposableEmail(x.email)) hard.push("disposable domain");
        if (x.phone_number && S.hasKnownPhone(x.phone_number)) hard.push("KNOWN OPERATOR PHONE");

        const phone = normPhone(x.phone_number);
        if (phone.length >= 9 && bannedPhone.has(phone)) {
            hard.push(`SAME PHONE AS BANNED: ${bannedPhone.get(phone)}`);
        }

        const msgs = await db.collection("messages")
            .where("author_id", "==", db.collection("users").doc(doc.id))
            .select("text", "created", "game_id")
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

        // Posting in a game you do not organise, days old, is the funnel's
        // other shape: no game of his own, so no venue and no fast-signup
        // signal, and a pitch too ordinary to match any phrase. That is exactly
        // how 20y3covv4s@yzcalo.com was missed on 2026-09-17 — signed up 13:27,
        // posted "on joue en futsal à côté du five ... 3 teams de 5" into
        // someone else's game at 13:34, and the 15:20 check said nothing.
        //
        // Not a HARD signal on its own: plenty of real players chat in games
        // they joined. But a brand-new account whose FIRST act is a message in
        // a stranger's game is worth a human glance every time.
        const ownGames = new Set(gs.map((g) => g.id).filter(Boolean));
        const foreign = human.filter((m) => m.game_id && !ownGames.has(m.game_id.id));
        if (foreign.length && gs.length === 0) {
            soft.push(`posts in others' games (${foreign.length})`);
        }
        for (const g of gs) {
            const gap = created && g.created_on
                ? Math.round((g.created_on.toDate() - created) / 60000) : null;
            if (gap !== null && gap <= 120) soft.push(`fast:${gap}min`);
            if (S.isFlaggedVenue(g.centre)) soft.push(`venue:${g.centre}`);
        }
        if (!x.display_name) soft.push("no name");
        if (!x.photo_url) soft.push("no photo");

        // Signup lane. connector === 'email' is the cheap one: any domain, no
        // provider standing between him and an account, so it is where he
        // operates at scale. A Google or Apple account costs real effort to
        // create, which is why he has only done it occasionally and never in a
        // burst. So an email signup is worth surfacing on lighter evidence
        // during an attack, while the same soft signals on Google or Apple are
        // ordinary.
        if (x.connector === "email") soft.push("email lane");

        // Lane-aware threshold. ONE soft signal is enough on the email lane:
        // that is the lane he uses at scale, and the 2026-09-17 miss had
        // exactly one ("posts in others' games") against a threshold of two.
        // Google and Apple still need three, because there the same signals
        // describe an ordinary new organiser and would bury the report.
        //
        // Cost of this is a longer report during a burst. That is the right
        // trade: a missed funnel message sits in a real organiser's chat
        // pulling their players away, and a false line in the report costs a
        // glance.
        const softNeeded = x.connector === "email" ? 1 : 3;
        if (hard.length || soft.length >= softNeeded) {
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
