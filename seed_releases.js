/**
 * Seeds the `releases` collection -- the source of truth for the in-app
 * changelog (Home banner + Settings > "Découvrir les nouveautés").
 *
 * Replaces the old `changelogs` Remote Config JSON blob. One document per
 * release means a typo can no longer blank the whole changelog, each release
 * carries a real date and `published` flag, and the set can be managed from
 * scripts like this one.
 *
 * Document ID is the Poteau version integer as a string ("510" for 5.1.0) --
 * the same scheme as getAppVersion(), users.app_version and users.changelog --
 * so the app reads the current release with a direct .doc() get, no query and
 * no composite index.
 *
 * Idempotent: re-running overwrites the same doc IDs with { merge: true }, so
 * correcting a typo is just editing the text below and running it again.
 *
 * IMPORTANT -- `published`:
 *   Set false to stage a release before anyone can see it. The app filters
 *   unpublished docs out of both the banner and the archive.
 *
 * IMPORTANT -- the Home banner:
 *   Only the CURRENTLY RUNNING version can raise the banner, and only if the
 *   user hasn't opened it. Backfilling older releases (like 5.0.0 here) is
 *   therefore safe: it populates the Settings archive without notifying
 *   anyone.
 *
 * Usage:
 *   cd ~/poteau-workspace/scripts && node seed_releases.js
 *   node seed_releases.js --dry     # print what would be written, write nothing
 */

const admin = require('firebase-admin');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const DRY_RUN = process.argv.includes('--dry');

/**
 * READ CHANGELOG_GUIDE.md AT THE WORKSPACE ROOT BEFORE WRITING A RELEASE.
 * It owns the copywriting rules; this comment only covers the format.
 *
 * Body format, which is what the archive page renders:
 *   - a line starting with an emoji is a SECTION HEADING
 *   - every line until the next emoji line is that section's paragraph
 *   - a trailing paragraph with no heading renders as a closing note
 *   - blank lines are ignored; authored bullets are stripped
 * So the emoji is structural, not decoration. Every section needs one.
 *
 * The three rules that matter most, in short:
 *   - Describe what happens across the COMMUNITY, not what the reader will
 *     feel or own. "On voyait de plus en plus de joueurs..." not "Ton
 *     créneau est vraiment le tien".
 *   - Never say our product was broken, never apologise, never lie. Observe
 *     and adapt: "on trouvait que ça n'allait pas assez loin".
 *   - French is written first and properly; EN/ES/IT follow it.
 */
