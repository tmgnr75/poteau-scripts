/**
 * Campaign Roster Snapshot
 *
 * Freezes the recipient list for a campaign into Firestore, assigning each
 * user to a wave based on their engagement at snapshot time.
 *
 * WHY THIS EXISTS
 * ---------------
 * If waves are computed as live queries at send time, the roster shifts
 * underneath the campaign. A user inactive for 200 days is scheduled for a
 * late wave; they reopen the app on D1 and now match "active <= 30 days", a
 * wave that already went out, so they are silently skipped forever. The
 * reverse produces double-sends.
 *
 * Freezing membership once removes that entire class of bug. Later activity
 * cannot move anyone between waves.
 *
 * Addresses on the SES account-level suppression list are excluded here, so
 * we never burn send-rate on addresses SES will reject anyway.
 *
 * Usage:
 *   node prepareCampaign.js <campaign-id>
 *   node prepareCampaign.js <campaign-id> --force   # rebuild an existing snapshot
 */

const admin = require('firebase-admin');
const { SESv2Client, ListSuppressedDestinationsCommand } = require('@aws-sdk/client-sesv2');
const fs = require('fs');
const path = require('path');

const serviceAccount = require('../krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});
const db = admin.firestore();

const sesv2 = new SESv2Client({
    region: 'eu-north-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const DAY_MS = 86400000;

// Waves are ordered most-engaged first. Early waves generate positive
// signals (opens, no complaints) before the dormant bulk is sent.
const WAVES = [
    { wave: 1, label: 'active <= 30 days', maxAgeDays: 30 },
    { wave: 2, label: '31-180 days', maxAgeDays: 180 },
    { wave: 3, label: '181-365 days', maxAgeDays: 365 },
    { wave: 4, label: '> 365 days / never active', maxAgeDays: Infinity },
];

function waveFor(lastActivity, now) {
    if (!lastActivity) return 4;
    const ageDays = (now - lastActivity.getTime()) / DAY_MS;
    for (const w of WAVES) {
        if (ageDays <= w.maxAgeDays) return w.wave;
    }
    return 4;
}

async function fetchSuppressionList() {
    const suppressed = new Set();
    let nextToken;
    do {
        const res = await sesv2.send(new ListSuppressedDestinationsCommand({
            PageSize: 1000,
            NextToken: nextToken,
        }));
        (res.SuppressedDestinationSummaries || []).forEach(d => {
            suppressed.add(d.EmailAddress.toLowerCase());
        });
        nextToken = res.NextToken;
    } while (nextToken);
    return suppressed;
}

async function main() {
    const args = process.argv.slice(2);
    const campaignId = args.find(a => !a.startsWith('--'));
    const force = args.includes('--force');

    if (!campaignId) {
        console.error('Usage: node prepareCampaign.js <campaign-id> [--force]');
        process.exit(1);
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.error('AWS credentials not found in environment.');
        process.exit(1);
    }

    const campaignPath = path.join(__dirname, 'campaigns', `${campaignId}.json`);
    if (!fs.existsSync(campaignPath)) {
        console.error(`Campaign JSON not found: ${campaignPath}`);
        process.exit(1);
    }

    const rosterRef = db.collection('newsletter_recipients').doc(campaignId);
    const existing = await rosterRef.get();
    if (existing.exists && !force) {
        const d = existing.data();
        console.error(`Snapshot already exists for "${campaignId}" (${d.total} recipients, frozen ${d.frozen_at?.toDate?.().toISOString()}).`);
        console.error('Refusing to overwrite. Re-run with --force only if nothing has been sent yet.');
        process.exit(1);
    }

    if (existing.exists && force) {
        // Guard: never rebuild a roster that has already been partly delivered,
        // or those users would be sent to twice.
        const sentProbe = await rosterRef.collection('users')
            .where('sent_at', '!=', null).limit(1).get();
        if (!sentProbe.empty) {
            console.error('This snapshot already has delivered rows. Rebuilding would cause double-sends.');
            console.error('Create a new campaign id instead.');
            process.exit(1);
        }
    }

    console.log(`\nBuilding roster snapshot for: ${campaignId}`);

    console.log('Fetching SES suppression list...');
    const suppressed = await fetchSuppressionList();
    console.log(`  ${suppressed.size} suppressed addresses will be excluded`);

    console.log('Reading users...');
    const snap = await db.collection('users').where('auth_email', '!=', false).get();

    const now = Date.now();
    const rows = [];
    const excluded = { noEmail: 0, banned: 0, pro: 0, suppressed: 0, duplicate: 0 };
    const seenEmails = new Set();
    const waveCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const langCounts = { fr: 0, en: 0, es: 0, it: 0 };

    snap.forEach(doc => {
        const d = doc.data();
        if (!d.email) { excluded.noEmail++; return; }
        if (d.banned === true) { excluded.banned++; return; }
        if (d.type === 'pro' || d.type === 'super_pro') { excluded.pro++; return; }

        const email = d.email.toLowerCase().trim();
        if (suppressed.has(email)) { excluded.suppressed++; return; }
        // Two accounts sharing an address must not both receive the mail.
        if (seenEmails.has(email)) { excluded.duplicate++; return; }
        seenEmails.add(email);

        const lang = ['fr', 'en', 'es', 'it'].includes(d.language) ? d.language : 'fr';
        const wave = waveFor(d.last_activity_date?.toDate?.(), now);

        waveCounts[wave]++;
        langCounts[lang]++;

        rows.push({
            uid: doc.id,
            email: d.email,
            display_name: d.display_name || '',
            language: lang,
            wave,
            sent_at: null,
        });
    });

    console.log(`\nWriting ${rows.length} rows...`);
    const usersCol = rosterRef.collection('users');

    // Clear any prior (unsent) snapshot rows before rewriting.
    if (existing.exists && force) {
        let cleared = 0;
        while (true) {
            const old = await usersCol.limit(500).get();
            if (old.empty) break;
            const b = db.batch();
            old.forEach(doc => b.delete(doc.ref));
            await b.commit();
            cleared += old.size;
        }
        if (cleared) console.log(`  cleared ${cleared} previous rows`);
    }

    for (let i = 0; i < rows.length; i += 500) {
        const batch = db.batch();
        rows.slice(i, i + 500).forEach(r => {
            batch.set(usersCol.doc(r.uid), r);
        });
        await batch.commit();
        process.stdout.write(`\r  ${Math.min(i + 500, rows.length)}/${rows.length}`);
    }
    console.log('');

    await rosterRef.set({
        campaign_id: campaignId,
        frozen_at: admin.firestore.FieldValue.serverTimestamp(),
        total: rows.length,
        wave_counts: waveCounts,
        language_counts: langCounts,
        excluded,
    });

    console.log(`\nRoster frozen: ${rows.length} recipients`);
    WAVES.forEach(w => {
        console.log(`  wave ${w.wave} (${w.label}): ${waveCounts[w.wave]}`);
    });
    console.log(`\nBy language: FR ${langCounts.fr} | EN ${langCounts.en} | ES ${langCounts.es} | IT ${langCounts.it}`);
    console.log(`\nExcluded:`);
    console.log(`  no email:        ${excluded.noEmail}`);
    console.log(`  banned:          ${excluded.banned}`);
    console.log(`  pro/super_pro:   ${excluded.pro}`);
    console.log(`  SES suppressed:  ${excluded.suppressed}`);
    console.log(`  duplicate email: ${excluded.duplicate}`);
    console.log(`\nNext: node sendNewsletter.js ${campaignId} --test`);

    process.exit(0);
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
