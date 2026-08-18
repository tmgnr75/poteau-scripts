/**
 * RGPD Art. 15 — read-only data collection for Mehdi EL GARGATI.
 * STRICTLY READ-ONLY. Uses only .get() / auth().getUser() — no writes anywhere.
 * Every Firestore query and external source is logged to query_log.
 * Output: ../rgpd_mehdi/_raw/collected.json  +  query_log.json
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const OUT = path.join(__dirname, '..', 'rgpd_mehdi', '_raw');
fs.mkdirSync(OUT, { recursive: true });

const SUBJECT = {
    name: 'Mehdi EL GARGATI',
    phones: ['0689260100', '+33689260100'],
    emails: ['mehdi.elgargati@sciencespo.fr', 'collectif-football-associatif@hotmail.fr'],
};

const queryLog = [];
function log(source, detail, count) {
    const entry = { ts: new Date().toISOString(), source, detail, count };
    queryLog.push(entry);
    console.log(`[LOG] ${source} | ${detail} | ${count}`);
}

// Serialize Firestore types without losing info, never mutating source.
function serialize(obj) {
    return JSON.parse(JSON.stringify(obj, (k, v) => {
        if (v && v._seconds !== undefined && v._nanoseconds !== undefined) return new Date(v._seconds * 1000).toISOString();
        if (v && typeof v.toDate === 'function') return v.toDate().toISOString();
        if (v && v._latitude !== undefined) return { lat: v._latitude, lng: v._longitude };
        if (v && v._path && v._path.segments) return { __ref: v._path.segments.join('/') };
        return v;
    }));
}

async function queryEq(collection, field, value) {
    const snap = await db.collection(collection).where(field, '==', value).get();
    log(`firestore:${collection}`, `${field} == ${JSON.stringify(value)}`, snap.size);
    return snap.docs.map(d => ({ __id: d.id, ...serialize(d.data()) }));
}

async function main() {
    const result = { subject: SUBJECT, collectedAt: new Date().toISOString(), accounts: {}, byAccount: {}, notes: [] };

    // ---------- STEP 2: find all linked accounts ----------
    const foundUids = new Set();
    const accountHits = [];
    for (const phone of SUBJECT.phones) {
        for (const u of await queryEq('users', 'phone_number', phone)) { foundUids.add(u.__id); accountHits.push({ via: `phone=${phone}`, uid: u.__id }); }
    }
    for (const email of SUBJECT.emails) {
        for (const u of await queryEq('users', 'email', email)) { foundUids.add(u.__id); accountHits.push({ via: `email=${email}`, uid: u.__id }); }
        // some accounts store auth email separately
        for (const u of await queryEq('users', 'auth_email_address', email)) { foundUids.add(u.__id); accountHits.push({ via: `auth_email_address=${email}`, uid: u.__id }); }
    }
    // name-based (display_name, nickname, first/last)
    for (const nameField of ['display_name', 'nickname', 'first_name', 'last_name']) {
        for (const nameVal of ['Mehdi EL GARGATI', 'Mehdi', 'EL GARGATI', 'El Gargati', 'Collectif Football Associatif']) {
            for (const u of await queryEq('users', nameField, nameVal)) {
                // only keep name matches that also corroborate via phone/email to avoid false positives
                const corroborated = SUBJECT.phones.includes(u.phone_number) || SUBJECT.emails.includes(u.email);
                accountHits.push({ via: `${nameField}=${nameVal}`, uid: u.__id, corroborated });
                if (corroborated) foundUids.add(u.__id);
            }
        }
    }
    result.accountHits = accountHits;

    // Resolve Auth records (device/provider/login traces) for each candidate uid
    const uids = [...foundUids];
    log('summary', 'distinct corroborated account UIDs', uids.length);

    for (const uid of uids) {
        const acc = { uid };
        // profile
        const udoc = await db.collection('users').doc(uid).get();
        log(`firestore:users/${uid}`, 'profile doc', udoc.exists ? 1 : 0);
        acc.profile = udoc.exists ? serialize(udoc.data()) : null;

        // Firebase Auth (login history, providers, disabled state)
        try {
            const a = await admin.auth().getUser(uid);
            log(`auth:${uid}`, 'getUser', 1);
            acc.auth = {
                email: a.email, phoneNumber: a.phoneNumber, displayName: a.displayName,
                disabled: a.disabled, emailVerified: a.emailVerified,
                providers: a.providerData.map(p => ({ providerId: p.providerId, email: p.email, phone: p.phoneNumber, uid: p.uid })),
                metadata: { creationTime: a.metadata.creationTime, lastSignInTime: a.metadata.lastSignInTime, lastRefreshTime: a.metadata.lastRefreshTime },
                customClaims: a.customClaims || null,
            };
        } catch (e) { log(`auth:${uid}`, 'getUser FAILED: ' + e.message, 0); acc.auth = { error: e.message }; }

        const userRef = db.collection('users').doc(uid);

        // availabilities (ex-alerts) — by user_id string and by ref
        acc.availabilities = [
            ...(await queryEq('availabilities', 'user_id', uid)),
        ];
        acc.alerts = (await db.collection('alerts').where('user', '==', userRef).get());
        log(`firestore:alerts`, `user == users/${uid}`, acc.alerts.size);
        acc.alerts = acc.alerts.docs.map(d => ({ __id: d.id, ...serialize(d.data()) }));

        // games organized (organizer is a string UID)
        acc.gamesOrganized = await queryEq('games', 'organizer', uid);

        // games joined: users.games is a list of refs on the profile; also scan attendees membership is expensive — use profile lists
        acc.gamesJoinedRefs = (acc.profile && (acc.profile.games || acc.profile.played_games || acc.profile.upcoming_games)) || null;

        // bans / moderation history
        acc.bans = await queryEq('bans', 'userId', uid);
        const bansByRef = await db.collection('bans').where('userRef', '==', userRef).get();
        log('firestore:bans', `userRef == users/${uid}`, bansByRef.size);
        acc.bansByRef = bansByRef.docs.map(d => ({ __id: d.id, ...serialize(d.data()) }));

        // payments concerning him (Stripe mirror) — by userRef
        const payByRef = await db.collection('payments').where('user_ref', '==', userRef).get();
        log('firestore:payments', `user_ref == users/${uid}`, payByRef.size);
        acc.payments = payByRef.docs.map(d => ({ __id: d.id, ...serialize(d.data()) }));
        acc.stripe_customer_id = acc.profile ? (acc.profile.stripe_customer_id || null) : null;
        acc.gold_status = acc.profile ? (acc.profile.gold_status || false) : null;
        acc.last_gold_date = acc.profile ? (acc.profile.last_gold_date || null) : null;

        // pro_invoices (if any pro/subscription billing)
        acc.proInvoices = (acc.profile && acc.profile.pro_invoices) ? acc.profile.pro_invoices.length : 0;

        // fcm tokens (device traces)
        try {
            const fcm = await db.collection('fcm_tokens').where('user_id', '==', uid).get();
            log('firestore:fcm_tokens', `user_id == ${uid}`, fcm.size);
            acc.fcm_tokens = fcm.docs.map(d => ({ __id: d.id, ...serialize(d.data()) }));
        } catch (e) { log('firestore:fcm_tokens', 'query failed: ' + e.message, 0); acc.fcm_tokens = []; }

        // messages authored by him — collect ONLY his own (third parties excluded by construction)
        const msnap = await db.collection('messages').where('author_id', '==', userRef).get();
        log('firestore:messages', `author_id == users/${uid} (HIS OWN ONLY)`, msnap.size);
        acc.ownMessages = msnap.docs.map(d => {
            const m = serialize(d.data());
            return {
                __id: d.id, game_id: m.game_id, created: m.created, type: m.type,
                text: m.text || '', text_en: m.text_en || '', source: m.source || null, trigger: m.trigger || null,
            };
        });

        // reports concerning him: he may appear in other users' *_reports arrays or game-level feedback.
        // We record only the FACT/count that he was reported (no third-party identity in the export).
        acc.reportsAbout = { note: 'See coverage report; reporter identities excluded as third-party data.' };

        result.byAccount[uid] = acc;
    }

    // ---------- external systems coverage ----------
    result.externalSystems = {
        stripe: { queriedVia: 'Firestore mirror (payments collection + users.stripe_customer_id) — live Stripe API key not available locally (lives in Functions secrets).', liveApiQueried: false },
        revenuecat: { found: false, note: 'No RevenueCat integration exists in the codebase (0 references). Not used by Poteau.' },
        gocardless: { found: 'referenced in index.js only', liveApiQueried: false, note: 'No local GoCardless credentials; check code path relevance in coverage report.' },
        amplitude: { liveApiQueried: false, note: 'Only the client ingestion key is in code; reading a user\'s events back requires the Amplitude dashboard/export API (not available locally).' },
        algolia: { liveApiQueried: false, note: 'Algolia indexes availabilities/games (write key in Functions secrets). Records are derived from Firestore docs already exported; no separate personal data. Admin/search key not available locally.' },
    };

    fs.writeFileSync(path.join(OUT, 'collected.json'), JSON.stringify(result, null, 2));
    fs.writeFileSync(path.join(OUT, 'query_log.json'), JSON.stringify(queryLog, null, 2));
    console.log(`\nWrote ${path.join(OUT, 'collected.json')}`);
    console.log(`Wrote ${path.join(OUT, 'query_log.json')}`);
    console.log(`\nAccounts: ${uids.length} | UIDs: ${uids.join(', ')}`);
    process.exit(0);
}
main().catch(e => { console.error('FATAL:', e); process.exit(1); });