const RELEASES = [
    {
        build: 500,
        date: new Date('2026-07-24T12:00:00Z'),
        published: true,
        title_fr: 'Poteau 5 est là 🎉',
        title_en: 'Poteau 5 is here 🎉',
        title_es: 'Poteau 5 ya está aquí 🎉',
        title_it: 'Poteau 5 è arrivato 🎉',
        body_fr: [
            'Nouveau logo, nouvelle app, et des matchs plus près de chez toi.',
            '',
            '🚪 Ton adresse, pas ta ville',
            'Dis-nous d\'où tu pars. On te propose les matchs les plus proches, pas ceux du centre-ville.',
            '',
            '🕗 Tes dispos, au créneau près',
            'Choisis les jours et les horaires où tu peux jouer. On te propose les matchs qui tombent sur ces créneaux.',
            '',
            '🔁 Les matchs récurrents',
            'Si tu organises, ton match du jeudi soir se recrée tout seul, chaque semaine.',
            '',
            '🤝 Un nouveau paiement',
            'La carte est retenue à l\'inscription. Le débit se fait quand le match est confirmé.',
        ].join('\n'),
        body_en: [
            'New logo, new app, and games closer to where you are.',
            '',
            '🚪 Your address, not your city',
            'Tell us where you set off from. We show you the closest games, not the city-centre ones.',
            '',
            '🕗 Your availability, slot by slot',
            'Pick the days and times you can play. We show you the games that land on those slots.',
            '',
            '🔁 Recurring games',
            'If you organise, your Thursday-night game recreates itself, every week.',
            '',
            '🤝 A new way to pay',
            'The card is held when you sign up. It is charged once the game is confirmed.',
        ].join('\n'),
        body_es: [
            'Nuevo logo, nueva app y partidos más cerca de donde estás.',
            '',
            '🚪 Tu dirección, no tu ciudad',
            'Dinos desde dónde sales. Te proponemos los partidos más cercanos, no los del centro.',
            '',
            '🕗 Tu disponibilidad, franja por franja',
            'Elige los días y las horas en las que puedes jugar. Te proponemos los partidos que caen en esas franjas.',
            '',
            '🔁 Los partidos recurrentes',
            'Si organizas, tu partido del jueves por la noche se recrea solo, cada semana.',
            '',
            '🤝 Una nueva forma de pagar',
            'La tarjeta queda retenida al apuntarte. Se cobra cuando el partido está confirmado.',
        ].join('\n'),
        body_it: [
            'Nuovo logo, nuova app e partite più vicine a dove sei.',
            '',
            '🚪 Il tuo indirizzo, non la città',
            'Dicci da dove parti. Ti proponiamo le partite più vicine, non quelle del centro.',
            '',
            '🕗 Le tue disponibilità, fascia per fascia',
            'Scegli i giorni e gli orari in cui puoi giocare. Ti proponiamo le partite che cadono in quelle fasce.',
            '',
            '🔁 Le partite ricorrenti',
            'Se organizzi, la tua partita del giovedì sera si ricrea da sola, ogni settimana.',
            '',
            '🤝 Un nuovo pagamento',
            'La carta viene bloccata all\'iscrizione. L\'addebito avviene quando la partita è confermata.',
        ].join('\n'),
    },
    {
        build: 510,
        date: new Date('2026-08-04T12:00:00Z'),
        published: true,
        // ONE feature, the biggest one, named plainly. No version number
        // (the pill beside it already says 5.1) and no second feature
        // bolted on with "et".
        //
        // The emoji is the feature's own, not a generic energy mark: a bolt
        // said "something happened", the cards say which thing.
        title_fr: 'Les cartons jaunes et rouges 🟨🟥',
        title_en: 'Yellow and red cards 🟨🟥',
        title_es: 'Las tarjetas amarillas y rojas 🟨🟥',
        title_it: 'I cartellini gialli e rossi 🟨🟥',
        body_fr: [
            '⛔ Cartons jaunes et rouges',
            'Se désinscrire au dernier moment, mal se comporter : ça peut coûter un carton. Deux jaunes font un rouge, et avec un rouge on ne peut plus s\'inscrire. Le joueur est prévenu à chaque fois, et un carton rouge se conteste.',
            '',
            '🧾 Tous les matchs, et ce qu\'on en a dit',
            'Tes matchs sont là, y compris ceux annulés, avec les retours laissés après chacun sur la ponctualité, les absences et le comportement. C\'est visible aussi sur les profils des autres joueurs.',
            '',
            '🪞 Un nouveau profil',
            'On y voit la fiabilité et le niveau.',
            '',
            '📊 Ton équipe en tableau',
            'Tes joueurs avec leur poste et leur niveau, triables comme tu veux. Tu peux aussi demander à un pote de passer le test de niveau.',
            '',
            '👋 Inviter, en plus simple',
            'Par lien, par WhatsApp, ou en cherchant dans la communauté.',
            '',
            '📰 Cette page',
            'On regroupe ici les nouveautés de chaque version. C\'est dans les réglages, quand tu veux.',
            '',
            '🌱 Ce qui arrive ensuite',
            'Tout ça prépare une nouveauté plus importante. On en reparle très vite.',
            '',
            'Et une série de corrections.',
        ].join('\n'),
        body_en: [
            '⛔ Yellow and red cards',
            'Dropping out at the last moment, behaving badly: it can cost you a card. Two yellows make a red, and with a red you can no longer sign up. The player is told every time, and a red card can be appealed.',
            '',
            '🧾 Every game, and what was said about it',
            'Your games are there, cancelled ones included, with the feedback left after each one on punctuality, no-shows and behaviour. It shows on other players\' profiles too.',
            '',
            '🪞 A new profile',
            'It shows reliability and level.',
            '',
            '📊 Your team as a table',
            'Your players with their position and level, sortable however you like. You can also ask a mate to take the level test.',
            '',
            '👋 Inviting, made simpler',
            'By link, by WhatsApp, or by searching the community.',
            '',
            '📰 This page',
            'We gather what changed in each version here. It is in your settings, whenever you want it.',
            '',
            '🌱 What comes next',
            'All of this is groundwork for something bigger. More on that very soon.',
            '',
            'And a batch of fixes.',
        ].join('\n'),
        body_es: [
            '⛔ Tarjetas amarillas y rojas',
            'Darse de baja a última hora, comportarse mal: puede costar una tarjeta. Dos amarillas hacen una roja, y con una roja ya no puedes apuntarte. Al jugador se le avisa siempre, y una tarjeta roja se puede recurrir.',
            '',
            '🧾 Todos los partidos, y lo que se dijo de ellos',
            'Tus partidos están ahí, incluidos los cancelados, con las valoraciones dejadas después de cada uno sobre puntualidad, ausencias y comportamiento. También se ve en los perfiles de los demás jugadores.',
            '',
            '🪞 Un nuevo perfil',
            'Ahí se ve la fiabilidad y el nivel.',
            '',
            '📊 Tu equipo en tabla',
            'Tus jugadores con su posición y su nivel, ordenables como quieras. También puedes pedirle a un amigo que haga el test de nivel.',
            '',
            '👋 Invitar, más sencillo',
            'Por enlace, por WhatsApp, o buscando en la comunidad.',
            '',
            '📰 Esta página',
            'Aquí reunimos las novedades de cada versión. Está en los ajustes, cuando quieras.',
            '',
            '🌱 Lo que viene después',
            'Todo esto prepara una novedad más importante. Te contamos más muy pronto.',
            '',
            'Y una serie de correcciones.',
        ].join('\n'),
        body_it: [
            '⛔ Cartellini gialli e rossi',
            'Disiscriversi all\'ultimo momento, comportarsi male: può costare un cartellino. Due gialli fanno un rosso, e con un rosso non ci si può più iscrivere. Il giocatore viene avvisato ogni volta, e un cartellino rosso si può contestare.',
            '',
            '🧾 Tutte le partite, e cosa se ne è detto',
            'Le tue partite ci sono, comprese quelle annullate, con i riscontri lasciati dopo ognuna su puntualità, assenze e comportamento. Si vede anche sui profili degli altri giocatori.',
            '',
            '🪞 Un nuovo profilo',
            'Ci si legge l\'affidabilità e il livello.',
            '',
            '📊 La tua squadra in tabella',
            'I tuoi giocatori con ruolo e livello, ordinabili come vuoi. Puoi anche chiedere a un amico di fare il test del livello.',
            '',
            '👋 Invitare, più semplice',
            'Con un link, su WhatsApp, o cercando nella community.',
            '',
            '📰 Questa pagina',
            'Qui raccogliamo le novità di ogni versione. È nelle impostazioni, quando vuoi.',
            '',
            '🌱 Cosa arriva dopo',
            'Tutto questo prepara una novità più importante. Ne riparliamo molto presto.',
            '',
            'E una serie di correzioni.',
        ].join('\n'),
    },
    {
        build: 520,
        // Placeholder ship date: this release is staged, not out. Correct it
        // and re-run before flipping published to true.
        date: new Date('2026-09-01T12:00:00Z'),
        // Published ahead of the build shipping. This is safe because
        // fetchChangelogs caps entries at the RUNNING version: nobody on 5.1
        // can see this, and the Home banner only ever fires for the build the
        // user is actually on, so seeding it early notifies no one.
        //
        // It relies on that filter holding. changelog_data.dart now fails
        // closed when the running version cannot be read (it used to treat an
        // unknown version as "show everything", which would have leaked this
        // entry to anyone whose PackageInfo lookup failed).
        //
        // Still editable after this point: re-running the script overwrites
        // the same doc, and 5.2.0 users only appear once the build ships.
        published: true,
        // The headline feature alone. Two earlier attempts each bolted a
        // second thing on with "et" ("des signalements plus justes", then
        // "et un match à la fois"), which asks the reader to hold two ideas
        // before they know what the first one is.
        //
        // The emoji has to survive being read by someone who does not know
        // the feature. 🔴 read as a prohibition sign; 🎙️ read as a podcast,
        // i.e. someone TALKING, when Live is the group's scoreboard: you tap,
        // the score goes up. 🏁 is the match itself, running, and it stays
        // neutral between soccer and padel.
        title_fr: 'Poteau Live 🏁',
        title_en: 'Poteau Live 🏁',
        title_es: 'Poteau Live 🏁',
        title_it: 'Poteau Live 🏁',
        // Poteau Live is named in the title because it is the headline of
        // 5.2.0, but its own section gets written when the feature lands rather
        // than guessed at now. Everything else that ships gets appended here as
        // it lands, which is why the body grows between now and the ship date.
        //
        // NOT BUILT YET (2026-08-19): the "you know when you pay" section is
        // written ahead of the feature. The payment lifecycle it describes is
        // real (hold on join, capture at T-1h once the game is confirmed --
        // see gen2/letsPay.js and gen2/handlePaymentAuth.js), but the in-app
        // screens that explain it to the player are still to build. This
        // section must ship or be removed before 5.2.0 goes out.
        body_fr: [
            '🤹\u200D♂️ Stop aux inscriptions sur plusieurs matchs',
            'On voyait de plus en plus de joueurs s\'inscrire sur plusieurs matchs en même temps. Sauf que c\'est impossible d\'être à 2 endroits en même temps. Donc les joueurs que tu vois inscrits à un match ne sont inscrits que sur ce match.',
            '',
            '💬 Signaler quelqu\'un, avec ta version des faits',
            'En signalant un joueur, tu peux écrire ce qui s\'est passé. C\'est obligatoire si tu choisis "Autre", sinon on ne sait pas quoi en faire. Ce que tu écris est lu par quelqu\'un chez nous.',
            '',
            '🔗 Des joueurs avec qui tu as déjà joué',
            'L\'accueil propose des joueurs croisés sur des matchs précédents. Chaque suggestion dit pourquoi elle est là, le dernier match ensemble ou le nombre de fois. Un tap pour l\'ajouter à ton équipe, un autre pour passer.',
            '',
            '🚗 Le match dans ton calendrier, rappel compris',
            'Une fois inscrit, tu peux ajouter le match au calendrier en un tap, avec le centre et l\'adresse. Le rappel se déclenche 30 minutes avant l\'heure de partir, et sur iPhone il tient compte du trafic. Quand un match atteint 5 joueurs, il se joue presque toujours.',
            '',
            '🧊 La carte n\'est débitée qu\'au dernier moment',
            'Sur les matchs payables dans l\'app, on explique comment ça se passe. La carte est seulement retenue à l\'inscription, puis débitée une heure avant le coup d\'envoi, quand le match est confirmé. Si le match ne se joue pas, il n\'y a pas de débit.',
        ].join('\n'),
        body_en: [
            '🤹\u200D♂️ No more signing up for several games at once',
            'We were seeing more and more players sign up for several games at the same time. Except nobody can be in 2 places at once. So the players you see signed up to a game are only signed up to that one.',
            '',
            '💬 Reporting someone, with your side of it',
            'When you report a player, you can write what happened. It is required if you pick "Other", otherwise we have nothing to go on. What you write is read by someone here.',
            '',
            '🔗 Players you have already played with',
            'The home page suggests players from your previous games. Each suggestion says why it is there, the last game together or the number of times. One tap to add them to your team, another to skip.',
            '',
            '🚗 The game in your calendar, reminder included',
            'Once you are in, you can add the game to your calendar in one tap, with the centre and the address. The reminder goes off 30 minutes before it is time to leave, and on iPhone it takes traffic into account. When a game reaches 5 players, it almost always gets played.',
            '',
            '🧊 The card is only charged at the last moment',
            'On games you pay for in the app, we explain how it works. The card is only held when you sign up, then charged an hour before kick-off, once the game is confirmed. If the game does not happen, nothing is charged.',
        ].join('\n'),
        body_es: [
            '🤹\u200D♂️ Se acabó apuntarse a varios partidos a la vez',
            'Veíamos cada vez más jugadores apuntarse a varios partidos a la misma hora. Solo que es imposible estar en 2 sitios a la vez. Así que los jugadores que ves apuntados a un partido solo están apuntados a ese.',
            '',
            '💬 Reportar a alguien, con tu versión',
            'Al reportar a un jugador, puedes escribir qué pasó. Es obligatorio si eliges "Otro", si no, no sabemos qué hacer con ello. Lo que escribes lo lee alguien de aquí.',
            '',
            '🔗 Jugadores con los que ya has jugado',
            'El inicio propone jugadores de tus partidos anteriores. Cada sugerencia dice por qué está ahí, el último partido juntos o el número de veces. Un toque para añadirlo a tu equipo, otro para pasar.',
            '',
            '🚗 El partido en tu calendario, con recordatorio',
            'Una vez apuntado, puedes añadir el partido al calendario con un toque, con el centro y la dirección. El recordatorio salta 30 minutos antes de la hora de salir, y en iPhone tiene en cuenta el tráfico. Cuando un partido llega a 5 jugadores, casi siempre se juega.',
            '',
            '🧊 La tarjeta solo se cobra al final',
            'En los partidos que se pagan en la app, te explicamos cómo funciona. La tarjeta solo queda retenida al apuntarte, y se cobra una hora antes del inicio, cuando el partido está confirmado. Si el partido no se juega, no se cobra nada.',
        ].join('\n'),
        body_it: [
            '🤹\u200D♂️ Basta iscrizioni a più partite insieme',
            'Vedevamo sempre più giocatori iscriversi a più partite alla stessa ora. Solo che è impossibile essere in 2 posti insieme. Quindi i giocatori che vedi iscritti a una partita sono iscritti solo a quella.',
            '',
            '💬 Segnalare qualcuno, con la tua versione',
            'Quando segnali un giocatore, puoi scrivere cosa è successo. È obbligatorio se scegli "Altro", altrimenti non sappiamo cosa farne. Quello che scrivi lo legge qualcuno qui.',
            '',
            '🔗 Giocatori con cui hai già giocato',
            'La home propone giocatori delle tue partite precedenti. Ogni suggerimento dice perché è lì, l\'ultima partita insieme o il numero di volte. Un tap per aggiungerlo alla tua squadra, un altro per passare.',
            '',
            '🚗 La partita nel calendario, promemoria incluso',
            'Una volta iscritto, puoi aggiungere la partita al calendario con un tap, con il centro e l\'indirizzo. Il promemoria parte 30 minuti prima dell\'ora di uscire, e su iPhone tiene conto del traffico. Quando una partita arriva a 5 giocatori, quasi sempre si gioca.',
            '',
            '🧊 La carta si addebita solo all\'ultimo',
            'Sulle partite che si pagano nell\'app, spieghiamo come funziona. La carta viene solo bloccata all\'iscrizione, poi addebitata un\'ora prima del fischio d\'inizio, quando la partita è confermata. Se la partita non si gioca, non viene addebitato nulla.',
        ].join('\n'),
    },
];

async function seedReleases() {
    console.log(`Seeding ${RELEASES.length} release(s)${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);

    for (const release of RELEASES) {
        const id = String(release.build);
        console.log(`  ${id}  ${release.title_fr}  published=${release.published}`);
        if (DRY_RUN) continue;
        // merge:true so re-running to fix a typo updates in place and never
        // drops fields added by hand in the console.
        await db.collection('releases').doc(id).set(release, { merge: true });
    }

    if (DRY_RUN) {
        console.log('\nDry run: nothing written.');
        return;
    }

    // Read back so the run proves what is actually live rather than assuming.
    const snap = await db.collection('releases').orderBy('build', 'desc').get();
    console.log(`\nCollection now holds ${snap.size} release(s):`);
    snap.forEach((doc) => {
        const d = doc.data();
        console.log(`  ${doc.id}  ${d.title_fr}  published=${d.published}`);
    });
}

seedReleases()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Failed:', err);
        process.exit(1);
    });
