/**
 * AWS SES Newsletter Template Creator
 *
 * This script creates/updates the NewsletterEmail template in AWS SES.
 * Run once to set up the template, or again to update it.
 *
 * Usage:
 *   node createTemplate.js          # Create new template
 *   node createTemplate.js --update # Update existing template
 */

const { SESClient, CreateTemplateCommand, UpdateTemplateCommand, GetTemplateCommand } = require('@aws-sdk/client-ses');
const fs = require('fs');
const path = require('path');

// AWS SES Configuration (same as cloud functions)
const sesClient = new SESClient({
    region: 'eu-north-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Read the HTML template
const htmlTemplate = fs.readFileSync(
    path.join(__dirname, 'templates', 'newsletter.html'),
    'utf8'
);

// Plain text version (fallback)
const textTemplate = `
{{greeting}}

{{body_text_1}}

{{body_text_2}}

{{body_text_3}}

{{cta_text}}: {{cta_url}}

---
{{signature}}

{{unsubscribe_text}}: {{unsubscribe_url}}
`;

const templateParams = {
    Template: {
        TemplateName: 'PoteauNewsletter',
        SubjectPart: '{{subject}}',
        HtmlPart: htmlTemplate,
        TextPart: textTemplate.trim(),
    },
};

async function checkTemplateExists() {
    try {
        await sesClient.send(new GetTemplateCommand({ TemplateName: 'PoteauNewsletter' }));
        return true;
    } catch (err) {
        if (err.name === 'TemplateDoesNotExistException') {
            return false;
        }
        throw err;
    }
}

async function createTemplate() {
    const isUpdate = process.argv.includes('--update');

    console.log('🔍 Checking AWS credentials...');
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.error('❌ AWS credentials not found in environment variables.');
        console.log('\nPlease set:');
        console.log('  export AWS_ACCESS_KEY_ID=your_access_key');
        console.log('  export AWS_SECRET_ACCESS_KEY=your_secret_key');
        process.exit(1);
    }

    try {
        const exists = await checkTemplateExists();

        if (exists && !isUpdate) {
            console.log('⚠️  Template "PoteauNewsletter" already exists.');
            console.log('   Use --update flag to update it.');
            process.exit(0);
        }

        if (isUpdate || exists) {
            console.log('📝 Updating template "PoteauNewsletter"...');
            await sesClient.send(new UpdateTemplateCommand(templateParams));
            console.log('✅ Template updated successfully!');
        } else {
            console.log('📝 Creating template "PoteauNewsletter"...');
            await sesClient.send(new CreateTemplateCommand(templateParams));
            console.log('✅ Template created successfully!');
        }

        console.log('\n📋 Template details:');
        console.log('   Name: PoteauNewsletter');
        console.log('   Region: eu-north-1');
        console.log('\n🔗 Next steps:');
        console.log('   1. Create Configuration Set "newsletter-emails" in AWS Console');
        console.log('   2. Enable open & click tracking');
        console.log('   3. Create a campaign JSON in campaigns/ folder');
        console.log('   4. Run: node sendNewsletter.js <campaign-id> --test');

    } catch (err) {
        console.error('❌ Error:', err.message);
        if (err.name === 'InvalidParameterValue') {
            console.log('\n💡 Tip: Check your HTML template for syntax errors.');
        }
        process.exit(1);
    }
}

createTemplate();
