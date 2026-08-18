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

const language = "fr"; // change to test different languages
const unsubscribe_texts = unsubscribeTexts[language] || unsubscribeTexts["fr"];
const unsubscribe_text = unsubscribe_texts[Math.floor(Math.random() * unsubscribe_texts.length)];

const games = [
    {
        centre: "Paris FC 13",
        game_date: "Aujourd’hui à 19h",
        game_id: "game_123",
        cta_link_text: "Voir dans l'app",
        cta_link_url: "https://poteau.app/game/game_123?source=email",
        organizer_picture: "https://firebasestorage.googleapis.com/v0/b/krank-club.appspot.com/o/images%2Fben-poteau-small.png?alt=media&token=7bcdd130-a529-4d37-8e67-75048fd07a0e"
    }
];

const heading_text = games.length > 1
    ? {
        fr: "Tes invitations en&nbsp;attente",
        en: "Your pending invites",
        es: "Tus invitaciones pendientes",
        it: "I tuoi inviti in attesa"
    }[language]
    : {
        fr: "Tu as une invitation en&nbsp;attente",
        en: "You have a pending invite",
        es: "Tienes una invitación pendiente",
        it: "Hai un invito in attesa"
    }[language];

const testPayload = {
    recipientId: "TEST_RECIPIENT_ID",
    connectId: "TEST_CONNECT_ID",
    email: "timothe@timwork.pro",
    last_email_date: new Date().toISOString(),
    auth_email: true,
    language,
    games,
    title: heading_text,
    heading_text: games.length > 1
        ? {
            fr: "Tes invitations en attente",
            en: "Your pending invites",
            es: "Tus invitaciones pendientes",
            it: "I tuoi inviti in attesa"
        }[language]
        : {
            fr: "Tu as une invitation en attente",
            en: "You have a pending invite",
            es: "Tienes una invitación pendiente",
            it: "Hai un invito in attesa"
        }[language],
    main_body_text: {
        fr: "Ta réponse est attendue, rendez-vous sur l’app pour plus d’infos.",
        en: "Your response is expected. Check the app for more details.",
        es: "Esperamos tu respuesta. Mira la app para más detalles.",
        it: "Aspettiamo la tua risposta. Vai sull'app per saperne di più."
    }[language],
    footer_text: {
        fr: "L'équipe Poteau",
        en: "The Poteau Team",
        es: "El equipo de Poteau",
        it: "Il team Poteau"
    }[language],
    global_cta_text: {
        fr: "Ouvrir Poteau",
        en: "Open Poteau",
        es: "Abrir Poteau",
        it: "Apri Poteau"
    }[language],
    global_cta_link: "https://poteau.app/games?source=email_global_cta",
    unsubscribe_url: "https://us-central1-krank-club.cloudfunctions.net/unsubscribeEmail?recipientId=TEST_RECIPIENT_ID&email=timothe@timwork.pro",
    unsubscribe_text
};

const params = {
    FromEmailAddress: "Poteau <noreply@mail.poteau.app>",
    Destination: {
        ToAddresses: [testPayload.email],
    },
    Content: {
        Template: {
            TemplateName: "InvitationEmail",
            TemplateData: JSON.stringify(testPayload),
        },
    },
    ConfigurationSetName: "my-first-configuration-set",
};

async function sendTestEmail() {
    try {
        const command = new SendEmailCommand(params);
        const response = await client.send(command);
        console.log("✅ InvitationEmail sent:", response.MessageId || response);
    } catch (err) {
        console.error("❌ Failed to send InvitationEmail:", err);
    }
}

sendTestEmail();