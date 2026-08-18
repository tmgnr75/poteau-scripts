const fs = require("fs");
const {
    SESv2Client,
    CreateEmailTemplateCommand,
} = require("@aws-sdk/client-sesv2");

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('Missing AWS credentials. Run: source ~/.poteau/aws_ses.env');
    process.exit(1);
}

const client = new SESv2Client({
    region: "eu-north-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const htmlBody = fs.readFileSync("./templates/InvitationEmail.html", "utf8");

const command = new CreateEmailTemplateCommand({
    TemplateName: "InvitationEmail",
    TemplateContent: {
        Subject: "{{heading_text}}",
        Html: htmlBody,
        Text: "Fallback text: {{main_body_text}}",
    },
});

(async () => {
    try {
        const response = await client.send(command);
        console.log("✅ Template created:", response);
    } catch (err) {
        console.error("❌ Error:", err);
    }
})();