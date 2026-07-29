/**
 * Draft (and optionally send) a per-centre Messenger nudge proposing the best
 * OFF-PEAK slots to open, based on real availability demand around that centre.
 *
 * Audience: type === 'pro' (never super_pro), centre_plan_status === 'active',
 * fewer than 6 games played this month AND fewer than 6 upcoming published
 * games. The second condition matters: several centres (GINGA STADIUM, LE FIVE
 * Bordeaux) have thousands of published games that are never marked 'played',
 * so "played" alone would flag busy centres as inactive.
 *
 * Slot demand replicates gen2/onGamePublished.js exactly — 50km Algolia
 * prefilter, then per-availability radius check, ±20min slot window — so the
 * numbers quoted to a centre are the number of players that would really be
 * invited if they opened that slot.
 *
 * Peak (excluded): weekdays Mon-Fri 19:00-20:59, when pitches are already
 * rented. Weekends have no peak, so weekend evenings are eligible.
 *
 * Usage:
 *   node draftOffPeakNudges.js --dry-run              write drafts to a file
 *   node draftOffPeakNudges.js --send                 send them
 *   node draftOffPeakNudges.js --send --only=<uid>    single centre
 */

const fs = require('fs');
const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});

const db = admin.firestore();

const SEARCH_RADIUS_M = 50000;
const DEFAULT_USER_RADIUS_M = 20000;
const MIN_PLAYERS_TO_SUGGEST = 40; // don't propose a slot with negligible demand
const SUGGESTIONS = 3;

const PEAK_START_MIN = 19 * 60;
const PEAK_END_MIN = 21 * 60;

