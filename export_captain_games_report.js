const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

// Date range: last 6 months from 2026-03-12
const endDate = new Date('2026-03-12T23:59:59Z');
const startDate = new Date('2025-09-12T00:00:00Z');

console.log(`Fetching captain games from ${startDate.toISOString()} to ${endDate.toISOString()}`);

db.collection('games')
    .where('type', '==', 'captain')
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .get()
    .then(snapshot => {
        console.log(`Total captain games found: ${snapshot.size}`);

        // centreStats[centreName] = { published, played, canceled, organizers: Set, gold_true, gold_false }
        const centreStats = {};

        snapshot.forEach(doc => {
            const data = doc.data();

            const centre = data.centre || '(sans centre)';
            const status = data.status || 'unknown';
            const organizer = data.organizer || null;
            const goldExclusive = data.gold_exclusive === true;

            if (!centreStats[centre]) {
                centreStats[centre] = {
                    published: 0,
                    played: 0,
                    canceled: 0,
                    hidden: 0,
                    other: 0,
                    organizers: new Set(),
                    gold_true: 0,
                    gold_false: 0,
                    total: 0
                };
            }

            const s = centreStats[centre];
            s.total++;

            if (status === 'published') s.published++;
            else if (status === 'played') s.played++;
            else if (status === 'canceled') s.canceled++;
            else if (status === 'hidden') s.hidden++;
            else s.other++;

            if (organizer) s.organizers.add(organizer);

            if (goldExclusive) s.gold_true++;
            else s.gold_false++;
        });

        // Sort centres by total games desc
        const sortedCentres = Object.entries(centreStats).sort((a, b) => b[1].total - a[1].total);

        // --- Build report ---
        const lines = [];
        lines.push('='.repeat(70));
        lines.push('RAPPORT - MATCHS CAPTAIN - 6 DERNIERS MOIS');
        lines.push(`Période : ${startDate.toLocaleDateString('fr-FR')} → ${endDate.toLocaleDateString('fr-FR')}`);
        lines.push(`Généré le : ${new Date().toLocaleString('fr-FR')}`);
        lines.push('='.repeat(70));

        // Global totals
        let totalAll = 0, totalPublished = 0, totalPlayed = 0, totalCanceled = 0, totalHidden = 0;
        let totalGoldTrue = 0, totalGoldFalse = 0;
        const allOrganizers = new Set();

        for (const [, s] of sortedCentres) {
            totalAll += s.total;
            totalPublished += s.published;
            totalPlayed += s.played;
            totalCanceled += s.canceled;
            totalHidden += s.hidden;
            totalGoldTrue += s.gold_true;
            totalGoldFalse += s.gold_false;
            s.organizers.forEach(o => allOrganizers.add(o));
        }

        lines.push('');
        lines.push('TOTAUX GLOBAUX');
        lines.push('-'.repeat(40));
        lines.push(`Total matchs captain     : ${totalAll}`);
        lines.push(`  → published            : ${totalPublished}`);
        lines.push(`  → played               : ${totalPlayed}`);
        lines.push(`  → canceled             : ${totalCanceled}`);
        lines.push(`  → hidden               : ${totalHidden}`);
        lines.push(`Gold exclusive (true)    : ${totalGoldTrue}`);
        lines.push(`Gold exclusive (false)   : ${totalGoldFalse}`);
        lines.push(`Organisateurs uniques    : ${allOrganizers.size}`);
        lines.push(`Centres actifs           : ${sortedCentres.length}`);

        lines.push('');
        lines.push('='.repeat(70));
        lines.push('DÉTAIL PAR CENTRE');
        lines.push('='.repeat(70));

        for (const [centre, s] of sortedCentres) {
            lines.push('');
            lines.push(`CENTRE : ${centre}`);
            lines.push('-'.repeat(50));
            lines.push(`  Total matchs          : ${s.total}`);
            lines.push(`  published             : ${s.published}`);
            lines.push(`  played                : ${s.played}`);
            lines.push(`  canceled              : ${s.canceled}`);
            if (s.hidden > 0) lines.push(`  hidden                : ${s.hidden}`);
            if (s.other > 0)  lines.push(`  other                 : ${s.other}`);
            lines.push(`  Organisateurs uniques : ${s.organizers.size}`);
            lines.push(`  Gold exclusive true   : ${s.gold_true}`);
            lines.push(`  Gold exclusive false  : ${s.gold_false}`);
        }

        lines.push('');
        lines.push('='.repeat(70));
        lines.push('FIN DU RAPPORT');
        lines.push('='.repeat(70));

        const report = lines.join('\n');
        console.log('\n' + report);

        // Write TXT report
        const now = new Date();
        const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;

        if (!fs.existsSync('exports')) fs.mkdirSync('exports');
        const txtFilename = `exports/captain_games_report_${ts}.txt`;
        fs.writeFileSync(txtFilename, report, 'utf-8');
        console.log(`\nRapport texte exporté : ${txtFilename}`);

        // Write CSV
        const csvFilename = `exports/captain_games_report_${ts}.csv`;
        const csvWriter = createCsvWriter({
            path: csvFilename,
            header: [
                { id: 'centre',      title: 'CENTRE' },
                { id: 'total',       title: 'TOTAL' },
                { id: 'published',   title: 'PUBLISHED' },
                { id: 'played',      title: 'PLAYED' },
                { id: 'canceled',    title: 'CANCELED' },
                { id: 'hidden',      title: 'HIDDEN' },
                { id: 'organizers',  title: 'ORGANISATEURS_UNIQUES' },
                { id: 'gold_true',   title: 'GOLD_EXCLUSIVE_TRUE' },
                { id: 'gold_false',  title: 'GOLD_EXCLUSIVE_FALSE' },
            ],
            encoding: 'utf-8',
        });

        const csvRows = sortedCentres.map(([centre, s]) => ({
            centre,
            total:      s.total,
            published:  s.published,
            played:     s.played,
            canceled:   s.canceled,
            hidden:     s.hidden,
            organizers: s.organizers.size,
            gold_true:  s.gold_true,
            gold_false: s.gold_false,
        }));

        return csvWriter.writeRecords(csvRows).then(() => {
            console.log(`Rapport CSV exporté   : ${csvFilename}`);
        });
    })
    .catch(error => {
        console.error('Erreur :', error);
    });
