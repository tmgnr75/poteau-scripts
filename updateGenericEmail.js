const { SESv2Client, UpdateEmailTemplateCommand } = require("@aws-sdk/client-sesv2");
const fs = require("fs");

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

const html = fs.readFileSync("./templates/GenericEmail.html", "utf8");

const params = {
    TemplateName: "GenericEmail",
    TemplateContent: {
        Subject: "{{title}}",
        Html: html,
        Text: "{{main_body_text}}", // fallback plain text version
    },
};

(async () => {
    try {
        const command = new UpdateEmailTemplateCommand(params);
        const res = await client.send(command);
        console.log("✅ GenericEmail template updated:", res);
    } catch (err) {
        console.error("❌ Failed to update template:", err);
    }
})();