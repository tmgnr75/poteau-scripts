/**
 * Create the "otc-emails" SES configuration set used by the sign-up code email.
 *
 * Keeping auth email separate from invitation-emails / generic-emails /
 * newsletter-emails means OTC bounce and delivery rates are not diluted by
 * marketing volume -- which matters, because a deliverability problem on the
 * sign-up code blocks account creation entirely.
 *
 * Idempotent: an existing set is left untouched.
 *
 * Usage:
 *   AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... node createOtcConfigSet.js
 */

const {
    SESv2Client,
    CreateConfigurationSetCommand,
    GetConfigurationSetCommand,
    ListConfigurationSetsCommand,
} = require('@aws-sdk/client-sesv2');

const REGION = 'eu-north-1';
const SET_NAME = 'otc-emails';

(async () => {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.error('Missing AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in the environment.');
        process.exit(1);
    }

    const client = new SESv2Client({
        region: REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });

    try {
        const existing = await client.send(new ListConfigurationSetsCommand({ PageSize: 50 }));
        console.log('Existing configuration sets:', (existing.ConfigurationSets || []).join(', ') || '(none)');
    } catch (err) {
        console.error(`Could not list configuration sets: ${err.name} - ${err.message}`);
        process.exit(1);
    }

    try {
        await client.send(new GetConfigurationSetCommand({ ConfigurationSetName: SET_NAME }));
        console.log(`"${SET_NAME}" already exists, nothing to do.`);
        return;
    } catch (err) {
        if (err.name !== 'NotFoundException') {
            console.error(`Unexpected error probing "${SET_NAME}": ${err.name} - ${err.message}`);
            process.exit(1);
        }
    }

    try {
        await client.send(new CreateConfigurationSetCommand({
            ConfigurationSetName: SET_NAME,
            ReputationOptions: { ReputationMetricsEnabled: true },
            SendingOptions: { SendingEnabled: true },
        }));
        console.log(`Created configuration set "${SET_NAME}".`);
        console.log('Note: no event destination is attached. Delivery/bounce events are');
        console.log('recorded in SES reputation metrics, but are not streamed to SNS.');
    } catch (err) {
        console.error(`Failed to create "${SET_NAME}": ${err.name} - ${err.message}`);
        process.exit(1);
    }
})();
