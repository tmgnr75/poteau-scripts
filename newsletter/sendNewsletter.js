/**
 * Newsletter Sending Script
 *
 * Sends newsletters to users via AWS SES.
 *
 * Usage:
 *   node sendNewsletter.js <campaign-id> --test   # Send to test emails only
 *   node sendNewsletter.js <campaign-id> --send   # Send to all users
 *
 * Example:
 *   node sendNewsletter.js example --test
 *   node sendNewsletter.js 2024-12-holiday --send
 */

const admin = require('firebase-admin');
const { SESClient, SendTemplatedEmailCommand } = require('@aws-sdk/client-ses');
const fs = require('fs');
const path = require('path');

// Firebase setup
const serviceAccount = require('../krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});
const db = admin.firestore();

// AWS SES setup
const sesClient = new SESClient({
    region: 'eu-north-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Test email addresses
const TEST_EMAILS = [
    't.genreau@me.com',
    'ben@poteau.team',
    'tmgnr+494@icloud.com',
    'centres@poteau.team',
    'axelmtzg67@gmail.com',
    'qj9zmt22gc@privaterelay.appleid.com',
    'charlottearnould96@gmail.com'
];

// SES rate limit: 14 emails/second, we'll do 10 to be safe
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1100; // Just over 1 second

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function loadCampaign(campaignId) {
    const campaignPath = path.join(__dirname, 'campaigns', `${campaignId}.json`);
    if (!fs.existsSync(campaignPath)) {
        console.error(`❌ Campaign not found: ${campaignPath}`);
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(campaignPath, 'utf8'));
}

async function getTestUsers() {
    const users = [];
    for (const email of TEST_EMAILS) {
        // Try to find the user in Firestore
        const snapshot = await db.collection('users')
            .where('email', '==', email)
            .limit(1)
            .get();

        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const data = doc.data();
            users.push({
                id: doc.id,
                email: data.email,
                display_name: data.display_name || '',
                language: data.language || 'fr'
            });
        } else {
            // User not found, create a mock entry for test
            users.push({
                id: `test-${email.replace(/[@.]/g, '-')}`,
                email: email,
                display_name: 'Test User',
                language: 'fr'
            });
        }
    }
    return users;
}

async function getAllUsers() {
    const users = [];
    // Firestore only allows one inequality filter, so we filter the rest in code
    const snapshot = await db.collection('users')
        .where('auth_email', '!=', false)
        .get();

    snapshot.forEach(doc => {
        const data = doc.data();
        // Skip users without email
        if (!data.email) return;
        // Skip banned users
        if (data.banned === true) return;
        // Skip pro and super_pro accounts (this newsletter is for players only)
        if (data.type === 'pro' || data.type === 'super_pro') return;

        users.push({
            id: doc.id,
            email: data.email,
            display_name: data.display_name || '',
            language: data.language || 'fr'
        });
    });

    return users;
}

async function sendEmail(user, campaign) {
    const lang = ['fr', 'en', 'es', 'it'].includes(user.language) ? user.language : 'fr';
    const unsubscribeUrl = `https://poteau-app.com/unsubscribe?uid=${user.id}&ml=${encodeURIComponent(user.email)}`;

    // Get greeting with display_name replaced
    let greeting = campaign.greeting?.[lang] || campaign.greeting?.fr || 'Hey,';
    const displayName = user.display_name || '';
    greeting = greeting.replace('{{display_name}}', displayName);
    // If no display name, clean up the greeting
    if (!displayName) {
        greeting = greeting.replace('Hey ,', 'Hey,').replace('¡Hola !', '¡Hola!').replace('Ciao !', 'Ciao!');
    }

    const templateData = {
        subject: campaign.subject[lang] || campaign.subject.fr,
        preview_text: campaign.preview_text?.[lang] || campaign.preview_text?.fr || '',
        greeting: greeting,
        headline_1: campaign.headline_1?.[lang] || campaign.headline_1?.fr || '',
        body_text_1: campaign.body_text_1?.[lang] || campaign.body_text_1?.fr || '',
        headline_2: campaign.headline_2?.[lang] || campaign.headline_2?.fr || '',
        body_text_2: campaign.body_text_2?.[lang] || campaign.body_text_2?.fr || '',
        headline_3: campaign.headline_3?.[lang] || campaign.headline_3?.fr || '',
        body_text_3: campaign.body_text_3?.[lang] || campaign.body_text_3?.fr || '',
        image_url: campaign.image_url || '',
        cta_text: campaign.cta_text[lang] || campaign.cta_text.fr,
        cta_url: campaign.cta_url,
        signature: campaign.signature?.[lang] || campaign.signature?.fr || "L'équipe Poteau",
        unsubscribe_url: unsubscribeUrl,
        unsubscribe_text: campaign.unsubscribe_text[lang] || campaign.unsubscribe_text.fr,
        language: lang
    };

    const params = {
        Destination: { ToAddresses: [user.email] },
        Source: 'Poteau <no-reply@mail.poteau.app>',
        Template: 'PoteauNewsletter',
        TemplateData: JSON.stringify(templateData),
        ConfigurationSetName: 'newsletter-emails',
        Tags: [
            { Name: 'campaign_id', Value: campaign.id },
            { Name: 'user_id', Value: user.id },
            { Name: 'language', Value: lang }
        ]
    };

    await sesClient.send(new SendTemplatedEmailCommand(params));
}

async function saveCampaignRecord(campaign, stats) {
    await db.collection('newsletter_campaigns').doc(campaign.id).set({
        ...campaign,
        sent_at: admin.firestore.FieldValue.serverTimestamp(),
        stats: {
            total_sent: stats.sent,
            total_failed: stats.failed,
            languages: stats.languages
        }
    }, { merge: true });
}

async function main() {
    const args = process.argv.slice(2);
    const campaignId = args.find(arg => !arg.startsWith('--'));
    const isTest = args.includes('--test');
    const isSend = args.includes('--send');

    if (!campaignId) {
        console.log('Usage: node sendNewsletter.js <campaign-id> [--test|--send]');
        console.log('\nAvailable campaigns:');
        const campaigns = fs.readdirSync(path.join(__dirname, 'campaigns'))
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''));
        campaigns.forEach(c => console.log(`  - ${c}`));
        process.exit(1);
    }

    if (!isTest && !isSend) {
        console.log('❌ Please specify --test or --send');
        console.log('   --test  Send to test emails only (4 recipients)');
        console.log('   --send  Send to all users');
        process.exit(1);
    }

    // Check AWS credentials
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.error('❌ AWS credentials not found.');
        console.log('Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
        process.exit(1);
    }

    console.log(`\n📧 Newsletter Sender`);
    console.log(`${'='.repeat(50)}`);

    // Load campaign
    const campaign = loadCampaign(campaignId);
    console.log(`\n📋 Campaign: ${campaign.id}`);
    console.log(`   Subject (FR): ${campaign.subject.fr}`);

    // Get users
    let users;
    if (isTest) {
        console.log(`\n🧪 TEST MODE - Sending to test emails only`);
        users = await getTestUsers();
    } else {
        console.log(`\n🚀 PRODUCTION MODE - Sending to all users`);
        users = await getAllUsers();

        // Confirmation prompt
        console.log(`\n⚠️  About to send to ${users.length} users.`);
        console.log(`   Press Ctrl+C within 5 seconds to cancel...`);
        await sleep(5000);
    }

    console.log(`\n📨 Sending to ${users.length} recipients...`);

    const stats = {
        sent: 0,
        failed: 0,
        languages: { fr: 0, en: 0, es: 0, it: 0 }
    };

    // Process in batches
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
        const batch = users.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (user) => {
            try {
                await sendEmail(user, campaign);
                stats.sent++;
                const lang = ['fr', 'en', 'es', 'it'].includes(user.language) ? user.language : 'fr';
                stats.languages[lang]++;
                console.log(`  ✓ ${user.email} (${user.language || 'fr'})`);
            } catch (err) {
                stats.failed++;
                console.log(`  ✗ ${user.email}: ${err.message}`);
            }
        }));

        // Progress update
        const progress = Math.min(i + BATCH_SIZE, users.length);
        console.log(`\n   Progress: ${progress}/${users.length} (${Math.round(progress / users.length * 100)}%)\n`);

        // Rate limit delay
        if (i + BATCH_SIZE < users.length) {
            await sleep(BATCH_DELAY_MS);
        }
    }

    // Save campaign record
    if (isSend) {
        await saveCampaignRecord(campaign, stats);
    }

    // Summary
    console.log(`\n${'='.repeat(50)}`);
    console.log(`✅ Newsletter sent!`);
    console.log(`   Total sent: ${stats.sent}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   By language:`);
    console.log(`     FR: ${stats.languages.fr}`);
    console.log(`     EN: ${stats.languages.en}`);
    console.log(`     ES: ${stats.languages.es}`);
    console.log(`     IT: ${stats.languages.it}`);

    if (isTest) {
        console.log(`\n📬 Check your inbox! If everything looks good, run:`);
        console.log(`   node sendNewsletter.js ${campaignId} --send`);
    } else {
        console.log(`\n📊 Check stats later with:`);
        console.log(`   node getStats.js ${campaignId}`);
    }

    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
