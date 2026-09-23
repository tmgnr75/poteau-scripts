/**
 * Operator hunter — scores new accounts on the behaviour he cannot hide.
 *
 * WHY THIS EXISTS ALONGSIDE check_new_signups.js
 *
 * That script scores signup-shape (lane, domain, speed). It went blind on
 * 2026-09-17 when he moved to gmail: pro.chatelard@gmail.com has a photo, a
 * real-looking address and a plausible name, and nothing in the signup itself
 * separates it from a genuine new player.
 *
 * What does separate it is what he does next. From that account, in two days:
 *
 *   8 games created, 6 of them at flagged Paris venues, 5 already cancelled,
 *   games posted 1-2 days ahead across four different centres, and a funnel
 *   message in chat.
 *
 * A real new organiser books one pitch, maybe two. Nobody legitimate opens
 * eight games at six venues in 48 hours and cancels most of them: the games
 * are bait for the chat, and the chat is the funnel.
 *
 * SCORING. Each signal is worth points; the total decides the verdict. Points
 * rather than a conjunction because he drops one signal at a time — domain,
 * then wording, then timing — and a conjunction fails the moment any single
 * leg is missing.
 *
 * Tim asked for "too far rather than too safe" (2026-09-19, while AFK), so
 * BAN_AT is deliberately reachable by behaviour alone. Every automatic ban is
 * reversible and is posted to #spam with its full reasoning.
 *
 * Usage:
 *   node hunt_operator.js                 report only, last 48h
 *   node hunt_operator.js --since=24h
 *   node hunt_operator.js --ban           apply bans at or above BAN_AT
 */
const path = require("path");
const admin = require("firebase-admin");
const serviceAccount = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: "krank-club" });
const db = admin.firestore();

const S = require(path.join(__dirname, "../cloud-functions/functions/shared/spamSignature.js"));
const { applySpamBan } = require(path.join(__dirname, "../cloud-functions/functions/shared/spamBan.js"));

const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1];
const APPLY = process.argv.includes("--ban");

const BAN_AT = 6;      // auto-ban at or above this
const REVIEW_AT = 3;   // report between REVIEW_AT and BAN_AT

const normPhone = (s) => String(s || "")
    .replace(/[\s.\-()]/g, "").replace(/\+33/g, "0").replace(/0033/g, "0");

/**
 * A blurhash that means "no picture", not "this picture".
 *
 * Measured 2026-09-21: 3,061 accounts share `KCMtaOof0000ay_3xufQ~q` and 298
 * share `L00000fQfQfQ…`. These are the default avatar and near-blank uploads,
 * so matching on them says nothing about identity. It produced a false positive
 * the first time the photo check ran: a new account was scored against
 * lekmine.najibe@gmail.com purely because both had the blank placeholder.
 *
 * The giveaway is the payload: a real blurhash encodes colour variation, while
 * these degenerate to a run of the same character.
 */
function isPlaceholderHash(h) {
    const s = String(h || "");
    if (s.length < 12) return true;
    // `fQfQfQ…`, `0000`, or any hash whose body is one repeated pair.
    if (/(fQ){4,}/.test(s)) return true;
    if (/0{4,}/.test(s)) return true;
    const uniq = new Set(s.slice(2)).size;
    return uniq <= 6;
}

const canonicalInbox = (email) => {
    const e = String(email || "").toLowerCase().trim();
    const [l, d] = e.split("@");
    if (!d) return e;
    if (/^(gmail|googlemail)\.com$/.test(d)) return `${l.split("+")[0].replace(/\./g, "")}@gmail.com`;
    return `${l.split("+")[0]}@${d}`;
};

function windowStart() {
    const since = arg("since") || "48h";
    const m = since.match(/^(\d+)([mh])$/);
    const mult = m && m[2] === "h" ? 3600 : 60;
    return new Date(Date.now() - (m ? Number(m[1]) : 48) * mult * 1000);
}

