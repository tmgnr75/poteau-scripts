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
 * Body text conventions, matching what the archive page renders:
 *   - a line starting with "•" becomes a bullet with a hanging indent
 *   - any other non-empty line becomes a bold paragraph (a section heading)
 *   - a blank line becomes vertical space
 * Keep bullets short: they wrap on a phone.
 *
 * Tone: "tu", warm and plain, no em dashes, no corporate voice. Describe what
 * the user can now DO, not what we refactored.
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
            'Nouveau logo, nouvelle app, et surtout : des matchs qui te correspondent vraiment.',
            '',
            '📍 Ton adresse, pas ta ville',
            'Dis-nous d\'où tu pars vraiment. On te propose les matchs les plus proches, pas ceux du centre-ville.',
            '',
            '🗓️ Tes dispos, au créneau près',
            'Choisis tes jours et tes horaires. On s\'occupe de te trouver des matchs qui tombent au bon moment.',
            '',
            '🔁 Les matchs récurrents',
            'Pour les organisateurs : ton match du jeudi soir se recrée tout seul, chaque semaine.',
            '',
            '💳 Un nouveau paiement',
            'Plus sûr et plus souple. Tu n\'es débité que quand le match est confirmé.',
        ].join('\n'),
        body_en: [
            'New logo, new app, and above all: games that actually match you.',
            '',
            '📍 Your address, not your city',
            'Tell us where you actually set off from. We show you the closest games, not the city-centre ones.',
            '',
            '🗓️ Your availability, slot by slot',
            'Pick your days and your times. We take care of finding games that land when you can play.',
            '',
            '🔁 Recurring games',
            'For organisers: your Thursday-night game recreates itself, every week.',
            '',
            '💳 A new way to pay',
            'Safer and more flexible. You are only charged once the game is confirmed.',
        ].join('\n'),
        body_es: [
            'Nuevo logo, nueva app y, sobre todo: partidos que de verdad encajan contigo.',
            '',
            '📍 Tu dirección, no tu ciudad',
            'Dinos desde dónde sales de verdad. Te proponemos los partidos más cercanos, no los del centro.',
            '',
            '🗓️ Tu disponibilidad, franja por franja',
            'Elige tus días y tus horarios. Nosotros nos encargamos de encontrarte partidos que te cuadren.',
            '',
            '🔁 Los partidos recurrentes',
            'Para los organizadores: tu partido del jueves por la noche se recrea solo, cada semana.',
            '',
            '💳 Una nueva forma de pagar',
            'Más segura y más flexible. Solo se te cobra cuando el partido está confirmado.',
        ].join('\n'),
        body_it: [
            'Nuovo logo, nuova app e soprattutto: partite che ti corrispondono davvero.',
            '',
            '📍 Il tuo indirizzo, non la città',
            'Dicci da dove parti davvero. Ti proponiamo le partite più vicine, non quelle del centro.',
            '',
            '🗓️ Le tue disponibilità, fascia per fascia',
            'Scegli i tuoi giorni e i tuoi orari. Al resto pensiamo noi, trovandoti partite al momento giusto.',
            '',
            '🔁 Le partite ricorrenti',
            'Per gli organizzatori: la tua partita del giovedì sera si ricrea da sola, ogni settimana.',
            '',
            '💳 Un nuovo pagamento',
            'Più sicuro e più flessibile. Ti addebitiamo solo quando la partita è confermata.',
        ].join('\n'),
    },
    {
        build: 510,
        date: new Date('2026-08-04T12:00:00Z'),
        published: true,
        // No "version 2.0" in a title: the version pill right beside it
        // already says 5.1, so a second number reads as confused. Names the
        // two things that actually changed instead.
        title_fr: 'Le profil et le fair play, repensés ⚡',
        title_en: 'Profiles and fair play, rethought ⚡',
        title_es: 'El perfil y el juego limpio, replanteados ⚡',
        title_it: 'Profilo e fair play, ripensati ⚡',
        body_fr: [
            '🟨🟥 Cartons jaunes et rouges',
            'Le fair play devient concret. Une désinscription à la dernière minute, un comportement limite : ça peut désormais coûter un carton. Deux jaunes = un rouge, et un rouge bloque l\'accès. Le joueur est prévenu à chaque fois, et un carton rouge est contestable.',
            '',
            '👤 Un nouveau profil',
            'Plus clair, plus complet : ta fiabilité et ton niveau se lisent d\'un coup d\'œil.',
            '',
            '📋 Tout ton historique',
            'Retrouve enfin tous tes matchs, même ceux annulés, et les retours reçus après chaque match : ponctualité, absences, comportement. Visible aussi sur les profils des autres joueurs. Tu sais avec qui tu joues.',
            '',
            '⚽ Ton équipe en tableau',
            'Tes joueurs listés avec leur poste et leur niveau, triables comme tu veux. Tu peux même demander à un pote de passer le test de niveau.',
            '',
            '➕ Inviter, en plus simple',
            'Lien, WhatsApp ou recherche dans la communauté : trois façons au même endroit.',
            '',
            '✨ Cette page',
            'Les nouveautés de chaque version sont désormais rassemblées ici. Tu les retrouves quand tu veux depuis tes réglages.',
            '',
            '🧱 La première brique',
            'Tout ça prépare une grosse nouveauté qui arrive cet été. On t\'en dit plus très vite.',
            '',
            'Et plein de corrections pour que tout soit plus fluide.',
        ].join('\n'),
        body_en: [
            '🟨🟥 Yellow and red cards',
            'Fair play gets real. Dropping out at the last minute, borderline behaviour: it can now cost you a card. Two yellows make a red, and a red blocks access. The player is told every time, and a red card can be appealed.',
            '',
            '👤 A new profile',
            'Clearer and more complete: your reliability and your level are readable at a glance.',
            '',
            '📋 Your whole history',
            'At last, find all your games, even the cancelled ones, along with the feedback left after each one: punctuality, no-shows, behaviour. Visible on other players\' profiles too. You know who you are playing with.',
            '',
            '⚽ Your team as a table',
            'Your players listed with their position and level, sortable however you like. You can even ask a mate to take the level test.',
            '',
            '➕ Inviting, made simpler',
            'Link, WhatsApp or a community search: three ways in one place.',
            '',
            '✨ This page',
            'What changed in each version now lives here. Come back to it whenever you like, from your settings.',
            '',
            '🧱 The first brick',
            'All of this is groundwork for something big landing this summer. More on that very soon.',
            '',
            'Plus plenty of fixes to make everything smoother.',
        ].join('\n'),
        body_es: [
            '🟨🟥 Tarjetas amarillas y rojas',
            'El juego limpio se vuelve concreto. Darse de baja a última hora, un comportamiento fuera de lugar: ahora puede costar una tarjeta. Dos amarillas son una roja, y una roja bloquea el acceso. Al jugador se le avisa siempre, y una tarjeta roja se puede recurrir.',
            '',
            '👤 Un nuevo perfil',
            'Más claro y más completo: tu fiabilidad y tu nivel se leen de un vistazo.',
            '',
            '📋 Todo tu historial',
            'Por fin encuentras todos tus partidos, incluso los cancelados, y las valoraciones recibidas después de cada uno: puntualidad, ausencias, comportamiento. También visible en los perfiles de los demás jugadores. Sabes con quién juegas.',
            '',
            '⚽ Tu equipo en tabla',
            'Tus jugadores con su posición y su nivel, ordenables como quieras. Incluso puedes pedirle a un amigo que haga el test de nivel.',
            '',
            '➕ Invitar, más sencillo',
            'Enlace, WhatsApp o búsqueda en la comunidad: tres formas en un mismo sitio.',
            '',
            '✨ Esta página',
            'Las novedades de cada versión ahora están reunidas aquí. Vuelve cuando quieras desde tus ajustes.',
            '',
            '🧱 El primer ladrillo',
            'Todo esto prepara una gran novedad que llega este verano. Te contamos más muy pronto.',
            '',
            'Y un montón de correcciones para que todo vaya más fluido.',
        ].join('\n'),
        body_it: [
            '🟨🟥 Cartellini gialli e rossi',
            'Il fair play diventa concreto. Disiscriversi all\'ultimo minuto, un comportamento al limite: ora può costare un cartellino. Due gialli fanno un rosso, e un rosso blocca l\'accesso. Il giocatore viene avvisato ogni volta, e un cartellino rosso è contestabile.',
            '',
            '👤 Un nuovo profilo',
            'Più chiaro e più completo: la tua affidabilità e il tuo livello si leggono a colpo d\'occhio.',
            '',
            '📋 Tutto il tuo storico',
            'Finalmente ritrovi tutte le tue partite, anche quelle annullate, e i riscontri ricevuti dopo ognuna: puntualità, assenze, comportamento. Visibile anche sui profili degli altri giocatori. Sai con chi giochi.',
            '',
            '⚽ La tua squadra in tabella',
            'I tuoi giocatori elencati con ruolo e livello, ordinabili come vuoi. Puoi anche chiedere a un amico di fare il test del livello.',
            '',
            '➕ Invitare, più semplice',
            'Link, WhatsApp o ricerca nella community: tre modi nello stesso posto.',
            '',
            '✨ Questa pagina',
            'Le novità di ogni versione ora sono raccolte qui. Torna quando vuoi dalle tue impostazioni.',
            '',
            '🧱 Il primo mattone',
            'Tutto questo prepara una grande novità in arrivo quest\'estate. Te ne parliamo molto presto.',
            '',
            'E tante correzioni per rendere tutto più fluido.',
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
        title_fr: 'Poteau Live et des signalements plus justes 🔴',
        title_en: 'Poteau Live, and fairer reporting 🔴',
        title_es: 'Poteau Live y reportes más justos 🔴',
        title_it: 'Poteau Live e segnalazioni più giuste 🔴',
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
            '🚩 Signaler quelqu\'un, avec le contexte',
            'Quand tu signales un joueur, tu peux expliquer ce qui s\'est passé. C\'est obligatoire si tu choisis "Autre", parce que sans explication on ne peut rien en faire. Plus tu nous en dis, plus la décision est juste.',
            '',
            '⚖️ Les cartons fonctionnent vraiment',
            'Une désinscription à la dernière minute sur un match presque complet compte désormais comme prévu. Ça marchait mal jusqu\'ici, c\'est corrigé.',
            '',
            '🕐 Un seul match à la fois',
            'Impossible de t\'inscrire à deux matchs qui se chevauchent. Tu voyais parfois un match complet alors qu\'un joueur était déjà ailleurs à la même heure : ça n\'arrivera plus. Ton créneau est vraiment le tien.',
            '',
            '📅 Tu es dans le match, et dans ton agenda',
            'Après ton inscription, ajoute le match à ton agenda en un tap : le centre, l\'adresse, et un rappel 30 minutes avant l\'heure de partir, qui s\'adapte même au trafic sur iPhone. Tu peux aussi inviter quelqu\'un dans la foulée, et à 5 joueurs un match se joue presque toujours.',
            '',
            '💳 Tu sais quand tu paies',
            'Sur les matchs payables dans l\'app, on t\'annonce maintenant clairement le déroulé : ta carte est seulement retenue quand tu t\'inscris, et débitée une heure avant le coup d\'envoi, une fois le match confirmé. Si le match ne se joue pas, tu ne paies rien.',
        ].join('\n'),
        body_en: [
            '🚩 Reporting someone, with the context',
            'When you report a player, you can explain what happened. It is required if you pick "Other", because without an explanation there is nothing we can act on. The more you tell us, the fairer the decision.',
            '',
            '⚖️ Cards actually work now',
            'Dropping out at the last minute from an almost full game now counts, the way it was meant to. It was not working properly until now. Fixed.',
            '',
            '🕐 One game at a time',
            'You can no longer join two games that overlap. Until now a game could look full while one of its players was already somewhere else at the same time. Your slot is genuinely yours.',
            '',
            '📅 You are in the game, and in your calendar',
            'Once you have joined, add the game to your calendar in one tap: the centre, the address, and a reminder 30 minutes before it is time to leave, which even adjusts to the traffic on iPhone. You can invite someone in the same breath, and with five players a game almost always gets played.',
            '',
            '💳 You know when you pay',
            'On games you pay for in the app, we now spell out exactly how it goes: your card is only held when you join, and charged one hour before kick-off, once the game is confirmed. If the game does not get played, you pay nothing.',
        ].join('\n'),
        body_es: [
            '🚩 Reportar a alguien, con contexto',
            'Cuando reportas a un jugador, puedes explicar qué pasó. Es obligatorio si eliges "Otro", porque sin explicación no podemos hacer nada. Cuanto más nos cuentes, más justa es la decisión.',
            '',
            '⚖️ Las tarjetas funcionan de verdad',
            'Darse de baja a última hora en un partido casi completo ya cuenta, como estaba previsto. Hasta ahora no funcionaba bien. Corregido.',
            '',
            '🕐 Un partido a la vez',
            'Ya no puedes apuntarte a dos partidos que se solapan. Antes un partido podía parecer completo mientras uno de sus jugadores ya estaba en otro sitio a la misma hora. Tu hueco es de verdad tuyo.',
            '',
            '📅 Estás en el partido, y en tu calendario',
            'Una vez apuntado, añade el partido a tu calendario con un toque: el centro, la dirección, y un recordatorio 30 minutos antes de salir, que en iPhone se adapta incluso al tráfico. También puedes invitar a alguien al momento, y con cinco jugadores un partido casi siempre se juega.',
            '',
            '💳 Sabes cuándo pagas',
            'En los partidos que se pagan en la app, ahora te explicamos claramente cómo funciona: tu tarjeta solo queda retenida al apuntarte, y se cobra una hora antes del inicio, cuando el partido está confirmado. Si el partido no se juega, no pagas nada.',
        ].join('\n'),
        body_it: [
            '🚩 Segnalare qualcuno, con il contesto',
            'Quando segnali un giocatore, puoi spiegare cosa è successo. È obbligatorio se scegli "Altro", perché senza spiegazione non possiamo farci nulla. Più ci racconti, più la decisione è giusta.',
            '',
            '⚖️ I cartellini funzionano davvero',
            'Disdire all\'ultimo minuto una partita quasi completa ora conta, come previsto. Finora non funzionava bene. Corretto.',
            '',
            '🕐 Una partita alla volta',
            'Non puoi più iscriverti a due partite che si sovrappongono. Prima una partita poteva sembrare completa mentre uno dei suoi giocatori era già altrove alla stessa ora. Il tuo posto è davvero tuo.',
            '',
            '📅 Sei nella partita, e nel tuo calendario',
            'Dopo l\'iscrizione, aggiungi la partita al calendario con un tap: il centro, l\'indirizzo, e un promemoria 30 minuti prima di uscire, che su iPhone si adatta anche al traffico. Puoi anche invitare qualcuno subito, e con cinque giocatori una partita si gioca quasi sempre.',
            '',
            '💳 Sai quando paghi',
            'Sulle partite che si pagano nell\'app, ora ti spieghiamo chiaramente come funziona: la tua carta viene solo bloccata quando ti iscrivi, e addebitata un\'ora prima del fischio d\'inizio, quando la partita è confermata. Se la partita non si gioca, non paghi nulla.',
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
