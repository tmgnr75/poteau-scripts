/**
 * Add event destinations to the "otc-emails" SES configuration set, so the
 * fate of every sign-up code email is recorded.
 *
 * WHY IT EXISTS
 * -------------
 * An audit on 2026-09-15 found otc-emails was the ONLY configuration set with
 * no event destination at all: not a bounce, not a delivery, not a rendering
 * failure was ever recorded. Every other set had one.
 *
 *   generic-emails      CloudWatch + EventBridge
 *   invitation-emails   CloudWatch + EventBridge
 *   newsletter-emails   SNS
 *   signin-emails       CloudWatch + SNS   (added 2026-09-15)
 *   otc-emails          NOTHING            <- this script
 *
 * That is the same blindness that made LE FIVE Champigny unexplainable: 18
 * sign-in links accepted by SES, none delivered, and no record of why.
 *
 * It matters more here than anywhere. The OTC code is what turns a download
 * into an account: if it does not arrive the user cannot sign up at all, and
 * the app has NO resend path, so an affected user is simply stuck. A silent
 * delivery failure on this set costs signups nobody would ever hear about.
 *
 * CloudWatch gives counts for alarms; SNS carries the full payload including
 * the receiving server's diagnostic string, which is the only thing that ever
 * answers "why didn't they get it".
 *
 * The SNS half reuses the processSignInEvents endpoint deliberately: the
 * handler keys on the destination address and stores the whole raw event, so
 * it is already correct for any transactional mail. Events land in
 * signin_events with their own message id and can be told apart by the
 * email_type tag.
 *
 * Idempotent: existing destinations are updated, never duplicated.
 *
 * Usage:
 *   set -a; . ~/.poteau/aws_ses.env; set +a
 *   node createOtcEventDestination.js --dry
 *   node createOtcEventDestination.js --apply
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
const SET_NAME = 'otc-emails';
const CW_DEST = 'otc-cloudwatch';
const SNS_DEST = 'otc-sns';
const TOPIC_NAME = 'ses-signin-events';
const ENDPOINT = 'https://us-central1-krank-club.cloudfunctions.net/processSignInEvents';

const EVENT_TYPES = [
    'BOUNCE',
    'COMPLAINT',
    'DELIVERY',
    'REJECT',
    'RENDERING_FAILURE',
    'DELIVERY_DELAY',
];

const CLOUDWATCH_DIMENSIONS = [
    {
        DimensionName: 'ses:configuration-set',
        DimensionValueSource: 'MESSAGE_TAG',
        DefaultDimensionValue: SET_NAME,
    },
    {
        DimensionName: 'ses:from-domain',
        DimensionValueSource: 'MESSAGE_TAG',
        DefaultDimensionValue: 'mail.poteau.app',
    },
];

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const DRY = args.includes('--dry') || !APPLY;

async function upsert(ses, name, destination, existing) {
    const already = existing.find((d) => d.Name === name);
    if (already) {
        await ses.send(new UpdateConfigurationSetEventDestinationCommand({
            ConfigurationSetName: SET_NAME,
            EventDestinationName: name,
            EventDestination: destination,
        }));
        console.log(`Updated destination "${name}".`);
    } else {
        await ses.send(new CreateConfigurationSetEventDestinationCommand({
            ConfigurationSetName: SET_NAME,
            EventDestinationName: name,
            EventDestination: destination,
        }));
        console.log(`Created destination "${name}".`);
    }
}

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

    const existing = (await ses.send(
        new GetConfigurationSetEventDestinationsCommand({ ConfigurationSetName: SET_NAME })
    )).EventDestinations || [];
    console.log(
        `Existing event destinations: ${
            existing.length ? existing.map((d) => d.Name).join(', ') : '(NONE -- this is the bug)'
        }`
    );

    if (DRY) {
        console.log('\n--- DRY RUN, nothing written ---');
        console.log(`Would upsert "${CW_DEST}" (CloudWatch) and "${SNS_DEST}" (SNS -> ${TOPIC_NAME})`);
        console.log(`Events: ${EVENT_TYPES.join(', ')}`);
        console.log('Re-run with --apply to write it.');
        return;
    }

    // CreateTopic returns the existing ARN unchanged, and the subscription is
    // already confirmed from the sign-in wiring, so this is a no-op in practice.
    const topicArn = (await sns.send(new CreateTopicCommand({ Name: TOPIC_NAME }))).TopicArn;
    console.log(`Topic: ${topicArn}`);

    const subs = (await sns.send(new ListSubscriptionsByTopicCommand({ TopicArn: topicArn }))).Subscriptions || [];
    const sub = subs.find((s) => s.Endpoint === ENDPOINT);
    if (!sub) {
        const created = await sns.send(new SubscribeCommand({
            TopicArn: topicArn,
            Protocol: 'https',
            Endpoint: ENDPOINT,
            ReturnSubscriptionArn: true,
        }));
        console.log(`Subscribed: ${created.SubscriptionArn}`);
    } else if (sub.SubscriptionArn === 'PendingConfirmation') {
        console.warn('WARNING: existing subscription is still PendingConfirmation; events will not arrive.');
    } else {
        console.log('Subscription already confirmed.');
    }

    await upsert(ses, CW_DEST, {
        Enabled: true,
        MatchingEventTypes: EVENT_TYPES,
        CloudWatchDestination: { DimensionConfigurations: CLOUDWATCH_DIMENSIONS },
    }, existing);

    await upsert(ses, SNS_DEST, {
        Enabled: true,
        MatchingEventTypes: EVENT_TYPES,
        SnsDestination: { TopicArn: topicArn },
    }, existing);

    // Verify by reading back rather than trusting the writes.
    const after = (await ses.send(
        new GetConfigurationSetEventDestinationsCommand({ ConfigurationSetName: SET_NAME })
    )).EventDestinations || [];
    for (const name of [CW_DEST, SNS_DEST]) {
        const d = after.find((x) => x.Name === name);
        if (!d) {
            console.error(`VERIFY FAILED: "${name}" is not present after writing.`);
            process.exit(1);
        }
        console.log(`Verified: "${name}" enabled=${d.Enabled} events=[${(d.MatchingEventTypes || []).join(', ')}]`);
    }
    console.log('\nSign-up code emails are no longer blind.');
})();