async function main() {
    const since = windowStart();
    const paris = (d) => d?.toLocaleString("fr-FR", {
        timeZone: "Europe/Paris", day: "2-digit", month: "2-digit",
        hour: "2-digit", minute: "2-digit",
    }) || "?";

    console.log(`hunting since ${paris(since)} Paris${APPLY ? "  [--ban ACTIVE]" : "  (report only)"}\n`);

    const users = await db.collection("users")
        .where("created_time", ">=", admin.firestore.Timestamp.fromDate(since))
        .select("email", "display_name", "phone_number", "banned", "connector",
                "created_time", "signup_blocked_reason", "photo_url", "hash_pic",
                "played_games", "positive_reports")
        .get();

    const games = await db.collection("games")
        .select("organizer", "centre", "created_on", "status", "date", "attendees", "max_players")
        .get();
    const byOrg = new Map();
    games.forEach((d) => {
        const o = d.data().organizer;
        if (typeof o !== "string") return;
        if (!byOrg.has(o)) byOrg.set(o, []);
        byOrg.get(o).push({ ...d.data(), id: d.id });
    });

    // Known-bad identity, for the evasion checks.
    const bannedPhone = new Map();
    const bannedInbox = new Map();
    const bannedHash = new Map();
    const bannedLocalTokens = new Map();
    const all = await db.collection("users")
        .select("email", "banned", "phone_number", "hash_pic", "banned_by", "banned_reason").get();
    all.forEach((d) => {
        const y = d.data();
        if (y.banned !== true) return;
        // Only OUR spam bans justify acting on a match.
        //
        // An unattributed ban gets a second chance (697 of 722 predate the
        // audit that added these fields), and a CENTRE's ban is not ours to
        // enforce: banned_by values like "Stadium Thiais", "LE FIVE Paris 18"
        // and "Foot POWER 5" mean a venue barred someone from their pitch, not
        // that we barred them from Poteau. Treating those as ours produced a
        // false positive on 2026-09-21 against lekmine.najibe@gmail.com.
        const ours = y.banned_reason === "spam"
            || /^(tim|hunt_operator|onMessageSpamCheck|scanSpamOffenders)/i.test(y.banned_by || "");
        if (!ours) return;
        const p = normPhone(y.phone_number);
        if (p.length >= 9) bannedPhone.set(p, y.email);
        const c = canonicalInbox(y.email);
        if (c.includes("@")) bannedInbox.set(c, y.email);
        if (y.hash_pic && !isPlaceholderHash(y.hash_pic)) bannedHash.set(y.hash_pic, y.email);
        String(y.email || "").toLowerCase().split("@")[0]
            .split(/[^a-z]+/).filter((t) => t.length >= 6)
            .forEach((t) => { if (!bannedLocalTokens.has(t)) bannedLocalTokens.set(t, y.email); });
    });

    const rows = [];
    for (const doc of users.docs) {
        const x = doc.data();
        if (x.banned === true) continue;

        const created = x.created_time?.toDate?.();
        const gs = byOrg.get(doc.id) || [];
        const score = [];
        let points = 0;

        const add = (p, label) => { points += p; score.push(`${label} (+${p})`); };

        // How fast the account went from signup to its first kickoff. Measured
        // against the game DATE rather than created_on, because created_on is
        // absent on games written by the max app and would read as null there.
        const firstKickoff = gs
            .map((g) => g.date?.toDate?.())
            .filter(Boolean)
            .sort((a, b) => a - b)[0];
        const firstGameAgeDays = (created && firstKickoff)
            ? (firstKickoff - created) / 86400000
            : null;

        // ---- identity reuse: decisive on its own ----
        const ph = normPhone(x.phone_number);
        if (ph.length >= 9 && bannedPhone.has(ph)) add(6, `phone of banned ${bannedPhone.get(ph)}`);

        // NOT DONE: adjacent phone numbers and reused name tokens.
        //
        // Both looked compelling and both were wrong, measured 2026-09-21
        // before shipping. He does buy consecutive burners (0680445698 and
        // 0680446652 are one apart) and he does recycle a surname across
        // providers (colinchatelard@aol.com, pro.chatelard@gmail.com,
        // arthurchatelard95@yahoo.com). But scored against every live account:
        //
        //   phone within 2000 of a banned number -> 53 real players
        //   local-part token shared with a banned account -> 56 real players
        //
        // "corentin" alone matched a dozen genuine users, because a banned
        // account carrying a common French first name poisons the token. The
        // phone gap fails for the same reason at a different scale: French
        // mobile ranges are dense, so proximity is coincidence far more often
        // than it is the same buyer.
        //
        // Either could work with a much tighter bound -- a gap under 50, or
        // tokens that are rare across the whole user base rather than merely
        // long -- but neither is safe as written, and a signal that bans is not
        // worth shipping on a guess.

        const inbox = canonicalInbox(x.email);
        if (bannedInbox.has(inbox)) add(6, `inbox of banned ${bannedInbox.get(inbox)}`);
        if (x.hash_pic && bannedHash.has(x.hash_pic)) add(6, `photo of banned ${bannedHash.get(x.hash_pic)}`);

        // ---- signup surface ----
        if (S.isDisposableEmail(x.email)) add(6, "throwaway domain");
        if (x.signup_blocked_reason) add(6, `signup blocked: ${x.signup_blocked_reason}`);
        if (x.phone_number && S.hasKnownPhone(x.phone_number)) add(6, "known operator phone block");

        // "That's weird" domains: worth a single point, never more.
        //
        // He abandoned throwaway domains once they were blocked and moved to
        // mainstream ones. On 2026-09-22 and 23 he used outlook.fr twice
        // (samy.zaouali@, louis.breda93@), which is what put it on this list.
        //
        // It CANNOT be a gate, and the lift says so. Measured 2026-09-23 across
        // 107,181 accounts against a 0.0327% platform spam-ban rate:
        //
        //   aol.com      40 accounts,  5 spam = 382.8x lift
        //   gmx.fr       60 accounts,  1 spam =  51.0x
        //   outlook.fr 1,610 accounts, 2 spam =   3.8x
        //   yahoo.com    701 accounts, 1 spam =   4.4x
        //   gmail.com 66,167 accounts, 6 spam =   0.28x
        //
        // outlook.fr at 3.8x is below yahoo.com, and nobody thinks yahoo means
        // anything. 1,577 of its 1,610 accounts are live and hold 13,419
        // positive reports between them. So it earns +1 and cannot approach
        // BAN_AT on its own, which needs six.
        //
        // aol.com and gmx.fr are already in TEMP_BLOCKED_EXACT_DOMAINS /
        // OPERATOR_EMAIL_DOMAINS, so isDisposableEmail() above scores them 6 and
        // this line never double-counts them.
        const WEIRD_BUT_LEGITIMATE_DOMAINS = new Set(["outlook.fr"]);
        const emailDomain = String(x.email || "").toLowerCase().split("@")[1] || "";
        if (WEIRD_BUT_LEGITIMATE_DOMAINS.has(emailDomain)) add(1, `${emailDomain} (weak: 3.8x lift)`);

        // ---- what he does with the account ----
        const flagged = gs.filter((g) => S.isFlaggedVenue(g.centre));
        const venues = new Set(gs.map((g) => (g.centre || "").toLowerCase()).filter(Boolean));
        const cancelled = gs.filter((g) => g.status === "canceled");

        // Volume, but ONLY when the games are spread across venues or land on
        // flagged ones. Raw volume at a single pitch is what a real organiser
        // does: romain.ichbiah opened 8 games at Centre sportif Suchet in the
        // same 48h as the operator's 8, and scored identically until this gate
        // was added. One venue means a regular booking their own slot; many
        // venues means fishing.
        const spreadOrFlagged = venues.size >= 3 || flagged.length >= 2;
        if (spreadOrFlagged) {
            if (gs.length >= 6) add(4, `${gs.length} games in the window`);
            else if (gs.length >= 4) add(3, `${gs.length} games in the window`);
            else if (gs.length >= 3) add(2, `${gs.length} games in the window`);
        } else if (gs.length >= 4) {
            score.push(`${gs.length} games but all at ${venues.size} venue (+0)`);
        }

        // Straight from signup to one of his five venues. Another "that's
        // weird": measured 2026-09-23 over the last 30 days, 36 mainstream-domain
        // accounts organised at a flagged venue within 2 days of signing up. 7
        // were his and 29 are live and ordinary -- roughly 1 in 5. That is far
        // too dirty to gate on and exactly the right shape for +1.
        //
        // It leans on the venue list, which is only five Paris pitches, so a real
        // player who happens to book one of them on day one is the common case,
        // not the exception. The flagged-venue points below are separate and
        // still apply; this adds the SPEED, which they do not measure.
        if (flagged.length && firstGameAgeDays !== null && firstGameAgeDays <= 2) {
            add(1, `at a flagged venue ${firstGameAgeDays.toFixed(1)}d after signup`);
        }

        if (flagged.length >= 3) add(3, `${flagged.length} at flagged venues`);
        else if (flagged.length >= 2) add(2, `${flagged.length} at flagged venues`);
        else if (flagged.length === 1) add(1, "1 at a flagged venue");

        // VENUE SPREAD is the sharpest discriminator found so far. Ranked every
        // organiser who created a game in the 72h to 2026-09-19: the operator
        // was 8 games across 8 DIFFERENT venues. Every other high-volume
        // organiser — centres (lefive.fr, stadium.thiais, footpowerfive) and
        // long-standing players with hundreds of positive reports — runs at
        // ONE venue, sometimes two or three. Nobody legitimate books eight
        // different pitches in two days, because a real organiser plays where
        // they play.
        if (venues.size >= 6) add(4, `${venues.size} DIFFERENT venues`);
        else if (venues.size >= 4) add(3, `${venues.size} different venues`);
        else if (venues.size >= 3 && gs.length >= 3) add(1, `${venues.size} different venues`);
        // Cancelling most of your games is ordinary for a real organiser whose
        // pitch keeps falling through -- jean-michel-m cancelled 5 of 6 with
        // 313 positive reports behind him. It only counts alongside spread.
        if (spreadOrFlagged && gs.length >= 3 && cancelled.length >= gs.length * 0.5) {
            add(2, `${cancelled.length}/${gs.length} cancelled`);
        }

        // ---- what he writes ----
        const msgs = await db.collection("messages")
            .where("author_id", "==", db.collection("users").doc(doc.id))
            .select("text", "game_id").get();
        const human = msgs.docs.map((m) => m.data())
            .filter((m) => { const t = m.text || ""; return t && !/^(a |⚠)/.test(t); });

        let scriptHit = false, phoneHit = false, harvestHit = false;
        human.forEach((m) => {
            const t = m.text || "";
            if (S.matchesOperatorScript(t)) scriptHit = true;
            else if (S.hasKnownPhone(t)) phoneHit = true;
            else if (S.looksLikeHarvest(t)) harvestHit = true;
        });
        if (scriptHit) add(6, "OPERATOR_SCRIPT phrase");
        if (phoneHit) add(6, "known operator number in a message");
        if (harvestHit) add(2, "harvest phrasing");

        // A funnel pitch posted into games he does not run.
        const own = new Set(gs.map((g) => g.id));
        const foreign = human.filter((m) => m.game_id && !own.has(m.game_id.id));
        if (foreign.length >= 3) add(2, `posts in ${foreign.length} games he does not run`);

        // ---- history that argues AGAINST acting ----
        const played = Array.isArray(x.played_games) ? x.played_games.length : 0;
        const positive = Array.isArray(x.positive_reports) ? x.positive_reports.length : 0;
        if (positive >= 3 || played >= 2) {
            points -= 5;
            score.push(`real history: ${positive} positive, ${played} played (-5)`);
        }

        if (points >= REVIEW_AT) {
            rows.push({ uid: doc.id, x, created, gs, human, points, score, flagged, cancelled });
        }
    }

    rows.sort((a, b) => b.points - a.points);
    console.log(`${users.size} signups, ${rows.length} scoring >= ${REVIEW_AT}\n`);

    const toBan = rows.filter((r) => r.points >= BAN_AT);

    for (const r of rows) {
        const tag = r.points >= BAN_AT ? "BAN " : "look";
        console.log(`${tag} [${r.points}] ${r.uid} | ${r.x.display_name || "(no name)"} | ${r.x.email}`);
        console.log(`     ${paris(r.created)} ${r.x.connector || "?"} | ${r.x.phone_number || "no phone"} | ${r.gs.length} games | ${r.human.length} msgs`);
        console.log(`     ${r.score.join(" · ")}`);
        r.gs.slice(0, 8).forEach((g) => console.log(`       ${g.centre} | ${g.status}${S.isFlaggedVenue(g.centre) ? " [FLAGGED]" : ""}`));
        r.human.slice(0, 3).forEach((m) => console.log(`       "${(m.text || "").replace(/\n/g, " ").slice(0, 110)}"`));
        console.log("");
    }

    if (!APPLY) {
        console.log(toBan.length
            ? `${toBan.length} would be banned. Re-run with --ban to apply.`
            : "nothing at ban threshold.");
        process.exit(0);
    }

    for (const r of toBan) {
        try {
            const res = await applySpamBan({
                db, admin, uid: r.uid,
                bannedBy: "hunt_operator (autonomous, Tim AFK 2026-09-19)",
                logPrefix: `[hunt] [${r.uid}]`,
            });
            console.log(`BANNED ${r.x.email} — ${res.deleted} msg deleted, ${res.canceledGames}/${res.totalGames} games cancelled`);
        } catch (e) {
            console.error(`FAILED to ban ${r.x.email}: ${e.message}`);
        }
    }
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
