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
        // Was a placeholder (2026-09-01) while the release was staged. Set to
        // the real date once every section below was verified as actually
        // built (2026-09-07) -- see the audit note above body_fr.
        date: new Date('2026-09-07T12:00:00Z'),
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
        // REWRITTEN 2026-09-07 after auditing all 488 app commits since 5.1.0.
        //
        // The body described five things and never once mentioned Poteau Live
        // -- in a release TITLED "Poteau Live". 85 of those commits are Live,
        // 25 padel, 13 Apple Watch, and none of it was in the notes. The
        // release now leads with what it is named after.
        //
        // ORDERED HEAVIEST TO LIGHTEST, and chronologically through a game:
        // during the match, on the wrist, after the match, then the two
        // lighter things that happen when you sign up.
        //
        // A CHANGELOG DESCRIBES THE VERSION, NOT WHAT IS SWITCHED ON TODAY.
        // Live is gated on a per-game `poteau_live` flag which currently sits
        // true on four seeded fixtures and nothing else. That is not a reason
        // to omit it: Tim flips it on every game at release, so a player on
        // this build can reach it. Do not "correct" this by cutting Live back
        // out because production looks quiet the day before shipping.
        //
        // Verified reachable against the code, not remembered:
        //   Live board      /live route, nav.dart:456. Entry from the game
        //                   sheet, the Home game card, and the upcoming card.
        //                   Attendees + organiser. Real landscape rotation.
        //   padel           fold_live_score.dart PadelScore -- points, games,
        //                   sets, tie-break. Not soccer minus goals.
        //   Apple Watch     ios/PoteauWatch Watch App, embedded via the
        //                   Runner's Embed Watch Content phase. iOS only, and
        //                   it needs the phone's board open (no watchOS
        //                   Firestore) -- which is why the copy says "sans
        //                   reprendre le téléphone en main", NOT "sans sortir
        //                   ton téléphone du sac".
        //   Live Activity   ios/PoteauLiveActivity, lock screen + Dynamic
        //                   Island, NSSupportsLiveActivities in both plists.
        //   wrap-up         /wrap-up, wrap_up_widget.dart, from three places.
        //   share card      wrap_up_share_card_widget.dart.
        //   your team       your_team_section_widget.dart, backed by
        //                   gen2/getTeamSuggestions (shipped 2026-09-07).
        //   overlap guard   _clashBlocks() in api_calls.dart, called from BOTH
        //                   AddPlayerCall and ConfirmSpotsCall. Fails open.
        //   calendar        addGameToCalendar, offered from b_s_joined_game.
        //
        // CUT DELIBERATELY, though they shipped: the Gold-exclusive chat leak
        // and the private-game leak (announcing a hole advertises what was
        // exposed), and the 'female'/'woman' copy bug that gave 405 women
        // masculine French -- fixing that quietly is the right call.
        //
        // Anything appended here later gets the same treatment before the date
        // moves again: the changelog is the one place we cannot describe
        // something the reader will go looking for and not find.
        body_fr: [
            '⚽ Le score se compte pendant le match',
            'Jusqu’ici le score vivait dans la tête des joueurs, et à la fin tout le monde avait un chiffre différent. Du coup on a mis un tableau dans l’app. Tu tournes ton téléphone et tu tapes de ton côté quand ça marque. Au foot comme au padel, avec les points, les jeux et les sets.',
            '',
            '⌚ Compter au poignet, suivre sur l’écran verrouillé',
            'Sur Apple Watch, un doigt suffit pour compter, sans quitter le terrain des yeux. Sur iPhone, le match s’affiche sur l’écran verrouillé et dans la Dynamic Island. Ça se met à jour tout seul.',
            '',
            '🏆 Qui a gagné, qui a marqué',
            'On te demandait déjà comment le match s’était passé, mais ça s’arrêtait là. Maintenant tu déclares aussi tes buts, et une carte avec le terrain et les joueurs part au groupe.',
            '',
            '📊 Des stats sur ton profil',
            'Le profil compte les matchs joués depuis toujours. Les buts, les victoires et les défaites, eux, se remplissent à partir des matchs dont le score a été déclaré. Au padel, les matchs, les sets et les jeux gagnés.',
            '',
            '🔗 Les joueurs croisés sur tes matchs précédents',
            'On se retrouve souvent sur le terrain avec les mêmes personnes, sans jamais les ajouter. L’accueil te les propose, en disant pourquoi : le dernier match ensemble, ou le nombre de fois. Un tap pour l’ajouter à ton équipe, un autre pour passer.',
            '',
            '🤹‍♂️ Stop aux inscriptions sur plusieurs matchs',
            'On voyait de plus en plus de joueurs s’inscrire sur plusieurs matchs en même temps. Sauf que c’est impossible d’être à 2 endroits en même temps. Donc les joueurs que tu vois inscrits à un match ne sont inscrits que sur ce match.',
            '',
            '🚗 Le match dans ton agenda, rappel compris',
            'Une fois inscrit, tu peux ajouter le match au calendrier en un tap, avec le centre et l’adresse. Le rappel se déclenche 30 minutes avant l’heure de partir, et sur iPhone il tient compte du trafic.',
            '',
            '📸 Les photos du match, pour tout le monde',
            'Le bouton photo était là pour tous, mais seuls les Gold pouvaient s’en servir. On trouvait ça dommage, juste au moment où le groupe se raconte le match. Tout le monde peut envoyer ses photos dans la discussion, jusqu’à 3 par message.',
        ].join('\n'),
        body_en: [
            '⚽ The score gets counted during the game',
            'Until now the score lived in the players’ heads, and by the end everyone had a different number. So we put a scoreboard in the app. Turn your phone sideways and tap your side when someone scores. Football and padel alike, with points, games and sets.',
            '',
            '⌚ Count on your wrist, follow on the lock screen',
            'On Apple Watch, one finger is enough to count, without taking your eyes off the pitch. On iPhone, the game shows on the lock screen and in the Dynamic Island. It updates on its own.',
            '',
            '🏆 Who won, who scored',
            'We already asked how the game went, but it stopped there. Now you also declare your goals, and a card with the pitch and the players goes to the group.',
            '',
            '📊 Stats on the profile',
            'The profile has always counted games played. Goals, wins and losses fill up from the games whose score has been declared. In padel, matches, sets and games won.',
            '',
            '🔗 The players from your previous games',
            'You end up on the pitch with the same people over and over, without ever adding them. The home page suggests them, and says why: the last game together, or the number of times. One tap to add them to your team, another to skip.',
            '',
            '🤹‍♂️ No more signing up for several games at once',
            'We were seeing more and more players sign up for several games at the same time. Except nobody can be in 2 places at once. So the players you see signed up to a game are only signed up to that one.',
            '',
            '🚗 The game in your calendar, reminder included',
            'Once you are in, you can add the game to your calendar in one tap, with the centre and the address. The reminder goes off 30 minutes before it is time to leave, and on iPhone it takes traffic into account.',
            '',
            '📸 Photos from the game, for everyone',
            'The photo button was there for everyone, but only Gold members could use it. That felt like a shame, right when the group is going back over the game. Anyone can send photos to the chat now, up to 3 per message.',
        ].join('\n'),
        body_es: [
            '⚽ El marcador se lleva durante el partido',
            'Hasta ahora el marcador vivía en la cabeza de los jugadores, y al final cada uno tenía un número distinto. Así que pusimos un marcador en la app. Giras el teléfono y tocas tu lado cuando alguien marca. En fútbol y en pádel, con puntos, juegos y sets.',
            '',
            '⌚ Contar en la muñeca, seguirlo en la pantalla bloqueada',
            'En Apple Watch, basta un dedo para contar, sin apartar la vista de la pista. En iPhone, el partido aparece en la pantalla bloqueada y en la Dynamic Island. Se actualiza solo.',
            '',
            '🏆 Quién ganó, quién marcó',
            'Ya te preguntábamos qué tal había ido el partido, pero se quedaba ahí. Ahora también declaras tus goles, y una tarjeta con la pista y los jugadores sale al grupo.',
            '',
            '📊 Estadísticas en el perfil',
            'El perfil cuenta los partidos jugados desde siempre. Los goles, las victorias y las derrotas se llenan a partir de los partidos cuyo resultado se ha declarado. En pádel, los partidos, los sets y los juegos ganados.',
            '',
            '🔗 Los jugadores de tus partidos anteriores',
            'Uno acaba coincidiendo en la pista con las mismas personas y nunca las añade. El inicio te las propone, y dice por qué: el último partido juntos, o el número de veces. Un toque para añadirlo a tu equipo, otro para pasar.',
            '',
            '🤹‍♂️ Se acabó apuntarse a varios partidos a la vez',
            'Veíamos cada vez más jugadores apuntarse a varios partidos a la misma hora. Solo que es imposible estar en 2 sitios a la vez. Así que los jugadores que ves apuntados a un partido solo están apuntados a ese.',
            '',
            '🚗 El partido en tu calendario, con recordatorio',
            'Una vez apuntado, puedes añadir el partido al calendario con un toque, con el centro y la dirección. El recordatorio salta 30 minutos antes de la hora de salir, y en iPhone tiene en cuenta el tráfico.',
            '',
            '📸 Las fotos del partido, para todos',
            'El botón de fotos estaba para todos, pero solo los Gold podían usarlo. Nos parecía una pena, justo cuando el grupo repasa el partido. Cualquiera puede enviar sus fotos a la conversación, hasta 3 por mensaje.',
        ].join('\n'),
        body_it: [
            '⚽ Il punteggio si conta durante la partita',
            'Finora il punteggio viveva nella testa dei giocatori, e alla fine ognuno aveva un numero diverso. Quindi abbiamo messo un tabellone nell’app. Giri il telefono e tocchi dalla tua parte quando qualcuno segna. Nel calcio come nel padel, con punti, giochi e set.',
            '',
            '⌚ Contare al polso, seguire sulla schermata di blocco',
            'Su Apple Watch, basta un dito per contare, senza staccare gli occhi dal campo. Su iPhone, la partita compare sulla schermata di blocco e nella Dynamic Island. Si aggiorna da sola.',
            '',
            '🏆 Chi ha vinto, chi ha segnato',
            'Ti chiedevamo già com’era andata la partita, ma finiva lì. Ora dichiari anche i tuoi gol, e una card con il campo e i giocatori parte nel gruppo.',
            '',
            '📊 Statistiche sul profilo',
            'Il profilo conta le partite giocate da sempre. I gol, le vittorie e le sconfitte si riempiono dalle partite di cui è stato dichiarato il risultato. Nel padel, le partite, i set e i giochi vinti.',
            '',
            '🔗 I giocatori incrociati nelle partite precedenti',
            'Ci si ritrova in campo sempre con le stesse persone, senza mai aggiungerle. La home te le propone, e dice perché: l’ultima partita insieme, o quante volte. Un tap per aggiungerlo alla squadra, un altro per passare.',
            '',
            '🤹‍♂️ Basta iscrizioni a più partite insieme',
            'Vedevamo sempre più giocatori iscriversi a più partite alla stessa ora. Solo che è impossibile essere in 2 posti insieme. Quindi i giocatori che vedi iscritti a una partita sono iscritti solo a quella.',
            '',
            '🚗 La partita nel calendario, promemoria compreso',
            'Una volta iscritto, puoi aggiungere la partita al calendario con un tap, con il centro e l’indirizzo. Il promemoria parte 30 minuti prima dell’ora di uscire, e su iPhone tiene conto del traffico.',
            '',
            '📸 Le foto della partita, per tutti',
            'Il pulsante foto c’era per tutti, ma solo i Gold potevano usarlo. Ci sembrava un peccato, proprio quando il gruppo si racconta la partita. Tutti possono mandare le loro foto nella chat, fino a 3 per messaggio.',
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
