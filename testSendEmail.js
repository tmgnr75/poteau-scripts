const { SESv2Client, SendEmailCommand } = require("@aws-sdk/client-sesv2");

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

// Language-specific unsubscribe texts
const unsubscribeTexts = {
  fr: [
    "Tu préfères qu'on ne t'envoie plus de mail ?\nClique ici",
    "Tu veux qu'on arrête de t'écrire ?\nC'est ici",
    "Besoin de silence ?\nC'est par là pour arrêter les mails",
    "Plus envie de recevoir nos messages ?\nClique ici"
  ],
  en: [
    "Prefer we stop emailing you?\nClick here",
    "Want us to stop reaching out?\nClick here",
    "Tired of emails?\nUnsubscribe here",
    "Click here if you don’t want our emails anymore"
  ],
  es: [
    "¿Prefieres que no te enviemos más correos?\nHaz clic aquí",
    "Haz clic aquí si no quieres más correos nuestros",
    "¿Cansado de nuestros correos?\nAquí para parar",
    "Haz clic aquí para dejar de recibir correos"
  ],
  it: [
    "Preferisci non ricevere più email?\nClicca qui",
    "Clicca qui per non ricevere più le nostre email",
    "Vuoi smettere di ricevere messaggi?\nClicca qui",
    "Non vuoi più sentirci via mail?\nClicca qui"
  ]
};

const language = "fr"; // change to "en", "es", "it" to test others
const unsubscribe_texts = unsubscribeTexts[language] || unsubscribeTexts['fr'];
const unsubscribe_text = unsubscribe_texts[Math.floor(Math.random() * unsubscribe_texts.length)];

const testPayload = {
  recipientId: "TEST_RECIPIENT_ID",
  connectId: "TEST_CONNECT_ID",
  email: "timothe@timwork.pro",
  last_email_date: new Date().toISOString(),
  auth_email: true,
  language,
  // picture: "https://firebasestorage.googleapis.com/v0/b/krank-club.appspot.com/o/images%2Fben-poteau-small.png?alt=media&token=7bcdd130-a529-4d37-8e67-75048fd07a0e",
  title: "Titre de test",
  heading_text: "Tu as rejoint un nouveau match&nbsp;!",
  main_body_text: "Clique ci-dessous pour le voir dans l'app",
  cta_link_text: "Voir dans l'app",
  cta_link_url: "https://poteau.app/game/12345?source=email",
  footer_text: "L'équipe Poteau",
  unsubscribe_url: "https://us-central1-krank-club.cloudfunctions.net/unsubscribeEmail?recipientId=TEST_RECIPIENT_ID&email=t.genreau@me.com",
  unsubscribe_text
};

const params = {
  FromEmailAddress: "Poteau <noreply@mail.poteau.app>",
  Destination: {
    ToAddresses: [testPayload.email],
  },
  Content: {
    Template: {
      TemplateName: "GenericEmail",
      TemplateData: JSON.stringify(testPayload),
    },
  },
  ConfigurationSetName: "my-first-configuration-set",
};

async function sendTestEmail() {
  try {
    const command = new SendEmailCommand(params);
    const response = await client.send(command);
    console.log("✅ Email sent:", response.MessageId || response);
  } catch (err) {
    console.error("❌ Failed to send email:", err);
  }
}

sendTestEmail();