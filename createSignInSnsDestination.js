/**
 * Wire full SES event payloads for Poteau Max sign-in (magic link) emails
 * into Firestore, via SNS -> processSignInEvents.
 *
 * WHY THIS EXISTS
 * ---------------
 * createSignInEventDestination.js already sends these events to CloudWatch,
 * but CloudWatch only COUNTS them. It can tell you that a sign-in mail
 * bounced; it cannot tell you that LE FIVE's server said
 * "550 5.7.1 message blocked". That diagnostic string is the only thing that
 * ever answers "why didn't the centre get it", and a magic link is the front
 * door: if it fails, the centre is locked out of the product entirely.
 *
 * So both destinations coexist on purpose:
 *   signin-cloudwatch  cheap counters, dashboards, alarms
 *   signin-sns         the full event, including the diagnostic code
 *
 * This script deliberately creates a NEW topic rather than reusing
 * "ses-newsletter-events", which has zero subscriptions and silently swallows
 * everything sent to it -- the exact failure mode being fixed here.
 *
 * ORDER MATTERS
 * The Cloud Function must be deployed BEFORE this runs, because SNS confirms
 * the subscription by calling it immediately:
 *     firebase deploy --only functions:processSignInEvents
 *
 * Idempotent: an existing topic, subscription or destination is reused or
 * updated, never duplicated. Safe to re-run.
 *
 * Usage:
 *   set -a; . ~/.poteau/aws_ses.env; set +a
 *   node createSignInSnsDestination.js --dry
 *   node createSignInSnsDestination.js --apply
 */

const {
    SESv2Client,
    GetConfigurationSetCommand,
    GetConfigurationSetEventDestinationsCommand,
    CreateConfigurationSetEventDestinationCommand,
    UpdateConfigurationSetEventDestinationCommand,
} = require('@aws-sdk/client-sesv2');
const {
    SNSClient,
    CreateTopicCommand,
    ListSubscriptionsByTopicCommand,
    SubscribeCommand,
} = require('@aws-sdk/client-sns');

const REGION = 'eu-north-1';
const SET_NAME = 'signin-emails';
const DEST_NAME = 'signin-sns';
const TOPIC_NAME = 'ses-signin-events';
const ENDPOINT = 'https://us-central1-krank-club.cloudfunctions.net/processSignInEvents';

// DELIVERY is included as well as the failures: proving a mail WAS delivered
// is what moves a diagnosis from our side to the recipient's, which is
// exactly the question left open for Champigny.
const EVENT_TYPES = [
    'BOUNCE',
    'COMPLAINT',
    'DELIVERY',
    'REJECT',
    'RENDERING_FAILURE',
    'DELIVERY_DELAY',
];

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const DRY = args.includes('--dry') || !APPLY;

(async () => {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.error(
            'Missing AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY.\n' +
            'Load them first:  set -a; . ~/.poteau/aws_ses.env; set +a'
        );
        process.exit(1);
    }

    const credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
    const ses = new SESv2Client({ region: REGION, credentials });
    const sns = new SNSClient({ region: REGION, credentials });

    try {
        await ses.send(new GetConfigurationSetCommand({ ConfigurationSetName: SET_NAME }));
        console.log(`Configuration set "${SET_NAME}" exists.`);
    } catch (err) {
        console.error(`Configuration set "${SET_NAME}" not found: ${err.name} - ${err.message}`);
        process.exit(1);
    }

    const existingDests = (await ses.send(
        new GetConfigurationSetEventDestinationsCommand({ ConfigurationSetName: SET_NAME })
    )).EventDestinations || [];
    console.log(
        `Existing event destinations: ${
            existingDests.length ? existingDests.map((d) => d.Name).join(', ') : '(none)'
        }`
    );
    const already = existingDests.find((d) => d.Name === DEST_NAME);

    if (DRY) {
        console.log('\n--- DRY RUN, nothing written ---');
        console.log(`Would create/reuse SNS topic "${TOPIC_NAME}" in ${REGION}`);
        console.log(`Would subscribe: ${ENDPOINT}`);
        console.log(`Would ${already ? 'UPDATE' : 'CREATE'} destination "${DEST_NAME}" on "${SET_NAME}"`);
        console.log(`Events: ${EVENT_TYPES.join(', ')}`);
        console.log('\nDeploy the function FIRST, or the subscription cannot confirm:');
        console.log('  firebase deploy --only functions:processSignInEvents');
        console.log('Re-run with --apply to write it.');
        return;
    }

    // CreateTopic is idempotent: it returns the existing ARN unchanged.
    const topicArn = (await sns.send(new CreateTopicCommand({ Name: TOPIC_NAME }))).TopicArn;
    console.log(`Topic: ${topicArn}`);

    const subs = (await sns.send(new ListSubscriptionsByTopicCommand({ TopicArn: topicArn }))).Subscriptions || [];
    const existingSub = subs.find((s) => s.Endpoint === ENDPOINT);
    if (existingSub) {
        console.log(`Subscription already present: ${existingSub.SubscriptionArn}`);
    } else {
        const sub = await sns.send(new SubscribeCommand({
            TopicArn: topicArn,
            Protocol: 'https',
            Endpoint: ENDPOINT,
            ReturnSubscriptionArn: true,
        }));
        console.log(`Subscribed: ${sub.SubscriptionArn}`);
    }

    const destination = {
        Enabled: true,
        MatchingEventTypes: EVENT_TYPES,
        SnsDestination: { TopicArn: topicArn },
    };

    if (already) {
        await ses.send(new UpdateConfigurationSetEventDestinationCommand({
            ConfigurationSetName: SET_NAME,
            EventDestinationName: DEST_NAME,
            EventDestination: destination,
        }));
        console.log(`Updated destination "${DEST_NAME}".`);
    } else {
        await ses.send(new CreateConfigurationSetEventDestinationCommand({
            ConfigurationSetName: SET_NAME,
            EventDestinationName: DEST_NAME,
            EventDestination: destination,
        }));
        console.log(`Created destination "${DEST_NAME}".`);
    }

    // Verify by reading back rather than trusting the write, the same way
    // sendSignInLinkViaSes.js refuses to claim a send it cannot prove.
    const after = (await ses.send(
        new GetConfigurationSetEventDestinationsCommand({ ConfigurationSetName: SET_NAME })
    )).EventDestinations || [];
    const confirmed = after.find((d) => d.Name === DEST_NAME);
    if (!confirmed) {
        console.error('VERIFY FAILED: destination is not present after writing.');
        process.exit(1);
    }
    console.log(
        `Verified: "${DEST_NAME}" enabled=${confirmed.Enabled} ` +
        `events=[${(confirmed.MatchingEventTypes || []).join(', ')}]`
    );

    const stillPending = (await sns.send(new ListSubscriptionsByTopicCommand({ TopicArn: topicArn })))
        .Subscriptions.find((s) => s.Endpoint === ENDPOINT);
    if (stillPending && stillPending.SubscriptionArn === 'PendingConfirmation') {
        console.warn(
            '\nWARNING: the subscription is still PendingConfirmation.\n' +
            'Events will NOT reach Firestore until it confirms. That usually means\n' +
            'processSignInEvents is not deployed or returned non-200. Deploy it and\n' +
            're-run this script.'
        );
    } else {
        console.log('\nFull SES event payloads now reach Firestore: signin_events.');
    }
})();
