const { SESv2Client, UpdateEmailTemplateCommand } = require("@aws-sdk/client-sesv2");
const fs = require("fs");

// Credentials come from the environment. The keys previously hardcoded here
// were rejected by AWS ("security token invalid") -- they were rotated and this
// script was never updated, so it had been silently broken.
//
//   AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... node updateInvitationEmail.js
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error("Missing AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in the environment.");
    process.exit(1);
}

const client = new SESv2Client({
    region: "eu-north-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const html = fs.readFileSync("./templates/InvitationEmail.html", "utf8");

const params = {
    TemplateName: "InvitationEmail",
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
        console.log("✅ InvitationEmail template updated:", res);
    } catch (err) {
        console.error("❌ Failed to update template:", err);
    }
})();