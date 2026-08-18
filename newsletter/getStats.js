/**
 * Newsletter Stats Script
 *
 * Displays open and click rates for a newsletter campaign.
 *
 * Usage:
 *   node getStats.js <campaign-id>
 *
 * Example:
 *   node getStats.js example
 *   node getStats.js 2024-12-holiday
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Firebase setup
const serviceAccount = require('../krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});
const db = admin.firestore();

async function getStats(campaignId) {
    console.log(`\n📊 Newsletter Stats: ${campaignId}`);
    console.log(`${'='.repeat(50)}`);

    // Get campaign record
    const campaignDoc = await db.collection('newsletter_campaigns').doc(campaignId).get();

    if (!campaignDoc.exists) {
        console.log(`\n❌ Campaign "${campaignId}" not found in Firestore.`);
        console.log(`   Make sure you've sent the campaign with --send flag.`);

        // Check if JSON exists
        const jsonPath = path.join(__dirname, 'campaigns', `${campaignId}.json`);
        if (fs.existsSync(jsonPath)) {
            console.log(`\n   Campaign JSON found at: campaigns/${campaignId}.json`);
            console.log(`   Run: node sendNewsletter.js ${campaignId} --send`);
        }
        process.exit(1);
    }

    const campaign = campaignDoc.data();
    const sentAt = campaign.sent_at?.toDate();

    console.log(`\n📋 Campaign Info`);
    console.log(`   Subject (FR): ${campaign.subject?.fr || 'N/A'}`);
    console.log(`   Sent at: ${sentAt ? sentAt.toISOString() : 'N/A'}`);

    if (campaign.stats) {
        console.log(`\n📨 Delivery Stats`);
        console.log(`   Total sent: ${campaign.stats.total_sent || 0}`);
        console.log(`   Failed: ${campaign.stats.total_failed || 0}`);
        if (campaign.stats.languages) {
            console.log(`   By language:`);
            console.log(`     FR: ${campaign.stats.languages.fr || 0}`);
            console.log(`     EN: ${campaign.stats.languages.en || 0}`);
            console.log(`     ES: ${campaign.stats.languages.es || 0}`);
            console.log(`     IT: ${campaign.stats.languages.it || 0}`);
        }
    }

    // Get events from Firestore
    const eventsSnapshot = await db.collection('newsletter_events')
        .where('campaign_id', '==', campaignId)
        .get();

    if (eventsSnapshot.empty) {
        console.log(`\n📭 No tracking events yet.`);
        console.log(`   Events may take a few minutes to appear.`);
        console.log(`   Make sure the SNS → Cloud Function is set up.`);
    } else {
        const events = {
            open: new Set(),
            click: new Set(),
            bounce: 0,
            complaint: 0
        };

        eventsSnapshot.forEach(doc => {
            const event = doc.data();
            const userId = event.user_id || event.email;

            switch (event.event_type) {
                case 'Open':
                    events.open.add(userId);
                    break;
                case 'Click':
                    events.click.add(userId);
                    break;
                case 'Bounce':
                    events.bounce++;
                    break;
                case 'Complaint':
                    events.complaint++;
                    break;
            }
        });

        const totalSent = campaign.stats?.total_sent || 1;
        const openRate = (events.open.size / totalSent * 100).toFixed(1);
        const clickRate = (events.click.size / totalSent * 100).toFixed(1);

        console.log(`\n📈 Engagement Stats`);
        console.log(`   Unique opens: ${events.open.size} (${openRate}%)`);
        console.log(`   Unique clicks: ${events.click.size} (${clickRate}%)`);
        console.log(`   Bounces: ${events.bounce}`);
        console.log(`   Complaints: ${events.complaint}`);

        // Click-to-open rate
        if (events.open.size > 0) {
            const ctor = (events.click.size / events.open.size * 100).toFixed(1);
            console.log(`   Click-to-open rate: ${ctor}%`);
        }
    }

    console.log(`\n${'='.repeat(50)}\n`);
}

async function listCampaigns() {
    console.log(`\n📋 Available campaigns in Firestore:\n`);

    const snapshot = await db.collection('newsletter_campaigns')
        .orderBy('sent_at', 'desc')
        .limit(10)
        .get();

    if (snapshot.empty) {
        console.log(`   No campaigns sent yet.`);
    } else {
        snapshot.forEach(doc => {
            const data = doc.data();
            const sentAt = data.sent_at?.toDate();
            const sent = data.stats?.total_sent || 0;
            console.log(`   - ${doc.id}`);
            console.log(`     Sent: ${sentAt ? sentAt.toISOString().split('T')[0] : 'N/A'} | Recipients: ${sent}`);
        });
    }

    console.log(`\n📁 Campaign JSON files:\n`);
    const files = fs.readdirSync(path.join(__dirname, 'campaigns'))
        .filter(f => f.endsWith('.json'));

    files.forEach(f => {
        console.log(`   - ${f.replace('.json', '')}`);
    });

    console.log('');
}

async function main() {
    const campaignId = process.argv[2];

    if (!campaignId) {
        await listCampaigns();
        console.log(`Usage: node getStats.js <campaign-id>\n`);
        process.exit(0);
    }

    await getStats(campaignId);
    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
