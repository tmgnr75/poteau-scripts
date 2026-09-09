/**
 * Watch LE PARK Servon for its first published games, and say so on Slack.
 *
 * Le Park got its Poteau Max account on 2026-09-09 with 591 players already
 * holding alerts on the venue. The thing worth knowing is whether Emmanuel
 * actually publishes anything, and there is no existing signal for that: the
 * daily health report does not track individual centres.
 *
 * WHAT COUNTS AS "HIS" GAME
 * -------------------------
 * Only games whose `organizer` is the centre's uid. Players have organized 469
 * games at this place_id since 2023 and keep doing so, so filtering on
 * place_id would fire on a stranger's game and report a launch that never
 * happened.
 *
 * SELF-TERMINATING
 * ----------------
 * State lives in a JSON file next to this script. Once the centre has
 * published its first game the watch posts once, records it, and every later
 * run exits immediately. It also stops on its own after DEADLINE_DAYS so a
 * centre that never launches does not leave an agent polling forever - that is
 * itself a finding, and it is reported once before the watch retires.
 *
 * Run:
 *   node watch_lepark_first_games.js           check, print, no Slack
 *   SLACK=1 node watch_lepark_first_games.js   post to #health-reports
 *   node watch_lepark_first_games.js --status  show state and exit
 *   node watch_lepark_first_games.js --reset   clear state (start over)
 *
 * Scheduled hourly by com.poteau.leparkwatch.plist.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const https = require('https');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});
const db = admin.firestore();

const UID = 'VeBdqhGJRZSOrajilg8pefl2PEk1';
const CENTRE_NAME = 'LE PARK Servon';
const PLACE_ID = 'ChIJMU8gErUJ5kcRSnpvacKwFtM';
const STATE_FILE = path.join(__dirname, '.lepark_watch_state.json');
const ONBOARDED = '2026-09-09';
const DEADLINE_DAYS = 30;

const args = process.argv.slice(2);
const POST = process.env.SLACK === '1';

function readState() {
    try {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch {
        return { announced: [], firstGameAnnounced: false, retired: false };
    }
}

function writeState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function slack(text) {
    if (!POST) {
        console.log('\n--- would post to Slack ---\n' + text + '\n---');
        return Promise.resolve();
    }
    // Same webhook the other watches use. Sourced from the env file rather
    // than hardcoded; a webhook is bound to one channel forever.
    const url = process.env.SLACK_WEBHOOK_URL;
    if (!url) {
        console.error('SLACK=1 but SLACK_WEBHOOK_URL is not set. Not posting.');
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        const body = JSON.stringify({ text });
        const req = https.request(
            url,
            { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
            (res) => {
                res.resume();
                res.on('end', resolve);
            }
        );
        req.on('error', (e) => {
            console.error('Slack post failed:', e.message);
            resolve();
        });
        req.write(body);
        req.end();
    });
}

function fmtDate(d) {
    return d.toLocaleString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long',
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
    });
}

async function main() {
    const state = readState();

    if (args.includes('--status')) {
        console.log(JSON.stringify(state, null, 2));
        process.exit(0);
    }
    if (args.includes('--reset')) {
        writeState({ announced: [], firstGameAnnounced: false, retired: false });
        console.log('State cleared.');
        process.exit(0);
    }
    if (state.retired) {
        console.log('Watch retired, nothing to do. Use --reset to restart.');
        process.exit(0);
    }

    // Games the CENTRE published. Not place_id: players organize here too.
    const snap = await db.collection('games').where('organizer', '==', UID).get();

    const games = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((g) => g.status === 'published' || g.status === 'played')
        .sort((a, b) => (a.date?.toDate?.() || 0) - (b.date?.toDate?.() || 0));

    const fresh = games.filter((g) => !state.announced.includes(g.id));

    console.log(`${CENTRE_NAME}: ${games.length} game(s) published by the centre, ${fresh.length} new since last check.`);

    if (fresh.length > 0) {
        const lines = fresh.map((g) => {
            const when = g.date?.toDate ? fmtDate(g.date.toDate()) : 'date inconnue';
            const players = new Set((g.attendees || []).map((r) => r.path)).size;
            const price = g.price ? `${g.price}${g.currency === 'EUR' ? ' EUR' : ''}` : 'prix non renseigné';
            return `• ${when} — ${players}/${g.max_players || '?'} joueurs, ${price}`;
        });

        const header = state.firstGameAnnounced
            ? (fresh.length === 1
                ? `*${CENTRE_NAME}* a publié un nouveau match`
                : `*${CENTRE_NAME}* a publié ${fresh.length} nouveaux matchs`)
            : (fresh.length === 1
                ? `🎉 *${CENTRE_NAME}* vient de publier son premier match sur Poteau Max`
                : `🎉 *${CENTRE_NAME}* vient de publier ses ${fresh.length} premiers matchs sur Poteau Max`);

        await slack([header, ...lines].join('\n'));

        state.announced.push(...fresh.map((g) => g.id));
        state.firstGameAnnounced = true;
        writeState(state);
        console.log('Announced.');
        process.exit(0);
    }

    // Nothing yet. Retire the watch once the deadline passes, reporting the
    // silence once - a centre that never launches is the thing worth knowing.
    const daysSince = Math.floor((Date.now() - new Date(ONBOARDED).getTime()) / 86400000);
    if (!state.firstGameAnnounced && daysSince >= DEADLINE_DAYS) {
        // Are players still organizing here without him? That is the useful
        // contrast: demand exists, the centre is not using it.
        const byPlayers = await db.collection('games')
            .where('place_id', '==', PLACE_ID)
            .where('date', '>=', admin.firestore.Timestamp.fromDate(new Date(ONBOARDED)))
            .get();

        const n = byPlayers.size;
        const byPlayersLine = n === 0
            ? 'Sur la même période, aucun match non plus du côté des joueurs.'
            : n === 1
                ? 'Sur la même période, 1 match a été organisé chez lui par un joueur.'
                : `Sur la même période, ${n} matchs ont été organisés chez lui par des joueurs.`;

        await slack(
            `⚠️ *${CENTRE_NAME}* n'a toujours pas publié de match, ${daysSince} jours après l'ouverture du compte.\n` +
            `${byPlayersLine}\n` +
            `_Surveillance arrêtée. Relancer avec --reset si besoin._`
        );
        state.retired = true;
        writeState(state);
        console.log('Deadline reached, watch retired.');
        process.exit(0);
    }

    console.log(`Nothing to announce (day ${daysSince}/${DEADLINE_DAYS}).`);
    process.exit(0);
}

main().catch((e) => {
    console.error('FAILED:', e.message);
    process.exit(1);
});