const DAYS = {
    fr: { 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi', 7: 'Dimanche' },
    en: { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday' },
    es: { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo' },
    it: { 1: 'Lunedì', 2: 'Martedì', 3: 'Mercoledì', 4: 'Giovedì', 5: 'Venerdì', 6: 'Sabato', 7: 'Domenica' },
};

function haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

function isPeak(weekday, minutes) {
    if (weekday >= 6) return false; // weekend: no peak
    return minutes >= PEAK_START_MIN && minutes < PEAK_END_MIN;
}

// A centre only benefits from slots it can actually staff; keep evening slots.
function isReasonable(minutes) {
    return minutes >= 17 * 60 && minutes <= 22 * 60;
}

// French reads "20h" / "20h30" rather than "20:00" / "20:30".
function formatTime(time, lang) {
    if (lang !== 'fr') return time;
    const [h, m] = time.split(':');
    const hour = String(parseInt(h, 10));
    return m === '00' ? `${hour}h` : `${hour}h${m}`;
}

function buildMessage(lang, firstName, centreName, reachable, picks, dayNames, plural) {
    const lines = picks.map(
        (p) => `• ${dayNames[p.weekday]} ${formatTime(p.time, lang)} → ${p.users}`
    );

    if (lang === 'en') {
        return `Hi ${firstName}, it's Ben from Poteau.

Quick heads-up: we changed how invitations work. When you publish a game, we now automatically notify every player nearby whose saved availability matches that exact day and time. The better the slot, the more players get invited.

Around ${centreName} there are ${reachable} players with saved availability.

We left out weekday 7-9pm since your pitches are usually already booked then. Here are the best remaining slots for you, with how many players would be notified:

${lines.join('\n')}

If you open one of these, the invitations go out on their own.

Ben`;
    }

    if (lang === 'es') {
        return `Hola ${firstName}, soy Ben de Poteau.

Un aviso rápido: hemos cambiado el sistema de invitaciones. Cuando publicas un partido, avisamos automáticamente a todos los jugadores cercanos cuya disponibilidad coincide con ese día y esa hora. Cuanto mejor sea el horario, más jugadores reciben la invitación.

Alrededor de ${centreName} hay ${reachable} jugadores con disponibilidad registrada.

Hemos excluido las 19h-21h entre semana porque tus pistas suelen estar ya alquiladas. Estos son tus mejores horarios restantes, con el número de jugadores que serían avisados:

${lines.join('\n')}

Si abres uno de estos, las invitaciones salen solas.

Ben`;
    }

    if (lang === 'it') {
        return `Ciao ${firstName}, sono Ben di Poteau.

Una nota veloce: abbiamo cambiato il sistema di inviti. Quando pubblichi una partita, avvisiamo automaticamente tutti i giocatori vicini la cui disponibilità corrisponde a quel giorno e a quell'ora. Migliore è la fascia oraria, più giocatori vengono invitati.

Intorno a ${centreName} ci sono ${reachable} giocatori con disponibilità registrata.

Abbiamo escluso le 19-21 nei giorni feriali perché i tuoi campi sono di solito già affittati. Ecco le tue migliori fasce orarie rimanenti, con quanti giocatori verrebbero avvisati:

${lines.join('\n')}

Se apri una di queste, gli inviti partono da soli.

Ben`;
    }

    if (plural) {
        // Used when no individual contact name is on file, so we address the
        // team. Matches how this centre was last contacted.
        return `Salut ${firstName}, c'est Ben de Poteau.

Une info utile : on a changé le système d'invitations. Quand vous publiez un match, on prévient maintenant automatiquement tous les joueurs autour de vous dont les disponibilités correspondent à ce jour et cette heure précise. Plus le créneau est bon, plus il y a de joueurs invités.

Autour de ${centreName}, il y a ${reachable} joueurs qui ont enregistré leurs disponibilités.

On a écarté les créneaux 19h-21h en semaine, vu que vos terrains sont sûrement déjà loués à ces heures-là. Voici vos meilleurs créneaux restants, avec le nombre de joueurs qui seraient prévenus :

${lines.join('\n')}

Si vous en ouvrez un, les invitations partent toutes seules.

Ben`;
    }

    return `Salut ${firstName}, c'est Ben de Poteau.

Une info utile : on a changé le système d'invitations. Quand tu publies un match, on prévient maintenant automatiquement tous les joueurs autour de toi dont les disponibilités correspondent à ce jour et cette heure précise. Plus le créneau est bon, plus il y a de joueurs invités.

Autour de ${centreName}, il y a ${reachable} joueurs qui ont enregistré leurs disponibilités.

On a écarté les créneaux 19h-21h en semaine, vu que tes terrains sont sûrement déjà loués à ces heures-là. Voici tes meilleurs créneaux restants, avec le nombre de joueurs qui seraient prévenus :

${lines.join('\n')}

Si tu en ouvres un, les invitations partent toutes seules.

Ben`;
}

async function main() {
    const args = process.argv.slice(2);
    const send = args.includes('--send');
    const dryRun = args.includes('--dry-run');
    const onlyArg = args.find((a) => a.startsWith('--only='));
    const only = onlyArg ? onlyArg.split('=')[1] : null;

    if (!send && !dryRun) {
        console.log('Usage: node draftOffPeakNudges.js --dry-run | --send [--only=<uid>]');
        process.exit(1);
    }

    // Soccer Arena 13 already received a longer, bespoke version of this
    // analysis on 2026-07-29; excluded so they aren't messaged twice.
    const EXCLUDE = new Set(['Jmd7OmNaMwYhDEyGVYyeq7oxODC2']);

    const targets = JSON.parse(fs.readFileSync('_tmp_targets.json', 'utf8')).filter(
        (t) => !EXCLUDE.has(t.id)
    );
    const list = only ? targets.filter((t) => t.id === only) : targets;
    console.log(`Targets: ${list.length}`);

    // Load availabilities once; reused for every centre.
    console.log('Loading availabilities...');
    const snap = await db.collection('availabilities').get();
    const avail = [];
    snap.docs.forEach((d) => {
        const a = d.data();
        if (!a.location || a.location.latitude == null) return;
        avail.push({
            lat: a.location.latitude,
            lng: a.location.longitude,
            radius: typeof a.radius === 'number' ? a.radius : DEFAULT_USER_RADIUS_M,
            user: a.user_id,
            slots: a.slots || [],
        });
    });
    console.log(`availabilities usable: ${avail.length}\n`);

    const drafts = [];

    for (const t of list) {
        if (t.lat == null || t.lng == null) {
            console.log(`SKIP ${t.name}: no centre_location`);
            continue;
        }

        const slotUsers = {};
        const reachableUsers = new Set();
        for (const a of avail) {
            const dist = haversineMeters(a.lat, a.lng, t.lat, t.lng);
            if (dist > SEARCH_RADIUS_M || dist > a.radius) continue;
            reachableUsers.add(a.user);
            for (const s of a.slots) {
                (slotUsers[s] = slotUsers[s] || new Set()).add(a.user);
            }
        }

        const ranked = Object.entries(slotUsers)
            .map(([slot, set]) => {
                const [wd, time] = slot.split('-');
                const [h, m] = time.split(':').map(Number);
                return { weekday: +wd, time, minutes: h * 60 + m, users: set.size };
            })
            .filter((r) => r.weekday >= 1 && r.weekday <= 7)
            .filter((r) => isReasonable(r.minutes))
            .filter((r) => !isPeak(r.weekday, r.minutes))
            .filter((r) => r.users >= MIN_PLAYERS_TO_SUGGEST)
            .sort((a, b) => b.users - a.users);

        // One suggestion per weekday, so we don't propose 3 variants of one evening.
        const picks = [];
        const usedDays = new Set();
        for (const r of ranked) {
            if (usedDays.has(r.weekday)) continue;
            picks.push(r);
            usedDays.add(r.weekday);
            if (picks.length === SUGGESTIONS) break;
        }

        if (picks.length === 0) {
            console.log(`SKIP ${t.name}: no off-peak slot above ${MIN_PLAYERS_TO_SUGGEST} players`);
            continue;
        }

        const lang = DAYS[t.lang] ? t.lang : 'fr';

        // A usable contact name is a person's first name. Placeholders and
        // centre names are not, so those centres get addressed as a team
        // ("Salut l'équipe X") with plural phrasing instead.
        const raw = (t.first || '').trim();
        const looksLikePerson =
            raw &&
            raw !== '[Ton prénom]' &&
            !/^(le five|lefive|sport)$/i.test(raw) &&
            !t.name.toLowerCase().includes(raw.toLowerCase());

        const plural = !looksLikePerson;
        const greeting = looksLikePerson ? raw : `l'équipe ${t.name}`;

        drafts.push({
            id: t.id,
            name: t.name,
            lang,
            tokens: t.tokens,
            reachable: reachableUsers.size,
            picks,
            plural,
            text: buildMessage(lang, greeting, t.name, reachableUsers.size, picks, DAYS[lang], plural),
        });
    }

    fs.writeFileSync('_tmp_drafts.json', JSON.stringify(drafts, null, 1));
    console.log(`\n=== ${drafts.length} DRAFTS ===\n`);
    drafts.forEach((d) => {
        console.log('='.repeat(70));
        console.log(`${d.name}  [${d.lang}]  uid=${d.id}  tokens=${d.tokens}  reachable=${d.reachable}`);
        console.log('='.repeat(70));
        console.log(d.text);
        console.log('');
    });

    if (!send) {
        console.log('\nDry run. Drafts written to _tmp_drafts.json. Nothing sent.');
        process.exit(0);
    }

    let sent = 0;
    for (const d of drafts) {
        const userRef = db.collection('users').doc(d.id);

        // Safety: never message a super_pro, and re-check plan status at send time.
        const snapshot = await userRef.get();
        if (snapshot.get('type') !== 'pro') {
            console.log(`SKIP ${d.name}: type is ${snapshot.get('type')}`);
            continue;
        }
        if (snapshot.get('centre_plan_status') !== 'active') {
            console.log(`SKIP ${d.name}: plan ${snapshot.get('centre_plan_status')}`);
            continue;
        }

        await db.collection('messenger').add({
            text: d.text,
            sent_at: admin.firestore.Timestamp.now(),
            conversation_with: userRef,
            sender: 'poteau',
        });
        await userRef.update({
            centre_unread_messenger: admin.firestore.FieldValue.increment(1),
        });
        console.log(`sent -> ${d.name}`);
        sent++;
    }
    console.log(`\nSent ${sent} message(s).`);
    process.exit(0);
}

main().catch((e) => {
    console.error('FAILED:', e.message);
    process.exit(1);
});
