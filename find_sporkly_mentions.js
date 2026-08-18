const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function main() {
    // Fetch last 1000 messages of type "message" (chat), ordered by created desc
    const snap = await db.collection('messages')
        .where('type', '==', 'message')
        .orderBy('created', 'desc')
        .limit(10000)
        .get();

    console.log(`Fetched ${snap.size} messages.\n`);

    const matches = [];
    snap.forEach(doc => {
        const d = doc.data();
        const text = (d.text || '') + ' ' + (d.text_en || '') + ' ' + (d.text_es || '') + ' ' + (d.text_it || '');
        if (/sporkly/i.test(text)) {
            matches.push({
                id: doc.id,
                author_id: d.author_id ? d.author_id.id : null,
                author_name: d.author_name,
                game_id: d.game_id ? d.game_id.id : null,
                created: d.created ? d.created.toDate().toISOString() : null,
                text: d.text || '',
            });
        }
    });

    console.log(`Found ${matches.length} messages mentioning "sporkly".\n`);

    // Group by author
    const byAuthor = {};
    for (const m of matches) {
        const key = m.author_id || 'unknown';
        if (!byAuthor[key]) byAuthor[key] = { name: m.author_name, messages: [] };
        byAuthor[key].messages.push(m);
    }

    for (const [authorId, info] of Object.entries(byAuthor)) {
        console.log(`\n=== Author ${authorId} (${info.name}) — ${info.messages.length} messages ===`);
        info.messages.slice(0, 5).forEach((m, i) => {
            console.log(`  ${i+1}. [${m.created}] game=${m.game_id} msg=${m.id}`);
            console.log(`     "${m.text.slice(0, 150).replace(/\n/g, ' ')}"`);
        });
        if (info.messages.length > 5) console.log(`  ...and ${info.messages.length - 5} more`);
    }

    // Show oldest and newest match
    if (matches.length > 0) {
        const sorted = [...matches].sort((a, b) => new Date(a.created) - new Date(b.created));
        console.log(`\n=== Time range ===`);
        console.log(`Oldest: ${sorted[0].created}`);
        console.log(`Newest: ${sorted[sorted.length - 1].created}`);
    }

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
