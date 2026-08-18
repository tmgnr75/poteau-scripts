const AWS = require('aws-sdk');
const fs = require('fs');

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('Missing AWS credentials. Run: source ~/.poteau/aws_ses.env');
    process.exit(1);
}

AWS.config.update({
    region: 'eu-north-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const sesv2 = new AWS.SESV2({ apiVersion: '2019-09-27' });

// Load your HTML from file or use inline
const htmlBody = fs.readFileSync('./templates/InvitationEmail.html', 'utf8');

const params = {
    TemplateName: 'InvitationEmail',
    TemplateContent: {
        Subject: '{{title}}',
        Html: htmlBody,
        Text: 'Fallback text: {{main_body_text}}',
    },
};

sesv2.createEmailTemplate(params, (err, data) => {
    if (err) {
        console.error('Error creating template:', err);
    } else {
        console.log('Template created successfully:', data);
    }
});