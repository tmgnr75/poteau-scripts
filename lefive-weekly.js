const admin = require('firebase-admin');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const CUTOFF_DATE = new Date('2025-10-06T22:08:00Z');

function getWeekKey(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    return monday.toISOString().split('T')[0];
}

async function main() {
    try {
        // Fetch LE FIVE Paris 18 organizer ID
        const usersSnapshot = await db.collection('users')
            .where('centre_name', '==', 'LE FIVE Paris 18')
            .get();

        let organizerId = null;
        usersSnapshot.forEach(doc => {
            organizerId = doc.id;
            console.log(`LE FIVE Paris 18 organizer: ${doc.id} (${doc.data().display_name})`);
        });

        if (!organizerId) {
            console.error('Organizer not found');
            process.exit(1);
        }

        // Fetch all in-app games for this organizer
        const gamesSnapshot = await db.collection('games')
            .where('payment_type', '==', 'in-app')
            .where('organizer', '==', organizerId)
            .where('date', '>=', admin.firestore.Timestamp.fromDate(new Date('2025-04-01')))
            .where('date', '<=', admin.firestore.Timestamp.fromDate(new Date('2026-03-28')))
            .get();

        console.log(`Total games: ${gamesSnapshot.size}\n`);

        const weekly = {};

        gamesSnapshot.forEach(doc => {
            const data = doc.data();
            const date = data.date?.toDate();
            if (!date) return;

            const week = getWeekKey(date);
            if (!weekly[week]) weekly[week] = { proposed: 0, played: 0, canceled: 0 };

            weekly[week].proposed++;
            if (data.status === 'played') weekly[week].played++;
            else if (data.status === 'canceled' || data.status === 'hidden') weekly[week].canceled++;
        });

        const cutoffWeek = getWeekKey(CUTOFF_DATE);

        console.log('LE FIVE Paris 18 — Semaine par semaine');
        console.log('');
        console.log('Semaine (lundi)  | Proposés | Joués | Annulés | Taux joués | Période');
        console.log('-'.repeat(80));

        Object.keys(weekly).sort().forEach(week => {
            const w = weekly[week];
            const rate = w.proposed > 0 ? ((w.played / w.proposed) * 100).toFixed(1) : '0.0';
            const period = week < cutoffWeek ? 'AVANT' : 'APRES';
            const marker = week === cutoffWeek ? ' <<<' : '';
            console.log(`${week}        | ${String(w.proposed).padStart(8)} | ${String(w.played).padStart(5)} | ${String(w.canceled).padStart(7)} | ${rate.padStart(9)}% | ${period}${marker}`);
        });

        // Averages
        const beforeWeeks = Object.entries(weekly).filter(([w]) => w < cutoffWeek);
        const afterWeeks = Object.entries(weekly).filter(([w]) => w >= cutoffWeek);

        const avgBefore = {
            proposed: beforeWeeks.reduce((s, [, w]) => s + w.proposed, 0) / beforeWeeks.length,
            played: beforeWeeks.reduce((s, [, w]) => s + w.played, 0) / beforeWeeks.length,
            canceled: beforeWeeks.reduce((s, [, w]) => s + w.canceled, 0) / beforeWeeks.length,
        };
        const avgAfter = {
            proposed: afterWeeks.reduce((s, [, w]) => s + w.proposed, 0) / afterWeeks.length,
            played: afterWeeks.reduce((s, [, w]) => s + w.played, 0) / afterWeeks.length,
            canceled: afterWeeks.reduce((s, [, w]) => s + w.canceled, 0) / afterWeeks.length,
        };

        console.log('-'.repeat(80));
        console.log(`\nMoyennes AVANT (${beforeWeeks.length} semaines):`);
        console.log(`  Proposés/sem: ${avgBefore.proposed.toFixed(1)}, Joués/sem: ${avgBefore.played.toFixed(1)}, Annulés/sem: ${avgBefore.canceled.toFixed(1)}, Taux: ${((avgBefore.played / avgBefore.proposed) * 100).toFixed(1)}%`);

        console.log(`\nMoyennes APRES (${afterWeeks.length} semaines):`);
        console.log(`  Proposés/sem: ${avgAfter.proposed.toFixed(1)}, Joués/sem: ${avgAfter.played.toFixed(1)}, Annulés/sem: ${avgAfter.canceled.toFixed(1)}, Taux: ${((avgAfter.played / avgAfter.proposed) * 100).toFixed(1)}%`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
