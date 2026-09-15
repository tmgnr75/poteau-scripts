/**
 * Add a CloudWatch event destination to the "signin-emails" SES configuration
 * set, so the fate of every pro magic link is recorded.
 *
 * WHY IT EXISTS
 * -------------
 * On 2026-09-15 LE FIVE Champigny requested 16 sign-in links across two days
 * and received none. Every send was accepted by SES with a MessageId, SES was
 * HEALTHY, and the address was NOT on the suppression list -- so the mail was
 * handed to LE FIVE's server and lost after that.
 *
 * We could not say what happened, because "signin-emails" had NO event
 * destination: no BOUNCE, no DELIVERY, no REJECT was ever recorded. The
 * history of those 16 messages does not exist anywhere and cannot be
 * recovered.
 *
 * This is the third silent delivery failure to cost us a partner:
 *   2026-09-04  bezons@lefive.fr     Brevo out of credits, returned 200
 *   2026-09-09  contact@lepark.fr    same, locked out on its onboarding day
 *   2026-09-15  champigny@lefive.fr  delivered-then-lost, unprovable
 *
 * The lesson each time is the same: an accepted send is not a delivered mail.
 * Without an event destination we are trusting acceptance, which is exactly
 * the mistake the Brevo post-mortem told us to stop making.
 *
 * WHAT IT RECORDS
 *   BOUNCE             the receiving server rejected it, and why
 *   COMPLAINT          marked as spam
 *   DELIVERY           it actually landed
 *   REJECT             SES itself refused it
 *   RENDERING_FAILURE  the template failed to render (silent today)
 *
 * CloudWatch is used rather than SNS deliberately. The existing
 * "ses-newsletter-events" SNS topic has ZERO subscriptions, so events sent
 * there vanish -- repeating the failure this script exists to fix.
 *
 * Idempotent: an existing destination of the same name is updated, not
 * duplicated. Safe to re-run.
 *
 * Usage:
 *   set -a; . ~/.poteau/aws_ses.env; set +a
 *   node createSignInEventDestination.js --dry
 *   node createSignInEventDestination.js --apply
 */

const {
    SESv2Client,
    GetConfigurationSetCommand,
    GetConfigurationSetEventDestinationsCommand,
    CreateConfigurationSetEventDestinationCommand,
    UpdateConfigurationSetEventDestinationCommand,
} = require('@aws-sdk/client-sesv2');

const REGION = 'eu-north-1';
const SET_NAME = 'signin-emails';
const DEST_NAME = 'signin-cloudwatch';

// REJECT and RENDERING_FAILURE are included because both fail silently today.
// A rendering failure in particular would look exactly like the Champigny
// symptom: a send that reports success and never arrives.
const EVENT_TYPES = [
    'BOUNCE',
    'COMPLAINT',
    'DELIVERY',
    'REJECT',
    'RENDERING_FAILURE',
];

// One dimension per message, so a single address can be isolated later.
// ses:configuration-set is the conventional default dimension; the message
// tag dimensions let us group by outcome without reading every event.
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

(async () => {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.error(
            'Missing AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY.\n' +
            'Load them first:  set -a; . ~/.poteau/aws_ses.env; set +a'
        );
        process.exit(1);
    }

    const client = new SESv2Client({
        region: REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });

    // Refuse to create a destination on a set that does not exist, rather
    // than silently creating nothing useful.
    try {
        await client.send(new GetConfigurationSetCommand({ ConfigurationSetName: SET_NAME }));
        console.log(`Configuration set "${SET_NAME}" exists.`);
    } catch (err) {
        console.error(`Configuration set "${SET_NAME}" not found: ${err.name} - ${err.message}`);
        process.exit(1);
    }

    let existing = [];
    try {
        const res = await client.send(
            new GetConfigurationSetEventDestinationsCommand({ ConfigurationSetName: SET_NAME })
        );
        existing = res.EventDestinations || [];
    } catch (err) {
        console.error(`Could not read event destinations: ${err.name} - ${err.message}`);
        process.exit(1);
    }

    console.log(
        `Existing event destinations: ${
            existing.length ? existing.map((d) => d.Name).join(', ') : '(NONE -- this is the bug)'
        }`
    );

    const already = existing.find((d) => d.Name === DEST_NAME);

    const destination = {
        Enabled: true,
        MatchingEventTypes: EVENT_TYPES,
        CloudWatchDestination: { DimensionConfigurations: CLOUDWATCH_DIMENSIONS },
    };

    if (DRY) {
        console.log('\n--- DRY RUN, nothing written ---');
        console.log(`Would ${already ? 'UPDATE' : 'CREATE'} destination "${DEST_NAME}" on "${SET_NAME}"`);
        console.log(`Events: ${EVENT_TYPES.join(', ')}`);
        console.log('Re-run with --apply to write it.');
        return;
    }

    try {
        if (already) {
            await client.send(
                new UpdateConfigurationSetEventDestinationCommand({
                    ConfigurationSetName: SET_NAME,
                    EventDestinationName: DEST_NAME,
                    EventDestination: destination,
                })
            );
            console.log(`Updated existing destination "${DEST_NAME}".`);
        } else {
            await client.send(
                new CreateConfigurationSetEventDestinationCommand({
                    ConfigurationSetName: SET_NAME,
                    EventDestinationName: DEST_NAME,
                    EventDestination: destination,
                })
            );
            console.log(`Created destination "${DEST_NAME}".`);
        }
    } catch (err) {
        console.error(`Write failed: ${err.name} - ${err.message}`);
        process.exit(1);
    }

    // Verify by reading back, rather than trusting the write call. Same
    // principle as sendSignInLinkViaSes.js checking for a MessageId.
    const after = await client.send(
        new GetConfigurationSetEventDestinationsCommand({ ConfigurationSetName: SET_NAME })
    );
    const confirmed = (after.EventDestinations || []).find((d) => d.Name === DEST_NAME);
    if (!confirmed) {
        console.error('VERIFY FAILED: destination is not present after writing.');
        process.exit(1);
    }
    console.log(
        `Verified: "${DEST_NAME}" enabled=${confirmed.Enabled} ` +
        `events=[${(confirmed.MatchingEventTypes || []).join(', ')}]`
    );
    console.log('\nFrom now on, bounces and deliveries for pro magic links are recorded.');
})();
